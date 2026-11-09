// AudioWorkletProcessor for the HOLYphantam wasm engine.
// In:  {set:[idx,v]} {setAll:[[idx,v],..]} {preset:i} {play:bool} {note:[n,v]} {noteoff:n} {pad:[layer,n,v]} {padoff:[layer,n]}
// Out: {ready:true,legacy} {params:[...]} after a preset load, and ~30 times a second {strikes:[[note,layer],..]} {levels:[4]}
class PhantamProcessor extends AudioWorkletProcessor {
  constructor(opts) {
    super();
    this.ready = false; this.strikes = []; this.frames = 0; this.every = Math.round(sampleRate / 30);
    const imports = { env: { emscripten_notify_memory_growth: () => {} } };
    WebAssembly.instantiate(opts.processorOptions.wasm, imports).then(({ instance }) => {
      const x = this.x = instance.exports;
      if (x._initialize) x._initialize();
      x.phantam_create(sampleRate);
      this.legacy = !x.phantam_param_set;      // an engine without the parameter API: hands, presets and play only
      this.pL = x.malloc(128 * 4); this.pR = x.malloc(128 * 4);
      this.pNotes = x.malloc(64 * 4); this.pLayers = x.malloc(64 * 4);
      this.ready = true;
      this.port.postMessage({ ready: true, legacy: this.legacy });
    }).catch(e => this.port.postMessage({ error: String(e) }));
    this.port.onmessage = (e) => {
      if (!this.ready) return;
      const m = e.data, x = this.x;
      if (m.set && !this.legacy) x.phantam_param_set(m.set[0], m.set[1]);
      else if (m.setAll && !this.legacy) for (const [i, v] of m.setAll) x.phantam_param_set(i, v);
      else if (m.preset !== undefined) {
        x.phantam_load_preset(m.preset);
        if (!this.legacy) { const n = x.phantam_param_count(), a = []; for (let i = 0; i < n; i++) a.push(x.phantam_param_get(i)); this.port.postMessage({ params: a }); }
      }
      else if (m.play !== undefined) x.phantam_play(m.play ? 1 : 0);
      else if (m.note) x.phantam_note_on(m.note[0], m.note[1]);
      else if (m.noteoff !== undefined) x.phantam_note_off(m.noteoff);
      else if (m.pad) { if (this.legacy) x.phantam_pad_on(m.pad[1], m.pad[2]); else x.phantam_pad_on_layer(m.pad[0], m.pad[1], m.pad[2]); }
      else if (m.padoff) { if (this.legacy) x.phantam_pad_off(m.padoff[1]); else x.phantam_pad_off_layer(m.padoff[0], m.padoff[1]); }
    };
  }
  process(inputs, outputs) {
    const out = outputs[0];
    if (!this.ready) return true;
    const x = this.x, n = out[0].length;
    x.phantam_process(this.pL, this.pR, n);
    const buf = x.memory.buffer;
    out[0].set(new Float32Array(buf, this.pL, n));
    if (out[1]) out[1].set(new Float32Array(buf, this.pR, n));
    const k = x.phantam_poll_strikes_ex(this.pNotes, this.pLayers, 64);
    if (k) {
      const nn = new Int32Array(x.memory.buffer, this.pNotes, k), ll = new Int32Array(x.memory.buffer, this.pLayers, k);
      for (let i = 0; i < k; i++) this.strikes.push([nn[i], ll[i]]);
    }
    this.frames += n;
    if (this.frames >= this.every) {
      this.frames = 0;
      if (this.strikes.length) { this.port.postMessage({ strikes: this.strikes.slice(0, 64) }); this.strikes = []; }
      if (!this.legacy) this.port.postMessage({ levels: [0, 1, 2, 3].map(l => x.phantam_layer_level(l)) });
    }
    return true;
  }
}
registerProcessor('phantam', PhantamProcessor);
