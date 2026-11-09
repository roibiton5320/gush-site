(async function () {
  const TWO = Math.PI * 2;
  const { C, HELP: H } = PH, { box, help, canvas, knob, seg, toggle, ibtn, combo, menu, closeMenu, st, groupHeader } = UI;
  const win = document.getElementById('win');
  const inFrame = window.parent !== window;
  const post = (type) => { if (inFrame) { try { window.parent.postMessage({ gushLive: type, name: M ? M.name : '' }, '*'); } catch (e) {} } };
  const NKEYS = 'awsedftgyhujk';

  // ---------------------------------------------------------------- model + audio
  let M = null, audio = null, selected = 0, playerPage = false, keyOctave = 0, techOverride = -1, shownBpm = 100;
  const vis = [0, 1, 2, 3].map(() => ({ n: 0, notes: [], glow: new Array(10).fill(0), meter: 0, particles: [], info: null, infoV: -1 }));
  const keyLit = new Float32Array(128), held = new Set();
  const updaters = [];
  let userPresets = {}; try { userPresets = JSON.parse(localStorage.getItem('ph_user_presets') || '{}'); } catch (e) {}
  const sendAudio = m => audio && audio.post(m);
  M = await Engine.createModel(sendAudio);
  audio = Engine.createAudio(() => M.bytes, () => M.info.map(p => [p.i, M.val(p.i)]), () => M.get(-1, 'player') > .5, onAudioMsg, () => { post('start'); hint.style.opacity = 0; });
  const get = (l, k) => M.get(l === 'sel' ? selected : l, k);
  const env = { M, win, sel: () => selected, set: (i, v) => { M.set(i, v); markEdited(); }, touch() {} };
  let edited = false; const markEdited = () => { edited = true; };

  function onAudioMsg(m) {
    if (m.strikes) for (const [note, layer] of m.strikes) strike(layer, note);
    if (m.levels) m.levels.forEach((v, i) => { vis[i].lv = v; });
  }
  function layerVis(l) {
    const v = vis[l];
    if (v.infoV !== M.version) { try { v.info = M.layerInfo(l); } catch (e) { v.info = null; } v.infoV = M.version; }
    const f = v.info && v.info.fields && v.info.fields.length ? v.info.fields : [48 + get(l, 'root') + 12 * (get(l, 'octave') - 2)];
    v.notes = f; v.n = f.length; return v;
  }
  function strike(layer, note) {
    const v = layerVis(layer), pc = ((note % 12) + 12) % 12; let best = -1, bd = 99;
    v.notes.forEach((n, i) => { if (((n % 12) + 12) % 12 === pc) { const d = Math.abs(n - note); if (d < bd) { bd = d; best = i; } } });
    if (best >= 0) v.glow[best] = 1;
    if (note >= 12 && note <= 127) keyLit[note] = 1;
    v.pulse = (v.pulse || 0) + 1;
    v.struck = 1;
  }
  const heard = l => {
    let anySolo = false; for (let i = 0; i < 4; i++) anySolo = anySolo || get(i, 'solo') > .5;
    return get(l, 'on') > .5 && get(l, 'mute') < .5 && (!anySolo || get(l, 'solo') > .5);
  };

  // ---------------------------------------------------------------- randomiser (Randomizer.cpp)
  const R = { u: (a, b) => a + (b - a) * Math.random(), lu: (a, b) => a * Math.pow(b / a, Math.random()), ch: p => Math.random() < p, pick: a => a[Math.floor(Math.random() * a.length)], sur: () => Math.random() < .25, int: n => Math.floor(Math.random() * n) };
  const roleOf = i => { const o = M.get(i, 'octave') - 2; return o <= -2 ? 0 : o === -1 ? 1 : o === 0 ? 2 : 3; };
  const S = (l, k, v) => M.put(l, k, v), G = (k, v) => M.put(-1, k, v);
  const D = {
    instrument(i, role) {
      const sub = [12, 12, 8, 4], low = [4, 1, 5, 0, 19, 20, 15], mid = [0, 1, 5, 2, 7, 13, 17, 18], high = [3, 9, 2, 11, 10, 14, 16];
      S(i, 'instrument', R.sur() ? R.int(21) : R.pick([sub, low, mid, high][role]));
    },
    material(i) { S(i, 'bright', R.u(30, 75)); S(i, 'hit', R.u(25, 80)); S(i, 'metal', R.sur() ? R.u(40, 100) : R.u(0, 20)); },
    envelope(i, role) {
      if (R.sur()) { S(i, 'attack', R.lu(.4, 3)); S(i, 'decay', R.lu(6, 25)); S(i, 'sustain', R.u(40, 90)); S(i, 'release', R.ch(.4) ? 30 : R.lu(6, 20)); return; }
      if (role === 0) { S(i, 'attack', R.lu(.05, .5)); S(i, 'decay', R.lu(4, 12)); S(i, 'sustain', R.u(30, 70)); S(i, 'release', R.lu(2, 6)); return; }
      S(i, 'attack', R.lu(.001, .03)); S(i, 'decay', role === 3 ? R.lu(1, 4) : R.lu(2.5, 10)); S(i, 'sustain', 0); S(i, 'release', role === 3 ? R.lu(.8, 3) : R.lu(1.5, 5));
    },
    halo(i, role) {
      if (R.sur()) { S(i, 'halo', 2 + R.int(4)); S(i, 'cloudMix', R.u(45, 85)); S(i, 'afterglow', R.ch(.3) ? 60 : R.lu(10, 40)); S(i, 'motion', R.u(50, 100)); return; }
      const sh = role === 3 ? R.ch(.5) : role === 2 ? R.ch(.2) : false; S(i, 'halo', sh ? 1 : 0);
      const a = [[0, 8], [10, 30], [20, 45], [25, 55]][role]; S(i, 'cloudMix', R.u(a[0], a[1])); S(i, 'afterglow', R.lu(1, 8)); S(i, 'motion', R.u(10, 60));
    },
    filter(i, role) {
      const lo = [120, 500, 2000, 6000][role], hi = [250, 1500, 7000, 20000][role], cut = R.lu(lo, hi);
      if (R.sur()) { S(i, 'cutoff', Math.min(12000, Math.max(60, cut * R.u(.5, 2)))); S(i, 'res', R.u(50, 85)); S(i, 'hpf', 20); return; }
      const lp = role === 3 && R.ch(.5) ? 20000 : cut; S(i, 'cutoff', lp); S(i, 'res', role === 0 || role === 3 ? 0 : R.u(0, 25));
      let hp = 20; if (role === 1) { if (R.ch(.5)) hp = R.lu(30, 60); } else if (role === 2) hp = R.lu(80, 200); else if (role === 3) hp = R.lu(200, 600);
      S(i, 'hpf', hp <= 20 ? 20 : Math.max(20, Math.min(hp, lp * .5)));
    },
    sends(i, role) {
      const e = [[0, 0], [0, 15], [10, 30], [15, 40]][role], sp = [[0, 15], [20, 40], [35, 60], [45, 75]][role], wild = R.sur() && role !== 0;
      S(i, 'sendDelay', wild ? R.u(50, 80) : R.u(e[0], e[1])); S(i, 'sendSpace', wild ? R.u(75, 100) : R.u(sp[0], sp[1]));
      const sh = [[0, 0], [0, 10], [0, 35], [10, 50]][role]; S(i, 'sendShadow', R.ch(.5) ? R.u(sh[0], sh[1]) : 0);
    },
    breath(i, role) { const w = R.sur(); S(i, 'breathRate', w ? R.u(.2, 3) : R.u(4, 8)); S(i, 'breathDepth', w ? R.u(40, 70) : R.u(0, 25)); S(i, 'width', role === 0 ? R.u(20, 40) : R.u(60, 100)); },
    player(i, role) {
      const rate = [[.15, .35], [.3, .6], [.5, 1], [1, 3]][role], ch = [[50, 80], [50, 75], [45, 70], [6, 20]][role], sty = [[1, 1], [1, 2], [2, 1], [0, 1]][role];
      S(i, 'style', sty[R.int(2)]); S(i, 'rate', R.lu(rate[0], rate[1])); S(i, 'chance', R.u(ch[0], ch[1])); S(i, 'ding', role === 0 ? R.u(40, 70) : R.u(5, 25));
      S(i, 'phrase', role === 3 ? 0 : 3 + R.int(5)); S(i, 'rest', R.u(1, 6)); S(i, 'velocity', role === 3 ? R.u(20, 45) : R.u(45, 75)); S(i, 'dynamics', R.u(20, 50));
      S(i, 'chord', R.u(0, 15)); S(i, 'roll', R.u(0, 8)); S(i, 'evolve', R.u(10, 40));
      if (R.sur()) { if (R.ch(.5)) { S(i, 'style', 3); S(i, 'rate', R.lu(1.5, 4)); } else { S(i, 'roll', R.u(25, 45)); S(i, 'chord', R.u(30, 50)); } }
    },
    layer(i, role) { D.instrument(i, role); D.material(i); D.envelope(i, role); D.halo(i, role); D.filter(i, role); D.sends(i, role); D.breath(i, role); },
    place(i, role) {
      const oct = role === 3 ? 1 + R.int(2) : [-2, -1, 0, 1][role];
      S(i, 'octave', oct + 2); S(i, 'level', [-6, -9, -10, -16][role] + R.u(-1.5, 1.5)); S(i, 'pan', role === 0 ? 0 : (i % 2 === 0 ? 1 : -1) * R.u(10, 30));
    },
    space() { if (R.sur()) { G('spaceAmount', R.u(60, 80)); G('spaceSize', R.u(150, 200)); G('shimmer', R.u(30, 60)); return; } G('spaceAmount', R.u(25, 50)); G('spaceSize', R.u(80, 140)); G('shimmer', R.u(0, 15)); },
    echo() {
      const pr = R.pick([[3, 4], [2, 6], [6, 4], [3, 7], [2, 5], [1, 3]]), fl = R.ch(.5); G('delayDiv', pr[fl ? 1 : 0]); G('delayDivR', pr[fl ? 0 : 1]);
      if (R.sur()) { G('delayFb', R.u(60, 85)); G('delaySpill', R.u(70, 100)); G('delayTone', R.u(20, 90)); return; }
      G('delayFb', R.u(20, 50)); G('delaySpill', R.u(15, 60)); G('delayTone', R.u(40, 75));
    },
    ring() { G('ringFreq', R.lu(6, 1500)); G('ringBend', R.u(0, 100)); G('ringMix', R.u(15, 60)); G('ringWander', R.sur() ? R.u(70, 100) : R.u(10, 50)); G('ringFeedback', R.sur() ? R.u(40, 85) : 0); },
    shadow() { G('shadowInterval', R.ch(.6) ? 0 : R.ch(.5) ? 1 : 2); G('shadowGrain', R.int(4)); G('shadowAmount', R.u(35, 80)); },
    everything() {
      const on = []; for (let i = 0; i < 4; i++) if (get(i, 'on') > .5) on.push(i);
      const sp = [[2], [1, 3], [1, 2, 3], [0, 1, 2, 3]][Math.max(0, on.length - 1)] || [2];
      on.forEach((l, k) => { const role = sp[k]; D.place(l, role); D.layer(l, role); D.player(l, role); });
      D.space(); D.echo(); D.shadow(); if (R.sur()) D.ring(); else G('ringMix', 0); G('strange', R.sur() ? R.u(10, 35) : 0);
    },
  };
  function roll(group, layer) {
    M.checkpoint(); markEdited();
    const role = roleOf(layer);
    if (['material', 'breath'].includes(group) && group === 'material') D.material(layer);
    else if (['space', 'echo', 'ring', 'shadow', 'everything'].includes(group)) D[group]();
    else D[group](layer, role);
    refreshAll();
  }

  // ---------------------------------------------------------------- header
  const hd = box(win, 0, 0, 1180, 56, '');
  box(win, 0, 55, 1180, 1, 'line'); box(win, 0, 147, 1180, 1, 'line'); box(win, 0, 640, 1180, 1, 'line');
  box(win, 340, 148, 1, 492, 'line'); box(win, 890, 148, 1, 492, 'line'); box(win, 891, 148, 289, 492, '').style.background = C.panel;
  const wm = box(hd, 20, 0, 180, 56, 'fl'); wm.textContent = 'HOLYphantam';
  wm.style.cssText += ';font-family:var(--disp);font-size:calc(25px*var(--kd));letter-spacing:.06em;cursor:pointer;white-space:nowrap';
  const ver = box(hd, 192, 8, 40, 40, ''); ver.textContent = '1.2.1'; ver.style.cssText += ';font-family:var(--mono);font-size:calc(10px*var(--km));color:var(--copper);pointer-events:none';
  // preset bar
  const pbar = box(hd, 226, 14, 330, 28, '');
  const mkSmall = (x, icon, helpKey, fn) => ibtn(pbar, x, 1, 26, 26, icon, '', H[helpKey], fn);
  mkSmall(0, 'Left', 'presetPrev', () => stepPreset(-1)); mkSmall(270, 'Right', 'presetNext', () => stepPreset(1));
  ibtn(pbar, 300, 1, 30, 26, 'Save', '', H.presetSave, () => askSave());
  const pname = box(pbar, 30, 0, 236, 28, 'combo'); pname.style.cssText += ';padding-left:10px;font-family:var(--disp);font-size:calc(17px*var(--kd))'; help(pname, H.presetName);
  pname.innerHTML = '<span class="nowrap" style="width:210px"></span><i></i>';
  const pnameT = pname.firstChild;
  const pedit = document.createElement('input'); pedit.placeholder = 'Name this sound'; pedit.maxLength = 60;
  pedit.style.cssText = 'position:absolute;left:30px;top:0;width:236px;height:28px;display:none;background:var(--panel);border:1px solid var(--copper);border-radius:3px;padding:3px 9px;font-family:var(--disp);font-size:calc(17px*var(--kd));color:var(--ink);outline:none;-webkit-user-select:text;user-select:text';
  pbar.appendChild(pedit);
  function askSave() { pedit.value = M.name.replace(/\*+$/, ''); pedit.style.display = 'block'; pedit.focus(); pedit.select(); }
  function finishSave(keep) {
    if (pedit.style.display === 'none') return; pedit.style.display = 'none';
    const n = pedit.value.trim().replace(/[\\/:*?"<>|]/g, '');
    if (keep && n) { userPresets[n] = M.snapshot(); try { localStorage.setItem('ph_user_presets', JSON.stringify(userPresets)); } catch (e) {} M.name = n; edited = false; post('preset'); }
    refreshAll();
  }
  pedit.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') finishSave(true); else if (e.key === 'Escape') { e.stopPropagation(); finishSave(false); } });
  pedit.addEventListener('blur', () => finishSave(false));
  function loadFactory(n) { M.loadPreset(n); edited = false; post('preset'); refreshAll(); undoMark.setActive(true); }
  function loadUser(name) { M.checkpoint(); M.restore(userPresets[name]); M.name = name; edited = false; post('preset'); refreshAll(); }
  function stepPreset(d) { const n = M.presets.length; loadFactory(((M.cur + d) % n + n) % n); }
  pname.addEventListener('pointerup', () => {
    const P = M.presets, cols = [[{ hd: 1, text: 'Factory' }], [{ hd: 1, text: 'Strange' }], [{ hd: 1, text: 'Keys' }], [{ hd: 1, text: 'Yours' }]];
    P.forEach((nm, i) => {
      const c = i < P.indexOf('Broken Mirror') ? 0 : i < P.indexOf('Steel Keys') ? 1 : 2;
      if (nm === 'Copper Pad') cols[2].push({ hd: 1, text: 'Synth' }); if (nm === 'Copper Rain') cols[2].push({ hd: 1, text: 'Generative' });
      cols[c].push({ text: nm, id: i, sel: nm === M.name.replace(/\*+$/, '') });
    });
    const names = Object.keys(userPresets);
    if (!names.length) cols[3].push({ text: 'None yet: the save mark keeps this sound', dis: 1 });
    names.forEach(n => cols[3].push({ text: n, id: 'u:' + n, sel: n === M.name.replace(/\*+$/, '') }));
    cols[3].push({ sep: 1 }, { text: 'Save as a new preset', id: 'save' });
    menu(win, pname, cols, id => { if (id === 'save') askSave(); else if (typeof id === 'string') loadUser(id.slice(2)); else loadFactory(id); }, { disp: true });
  });
  // undo / redo / dice marks
  const mark = (parent, x, y, s, Cls) => { const cv = document.createElement('canvas'); cv.className = 'mark'; cv.style.cssText = `left:${x}px;top:${y}px;width:${s}px;height:${s}px`; parent.appendChild(cv); const m = new Cls(cv); m.cssSize = s; st.marks.push(m); return m; };
  const undoBox = box(hd, 566, 7, 42, 42, 'ibtn'); undoBox.style.cursor = 'pointer'; help(undoBox, H.undo); undoBox.style.border = '0';
  const undoMark = mark(undoBox, 0, 0, 42, Marks.Hourglass);
  undoBox.addEventListener('pointerenter', () => undoMark.setHover(true)); undoBox.addEventListener('pointerleave', () => undoMark.setHover(false));
  undoBox.addEventListener('pointerup', () => { if (!M.undo.length) return; M.doUndo(); undoMark.flip(); refreshAll(); });
  undoBox.style.background = 'transparent';
  const redoB = ibtn(hd, 608, 15, 24, 26, 'Redo', '', H.redo, () => { if (M.doRedo()) refreshAll(); });
  const rollBox = box(hd, 640, 7, 148, 42, 'ibtn'); rollBox.style.cssText += ';cursor:pointer;border:0;justify-content:flex-start;padding:0'; help(rollBox, H.rollAll);
  const dieMark = mark(rollBox, 0, 0, 42, Marks.Die);
  const rollTxt = box(rollBox, 44, 0, 104, 42, 'cap fl'); rollTxt.textContent = 'Roll everything'; rollTxt.style.letterSpacing = '.12em'; rollTxt.style.fontSize = 'calc(9.5px*var(--k))';
  rollBox.addEventListener('pointerenter', () => dieMark.setHover(true)); rollBox.addEventListener('pointerleave', () => dieMark.setHover(false));
  rollBox.addEventListener('pointerup', () => { roll('everything', selected); dieMark.roll(); });
  rollBox.style.background = 'transparent';
  const setBtn = box(hd, 796, 15, 70, 26, 'tb caps'); setBtn.textContent = 'Settings'; help(setBtn, H.settings);
  const openSettings = () => menu(win, setBtn, [[{ hd: 1, text: 'HOLYphantam 1.2.1' }, { text: 'This page is the real plugin engine, in your browser.', dis: 1 }, { text: 'Nothing you do here is sent anywhere.', dis: 1 }, { sep: 1 }, { text: 'Get the plugin, free', id: 'dl' }]], id => { if (id === 'dl') download(); });
  setBtn.addEventListener('pointerup', openSettings); wm.addEventListener('pointerup', openSettings);
  const bpm = box(hd, 1180 - 266, 0, 60, 56, 'fl'); bpm.style.cssText += ';justify-content:flex-end;font-family:var(--mono);font-size:calc(11px*var(--km));color:var(--muted)'; bpm.textContent = '100 BPM';
  const playBtn = box(hd, 1180 - 190, 13, 170, 30, 'tb pill acc'); help(playBtn, H.play);
  playBtn.addEventListener('pointerup', () => { const on = get(-1, 'player') < .5; M.put(-1, 'player', on ? 1 : 0); sendAudio({ play: on }); post('player'); refreshAll(); });
  function download() { if (inFrame) post('download'); else window.open('https://gush.best/#holyphantam', '_blank', 'noopener'); }

  // ---------------------------------------------------------------- layer tabs
  const tabs = [];
  for (let i = 0; i < 4; i++) tabs.push(buildTab(i));
  function buildTab(i) {
    const el = box(win, i * 295, 56, 295, 92, 'tab'); el.style.cursor = 'pointer'; help(el, H.layerTab);
    const edge = box(el, 294, 0, 1, 92, 'line');
    const bar = box(el, 0, 90, 295, 2, ''); bar.style.background = C.copper;
    const ball = canvas(el, 16, 9, 74, 74, g => { const v = layerVis(i), ins = PH.INSTRUMENTS[get(i, 'instrument')]; const ok = heard(i); g.globalAlpha = ok ? 1 : .4; UI.pantam(g, 74, 74, ins.steel, v.notes, v.n, ok ? v.glow : null, ok ? v.particles : null, false, .36 + .06 * lvlN()); g.globalAlpha = 1; });
    const lvlN = () => M.shapes[M.idx(i, 'level')].toProp(get(i, 'level'));
    const cap = box(el, 120, 9, 60, 24, 'cap fl'); cap.textContent = 'Layer ' + (i + 1); cap.style.color = C.muted;
    const pill = box(el, 181, 14.5, 24, 13, ''); pill.style.cssText += ';border:1px solid var(--copper);border-radius:6.5px;cursor:pointer';
    const kn = box(pill, 0, 0, 8, 8, ''); kn.style.cssText += ';background:var(--copper);border-radius:50%;top:1.5px';
    const pillHit = box(el, 175, 9, 36, 24, ''); pillHit.style.cursor = 'pointer';
    pillHit.addEventListener('pointerup', e => { e.stopPropagation(); M.put(i, 'on', get(i, 'on') > .5 ? 0 : 1); markEdited(); refreshAll(); });
    const name = box(el, 120, 33, 107, 20, 'nowrap'); name.style.cssText += ';font-weight:700;font-size:calc(13px*var(--k));line-height:20px';
    const sub = box(el, 120, 53, 97, 18, 'nowrap'); sub.style.cssText += ';font-size:calc(11px*var(--k));line-height:18px;color:var(--muted);white-space:pre';
    // fader
    const fy = 13, fh = 66, fx = 96;
    const fad = box(el, fx - 5, fy - 4, 26, fh + 8, 'fader'); help(fad, H.layerFader);
    const track = box(fad, 10, 4, 6, fh, ''); track.style.cssText += ';background:var(--line);border-radius:3px';
    const fillSoft = box(fad, 10, 4, 6, fh, ''); fillSoft.style.cssText += ';background:var(--copperSoft);border-radius:3px';
    const fillMeter = box(fad, 10, 4, 6, fh, ''); fillMeter.style.cssText += ';background:var(--copper);border-radius:3px';
    const handle = box(fad, 5, 4, 16, 4, ''); handle.style.cssText += ';background:var(--ink);border-radius:2px;box-shadow:0 0 0 1px var(--panel)';
    const roll = ibtn(el, 259, 8, 26, 22, 'Random', '', H.layerRoll, () => { roll_(); }); const roll_ = () => { M.checkpoint(); markEdited(); D.layer(i, roleOf(i)); selectLayer(i); refreshAll(); };
    const prev = ibtn(el, 235, 34, 22, 22, 'Left', '', H.layerPrev, () => stepIns(-1)), next = ibtn(el, 259, 34, 22, 22, 'Right', '', H.layerNext, () => stepIns(1));
    const stepIns = d => { M.put(i, 'instrument', (get(i, 'instrument') + d + 21) % 21); markEdited(); selectLayer(i); refreshAll(); };
    const mute = ibtn(el, 225, 60, 28, 26, 'Mute', '', H.mute, () => { const m = get(i, 'mute') < .5; M.put(i, 'mute', m ? 1 : 0); if (m) M.put(i, 'solo', 0); refreshAll(); });
    const solo = ibtn(el, 257, 60, 28, 26, 'Solo', '', H.solo, () => { const s = get(i, 'solo') < .5; if (s) { M.put(i, 'mute', 0); for (let j = 0; j < 4; j++) if (j !== i) M.put(j, 'solo', 0); } M.put(i, 'solo', s ? 1 : 0); refreshAll(); });
    let drag = null, hot = false;
    const yToVal = y => { const r = fad.getBoundingClientRect(); return Math.min(1, Math.max(0, (r.top + (4 + fh) * st.S - y) / (fh * st.S))); };
    const setLvl = p => env.set(M.idx(i, 'level'), M.shapes[M.idx(i, 'level')].fromProp(p));
    fad.addEventListener('pointerdown', e => {
      e.stopPropagation(); e.preventDefault(); fad.setPointerCapture(e.pointerId);
      const cur = lvlN(), yy = yToVal(e.clientY);
      if (Math.abs(yy - cur) * fh > 6) { setLvl(yy); } drag = { y: e.clientY, start: lvlN(), per: fh * (e.shiftKey ? 4 : 1) };
    });
    fad.addEventListener('pointermove', e => { if (drag) setLvl(Math.min(1, Math.max(0, drag.start - (e.clientY - drag.y) / st.S / drag.per))); });
    fad.addEventListener('pointerup', e => { drag = null; e.stopPropagation(); }); fad.addEventListener('pointercancel', () => { drag = null; });
    fad.addEventListener('dblclick', e => { e.stopPropagation(); env.set(M.idx(i, 'level'), M.info[M.idx(i, 'level')].defaultV); });
    fad.addEventListener('wheel', e => { e.preventDefault(); setLvl(Math.min(1, Math.max(0, lvlN() - Math.sign(e.deltaY) * .06))); }, { passive: false });
    fad.addEventListener('pointerenter', () => { hot = true; }); fad.addEventListener('pointerleave', () => { hot = false; });
    el.addEventListener('pointerup', () => selectLayer(i));
    return { el, bar, ball, update() {
      const on = get(i, 'on') > .5, ok = heard(i), muted = get(i, 'mute') > .5, dim = ok ? 1 : .35, sel = selected === i;
      el.style.background = sel ? C.panel : 'transparent'; bar.style.display = sel ? 'block' : 'none';
      const ins = PH.INSTRUMENTS[get(i, 'instrument')];
      name.textContent = ins.name; name.style.opacity = ok ? 1 : .4; cap.style.opacity = dim;
      pill.style.borderColor = on ? C.copper : C.muted; pill.style.opacity = on ? dim : 1; kn.style.background = on ? C.copper : C.muted; kn.style.left = (on ? 24 - 11 - 1 : 1) + 'px';
      let sc = get(i, 'scale'), root = get(i, 'root'); if (get(-1, 'scaleShared') > .5) { sc = get(-1, 'globalScale'); root = get(-1, 'globalRoot'); }
      const mode = get(i, 'mode'); let s = PH.NOTE[root] + ' ' + PH.SCALES[sc].name + '  ·  ' + ['MIDI', 'Generative', 'Both'][mode];
      if (mode !== 0) s += '  ·  ' + ['Random', 'Wander', 'Motif', 'Arp'][get(i, 'style')]; if (get(i, 'halo') === 5) s += '  ·  Freeze';
      if (hot || drag) { sub.textContent = 'Level ' + PP.text(M.info[M.idx(i, 'level')], get(i, 'level')); sub.style.color = C.copper; sub.style.fontWeight = 700; }
      else { sub.textContent = s; sub.style.color = C.muted; sub.style.fontWeight = 400; sub.style.opacity = dim; }
      [prev, next, roll, solo].forEach(b => { b.style.opacity = dim; }); mute.style.opacity = (ok || muted) ? 1 : .35;
      mute.classList.toggle('on', muted); solo.classList.toggle('on', get(i, 'solo') > .5);
      const lv = lvlN(), v = vis[i], hy = 4 + fh - lv * fh;
      handle.style.top = (hy - 2) + 'px'; handle.style.background = (on && ok) ? C.ink : C.muted;
      fillSoft.style.top = hy + 'px'; fillSoft.style.height = (4 + fh - hy) + 'px'; fillSoft.style.opacity = (ok && on) ? 1 : .5;
      let mm = 0; if (ok && on && v.meter > 1e-4) { const db = Math.max(-60, 20 * Math.log10(v.meter)); mm = Math.min(lv, M.shapes[M.idx(i, 'level')].toProp(Math.min(6, db))); }
      const my = 4 + fh - mm * fh; fillMeter.style.top = my + 'px'; fillMeter.style.height = (4 + fh - my) + 'px'; fillMeter.style.display = mm > 0 ? 'block' : 'none';
      ball.paint();
    } };
  }

  // ---------------------------------------------------------------- stage (left column)
  const stName = box(win, 20, 160, 236, 32, 'nowrap'); stName.style.cssText += ';font-family:var(--disp);font-size:calc(24px*var(--kd));line-height:32px';
  const stDesc = box(win, 20, 194, 300, 30, ''); stDesc.style.cssText += ';font-size:calc(12px*var(--k));color:var(--muted);line-height:15px';
  const instStep = d => { M.put(selected, 'instrument', (get('sel', 'instrument') + d + 21) % 21); markEdited(); refreshAll(); };
  ibtn(win, 262, 164, 26, 26, 'Left', '', H.instPrev, () => instStep(-1)); ibtn(win, 290, 164, 26, 26, 'Right', '', H.instNext, () => instStep(1));
  ibtn(win, 20, 226, 120, 24, 'Tone', 'Collection', H.collection, () => openGallery());
  const KF = .44;
  const stage = canvas(win, 35, 256, 270, 270, (g, w, h) => {
    const v = layerVis(selected), ins = PH.INSTRUMENTS[get('sel', 'instrument')], ok = heard(selected);
    g.globalAlpha = ok ? 1 : .4; UI.pantam(g, w, h, ins.steel, v.notes, v.n, ok ? v.glow : null, ok ? v.particles : null, true, KF); g.globalAlpha = 1;
    const mode = get('sel', 'mode'), playing = get(-1, 'player') > .5;
    if (mode !== 0 && (playing || playerPage)) { const a = get('sel', 'fieldLow'), b = get('sel', 'fieldHigh'); UI.pantamPlayer(g, w, h, KF, v.n, Math.min(a, b), Math.max(a, b)); }
  });
  help(stage.el, H.stage); stage.el.style.touchAction = 'none';
  let padDown = null;
  stage.el.addEventListener('pointerdown', e => {
    e.preventDefault(); stage.el.setPointerCapture(e.pointerId);
    const r = stage.el.getBoundingClientRect(), k = st.S, v = layerVis(selected);
    const hit = UI.hitField(270, 270, (e.clientX - r.left) / k, (e.clientY - r.top) / k, v.n, KF); if (!hit) return;
    if (get('sel', 'on') < .5) M.put(selected, 'on', 1);
    const note = v.notes[hit.f], vel = Math.min(1, Math.max(.3, 1 - hit.dist * 2.2));
    padDown = { layer: selected, note }; sendAudio({ pad: [selected, note, vel] }); v.glow[hit.f] = 1; keyLit[note] = 1;
  });
  const padUp = () => { if (padDown) { sendAudio({ padoff: [padDown.layer, padDown.note] }); padDown = null; } };
  stage.el.addEventListener('pointerup', padUp); stage.el.addEventListener('pointercancel', padUp);
  const stScale = box(win, 0, 532, 340, 16, ''); stScale.style.cssText += ';text-align:center;font-size:calc(11px*var(--k));color:var(--muted);white-space:pre';
  const techCap = box(win, 20, 556, 300, 16, 'cap'); techCap.textContent = 'Technique · keyswitch C0–E0'; techCap.style.color = C.muted;
  const tech = seg(env, win, 20, 576, 300, 28, PH.TECH, { layer: 'sel', key: 'technique' }, { help: 'tech' });
  const tecDown = tech.el.addEventListener('pointerup', () => { techOverride = -1; });
  const galBtn = null;

  // ---------------------------------------------------------------- editing panel
  const c1 = 350, c2 = 625, KW = 255, FULL = 530;
  const soundTab = box(win, c1, 156, 90, 24, 'tb caps'); soundTab.textContent = 'Sound'; help(soundTab, H.soundTab);
  const playerTab = box(win, c1 + 94, 156, 90, 24, 'tb caps'); playerTab.textContent = 'Player'; help(playerTab, H.playerTab);
  const layerTxt = box(win, c2 + KW - 120, 156, 120, 24, 'fl'); layerTxt.style.cssText += ';justify-content:flex-end;font-size:calc(10.5px*var(--k));color:var(--muted)';
  soundTab.addEventListener('pointerup', () => showPage(false)); playerTab.addEventListener('pointerup', () => showPage(true));
  const pgS = box(win, 0, 0, 1180, 640, ''), pgP = box(win, 0, 0, 1180, 640, ''); pgS.style.pointerEvents = pgP.style.pointerEvents = 'none';
  const K = (parent, x, y, w, h, label, key, opt) => { const o = knob(env, parent, x, y, w, h, label, { layer: opt && opt.g ? -1 : 'sel', key }, opt); updaters.push(o); o.el.style.pointerEvents = 'auto'; return o; };
  const P = (o) => { updaters.push(o); o.el.style.pointerEvents = 'auto'; return o; };
  const dice = (parent, x, y, helpKey, fn) => { const b = ibtn(parent, x, y, 26, 24, 'Random', '', H[helpKey], fn); b.style.pointerEvents = 'auto'; return b; };
  const GH = (parent, x, y, w, t, ic, as) => { const o = groupHeader(parent, x, y, w, t, ic, as); o.el = null; return o; };
  // SOUND page
  const srcH = groupHeader(pgS, c1, 186, FULL - 30, 'Source', 'Tone', '');
  dice(pgS, c1 + KW + 20 + KW - 26, 183, 'diceMaterial', () => roll('material', selected));
  [['Octave', 'pitchOct'], ['Semi', 'transpose'], ['Fine', 'fine'], ['Bright', 'bright'], ['Hit', 'hit'], ['Metal', 'metal'], ['Breath', 'breathRate'], ['Depth', 'breathDepth'], ['Width', 'width']]
    .forEach((a, i) => K(pgS, c1 + i * 59, 206, 58, 66, a[0], a[1]));
  groupHeader(pgS, c1, 282, 225, 'Halo', 'Halo'); dice(pgS, c1 + KW - 26, 279, 'diceHalo', () => roll('halo', selected));
  // halo picker (3 x 2 cells, icon left)
  const haloBox = box(pgS, c1, 304, KW, 36, ''); haloBox.style.pointerEvents = 'auto'; help(haloBox, H.halo);
  const haloCells = ['Cloud', 'Shimmer', 'Reverse', 'Scatter', 'Stutter', 'Freeze'].map((n, k) => {
    const cw = KW / 3, ch = 18, c = box(haloBox, (k % 3) * cw + 2, Math.floor(k / 3) * ch + 2, cw - 4, ch - 4, 'fl');
    c.style.cssText += ';border:1px solid var(--line);border-radius:3px;padding:0 6px;gap:4px;cursor:pointer;background:var(--paper);font-size:calc(10.5px*var(--k));color:var(--muted)';
    c.innerHTML = Icons.svg(n, 14, 1.2) + `<span>${n}</span>`; c.firstChild.style.cssText = 'width:13px;height:11.3px'; c.addEventListener('pointerup', () => env.set(M.idx(selected, 'halo'), k)); return c;
  });
  updaters.push({ update() { const h = get('sel', 'halo'); haloCells.forEach((c, k) => { const on = k === h; c.style.background = on ? C.panel : C.paper; c.style.borderColor = on ? C.copper : C.line; c.style.color = on ? C.ink : C.muted; c.style.fontWeight = on ? 600 : 400; c.firstChild.style.color = on ? C.copper : C.steel; }); } });
  [['Amount', 'cloudMix'], ['Motion', 'motion'], ['Afterglow', 'afterglow']].forEach((a, i) => K(pgS, c1 + i * 82, 344, 58, 66, a[0], a[1]));
  groupHeader(pgS, c2, 282, KW - 30 - 44, 'Envelope', 'Envelope', 'the length'); dice(pgS, c2 + KW - 26, 279, 'diceEnvelope', () => roll('envelope', selected));
  const inf = box(pgS, c2 + KW - 70, 281, 40, 19, 'tb pill'); inf.textContent = '∞'; inf.style.pointerEvents = 'auto'; help(inf, H.inf);
  inf.addEventListener('pointerup', () => env.set(M.idx(selected, 'release'), get('sel', 'release') >= 29.5 ? 4 : 30));
  updaters.push({ update() { inf.classList.toggle('on', get('sel', 'release') >= 29.5); } });
  buildAdsr(pgS, c2, 308);
  groupHeader(pgS, c1, 418, KW, 'Voicing', 'Player', 'how it plays');
  P(seg(env, pgS, c1, 442, KW, 22, ['Poly', 'Mono', 'Legato'], { layer: 'sel', key: 'voicing' }));
  [['Glide', 'glide'], ['Bend', 'bendRange'], ['Vel level', 'velLevel'], ['Vel tone', 'velBright']].forEach((a, i) => K(pgS, c1 + i * 64, 470, 58, 66, a[0], a[1]));
  groupHeader(pgS, c2, 418, KW - 30 - 112, 'Filter', 'Filter'); dice(pgS, c2 + KW - 26, 415, 'diceFilter', () => roll('filter', selected));
  P(seg(env, pgS, c2 + KW - 30 - 106, 418, 102, 19, ['LP', 'BP', 'HP'], { layer: 'sel', key: 'filterType' }));
  buildFilter(pgS, c2, 442);
  [['Drive', 'drive'], ['Key track', 'keyTrack']].forEach((a, i) => K(pgS, c2 + i * 64, 522, 58, 66, a[0], a[1]));
  groupHeader(pgS, c1, 546, KW - 30, 'Output', 'Tone', 'level · sends'); dice(pgS, c1 + KW - 26, 543, 'diceSends', () => roll('sends', selected));
  [['Level', 'level'], ['Pan', 'pan'], ['Echo', 'sendDelay'], ['Space', 'sendSpace'], ['Shadow', 'sendShadow']].forEach((a, i) => K(pgS, c1 + i * 51, 566, 50, 66, a[0], a[1]));

  // PLAYER page
  groupHeader(pgP, c1, 186, FULL - 30, 'Generative Player', 'Player', 'plays this layer by itself'); dice(pgP, c1 + FULL - 26, 183, 'dicePlayer', () => roll('player', selected));
  const sentence = box(pgP, c1, 212, FULL, 34, ''); sentence.style.cssText += ';font-size:calc(12px*var(--k));line-height:16px;display:flex;align-items:center';
  // style picker
  const styBox = box(pgP, c1, 254, FULL, 34, ''); styBox.style.pointerEvents = 'auto'; help(styBox, H.style);
  const styCells = ['Random', 'Wander', 'Motif', 'Arp'].map((n, k) => {
    const cw = FULL / 4, c = box(styBox, k * cw + 2, 0, cw - 4, 34, 'fl'); c.style.cssText += ';border:1px solid var(--line);border-radius:3px;padding:0 8px;gap:6px;cursor:pointer;font-size:calc(11.5px*var(--k))';
    c.innerHTML = Icons.svg(n, 24, 1.3) + `<span>${n}</span>`; c.firstChild.style.cssText = 'width:26px;height:22.5px'; c.addEventListener('pointerup', () => env.set(M.idx(selected, 'style'), k)); return c;
  });
  updaters.push({ update() { const s = get('sel', 'style'); styCells.forEach((c, k) => { const on = k === s; c.style.background = on ? C.copper : C.panel; c.style.borderColor = on ? C.copper : C.line; c.style.color = on ? C.panel : C.ink; c.style.fontWeight = on ? 600 : 400; c.firstChild.style.color = on ? C.panel : C.copper; }); } });
  P(seg(env, pgP, c1, 298, 300, 24, ['MIDI', 'Generative', 'Both'], { layer: 'sel', key: 'mode' }));
  P(toggle(env, pgP, c1 + 320, 300, 60, 20, 'Sync', { layer: 'sel', key: 'sync' }));
  P(combo(env, pgP, c1 + 388, 299, 70, 22, { layer: 'sel', key: 'division' }, 'rate'));
  [['Rate', 'rate'], ['Chance', 'chance'], ['Ding', 'ding'], ['Velocity', 'velocity'], ['Dynamics', 'dynamics'], ['Chord', 'chord'], ['Roll', 'roll']].forEach((a, i) => K(pgP, c1 + i * 62, 332, 58, 66, a[0], a[1]));
  [['Phrase', 'phrase'], ['Rest', 'rest'], ['Evolve', 'evolve']].forEach((a, i) => K(pgP, c1 + i * 62, 404, 58, 66, a[0], a[1]));
  const cap2 = (parent, x, y, w, h, t, ctr) => { const b = box(parent, x, y, w, h, 'cap fl'); b.textContent = t; b.style.color = C.muted; if (ctr) b.style.justifyContent = 'center'; return b; };
  cap2(pgP, c1 + 254, 410, 190, 20, 'Fields the player may use'); cap2(pgP, c1 + 336, 432, 20, 22, 'to', 1);
  P(combo(env, pgP, c1 + 254, 432, 80, 22, { layer: 'sel', key: 'fieldLow' }, 'ding')); P(combo(env, pgP, c1 + 360, 432, 80, 22, { layer: 'sel', key: 'fieldHigh' }, 'ding'));
  groupHeader(pgP, c1, 474, FULL, 'Scale · Tuning · Keys', 'Pitch', 'what the player and Scale Lock use');
  P(toggle(env, pgP, c1, 504, 96, 22, 'Snap keys', { layer: 'sel', key: 'lock' }));
  const lockSel = { get layer() { return get(-1, 'scaleShared') > .5 ? -1 : 'sel'; }, get key() { return get(-1, 'scaleShared') > .5 ? 'globalRoot' : 'root'; } };
  const rootC = P(combo(env, pgP, c1 + 104, 504, 56, 22, lockSel, 'scaleLock')), scaleSpec = { get layer() { return lockSel.layer; }, get key() { return lockSel.layer === -1 ? 'globalScale' : 'scale'; } };
  P(combo(env, pgP, c1 + 168, 504, 170, 22, scaleSpec, 'scaleLock'));
  P(combo(env, pgP, c1 + 346, 504, 90, 22, { layer: 'sel', key: 'octave' }, 'pitchOct'));
  const lk = ibtn(pgP, c1 + 444, 502, 70, 26, 'Lock', 'Lock', H.scaleLock, () => {
    const on = get(-1, 'scaleShared') < .5;
    if (on) { M.put(-1, 'globalScale', get('sel', 'scale')); M.put(-1, 'globalRoot', get('sel', 'root')); }
    M.put(-1, 'scaleShared', on ? 1 : 0); markEdited(); refreshAll();
  }); lk.style.pointerEvents = 'auto'; updaters.push({ update() { lk.classList.toggle('on', get(-1, 'scaleShared') > .5); } });
  cap2(pgP, c1 + 150, 568, 80, 22, 'Key range'); cap2(pgP, c1 + 306, 568, 20, 22, 'to', 1);
  P(combo(env, pgP, c1 + 230, 568, 70, 22, { layer: 'sel', key: 'keyLow' }, 'keyboard')); P(combo(env, pgP, c1 + 330, 568, 70, 22, { layer: 'sel', key: 'keyHigh' }, 'keyboard'));

  // ADSR + filter graphs (SVG)
  function svgEl(parent, x, y, w, h) {
    const NS = 'http://www.w3.org/2000/svg', s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', `0 0 ${w} ${h}`);
    s.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;overflow:visible;touch-action:none;pointer-events:auto`; parent.appendChild(s);
    s.mk = (t, a, p) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); (p || s).appendChild(e); return e; }; return s;
  }
  function buildAdsr(parent, x, y) {
    const w = KW, h = 100, gh = h - 14, s = svgEl(parent, x, y, w, h); help(s, H.adsr);
    s.mk('rect', { x: .5, y: .5, width: w - 1, height: gh - 1, rx: 3, fill: C.panel, stroke: C.line });
    const fill = s.mk('path', { fill: rgba(C.copperSoft, .6) }), ln = s.mk('path', { fill: 'none', stroke: C.copper, 'stroke-width': 1.5 });
    const pts = [0, 1, 2].map(() => s.mk('circle', { r: 4.5, fill: C.panel, stroke: C.ink, 'stroke-width': 1.2 }));
    const labs = [0, 1, 2, 3].map(k => { const t = s.mk('text', { x: k * w / 4, y: gh + 11, fill: C.muted, 'font-family': UI.MONO, 'font-size': 9.5 * .78 }); return t; });
    function rgba(c, a) { return UI.rgba(c, a); }
    const keys = ['attack', 'decay', 'sustain', 'release'], top = 8, bot = gh - 8, x0 = 6, segW = (w - 12 - 36) / 3;
    const rng = k => { const p = M.info[M.idx(selected, k)]; return [p.min, p.max]; };
    const slot = k => { const [lo, hi] = rng(k), v = Math.max(lo, get('sel', k)); return 6 + Math.min(1, Math.max(0, Math.log(v / lo) / Math.log(hi / lo))) * (segW - 6); };
    let P_ = {};
    const geo = () => { const xa = x0 + slot('attack'), xd = xa + slot('decay'), ys = bot - get('sel', 'sustain') * .01 * (bot - top), xs = xd + 36, xr = xs + slot('release'); P_ = { xa, xd, ys, xs, xr }; };
    const o = { el: s, update() {
      geo(); const { xa, xd, ys, xs, xr } = P_;
      const d = `M${x0} ${bot}Q${x0 + (xa - x0) * .3} ${top} ${xa} ${top}Q${xa + (xd - xa) * .25} ${ys} ${xd} ${ys}L${xs} ${ys}Q${xs + (xr - xs) * .2} ${bot} ${xr} ${bot}`;
      ln.setAttribute('d', d); fill.setAttribute('d', d + 'Z');
      [[xa, top], [xd, ys], [xr, bot]].forEach((p, i) => { pts[i].setAttribute('cx', p[0]); pts[i].setAttribute('cy', p[1]); });
      keys.forEach((k, i) => { labs[i].textContent = 'ADSR'[i] + ' ' + PP.text(M.info[M.idx(selected, k)], get('sel', k)); });
    } };
    let drag = -1;
    const loc = e => { const r = s.getBoundingClientRect(); return [(e.clientX - r.left) / st.S, (e.clientY - r.top) / st.S]; };
    s.addEventListener('pointerdown', e => {
      const [px, py] = loc(e); const q = [[P_.xa, top], [P_.xd, P_.ys], [P_.xr, bot]]; let best = 12; drag = -1;
      q.forEach((p, i) => { const d = Math.hypot(p[0] - px, p[1] - py); if (d < best) { best = d; drag = i; } });
      if (drag >= 0) { s.setPointerCapture(e.pointerId); M.checkpoint(); }
    });
    const setT = (k, dx) => { const [lo, hi] = rng(k), t = Math.min(1, Math.max(0, (dx - 6) / (segW - 6))); env.set(M.idx(selected, k), lo * Math.pow(hi / lo, t)); };
    s.addEventListener('pointermove', e => {
      if (drag < 0) return; const [px, py] = loc(e);
      if (drag === 0) setT('attack', px - x0);
      if (drag === 1) { setT('decay', px - P_.xa); env.set(M.idx(selected, 'sustain'), Math.min(100, Math.max(0, (bot - py) / (bot - top) * 100))); }
      if (drag === 2) setT('release', px - P_.xs);
    });
    s.addEventListener('pointerup', () => { drag = -1; }); s.addEventListener('pointercancel', () => { drag = -1; });
    updaters.push(o);
  }
  function respDb(f, fc, rs, type, drive, hpf) {
    const sq = Math.sqrt, tanh = Math.tanh, pow = Math.pow;
    let db = 0;
    if (hpf > 20.5) { const x = f / hpf, st_ = (x, q) => { const a = 1 - x * x, b = x / q; return x * x / sq(a * a + b * b); }; db = 20 * Math.log10(Math.max(1e-6, st_(x, .54) * st_(x, 1.31))); }
    if (!(type === 0 && drive <= .001 && fc >= 19500 && rs <= .002)) {
      const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), PI = Math.PI;
      const shape = r => pow(clamp(r, 0, 1), 2.6), topQ = c => clamp(PI * c * .9 / 6.91, 30, 4000), qf = (c, r) => 1.31 * pow(topQ(c) / 1.31, shape(r));
      const G = 1 + 5.3 * rs * rs, b = .18 * rs, dm = clamp(rs * 1.6 - .25, 0, 1), t = tanh(b), slope = G * (1 - t * t) / sq(G), trim = 1 / (1 + .66 * rs * rs);
      const ss = trim * (1 + dm * (slope - 1));
      const Gu = 1 + 24 * drive * drive, tu = tanh(.12 * drive), su = Gu * (1 - tu * tu) / pow(Gu, .6), ud = 1 + clamp(drive * 5, 0, 1) * (su - 1);
      const x = f / fc, typed = (x, q, bpn) => { const a = 1 - x * x, bb = x / q, den = sq(a * a + bb * bb); return type === 1 ? bpn * x / den : type === 2 ? x * x / den : 1 / den; };
      const m = ud * ss * typed(x, .54, 1 / .54) * typed(x, qf(fc, rs), 1 / 1.31);
      db += 20 * Math.log10(Math.max(1e-6, m));
    }
    return db <= 6 ? db : 6 + 12 * tanh((db - 6) / 12);
  }
  function buildFilter(parent, x, y) {
    const w = KW, h = 76, gh = h - 14, s = svgEl(parent, x, y, w, h); help(s, H.filterGraph);
    s.mk('rect', { x: .5, y: .5, width: w - 1, height: gh - 1, rx: 3, fill: C.panel, stroke: C.line });
    const left = 6, right = w - 6, top = 6, bot = gh - 6, LO = 20, HI = 20000, TOPDB = 20, BOTDB = -40;
    const xOf = hz => left + (right - left) * Math.log(hz / LO) / Math.log(HI / LO), fOf = px => LO * Math.pow(HI / LO, Math.min(1, Math.max(0, (px - left) / (right - left))));
    const yOf = db => top + (bot - top) * (TOPDB - Math.min(TOPDB, Math.max(BOTDB, db))) / (TOPDB - BOTDB);
    [100, 1000, 10000].forEach(f => s.mk('rect', { x: xOf(f), y: top, width: 1, height: bot - top, fill: UI.rgba(C.line, .6) }));
    s.mk('rect', { x: left, y: yOf(0), width: right - left, height: 1, fill: UI.rgba(C.line, .6) });
    const fill = s.mk('path', { fill: UI.rgba(C.copperSoft, .6) }), ln = s.mk('path', { fill: 'none', stroke: C.copper, 'stroke-width': 1.5 });
    const pc = s.mk('circle', { r: 4.5, fill: C.panel, stroke: C.ink, 'stroke-width': 1.2 }), pr = s.mk('circle', { r: 4.5, fill: C.panel, stroke: C.ink, 'stroke-width': 1.2 }), ph = s.mk('circle', { r: 4.5, fill: C.copper, stroke: C.ink, 'stroke-width': 1.2 });
    const lab = [.0, .29, .71].map(f => s.mk('text', { x: f * w, y: gh + 11, fill: C.muted, 'font-family': UI.MONO, 'font-size': 9.5 * .78 }));
    const V = () => ({ fc: get('sel', 'cutoff'), rs: get('sel', 'res') * .01, hp: get('sel', 'hpf'), ty: get('sel', 'filterType'), dr: get('sel', 'drive') * .01 });
    const resp = (f, v) => respDb(f, v.fc, v.rs, v.ty, v.dr, v.hp);
    const o = { el: s, update() {
      const v = V(); let d = '';
      for (let px = left; px <= right + .01; px += 1.5) d += (px === left ? 'M' : 'L') + px.toFixed(1) + ' ' + yOf(resp(fOf(px), v)).toFixed(1);
      ln.setAttribute('d', d); fill.setAttribute('d', d + `L${right} ${bot}L${left} ${bot}Z`);
      pc.setAttribute('cx', xOf(v.fc)); pc.setAttribute('cy', bot); pr.setAttribute('cx', xOf(Math.min(v.fc, HI))); pr.setAttribute('cy', yOf(resp(Math.min(v.fc, HI), v)));
      ph.setAttribute('cx', xOf(Math.max(LO, v.hp))); ph.setAttribute('cy', bot);
      lab[0].textContent = 'HP ' + PP.text(M.info[M.idx(selected, 'hpf')], v.hp); lab[1].textContent = 'Cutoff ' + PP.text(M.info[M.idx(selected, 'cutoff')], v.fc); lab[2].textContent = 'Res ' + PP.text(M.info[M.idx(selected, 'res')], v.rs * 100);
    } };
    const loc = e => { const r = s.getBoundingClientRect(); return [(e.clientX - r.left) / st.S, (e.clientY - r.top) / st.S]; };
    let drag = null;
    const pts = () => { const v = V(); return { c: [xOf(v.fc), bot], r: [xOf(Math.min(v.fc, HI)), yOf(resp(Math.min(v.fc, HI), v))], h: [xOf(Math.max(LO, v.hp)), bot], v }; };
    s.addEventListener('pointerdown', e => {
      const [px, py] = loc(e), p = pts(), dc = Math.hypot(p.c[0] - px, p.c[1] - py), dr = Math.hypot(p.r[0] - px, p.r[1] - py), dh = Math.hypot(p.h[0] - px, p.h[1] - py);
      const which = dh < 12 && dh <= dc && dh <= dr ? 'h' : (dc < 12 && dc < dr ? 'c' : 'r');
      s.setPointerCapture(e.pointerId); M.checkpoint();
      drag = { which, off: px - (which === 'h' ? p.h[0] : xOf(p.v.fc)), y: py, res: p.v.rs * 100 };
    });
    s.addEventListener('pointermove', e => {
      if (!drag) return; const [px, py] = loc(e);
      if (drag.which === 'h') { env.set(M.idx(selected, 'hpf'), Math.min(2000, Math.max(20, fOf(px - drag.off)))); return; }
      env.set(M.idx(selected, 'cutoff'), Math.min(20000, Math.max(40, fOf(px - drag.off))));
      if (drag.which === 'r') env.set(M.idx(selected, 'res'), Math.min(100, Math.max(0, drag.res + (drag.y - py) / Math.max(20, bot - top) * 100)));
    });
    s.addEventListener('pointerup', () => { drag = null; }); s.addEventListener('pointercancel', () => { drag = null; });
    s.addEventListener('dblclick', e => {
      const [px, py] = loc(e), p = pts(), rst = k => env.set(M.idx(selected, k), M.info[M.idx(selected, k)].defaultV);
      if (Math.hypot(p.h[0] - px, p.h[1] - py) < 12) { rst('hpf'); return; } rst('cutoff'); rst('res');
    });
    updaters.push(o);
  }

  // ---------------------------------------------------------------- effects column
  const f1 = 908, FW = 254, fxSw = {};
  const fx = [['Space', 156, 'Cosmos', 'Cosmos', 'spaceOff', 'diceSpace', 'space'], ['Shadow', 248, 'under the sound', 'Pitch', 'shadowOff', 'diceShadow', 'shadow'],
    ['Echo', 342, 'left · right', 'Delay', 'echoOff', 'diceEcho', 'echo'], ['Ring · Bend', 436, 'broken metal', 'Ring', 'ringOff', 'diceRing', 'ring']];
  const fxCtl = { spaceOff: [], shadowOff: [], echoOff: [], ringOff: [] };
  fx.forEach(([title, y, aside, icon, offKey, diceKey, group]) => {
    const gh = groupHeader(win, f1, y, FW - 64, title, icon, aside);
    dice(win, f1 + FW - 26, y - 3, diceKey, () => roll(group, selected));
    const sw = box(win, f1 + FW - 26 - 38, y - 11, 36, 36, 'ibtn'); sw.style.cssText += ';border:0;padding:0;background:transparent;cursor:pointer'; help(sw, H[offKey]);
    const mk = mark(sw, 0, 0, 36, Marks.Eclipse); sw.addEventListener('pointerenter', () => mk.setHover(true)); sw.addEventListener('pointerleave', () => mk.setHover(false));
    sw.addEventListener('pointerup', () => { M.put(-1, offKey, get(-1, offKey) > .5 ? 0 : 1); markEdited(); refreshAll(); });
    let first = true;
    updaters.push({ update() { const off = get(-1, offKey) > .5; mk.setOn(!off, !first); first = false; gh.setAside(off ? 'off' : aside); fxCtl[offKey].forEach(c => { c.style.opacity = off ? .38 : 1; }); } });
  });
  const FK = (x, y, w, label, key, off) => { const k = K(win, x, y, w, 66, label, key, { g: 1 }); fxCtl[off].push(k.el); return k; };
  FK(f1, 178, 58, 'Amount', 'spaceAmount', 'spaceOff'); FK(f1 + 62, 178, 58, 'Size', 'spaceSize', 'spaceOff'); FK(f1 + 124, 178, 58, 'Shimmer', 'shimmer', 'spaceOff');
  const FC = (x, y, w, h, key, off) => { const c = combo(env, win, x, y, w, h, { layer: -1, key }); updaters.push(c); fxCtl[off].push(c.el); return c; };
  FC(f1, 276, 118, 22, 'shadowInterval', 'shadowOff'); FC(f1, 304, 118, 22, 'shadowGrain', 'shadowOff'); FK(f1 + 130, 270, 58, 'Amount', 'shadowAmount', 'shadowOff');
  FC(f1, 370, 70, 22, 'delayDiv', 'echoOff'); FC(f1, 398, 70, 22, 'delayDivR', 'echoOff');
  FK(f1 + 80, 364, 58, 'Feedback', 'delayFb', 'echoOff'); FK(f1 + 80 + 58, 364, 58, 'Spill', 'delaySpill', 'echoOff'); FK(f1 + 80 + 116, 364, 58, 'Tone', 'delayTone', 'echoOff');
  [['Freq', 'ringFreq'], ['Bend', 'ringBend'], ['Mix', 'ringMix'], ['Wander', 'ringWander'], ['Feedback', 'ringFeedback']].forEach((a, i) => FK(f1 + i * 51, 458, 50, a[0], a[1], 'ringOff'));
  groupHeader(win, f1, 530, FW, 'Master', 'Strange');
  [['Strange', 'strange', 1], ['Drift', 'drift', 1], ['Width', 'masterWidth'], ['Tune A4', 'tune'], ['Master', 'volume']].forEach((a, i) => K(win, f1 + i * 51, 552, 50, 66, a[0], a[1], { g: 1, accent: !!a[2] }));

  // ---------------------------------------------------------------- help line + keyboard
  const helpEl = box(win, 20, 644, 1140, 16, ''); helpEl.id = 'help';
  const kb = buildKeyboard();
  function buildKeyboard() {
    const W = 1140, Hh = 96, LO = 12, HI = 108, black = k => [1, 3, 6, 8, 10].includes(k % 12);
    let whites = 0; for (let k = LO; k <= HI; k++) whites += black(k) ? 0 : 1; const ww = W / whites;
    const keyX = k => { let n = 0; for (let j = LO; j < k; j++) n += black(j) ? 0 : 1; return black(k) ? n * ww - ww * .31 : n * ww; };
    const rectOf = (k, top, h) => black(k) ? [keyX(k), top, ww * .62, h * .6] : [keyX(k), top, ww, h];
    const state = { lo: 21, hi: 108, scale: new Array(128).fill(false), tech: 0 };
    const cv = canvas(win, 20, 662, W, Hh, g => {
      const top = 8, h = Hh - top; g.fillStyle = UI.rgba(C.copper, .8);
      const bx0 = keyX(state.lo), bx1 = keyX(state.hi) + (black(state.hi) ? ww * .62 : ww);
      g.beginPath(); g.roundRect(bx0, 0, Math.max(4, bx1 - bx0), 4, 2); g.fill();
      const ks = ['F', 'T', 'S', 'H', 'G'];
      for (let pass = 0; pass < 2; pass++) for (let k = LO; k <= HI; k++) {
        if (black(k) !== (pass === 1)) continue;
        const r = rectOf(k, top, h), sw = k >= 12 && k <= 16, outside = k < 21 && !sw, lit = keyLit[k] > .02 || held.has(k);
        let fc = black(k) ? C.steel : C.keyWhite; if (sw) fc = black(k) ? C.copper : C.copperSoft; if (outside && !black(k)) fc = C.line;
        if (sw && k - 12 === state.tech) fc = C.copper; if (lit) fc = black(k) ? C.ink : C.copper;
        g.fillStyle = fc; g.fillRect(r[0], r[1], r[2], r[3]);
        g.strokeStyle = black(k) ? shade(fc) : C.line; g.lineWidth = 1; g.strokeRect(r[0] + .5, r[1] + .5, r[2] - 1, r[3] - 1);
        if (sw) { g.fillStyle = black(k) || k - 12 === state.tech ? C.panel : C.copper; g.font = `bold ${8 * UI.K}px ${UI.SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ks[k - 12], r[0] + r[2] / 2, r[1] + (black(k) ? r[3] - 4 - 5 : r[3] - 13 - 5)); }
        else if (state.scale[k] && !black(k) && !lit && k >= 21) { g.fillStyle = C.copper; g.beginPath(); g.arc(r[0] + r[2] / 2, r[1] + r[3] - 19 + 2, 2, 0, TWO); g.fill(); }
        else if (state.scale[k] && black(k) && !lit) { g.fillStyle = C.copperSoft; g.beginPath(); g.arc(r[0] + r[2] / 2, r[1] + r[3] - 7 + 1.5, 1.5, 0, TWO); g.fill(); }
      }
      g.fillStyle = C.muted; g.font = `${8 * UI.K}px ${UI.SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let k = 12; k <= HI; k += 12) { const r = rectOf(k, top, h); g.fillText('C' + (k / 12 - 1), r[0] + r[2] / 2, r[1] + r[3] - 6); }
    });
    function shade(c) { const n = parseInt(c.slice(1), 16), f = .83; return `rgb(${(n >> 16) * f | 0},${((n >> 8) & 255) * f | 0},${(n & 255) * f | 0})`; }
    help(cv.el, H.keyboard); cv.el.style.touchAction = 'none';
    const keyAt = (x, y) => { const top = 8, h = Hh - top; for (let k = LO; k <= HI; k++) if (black(k)) { const r = rectOf(k, top, h); if (x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3]) return k; }
      for (let k = LO; k <= HI; k++) if (!black(k)) { const r = rectOf(k, top, h); if (x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3]) return k; } return -1; };
    let down = -1;
    const press = e => {
      const r = cv.el.getBoundingClientRect(), x = (e.clientX - r.left) / st.S, y = (e.clientY - r.top) / st.S, k = keyAt(x, y); if (k < 0) return;
      const rr = rectOf(k, 8, Hh - 8), vel = Math.min(1, Math.max(.2, .35 + (y - rr[1]) / rr[3] * .65));
      noteOn(k, vel); down = k;
    };
    cv.el.addEventListener('pointerdown', e => { e.preventDefault(); cv.el.setPointerCapture(e.pointerId); press(e); });
    cv.el.addEventListener('pointermove', e => { if (down < 0) return; const r = cv.el.getBoundingClientRect(), k = keyAt((e.clientX - r.left) / st.S, (e.clientY - r.top) / st.S); if (k !== down && k >= 0) { noteOff(down); press(e); } });
    const up = () => { if (down >= 0) noteOff(down); down = -1; };
    cv.el.addEventListener('pointerup', up); cv.el.addEventListener('pointercancel', up);
    return { cv, state };
  }
  function noteOn(k, v) { held.add(k); sendAudio({ note: [k, v] }); if (k >= 12 && k <= 16) techOverride = k - 12; }
  function noteOff(k) { held.delete(k); sendAudio({ noteoff: k }); }

  // ---------------------------------------------------------------- collection gallery
  let gal = null;
  function openGallery() {
    if (gal) return; gal = box(win, 0, 0, 1180, 760, 'gal'); gal.classList.remove('a'); gal.classList.add('gal'); gal.style.cssText = '';
    const b = box(gal, 20, 30, 1140, 700, 'box'); b.style.cssText = 'position:absolute;left:20px;top:30px;width:1140px;height:700px;background:var(--paper);border:1px solid var(--line);border-radius:6px';
    const t = box(b, 24, 16, 600, 40, ''); t.textContent = 'The Collection'; t.style.cssText += ';font-family:var(--disp);font-size:calc(30px*var(--kd));line-height:40px';
    const cl = box(b, 1140 - 24 - 70, 20, 70, 28, 'tb'); cl.textContent = 'Close'; cl.addEventListener('pointerup', closeGallery);
    gal.addEventListener('pointerup', e => { if (e.target === gal) closeGallery(); });
    const cur = get('sel', 'instrument'), cols = 7, rows = 3, gap = 10, aw = 1140 - 48, ah = 700 - 32 - 54, cw = Math.floor((aw - gap * 6) / cols), ch = Math.floor((ah - gap * 2) / rows);
    const kurd = [50, 57, 58, 60, 62, 64, 65, 67, 69];
    PH.INSTRUMENTS.forEach((ins, i) => {
      const c = box(b, 24 + (i % cols) * (cw + gap), 16 + 54 + Math.floor(i / cols) * (ch + gap), cw, ch, 'card' + (i === cur ? ' cur' : ''));
      c.style.cssText += `;left:${24 + (i % cols) * (cw + gap)}px;top:${70 + Math.floor(i / cols) * (ch + gap)}px;width:${cw}px;height:${ch}px`;
      const iw = cw - 24, ih = Math.round((ch - 20) * .48);
      const cvs = canvas(c, 0, 0, iw, ih, g => UI.pantam(g, iw, ih, ins.steel, kurd, 9, null, null, false, .46)); cvs.el.style.cssText += ';position:relative;display:block;left:0;top:0'; cvs.fit();
      const cap = document.createElement('div'); cap.className = 'cap'; cap.style.cssText = 'color:var(--copper);margin-top:4px;height:14px;font-size:calc(9px*var(--k))'; cap.textContent = PH.STEELS[ins.steel][4] + ' · ' + PH.STEELS[ins.steel][3];
      const nm = document.createElement('div'); nm.style.cssText = 'font-weight:700;font-size:calc(13px*var(--k));height:18px;line-height:18px'; nm.textContent = ins.name;
      const ds = document.createElement('div'); ds.style.cssText = 'color:var(--muted);font-size:calc(11px*var(--k));line-height:13px'; ds.textContent = ins.description;
      c.append(cap, nm, ds);
      c.addEventListener('pointerup', () => { M.put(selected, 'instrument', i); markEdited(); closeGallery(); refreshAll(); });
    });
  }
  function closeGallery() { if (gal) { gal.remove(); gal = null; st.canvases = st.canvases.filter(c => c.el.isConnected); } }

  // ---------------------------------------------------------------- state -> screen
  function showPage(p) { playerPage = p; refreshAll(); }
  function selectLayer(i) { selected = i; refreshAll(); }
  function playerSentence() {
    const g = k => get('sel', k), mode = g('mode');
    if (mode === 0) return 'This layer only plays from MIDI. Choose Generative or Both to let the player in.';
    const what = ['strikes any field in its range, at random', 'wanders: mostly to a neighbouring field, now and then a leap', 'makes up a short motif, repeats it, and changes a note of it now and then', 'climbs up and down the fields in order'];
    const style = g('style'), phr = g('phrase'); let t = 'The player ' + what[Math.min(3, Math.max(0, style))];
    if (phr > 0 && g('rest') > .01) t += (style === 2 ? '. After each pass of ' : ', plays ') + phr + (style === 2 ? ' notes it rests' : ' notes, then rests') + ' about ' + g('rest').toFixed(1) + ' s.'; else t += ', without resting.';
    if (mode === 2) t += ' Hold keys and it plays your chord instead.';
    if (get(-1, 'player') < .5) t += ' (Press Start player.)';
    return t;
  }
  function refreshAll() {
    closeMenuIfNeeded();
    const ins = PH.INSTRUMENTS[get('sel', 'instrument')], playing = get(-1, 'player') > .5;
    pgS.style.display = playerPage ? 'none' : 'block'; pgP.style.display = playerPage ? 'block' : 'none';
    soundTab.classList.toggle('on', !playerPage); playerTab.classList.toggle('on', playerPage);
    layerTxt.textContent = 'Layer ' + (selected + 1);
    srcH.setAside('the pantam · ' + PH.STEELS[ins.steel][4]);
    stName.textContent = ins.name; stDesc.textContent = ins.description;
    playBtn.textContent = playing ? 'Player running' : 'Start player'; playBtn.classList.toggle('on', playing);
    pnameT.textContent = M.name.replace(/\*+$/, '') + (edited ? '*' : '');
    const v = layerVis(selected), root = get('sel', 'root'), sc = PH.SCALES[get('sel', 'scale')];
    stScale.textContent = PH.NOTE[root] + ' ' + sc.name + '  ·  ding ' + PH.noteName(v.notes[0]) + '  ·  ' + (v.n - 1) + ' fields';
    sentence.textContent = playerSentence();
    redoB.classList.toggle('dis', !M.redo.length); undoMark.setActive(M.undo.length > 0);
    updaters.forEach(u => u.update()); tabs.forEach(t => t.update());
    tech.update(); // technique
    stage.paint(); kbState();
    M.dirty = false;
  }
  const closeMenuIfNeeded = () => {};
  function kbState() {
    const l = selected, root = get(l, 'root'), sc = PH.SCALES[get(l, 'scale')], pcs = new Array(12).fill(false);
    sc.offsets.forEach(o => { pcs[(o + root) % 12] = true; });
    for (let k = 0; k < 128; k++) kb.state.scale[k] = pcs[k % 12];
    let lo = 21 + get(l, 'keyLow'), hi = 21 + get(l, 'keyHigh'); if (hi < lo) [lo, hi] = [hi, lo];
    kb.state.lo = lo; kb.state.hi = hi; kb.state.tech = techOverride >= 0 ? techOverride : get(l, 'technique');
    helpDefault = `Chromatic, A0–C8  ·  copper band = Layer ${l + 1} key range  ·  dots = scale  ·  point at anything to read what it does`;
    setHelp(curHelp); kb.cv.paint();
  }

  // help line
  let curHelp = '', helpDefault = '';
  function setHelp(t) { curHelp = t; helpEl.textContent = t || helpDefault; helpEl.classList.toggle('h', !!t); }
  win.addEventListener('pointerover', e => { const el = e.target.closest && e.target.closest('[data-help]'); setHelp(el ? el.dataset.help : ''); });
  win.addEventListener('pointerleave', () => setHelp(''));
  win.addEventListener('pointerdown', e => { const el = e.target.closest && e.target.closest('[data-help]'); if (el) setHelp(el.dataset.help); });

  // ---------------------------------------------------------------- animation tick (30 Hz)
  let lastT = 0;
  function frame(t) {
    requestAnimationFrame(frame);
    if (t - lastT < 33) return; lastT = t;
    for (let i = 0; i < 4; i++) {
      const v = layerVis(i);
      // meters: from the engine's own layer peak if audio runs, else from strikes
      if (v.lv !== undefined) v.meter = Math.max(v.lv, v.meter * .84); else v.meter *= .84;
      if (v.struck) { v.meter = Math.max(v.meter, .35); v.struck = 0; }
      for (let f = 0; f < 10; f++) v.glow[f] = v.glow[f] * .88 < .01 ? 0 : v.glow[f] * .88;
      // halo grains: a particle now and then while the layer rings
      const cm = get(i, 'cloudMix') * .01;
      if (v.meter > .02 && cm > .01) { const k = Math.min(3, Math.round(cm * 3 * Math.random() * 2)); for (let b = 0; b < k && v.particles.length < 240; b++) {
        const f = Math.floor(Math.random() * Math.max(1, v.n)), pos = PH.fieldPos(f, v.n), sp = .4 + .4 * get(i, 'motion') * .01;
        v.particles.push({ x: pos[0] + (Math.random() - .5) * sp * .5, y: pos[1] + (Math.random() - .5) * sp * .3, vx: (Math.random() - .5) * .02, vy: -.03 - Math.random() * .05, life: 0, max: 1.3 }); } }
      for (const p of v.particles) { p.life += 1 / 30; p.x += p.vx * 6 / 30; p.y += p.vy * 6 / 30; }
      v.particles = v.particles.filter(p => p.life < p.max);
    }
    for (let k = 0; k < 128; k++) if (keyLit[k]) keyLit[k] = keyLit[k] * .93 < .02 ? 0 : keyLit[k] * .93;
    tabs.forEach(t => t.update()); stage.paint(); kb.cv.paint();
    if (M.dirty) { refreshAll(); }
  }

  // ---------------------------------------------------------------- scaling + page chrome
  const hint = document.getElementById('hint'), xBtn = document.getElementById('x'), dl = document.getElementById('dl'), turn = document.getElementById('turn');
  let small = false;
  function layout() {
    const vw = innerWidth, vh = innerHeight, coarse = matchMedia('(pointer: coarse)').matches, portrait = vh > vw;
    turn.style.display = coarse && portrait && !small ? 'flex' : 'none';
    const phone = Math.min(vw, vh) < 600, mx = inFrame ? (phone ? 30 : 36) : 0, bot = phone ? 26 : 32;
    const aw = vw - 2 * mx, ah = vh - bot - (phone ? 0 : 4);
    const S = Math.min(aw / 1180, ah / 760);
    const left = (vw - 1180 * S) / 2, top = Math.max(0, (vh - bot - 760 * S) / 2);
    win.style.transform = `translate(${left}px,${top}px) scale(${S})`; win.style.visibility = 'visible';
    if (Math.abs(S - st.S) > 1e-4) { st.S = S; fitAll(); } else if (!win.dataset.fit) { fitAll(); }
    win.dataset.fit = 1;
  }
  function fitAll() { st.canvases.forEach(c => c.fit()); st.marks.forEach(m => m.fit(m.cssSize, st.S)); }
  addEventListener('resize', layout); addEventListener('orientationchange', () => setTimeout(layout, 120));
  document.getElementById('small').addEventListener('pointerup', () => { small = true; layout(); });
  if (inFrame) xBtn.style.display = 'block';
  xBtn.addEventListener('click', () => post('close'));
  dl.addEventListener('click', e => { if (inFrame) { e.preventDefault(); post('download'); } });

  // ---------------------------------------------------------------- input: first tap wakes audio; computer keys
  const wake = () => audio.tap();
  document.addEventListener('pointerdown', wake, true); document.addEventListener('keydown', wake, true); document.addEventListener('touchend', wake, true);
  const keyDown = {};
  document.addEventListener('keydown', e => {
    if (e.target && e.target.tagName === 'INPUT') return;
    if (e.key === 'Escape') { if (gal) closeGallery(); else if (openedMenu()) closeMenu(); else if (inFrame) post('close'); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const c = e.key.toLowerCase();
    if (c === 'z') { keyOctave = Math.max(-3, keyOctave - 1); return; } if (c === 'x') { keyOctave = Math.min(3, keyOctave + 1); return; }
    const i = NKEYS.indexOf(c); if (i < 0) return; e.preventDefault(); if (e.repeat || keyDown[i] !== undefined) return;
    keyDown[i] = Math.max(0, Math.min(127, 60 + i + 12 * keyOctave)); noteOn(keyDown[i], .8); keyLit[keyDown[i]] = 1;
  });
  document.addEventListener('keyup', e => { const i = NKEYS.indexOf(e.key.toLowerCase()); if (i >= 0 && keyDown[i] !== undefined) { noteOff(keyDown[i]); delete keyDown[i]; } });
  addEventListener('blur', () => { for (const i in keyDown) { noteOff(keyDown[i]); delete keyDown[i]; } });
  const openedMenu = () => document.querySelector('.menu');

  layout(); refreshAll(); fitAll(); requestAnimationFrame(frame);
  window.__ph = { M, audio, get state() { return { selected, playerPage }; }, refreshAll, selectLayer, showPage, strike, roll, vis, keyLit };
  document.title = 'HOLYphantam live';
})();
