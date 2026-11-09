// Parameter shapes and the plugin's own text formats (Parameters.cpp), plus the registry the mock serves.
window.PP = (function () {
  const { SCALES, INSTRUMENTS, DIVS, INTERVALS, GRAINS, HALOS, TECH, keyNames, fieldNames, NOTE } = PH;

  // ---- text, as Parameters.cpp formats it ------------------------------------------------------
  const rint = v => Math.sign(v) * Math.round(Math.abs(v));
  const fmtTime = s => s < 1 ? rint(s * 1000) + ' ms' : s.toFixed(s < 10 ? 2 : 1) + ' s';
  const fmtHz = hz => hz >= 1000 ? (hz / 1000).toFixed(1) + ' kHz' : hz.toFixed(hz < 10 ? 2 : 0) + ' Hz';
  const fmtPct = v => rint(v) + '%';
  const fmtDb = v => v <= -59.5 ? '-inf' : v.toFixed(1) + ' dB';
  const INF = '∞';
  const TEXT = {
    transpose: v => (v > 0 ? '+' : '') + rint(v) + ' st',
    fine: v => v.toFixed(1) + ' ct',
    breathRate: fmtHz,
    attack: fmtTime, decay: fmtTime,
    release: v => v >= 29.5 ? INF : fmtTime(v),
    afterglow: v => v >= 59.5 ? INF : fmtTime(v),
    rate: v => v.toFixed(v < 1 ? 2 : 1) + '/s',
    phrase: v => v === 0 ? 'endless' : rint(v) + ' notes',
    rest: v => v < 0.01 ? 'none' : fmtTime(v),
    cutoff: v => v >= 19500 ? 'open' : fmtHz(v),
    level: fmtDb, volume: fmtDb,
    pan: v => Math.abs(v) < 1 ? 'C' : (v < 0 ? 'L' : 'R') + rint(Math.abs(v)),
    hpf: v => v <= 20.5 ? 'off' : fmtHz(v),
    pitchOct: v => (v > 0 ? '+' : '') + rint(v),
    glide: v => v < 0.0005 ? 'off' : fmtTime(v),
    bendRange: v => '±' + rint(v) + ' st',
    tune: v => v.toFixed(1) + ' Hz',
    ringFreq: fmtHz,
  };
  const PCT = ['bright', 'hit', 'metal', 'breathDepth', 'width', 'sustain', 'cloudMix', 'motion', 'chance', 'ding', 'velocity', 'dynamics', 'chord', 'roll',
    'evolve', 'res', 'sendDelay', 'sendSpace', 'sendShadow', 'drive', 'keyTrack', 'velLevel', 'velBright', 'strange', 'spaceAmount', 'spaceSize', 'shimmer',
    'delayFb', 'delaySpill', 'delayTone', 'ringBend', 'ringMix', 'ringWander', 'ringFeedback', 'shadowAmount', 'drift', 'masterWidth'];
  PCT.forEach(k => { TEXT[k] = fmtPct; });

  // ---- ranges: skew centres (NormalisableRange::setSkewForCentre) and steps -----------------------
  const CENTRE = { attack: 0.15, decay: 4, release: 2.5, afterglow: 6, rate: 0.7, rest: 3, cutoff: 1200, glide: 0.25, ringFreq: 150 };
  const STEP = { breathRate: 0.01, level: 0.1, volume: 0.1, pan: 1, fine: 0.1, tune: 0.1, spaceSize: 1, masterWidth: 1, transpose: 1 };
  const HPF_SEGS = [[0, 0.10, 20, 40], [0.10, 0.75, 40, 400], [0.75, 1, 400, 2000]];

  const KINDS = { float: 0, int: 1, bool: 2, choice: 3 };
  // Accepts the engine's phantam_param_info entry; adds short/kindN/defaultV used by the UI.
  function normalize(p) {
    p.short = p.key; p.kindN = typeof p.kind === 'string' ? KINDS[p.kind] : p.kind; p.defaultV = p.def;
    p.choices = p.choices || []; return p;
  }
  function shape(p) {           // -> { toProp, fromProp, snap } (JUCE NormalisableRange)
    const lo = p.min, hi = p.max;
    if (p.curve === 'hpf') {
      return {
        toProp: hz => { hz = Math.min(2000, Math.max(20, hz)); for (const g of HPF_SEGS) if (hz <= g[3]) return g[0] + (g[1] - g[0]) * Math.log(hz / g[2]) / Math.log(g[3] / g[2]); return 1; },
        fromProp: t => { t = Math.min(1, Math.max(0, t)); for (const g of HPF_SEGS) if (t <= g[1]) return g[2] * Math.pow(g[3] / g[2], (t - g[0]) / (g[1] - g[0])); return 2000; },
        snap: v => v,
      };
    }
    const step = p.step || 0, c = p.centre;
    const skew = p.skew || (c ? Math.log(0.5) / Math.log((c - lo) / (hi - lo)) : 1);
    return {
      toProp: v => { const t = Math.min(1, Math.max(0, (v - lo) / (hi - lo))); return skew !== 1 ? Math.pow(t, skew) : t; },
      fromProp: t => { t = Math.min(1, Math.max(0, t)); return lo + (hi - lo) * (skew !== 1 ? Math.pow(t, 1 / skew) : t); },
      snap: v => { v = Math.min(hi, Math.max(lo, v)); return step > 0 ? Math.min(hi, Math.max(lo, lo + Math.round((v - lo) / step) * step)) : v; },
    };
  }

  function text(p, v) {
    if (p.kindN === 3) { const i = Math.round(v); return (p.choices[i] !== undefined ? p.choices[i] : String(i)); }
    if (p.kindN === 2) return v > 0.5 ? 'on' : 'off';
    if (TEXT[p.short]) return TEXT[p.short](v);
    return rint(v) + (p.unit ? ' ' + p.unit : '');
  }

  // ---- the registry the mock serves (same shape as phantam_param_info) ---------------------------
  const LAYER_ORDER = ['on', 'instrument', 'mode', 'technique', 'scale', 'root', 'octave', 'lock', 'transpose', 'fine', 'keyLow', 'keyHigh',
    'bright', 'hit', 'metal', 'breathRate', 'breathDepth', 'width', 'attack', 'decay', 'sustain', 'release', 'halo', 'cloudMix', 'afterglow', 'motion',
    'rate', 'chance', 'ding', 'sync', 'division', 'style', 'phrase', 'rest', 'fieldLow', 'fieldHigh', 'velocity', 'dynamics', 'chord', 'roll', 'evolve',
    'cutoff', 'res', 'level', 'pan', 'sendDelay', 'sendSpace', 'hpf', 'sendShadow', 'pitchOct', 'filterType', 'drive', 'keyTrack', 'voicing', 'glide',
    'bendRange', 'velLevel', 'velBright', 'mute', 'solo'];
  const MASTER_ORDER = ['tune', 'player', 'strange', 'spaceAmount', 'spaceSize', 'shimmer', 'delayDiv', 'delayDivR', 'delayFb', 'delaySpill', 'delayTone',
    'ringFreq', 'ringBend', 'ringMix', 'ringWander', 'ringFeedback', 'shadowInterval', 'shadowGrain', 'shadowAmount', 'drift', 'masterWidth',
    'spaceOff', 'shadowOff', 'echoOff', 'ringOff', 'scaleShared', 'globalScale', 'globalRoot', 'volume'];

  const ROOTS = NOTE.slice();
  // [name, kind, min, max, unit, choices]
  const SPEC = {
    on: ['On', 2, 0, 1], instrument: ['Instrument', 3, 0, 20, '', INSTRUMENTS.map(i => i.name)], mode: ['Mode', 3, 0, 2, '', ['MIDI', 'Generative', 'Both']],
    technique: ['Technique', 3, 0, 4, '', TECH], scale: ['Scale', 3, 0, 19, '', SCALES.map(s => s.name)], root: ['Root', 3, 0, 11, '', ROOTS],
    octave: ['Octave', 3, 0, 4, '', ['Oct -2', 'Oct -1', 'Oct 0', 'Oct +1', 'Oct +2']], lock: ['Scale Lock', 2, 0, 1],
    transpose: ['Transpose', 1, -24, 24, 'st'], fine: ['Fine', 0, -50, 50, 'ct'], keyLow: ['Key Low', 3, 0, 87, '', keyNames], keyHigh: ['Key High', 3, 0, 87, '', keyNames],
    bright: ['Bright', 0, 0, 100, '%'], hit: ['Hit', 0, 0, 100, '%'], metal: ['Metal', 0, 0, 100, '%'], breathRate: ['Breath Rate', 0, 0.1, 8, 'Hz'],
    breathDepth: ['Breath Depth', 0, 0, 100, '%'], width: ['Width', 0, 0, 100, '%'],
    attack: ['Attack', 0, 0.001, 10, 's'], decay: ['Decay', 0, 0.05, 30, 's'], sustain: ['Sustain', 0, 0, 100, '%'], release: ['Release', 0, 0.01, 30, 's'],
    halo: ['Halo', 3, 0, 5, '', HALOS], cloudMix: ['Halo Amount', 0, 0, 100, '%'], afterglow: ['Afterglow', 0, 0, 60, 's'], motion: ['Halo Motion', 0, 0, 100, '%'],
    rate: ['Player Rate', 0, 0.05, 6, '/s'], chance: ['Chance', 0, 0, 100, '%'], ding: ['Ding', 0, 0, 100, '%'], sync: ['Player Sync', 2, 0, 1],
    division: ['Player Division', 3, 0, 7, '', DIVS], style: ['Player Style', 3, 0, 3, '', ['Random', 'Wander', 'Motif', 'Arp']],
    phrase: ['Phrase', 1, 0, 16], rest: ['Rest', 0, 0, 20, 's'], fieldLow: ['Player From', 3, 0, 9, '', fieldNames], fieldHigh: ['Player To', 3, 0, 9, '', fieldNames],
    velocity: ['Player Velocity', 0, 0, 100, '%'], dynamics: ['Player Dynamics', 0, 0, 100, '%'], chord: ['Player Chord', 0, 0, 100, '%'],
    roll: ['Player Roll', 0, 0, 100, '%'], evolve: ['Player Evolve', 0, 0, 100, '%'],
    cutoff: ['Filter', 0, 40, 20000, 'Hz'], res: ['Resonance', 0, 0, 100, '%'], level: ['Level', 0, -60, 6, 'dB'], pan: ['Pan', 0, -100, 100, ''],
    sendDelay: ['Echo Send', 0, 0, 100, '%'], sendSpace: ['Space Send', 0, 0, 100, '%'], hpf: ['High-pass', 0, 20, 2000, 'Hz'], sendShadow: ['Shadow Send', 0, 0, 100, '%'],
    pitchOct: ['Octave', 1, -3, 3], filterType: ['Filter Type', 3, 0, 2, '', ['LP', 'BP', 'HP']], drive: ['Drive', 0, 0, 100, '%'], keyTrack: ['Key Track', 0, 0, 100, '%'],
    voicing: ['Voicing', 3, 0, 2, '', ['Poly', 'Mono', 'Legato']], glide: ['Glide', 0, 0, 2, 's'], bendRange: ['Bend Range', 1, 0, 24, 'st'],
    velLevel: ['Vel to Level', 0, 0, 100, '%'], velBright: ['Vel to Tone', 0, 0, 100, '%'], mute: ['Mute', 2, 0, 1], solo: ['Solo', 2, 0, 1],
    tune: ['Tune A4', 0, 415, 466, 'Hz'], player: ['Player Running', 2, 0, 1], strange: ['Strange', 0, 0, 100, '%'], spaceAmount: ['Space Amount', 0, 0, 100, '%'],
    spaceSize: ['Space Size', 0, 50, 200, '%'], shimmer: ['Space Shimmer', 0, 0, 100, '%'], delayDiv: ['Echo Left', 3, 0, 7, '', DIVS], delayDivR: ['Echo Right', 3, 0, 7, '', DIVS],
    delayFb: ['Echo Feedback', 0, 0, 95, '%'], delaySpill: ['Echo Spill', 0, 0, 100, '%'], delayTone: ['Echo Tone', 0, 0, 100, '%'],
    ringFreq: ['Ring Freq', 0, 5, 4000, 'Hz'], ringBend: ['Ring Bend', 0, 0, 100, '%'], ringMix: ['Ring Mix', 0, 0, 100, '%'], ringWander: ['Ring Wander', 0, 0, 100, '%'],
    ringFeedback: ['Ring Feedback', 0, 0, 100, '%'], shadowInterval: ['Shadow Interval', 3, 0, 2, '', INTERVALS], shadowGrain: ['Shadow Grain', 3, 0, 3, '', GRAINS],
    shadowAmount: ['Shadow Amount', 0, 0, 100, '%'], drift: ['Drift', 0, 0, 100, '%'], masterWidth: ['Master Width', 0, 0, 200, '%'],
    spaceOff: ['Space Bypass', 2, 0, 1], shadowOff: ['Shadow Bypass', 2, 0, 1], echoOff: ['Echo Bypass', 2, 0, 1], ringOff: ['Ring Bypass', 2, 0, 1],
    scaleShared: ['Scale Locked', 2, 0, 1], globalScale: ['Locked Scale', 3, 0, 19, '', SCALES.map(s => s.name)], globalRoot: ['Locked Root', 3, 0, 11, '', ROOTS],
    volume: ['Master', 0, -60, 6, 'dB'],
  };
  // First Light (the plugin's default state): LayerParams defaults, then FirstLight.h per layer.
  const LD = { on: 1, instrument: 0, mode: 2, technique: 0, scale: 0, root: 2, octave: 2, lock: 0, transpose: 0, fine: 0, keyLow: 0, keyHigh: 87, bright: 50, hit: 40, metal: 0,
    breathRate: 5.5, breathDepth: 25, width: 70, attack: 0.002, decay: 7, sustain: 0, release: 4, halo: 0, cloudMix: 30, afterglow: 3, motion: 20, rate: 0.5, chance: 70, ding: 15,
    sync: 0, division: 2, style: 1, phrase: 6, rest: 3, fieldLow: 0, fieldHigh: 9, velocity: 65, dynamics: 50, chord: 10, roll: 5, evolve: 25, cutoff: 20000, res: 0, level: -6, pan: 0,
    sendDelay: 20, sendSpace: 80, hpf: 20, sendShadow: 0, pitchOct: 0, filterType: 0, drive: 0, keyTrack: 0, voicing: 0, glide: 0, bendRange: 2, velLevel: 100, velBright: 100, mute: 0, solo: 0 };
  const FL = [
    { width: 80, afterglow: 4, motion: 25, style: 1, phrase: 6, rest: 3 },
    { instrument: 2, mode: 1, scale: 1, octave: 3, level: -12, pan: -30, cloudMix: 60, rate: 0.35, sendSpace: 100, width: 100, afterglow: 12, motion: 50, decay: 9, style: 2, phrase: 5, evolve: 30, rest: 4, velocity: 50 },
    { instrument: 12, mode: 0, scale: 3, octave: 1, level: -8, cutoff: 3000, cloudMix: 15, width: 40, attack: 0.4, decay: 5, sustain: 80, release: 8, afterglow: 6, motion: 20, sendSpace: 60 },
    { on: 0, instrument: 11, mode: 1, scale: 2, octave: 2, halo: 5, level: -14, pan: 30, cloudMix: 85, width: 100, afterglow: 60, motion: 70, style: 0, phrase: 0 },
  ];
  const MD = { tune: 440, player: 0, strange: 0, spaceAmount: 40, spaceSize: 60, shimmer: 0, delayDiv: 3, delayDivR: 4, delayFb: 45, delaySpill: 35, delayTone: 55, ringFreq: 180,
    ringBend: 30, ringMix: 0, ringWander: 30, ringFeedback: 0, shadowInterval: 0, shadowGrain: 1, shadowAmount: 60, drift: 0, masterWidth: 120, spaceOff: 0, shadowOff: 0,
    echoOff: 0, ringOff: 0, scaleShared: 0, globalScale: 0, globalRoot: 2, volume: 0 };

  function registry() {
    const out = [];
    const add = (short, layer) => {
      const s = SPEC[short];
      const kindStep = s[1] >= 1 ? 1 : (STEP[short] !== undefined ? STEP[short] : (CENTRE[short] ? 0 : 0.1));
      out.push({ i: out.length, id: layer >= 0 ? 'L' + (layer + 1) + '_' + short : short, key: short, name: (layer >= 0 ? 'L' + (layer + 1) + ' ' : '') + s[0], layer,
        kind: ['float', 'int', 'bool', 'choice'][s[1]], min: s[2], max: s[3], step: kindStep, centre: CENTRE[short],
        def: layer >= 0 ? (FL[layer][short] !== undefined ? FL[layer][short] : LD[short]) : MD[short], unit: s[4] || '', choices: s[5] || [],
        curve: short === 'hpf' ? 'hpf' : undefined });
    };
    MASTER_ORDER.forEach(k => add(k, -1));
    for (let l = 0; l < 4; l++) LAYER_ORDER.forEach(k => add(k, l));
    return out;
  }

  return { text, shape, normalize, registry, TEXT, CENTRE };
})();
