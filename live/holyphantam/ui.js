// UI building blocks: absolute boxes, canvases that follow the page scale, knobs, segments, combos, menus, drawings.
window.UI = (function () {
  const C = PH.C, TWO = Math.PI * 2;
  const st = { S: 1, canvases: [], marks: [], onSet: null, helpOf: null };
  const SANS = '-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,Arial,sans-serif';
  const MONO = '"SF Mono",Menlo,Consolas,monospace';
  const K = 0.86;

  function box(parent, x, y, w, h, cls, html) {
    const e = document.createElement('div'); e.className = 'a ' + (cls || '');
    e.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
    if (html != null) e.innerHTML = html; parent.appendChild(e); return e;
  }
  function help(el, text) { el.dataset.help = text; return el; }

  // a canvas drawn in design pixels, backed at page-scale * dpr
  function canvas(parent, x, y, w, h, draw) {
    const el = document.createElement('canvas'); el.className = 'a';
    el.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px`; parent.appendChild(el);
    const o = { el, w, h, draw, fit() {
      const k = st.S * (window.devicePixelRatio || 1), pw = Math.max(1, Math.round(w * k)), ph = Math.max(1, Math.round(h * k));
      if (el.width !== pw || el.height !== ph) { el.width = pw; el.height = ph; }
      o.paint();
    }, paint() {
      const g = el.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, el.width, el.height);
      const k = el.width / w; g.setTransform(k, 0, 0, k, 0, 0); o.draw(g, w, h);
    } };
    st.canvases.push(o); return o;
  }

  const ell = (g, x, y, w, h, rot = 0) => { g.beginPath(); g.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), rot, 0, TWO); };
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

  // ---- the pantam (PantamPainter.h) -----------------------------------------------------------
  function geometry(w, h, fill) { const R = Math.min(w, h) * fill; return { R, cx: w / 2, cy: h / 2 - R * 0.02 }; }
  function pantam(g, w, h, steel, notes, n, glow, particles, labels, fill) {
    const s = PH.STEELS[steel], { R, cx, cy } = geometry(w, h, fill);
    g.fillStyle = 'rgba(60,48,36,0.102)'; ell(g, cx - R * 1.02, cy + R * 0.1 - R * 0.98, R * 2.04, R * 1.96); g.fill();
    const gx = cx - R * .35, gy = cy - R * .4, gr = Math.hypot(cx + R * .7 - gx, cy + R * .75 - gy);
    const gd = g.createRadialGradient(gx, gy, 0, gx, gy, gr); gd.addColorStop(0, s[0]); gd.addColorStop(.6, s[1]); gd.addColorStop(1, s[2]);
    g.fillStyle = gd; ell(g, cx - R, cy - R, R * 2, R * 2); g.fill();
    g.strokeStyle = 'rgba(30,26,22,0.549)'; g.lineWidth = Math.max(1, R * .025); ell(g, cx - R * .985, cy - R * .985, R * 1.97, R * 1.97); g.stroke();
    for (let i = 0; i < n; i++) {
      const u = PH.fieldPos(i, n), x = cx + u[0] * R, y = cy + u[1] * R;
      const sz = (i === 0 ? .25 : .2 - (i / n) * .07) * R, rot = i === 0 ? 0 : Math.atan2(u[1], u[0]) + Math.PI / 2;
      g.fillStyle = 'rgba(255,255,255,0.12)'; ell(g, x - sz * 1.25, y - sz, sz * 2.5, sz * 2, rot); g.fill();
      const dx = x - sz * .15, dy = y - sz * .2, dg = g.createRadialGradient(dx, dy, 0, dx, dy, Math.hypot(x + sz * .5 - dx, y + sz * .5 - dy));
      dg.addColorStop(0, s[2]); dg.addColorStop(1, 'rgba(0,0,0,0.05)');
      g.fillStyle = dg; ell(g, x - sz * .62, y - sz * .5, sz * 1.24, sz, rot); g.fill();
      const gl = glow ? Math.min(1, Math.max(0, glow[i] || 0)) : 0;
      if (gl > .01) {
        g.fillStyle = rgba(C.glow, gl * .85); ell(g, x - sz * 1.25, y - sz, sz * 2.5, sz * 2, rot); g.fill();
        const e = gl * R * .05; g.strokeStyle = `rgba(255,214,170,${gl})`; g.lineWidth = Math.max(1, R * .012);
        ell(g, x - sz * 1.25 - e, y - sz - e, sz * 2.5 + 2 * e, sz * 2 + 2 * e, rot); g.stroke();
      }
      if (labels && notes) {
        g.fillStyle = 'rgba(255,255,255,0.78)'; g.font = `${Math.max(8, R * .07) * K}px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        const dyy = (i === 0 ? sz * 1.45 : sz * 1.6) * (u[1] < -.1 ? -1.05 : 1);
        g.fillText(PH.noteName(notes[i]), x, y + dyy);
      }
    }
    if (particles) for (const p of particles) {
      const a = Math.sin(Math.PI * Math.min(1, Math.max(0, p.life / p.max))), pr = Math.max(1, R * .012 * (1 + a));
      g.fillStyle = rgba(C.copper, a * .9); ell(g, cx + p.x * R - pr, cy + p.y * R - pr, pr * 2, pr * 2); g.fill();
    }
  }
  function pantamPlayer(g, w, h, fill, n, lo, hi) {
    const { R, cx, cy } = geometry(w, h, fill);
    for (let i = Math.max(0, lo); i <= Math.min(hi, n - 1); i++) {
      const u = PH.fieldPos(i, n), sz = (i === 0 ? .25 : .2 - (i / n) * .07) * R, rot = i === 0 ? 0 : Math.atan2(u[1], u[0]) + Math.PI / 2;
      g.strokeStyle = rgba(C.copperSoft, .85); g.lineWidth = Math.max(1, R * .01);
      ell(g, cx + u[0] * R - sz * 1.32, cy + u[1] * R - sz * 1.07, sz * 2.64, sz * 2.14, rot); g.stroke();
    }
  }
  function hitField(w, h, px, py, n, fill) {
    const { R, cx, cy } = geometry(w, h, fill), ux = (px - cx) / R, uy = (py - cy) / R;
    if (ux * ux + uy * uy > 1) return null;
    let best = 0, dist = 9;
    for (let i = 0; i < n; i++) { const u = PH.fieldPos(i, n), d = Math.hypot(u[0] - ux, u[1] - uy); if (d < dist) { dist = d; best = i; } }
    return { f: best, dist };
  }

  // ---- header of a group ------------------------------------------------------------------------
  function groupHeader(parent, x, y, w, title, icon, aside) {
    const r = box(parent, x, y, w, 20, 'gh');
    r.style.borderBottom = '1px solid var(--line)';
    if (icon) { const i = box(r, 0, 1, 20, 17, 'fl', Icons.svg(icon, 18, 1.1)); i.style.color = C.copper; i.firstChild.style.cssText = 'width:18px;height:15.6px;margin-left:1px'; }
    const t = box(r, icon ? 26 : 0, 0, w, 19, 'cap fl'); t.textContent = title; t.style.color = C.ink;
    const as = box(r, 0, 0, w, 19, 'fl'); as.style.cssText += ';justify-content:flex-end;color:var(--muted);font-size:calc(10.5px*var(--k));white-space:nowrap';
    as.textContent = aside || '';
    return { setAside(s) { as.textContent = s || ''; } };
  }

  // ---- knob ---------------------------------------------------------------------------------------
  const A0 = Math.PI * 1.25, A1 = Math.PI * 2.75;
  function arc(c, R, a, b) {
    const pt = t => [c + R * Math.sin(t), c - R * Math.cos(t)], p0 = pt(a), p1 = pt(b);
    return `M${p0[0].toFixed(2)} ${p0[1].toFixed(2)}A${R} ${R} 0 ${b - a > Math.PI ? 1 : 0} 1 ${p1[0].toFixed(2)} ${p1[1].toFixed(2)}`;
  }
  // spec: { layer:'sel'|-1, key } ; env: { M, sel() }
  function knob(env, parent, x, y, w, h, label, spec, opt = {}) {
    const big = !!opt.big, d = big ? 54 : 40, R = d / 2 - 2, c = d / 2;
    const el = box(parent, x, y, w, h, 'knob' + (opt.accent ? ' accent' : ''));
    help(el, PH.HELP[spec.key] || '');
    const v = box(el, 0, d, w, 12, 'v'); v.style.fontSize = `calc(${big ? 10.5 : 9.5}px*var(--km))`;
    const l = box(el, 0, d + 12, w, 14, 'l'); l.style.fontSize = `calc(${big ? 11.5 : 10}px*var(--k))`; if (big) l.style.fontWeight = 700; l.textContent = label;
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', `0 0 ${d} ${d}`); svg.style.cssText = `left:${(w - d) / 2}px;top:0;width:${d}px;height:${d}px`;
    const mk = (t, a) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); svg.appendChild(e); return e; };
    const track = mk('path', { d: arc(c, R, A0, A1), fill: 'none', stroke: C.line, 'stroke-width': 1.6, 'stroke-linecap': 'round' });
    const val = mk('path', { fill: 'none', stroke: C.copper, 'stroke-width': 1.6, 'stroke-linecap': 'round' });
    const cap = mk('circle', { cx: c, cy: c, r: R * .66, fill: C.panel, stroke: C.steel, 'stroke-width': 1 });
    const ptr = mk('line', { x1: c, y1: c, 'stroke-width': 1.5, 'stroke-linecap': 'butt', stroke: C.ink });
    el.appendChild(svg);
    const idx = () => env.M.idx(spec.layer === 'sel' ? env.sel() : spec.layer, spec.key);
    const o = { el, update() {
      const i = idx(), p = env.M.info[i], sh = env.M.shapes[i], vv = env.M.val(i);
      const pos = sh.toProp(vv), ang = A0 + pos * (A1 - A0);
      const bip = p.min < 0 && p.max > 0, from = bip ? A0 + sh.toProp(0) * (A1 - A0) : A0;
      val.setAttribute('d', Math.abs(ang - from) > .01 ? arc(c, R, Math.min(from, ang), Math.max(from, ang)) : '');
      const cr = R * .66 * .82; ptr.setAttribute('x2', (c + cr * Math.sin(ang)).toFixed(2)); ptr.setAttribute('y2', (c - cr * Math.cos(ang)).toFixed(2));
      v.textContent = PP.text(p, vv);
    } };
    let drag = null;
    const hot = on => ptr.setAttribute('stroke', on ? C.copper : C.ink);
    el.addEventListener('pointerenter', () => hot(true)); el.addEventListener('pointerleave', () => { if (!drag) hot(false); });
    el.addEventListener('pointerdown', e => {
      e.preventDefault(); el.setPointerCapture(e.pointerId); const i = idx();
      drag = { i, y: e.clientY, start: env.M.shapes[i].toProp(env.M.val(i)), sens: e.shiftKey ? 900 : 180, undo: true }; env.touch && env.touch();
    });
    el.addEventListener('pointermove', e => {
      if (!drag) return; const sh = env.M.shapes[drag.i];
      const prop = drag.start - (e.clientY - drag.y) / st.S / drag.sens;
      env.set(drag.i, sh.fromProp(prop));
    });
    const end = () => { drag = null; };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', () => { end(); hot(false); });
    el.addEventListener('dblclick', () => { const i = idx(); env.set(i, env.M.info[i].defaultV); });
    el.addEventListener('wheel', e => {
      e.preventDefault(); const i = idx(), sh = env.M.shapes[i];
      env.set(i, sh.fromProp(sh.toProp(env.M.val(i)) - Math.sign(e.deltaY) * 0.02));
    }, { passive: false });
    return o;
  }

  // ---- segments (ChoiceSegment) ---------------------------------------------------------------------
  function seg(env, parent, x, y, w, h, labels, spec, opt = {}) {
    const el = box(parent, x, y, w, h, ''); const bw = Math.floor(w / labels.length), bs = [];
    labels.forEach((t, k) => {
      const b = box(el, k * bw, 0, k === labels.length - 1 ? w - k * bw : bw, h, 'tb' + (opt.acc ? ' acc' : '')); b.textContent = t;
      b.addEventListener('pointerup', () => env.set(env.M.idx(spec.layer === 'sel' ? env.sel() : spec.layer, spec.key), k)); bs.push(b);
    });
    help(el, PH.HELP[opt.help || spec.key] || '');
    return { el, update() { const v = Math.round(env.M.val(env.M.idx(spec.layer === 'sel' ? env.sel() : spec.layer, spec.key))); bs.forEach((b, k) => b.classList.toggle('on', k === v)); } };
  }

  // ---- toggle pill (bool param) --------------------------------------------------------------------------
  function toggle(env, parent, x, y, w, h, text, spec, helpKey) {
    const b = box(parent, x, y, w, h, 'tb pill acc caps'); b.textContent = text; help(b, PH.HELP[helpKey || spec.key] || '');
    const idx = () => env.M.idx(spec.layer === 'sel' ? env.sel() : spec.layer, spec.key);
    b.addEventListener('pointerup', () => env.set(idx(), env.M.val(idx()) > .5 ? 0 : 1));
    return { el: b, update() { b.classList.toggle('on', env.M.val(idx()) > .5); } };
  }

  // ---- icon button ---------------------------------------------------------------------------------------
  function ibtn(parent, x, y, w, h, icon, text, helpText, onClick) {
    const b = box(parent, x, y, w, h, 'ibtn');
    const sz = h - 6, iw = Math.min(w - 6, sz * 30 / 26);
    b.innerHTML = Icons.svg(icon, iw, 1.3) + (text ? `<span>${text}</span>` : '');
    const s = b.firstChild; s.style.width = (text ? sz * 30 / 26 : iw) + 'px'; s.style.height = (text ? sz : iw * 26 / 30) + 'px';
    if (!text) b.style.padding = '0';
    if (helpText) help(b, helpText);
    if (onClick) b.addEventListener('pointerup', e => { if (e.button === 0 || e.pointerType !== 'mouse') onClick(e); });
    return b;
  }

  // ---- popup menus ------------------------------------------------------------------------------------------
  let openMenu = null;
  function closeMenu() { if (openMenu) { openMenu.remove(); openMenu = null; } }
  // cols: [[ {text,id,sel,dis,hd,sep} ... ], ...]
  function menu(win, anchorEl, cols, onPick, opt = {}) {
    closeMenu();
    const m = document.createElement('div'); m.className = 'menu' + (opt.disp ? ' disp' : '');
    m.style.gridTemplateColumns = `repeat(${cols.length},auto)`;
    cols.forEach(items => {
      const c = document.createElement('div'); c.className = 'col';
      items.forEach(it => {
        const d = document.createElement('div');
        if (it.hd) { d.className = 'hd'; d.textContent = it.text; }
        else if (it.sep) d.className = 'sep';
        else { d.className = 'it' + (it.sel ? ' sel' : '') + (it.dis ? ' dis' : ''); d.textContent = it.text; if (!it.dis) d.addEventListener('pointerup', e => { e.stopPropagation(); closeMenu(); onPick(it.id); }); }
        c.appendChild(d);
      }); m.appendChild(c);
    });
    win.appendChild(m); openMenu = m;
    const wr = win.getBoundingClientRect(), ar = anchorEl.getBoundingClientRect(), S = st.S;
    let x = (ar.left - wr.left) / S, y = (ar.bottom - wr.top) / S + 2;
    const mw = m.offsetWidth, mh = m.offsetHeight;
    if (x + mw > 1170) x = Math.max(4, 1170 - mw); if (y + mh > 756) y = Math.max(4, (ar.top - wr.top) / S - mh - 2);
    m.style.left = x + 'px'; m.style.top = y + 'px';
    return m;
  }
  document.addEventListener('pointerdown', e => { if (openMenu && !openMenu.contains(e.target)) closeMenu(); }, true);

  function combo(env, parent, x, y, w, h, spec, helpKey) {
    const el = box(parent, x, y, w, h, 'combo'); el.style.position = 'absolute'; el.style.left = x + 'px'; el.style.top = y + 'px';
    const t = document.createElement('span'); t.className = 'nowrap'; t.style.cssText = `width:${w - 22}px`; el.appendChild(t); el.appendChild(document.createElement('i'));
    help(el, PH.HELP[helpKey || spec.key] || '');
    const idx = () => env.M.idx(spec.layer === 'sel' ? env.sel() : spec.layer, spec.key);
    el.addEventListener('pointerup', e => {
      if (openMenu) { closeMenu(); return; } e.stopPropagation();
      const i = idx(), p = env.M.info[i], cur = Math.round(env.M.val(i)), n = p.choices.length, rows = Math.min(n, 16), cols = [];
      for (let k = 0; k < n; k += rows) cols.push(p.choices.slice(k, k + rows).map((c, j) => ({ text: c, id: k + j, sel: k + j === cur })));
      menu(env.win, el, cols, v => env.set(i, v));
    });
    return { el, update() { const i = idx(); t.textContent = PP.text(env.M.info[i], env.M.val(i)); } };
  }

  return { st, box, help, canvas, pantam, pantamPlayer, hitField, groupHeader, knob, seg, toggle, ibtn, menu, closeMenu, combo, rgba, ell, SANS, MONO, K, geometry };
})();
