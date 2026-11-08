// HOLYphantam's own engine (Source/DSP compiled to WebAssembly, see ../holyphantam-wasm) inside an AudioWorklet.
// In:  {pad, v} {padoff} (the hands, on the shown layer)  {param, value}  {preset}  {play}
// Out: {ready, presets}  {sound: {scale, scaleName, params}} after every preset  {strikes: [notes]}
class PhantamProcessor extends AudioWorkletProcessor {
  constructor(opts) {
    super();
    this.ready = false;
    this.frames = 0;
    const imports = {
      env: { emscripten_notify_memory_growth: () => {} },
      wasi_snapshot_preview1: new Proxy({}, { get: () => () => 0 }),
    };
    WebAssembly.instantiate(opts.processorOptions.wasm, imports).then(({ instance }) => {
      const x = this.x = instance.exports;
      if (x._initialize) x._initialize();
      x.phantam_create(sampleRate);
      this.pL = x.malloc(128 * 4);
      this.pR = x.malloc(128 * 4);
      this.buf = x.malloc(512);
      this.ready = true;
      const presets = [];
      for (let i = 0, n = x.phantam_preset_count(); i < n; i++) { x.phantam_preset_name(i, this.buf, 64); presets.push(this.text()); }
      this.port.postMessage({ ready: true, presets });
    }).catch(e => this.port.postMessage({ error: String(e) }));
    this.port.onmessage = e => {
      if (!this.ready) return;
      const m = e.data, x = this.x;
      if (m.pad !== undefined) x.phantam_pad_on(m.pad, m.v ?? 0.8);
      else if (m.padoff !== undefined) x.phantam_pad_off(m.padoff);
      else if (m.param !== undefined) x.phantam_set_param(m.param, m.value);
      else if (m.preset !== undefined) { x.phantam_load_preset(m.preset); this.port.postMessage({ sound: this.sound() }); }
      else if (m.play !== undefined) x.phantam_play(m.play ? 1 : 0);
    };
  }
  text() {
    const b = new Uint8Array(this.x.memory.buffer, this.buf, 64);
    let s = "";
    for (let i = 0; i < 64 && b[i]; i++) s += String.fromCharCode(b[i]);
    return s;
  }
  sound() {
    const x = this.x;
    const n = x.phantam_scale_notes(this.buf, 32);
    const scale = Array.from(new Int32Array(x.memory.buffer, this.buf, n));
    x.phantam_scale_name(this.buf, 64);
    return { scale, scaleName: this.text(), params: [0, 1, 2, 3, 4, 5].map(i => x.phantam_get_param(i)) };
  }
  process(inputs, outputs) {
    const out = outputs[0];
    if (!this.ready) return true;
    const n = out[0].length, x = this.x;
    x.phantam_process(this.pL, this.pR, n);
    const mem = x.memory.buffer;
    out[0].set(new Float32Array(mem, this.pL, n));
    if (out[1]) out[1].set(new Float32Array(mem, this.pR, n));
    // every struck note (player or hands) lights its field, checked about every 20 ms
    if ((this.frames += n) >= 1024) {
      this.frames = 0;
      const k = x.phantam_poll_strikes(this.buf, 32);
      if (k > 0) this.port.postMessage({ strikes: Array.from(new Int32Array(x.memory.buffer, this.buf, k)) });
    }
    return true;
  }
}
registerProcessor("phantam", PhantamProcessor);
