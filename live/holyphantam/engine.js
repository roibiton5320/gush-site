// The model (every parameter, presets, undo, layer info) on the real wasm engine run on the main thread, with a silent
// mock as the fallback; and the audio side (AudioContext + worklet running the same wasm).
window.Engine = (function () {
  const dec = new TextDecoder();
  async function loadRaw() {
    const bytes = await (await fetch('phantam.wasm')).arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes, { env: { emscripten_notify_memory_growth() {} } });
    const x = instance.exports; if (x._initialize) x._initialize();
    for (const f of ['phantam_param_count', 'phantam_param_info', 'phantam_param_get', 'phantam_param_set', 'phantam_layer_info', 'phantam_preset_count', 'phantam_load_preset'])
      if (!x[f]) throw new Error('engine lacks ' + f);
    x.phantam_create(48000);
    const str = (p, max) => { const b = new Uint8Array(x.memory.buffer, p, max); let n = 0; while (n < max && b[n]) n++; return dec.decode(b.subarray(0, n)); };
    const need = x.phantam_param_info(0, 0), buf = x.malloc(need + 64); x.phantam_param_info(buf, need + 64);
    const info = JSON.parse(str(buf, need + 64)); x.free && x.free(buf);
    const sb = x.malloc(2048);
    const names = []; for (let i = 0; i < x.phantam_preset_count(); i++) { x.phantam_preset_name(i, sb, 64); names.push(str(sb, 64)); }
    return {
      mock: false, bytes, info: () => info,
      get: i => x.phantam_param_get(i), set: (i, v) => x.phantam_param_set(i, v),
      presetNames: () => names, loadPreset: i => x.phantam_load_preset(i),
      layerInfo: l => { x.phantam_layer_info(l, sb, 2048); return JSON.parse(str(sb, 2048)); },
    };
  }

  async function createModel(onAudio) {
    let raw, bytes = null;
    try { raw = await loadRaw(); bytes = raw.bytes; }
    catch (e) { console.warn('real engine not available, using the mock:', e); raw = window.createMockRaw(); }
    const info = raw.info(); info.forEach(PP.normalize);
    const shapes = info.map(p => PP.shape(p));
    const lookup = {}; info.forEach(p => { lookup[p.layer + ':' + p.key] = p.i; });
    const vals = info.map(p => raw.get(p.i));
    const M = {
      raw, mock: raw.mock, bytes, info, shapes, version: 0, undo: [], redo: [], dirty: false, name: 'First Light', presets: raw.presetNames(),
      idx: (layer, key) => lookup[layer + ':' + key],
      val: i => vals[i],
      get: (layer, key) => vals[lookup[layer + ':' + key]],
      set(i, v, quiet) {
        const p = info[i]; v = shapes[i].snap(v); if (p.kindN >= 1) v = Math.round(v);
        const st = raw.set(i, v); v = (typeof st === 'number' && !isNaN(st)) ? st : v;
        if (v === vals[i]) return;
        vals[i] = v; M.version++; M.dirty = true; onAudio({ set: [i, v] });
      },
      put(layer, key, v) { M.set(lookup[layer + ':' + key], v); },
      snapshot: () => vals.slice(),
      restore(s) { let ch = 0; s.forEach((v, i) => { if (v !== vals[i]) { M.set(i, v); ch++; } }); return ch; },
      checkpoint() { M.undo.push(vals.slice()); if (M.undo.length > 40) M.undo.shift(); M.redo.length = 0; },
      doUndo() { if (!M.undo.length) return false; M.redo.push(vals.slice()); M.restore(M.undo.pop()); return true; },
      doRedo() { if (!M.redo.length) return false; M.undo.push(vals.slice()); M.restore(M.redo.pop()); return true; },
      loadPreset(n) {
        M.checkpoint(); raw.loadPreset(n);
        info.forEach(p => { vals[p.i] = raw.get(p.i); });
        M.version++; M.dirty = true; M.name = M.presets[n]; M.cur = n; onAudio({ preset: n });
      },
      layerInfo: l => raw.layerInfo(l),
    };
    M.cur = 1;
    return M;
  }

  // ---- audio ---------------------------------------------------------------------------------
  function createAudio(getBytes, getAll, getPlay, onMsg, onStart) {
    const A = { ctx: null, node: null, ready: false, started: false, starting: false };
    A.post = m => { if (A.node && A.ready) A.node.port.postMessage(m); };
    A.tap = async () => {
      try {
        if (!A.ctx && !A.starting) {
          A.starting = true;
          const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return;
          A.ctx = new Ctx({ latencyHint: 'interactive' });
          A.ctx.resume();
          const bytes = getBytes();
          if (!bytes) return;
          await A.ctx.audioWorklet.addModule('worklet.js');
          A.node = new AudioWorkletNode(A.ctx, 'phantam', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2], processorOptions: { wasm: bytes } });
          A.node.port.onmessage = e => {
            const m = e.data;
            if (m.ready) { A.ready = true; A.legacy = m.legacy; A.post({ setAll: getAll() }); A.post({ play: getPlay() }); }
            if (m.error) console.warn('worklet:', m.error);
            onMsg(m);
          };
          A.node.connect(A.ctx.destination);
          A.started = true; onStart();
        }
        if (A.ctx && A.ctx.state !== 'running') await A.ctx.resume();
      } catch (e) { console.warn('audio', e); }
    };
    return A;
  }
  return { createModel, createAudio };
})();
