// Fallback engine for the model, used only if phantam.wasm fails to load: same raw API the wasm gives
// (info, get, set, presets, layerInfo), no sound. Built from my own reading of Parameters.cpp.
window.createMockRaw = function () {
  const info = PP.registry(); info.forEach(PP.normalize);
  const byKey = {}; info.forEach(p => { byKey[(p.layer + 2) + ':' + p.key] = p; });
  const val = info.map(p => p.def);
  const shapes = info.map(p => PP.shape(p));
  const names = PHANTAM_PRESETS.map(p => p.name);
  let cur = 1;
  const legal = (p, v) => { v = shapes[p.i].snap(v); return p.kindN >= 1 ? Math.round(v) : v; };
  return {
    mock: true,
    info: () => info,
    get: i => val[i],
    set: (i, v) => { val[i] = legal(info[i], v); return val[i]; },
    presetNames: () => names,
    loadPreset(n) {
      const keep = { player: val[1], volume: val[28], scaleShared: val[info.findIndex(p => p.key === 'scaleShared')] };
      info.forEach(p => { val[p.i] = p.def; });
      PHANTAM_PRESETS[n].c.forEach(([l, id, v]) => { const p = byKey[(l - 1 + 2) + ':' + id]; if (p) val[p.i] = legal(p, v); });
      val[1] = keep.player; val[28] = keep.volume; cur = n;
    },
    layerInfo(l) {
      const g = k => val[byKey[(l + 2) + ':' + k].i], G = k => val[byKey[(1) + ':' + k].i];
      let sc = g('scale'), root = g('root');
      if (G('scaleShared') > 0.5) { sc = G('globalScale'); root = G('globalRoot'); }
      const ding = 48 + root + 12 * (g('octave') - 2);
      return { layer: l, on: g('on'), mode: g('mode'), instrument: g('instrument'), scale: sc, root, ding, fields: PH.SCALES[sc].offsets.map(o => ding + o), keyLow: 21 + g('keyLow'), keyHigh: 21 + g('keyHigh') };
    },
    sendNote() {}, 
  };
};
