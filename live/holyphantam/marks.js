// Gush marks (die, hourglass, eclipse): a canvas port of brand/marks/GushMarks.h, same geometry, same palette as the plugin
// (ink on panel). Each draws in a 64 x 64 square and animates only while it moves.
window.Marks = (function () {
  const PI = Math.PI, TWO = 2 * PI;
  const INK = [46, 39, 32], FACE = '#F7EFE2', GLASS = 'rgba(247,239,226,0.55)';
  const ink = a => `rgba(${INK[0]},${INK[1]},${INK[2]},${Math.max(0, Math.min(1, a))})`;
  const now = () => performance.now();
  const easeBack = t => { const c = 1.3; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const rotX = a => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
  const rotY = a => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
  const rotZ = a => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
  const mul = (A, B) => { const C = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]; return C; };
  const mv = (M, v) => [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]];
  const rnd = seed => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const line = (g, x1, y1, x2, y2, w) => { g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
  const ell = (g, x, y, w, h) => { g.beginPath(); g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, TWO); };

  class Mark {
    constructor(canvas) { this.cv = canvas; this.hover = 0; this.wob = 0; this.run = false; this.size = 0; }
    fit(cssSize, scale) {   // pixel size = css size * page scale * dpr
      const px = Math.max(16, Math.round(cssSize * scale * (window.devicePixelRatio || 1)));
      if (px !== this.size) { this.size = px; this.cv.width = px; this.cv.height = px; }
      this.paint();
    }
    setHover(h) { this.hover = h ? 1 : 0; this.wake(); }
    wake() { if (!this.run) { this.run = true; requestAnimationFrame(() => this.tick()); } }
    tick() {
      this.paint();
      if (this.moving(now()) || Math.abs(this.wob) > 0.002 || this.hover) requestAnimationFrame(() => this.tick()); else this.run = false;
    }
    paint() {
      const g = this.cv.getContext('2d'); if (!this.size) return;
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.size, this.size);
      const k = this.size / 64; g.setTransform(k, 0, 0, k, 0, 0); g.lineJoin = 'round';
      this.draw(g, now());
    }
  }

  // ---- die -------------------------------------------------------------------------------
  const FACES = [
    { n: [0, 0, 1], a: [1, 0, 0], b: [0, 1, 0], p: 1 }, { n: [0, 0, -1], a: [-1, 0, 0], b: [0, 1, 0], p: 6 },
    { n: [1, 0, 0], a: [0, 0, -1], b: [0, 1, 0], p: 2 }, { n: [-1, 0, 0], a: [0, 0, 1], b: [0, 1, 0], p: 5 },
    { n: [0, -1, 0], a: [1, 0, 0], b: [0, 0, 1], p: 3 }, { n: [0, 1, 0], a: [1, 0, 0], b: [0, 0, -1], p: 4 }];
  const PIPS = [[], [[0, 0]], [[-.5, -.5], [.5, .5]], [[-.5, -.5], [0, 0], [.5, .5]], [[-.5, -.5], [.5, -.5], [-.5, .5], [.5, .5]],
    [[-.5, -.5], [.5, -.5], [0, 0], [-.5, .5], [.5, .5]], [[-.5, -.55], [.5, -.55], [-.5, 0], [.5, 0], [-.5, .55], [.5, .55]]];
  const LIGHT = (() => { const v = [-.45, -.7, .55], l = Math.hypot(...v); return v.map(x => x / l); })();
  class Die extends Mark {
    constructor(c) { super(c); this.q = [0, 0, 0]; this.from = [0, 0, 0]; this.to = [0, 0, 0]; this.t0 = -1e9; this.dur = 820; }
    roll() {
      const pick = () => (1 + Math.floor(Math.random() * 3)) * (PI / 2) * (Math.random() < .5 ? -1 : 1);
      this.from = this.q.slice(); this.to = [this.q[0] + pick() + TWO, this.q[1] + pick(), this.q[2] + pick()]; this.t0 = now(); this.wake();
    }
    moving(t) { return t - this.t0 < this.dur; }
    draw(g, t) {
      const p = Math.min(1, Math.max(0, (t - this.t0) / this.dur)), e = easeBack(p);
      for (let i = 0; i < 3; i++) this.q[i] = this.from[i] + (this.to[i] - this.from[i]) * e;
      const hop = p < 1 ? Math.sin(PI * Math.min(1, p * 1.15)) * 7 : 0;
      this.wob += (this.hover * Math.sin(t / 260) * .1 - this.wob) * .12;
      const R = mul(mul(rotX(-.52 + this.wob), rotY(.68)), mul(mul(rotX(this.q[0]), rotY(this.q[1])), rotZ(this.q[2])));
      const S = 13.5, cx = 32, cy = 33 - hop;
      g.strokeStyle = ink(.18 * (1 - hop / 14)); ell(g, 32 - (15 - hop * .6), 54 - 3.2, 2 * (15 - hop * .6), 6.4); g.lineWidth = .7; g.stroke();
      for (const f of FACES) {
        const n = mv(R, f.n); if (n[2] <= .02) continue;
        const A = mv(R, f.a), B = mv(R, f.b), lit = n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2];
        g.save(); g.transform(A[0] * S, A[1] * S, B[0] * S, B[1] * S, cx + n[0] * S, cy + n[1] * S);
        g.fillStyle = FACE; g.fillRect(-1, -1, 2, 2);
        if (lit > .3) {
          g.strokeStyle = ink(lit > .7 ? .55 : .32); const sp = lit > .7 ? .17 : .26;
          for (let v = -1 + sp / 2; v < 1; v += sp) line(g, -1, v, 1, v, .06);
        }
        g.fillStyle = ink(.92);
        for (let k = 0; k < f.p; k++) { ell(g, PIPS[f.p][k][0] - .17, PIPS[f.p][k][1] - .17, .34, .34); g.fill(); }
        g.strokeStyle = ink(.95); g.lineWidth = .09; g.strokeRect(-1, -1, 2, 2);
        g.restore();
      }
    }
  }

  // ---- hourglass --------------------------------------------------------------------------
  const GH = 17, GR = 13;
  const prof = y => 1.6 + 10.2 * Math.pow(Math.min(1, Math.abs(y) / (GH * .86)), 1.25);
  class Hourglass extends Mark {
    constructor(c) {
      super(c); this.th = 0; this.from = 0; this.to = 0; this.t0 = -1e9; this.last = -1; this.sand = [1, 0]; this.active = true; this.flowing = false; this.dur = 760;
      const r = rnd(5); this.grains = Array.from({ length: 170 }, () => [r(), r() * 2 - 1]);
    }
    flip() { this.from = this.th; this.to = Math.round(this.th / PI) * PI + PI; this.t0 = now(); this.wake(); }
    setActive(a) { if (a !== this.active) { this.active = a; this.paint(); } }
    moving(t) { return t - this.t0 < this.dur || this.flowing; }
    draw(g, t) {
      const dt = this.last < 0 ? 0 : Math.min(.05, (t - this.last) / 1000); this.last = t;
      const p = Math.min(1, Math.max(0, (t - this.t0) / this.dur));
      this.th = this.from + (this.to - this.from) * easeBack(p);
      this.wob += (this.hover * Math.sin(t / 260) * .1 - this.wob) * (1 - Math.exp(-dt * 8));
      const al = this.th + .32 + this.wob, ca = Math.cos(al), sa = Math.sin(al);
      const down = ca > 0 ? 0 : 1, up = 1 - down, sand = this.sand;
      this.flowing = false;
      if (p >= 1 && sand[up] > 0) { const f = Math.min(sand[up], dt / 1.1); sand[up] -= f; sand[down] += f; this.flowing = sand[up] > 0; }
      const a = this.active ? 1 : .35, cx = 32, cy = 31, Y = y => cy + y * ca;
      g.strokeStyle = ink(.18 * a); ell(g, 32 - 13, 55 - 2.8, 26, 5.6); g.lineWidth = .7; g.stroke();
      const cap = sgn => {
        const yy = Y(sgn * GH), ry = Math.max(.6, GR * Math.abs(sa)), thick = 2.2 * Math.abs(ca), sg = ca >= 0 ? 1 : -1;
        for (const off of [sgn * thick * sg, 0]) {
          ell(g, cx - GR, yy + off - ry, 2 * GR, 2 * ry); g.fillStyle = FACE; g.fill();
          g.strokeStyle = ink(.95 * a); g.lineWidth = 1; g.stroke();
        }
      };
      const first = (1 * sa) < (-1 * sa) ? 1 : -1;
      cap(first);
      const pillar = (th, front) => {
        const x = cx + Math.cos(th) * GR * .82, off = Math.sin(th) * GR * .82 * -sa;
        g.strokeStyle = ink((front ? .9 : .28) * a); line(g, x, Y(-GH) + off, x, Y(GH) + off, front ? 1.4 : .9);
      };
      pillar(-PI / 2, false);
      const body = new Path2D(), right = new Path2D(), left = new Path2D();
      for (let k = 0; k <= 40; k++) {
        const y = -GH * .86 + GH * 1.72 * k / 40;
        if (k === 0) { body.moveTo(cx + prof(y), Y(y)); right.moveTo(cx + prof(y), Y(y)); left.moveTo(cx - prof(y), Y(y)); }
        else { body.lineTo(cx + prof(y), Y(y)); right.lineTo(cx + prof(y), Y(y)); left.lineTo(cx - prof(y), Y(y)); }
      }
      for (let k = 40; k >= 0; k--) { const y = -GH * .86 + GH * 1.72 * k / 40; body.lineTo(cx - prof(y), Y(y)); }
      body.closePath();
      g.save(); g.fillStyle = GLASS; g.fill(body); g.clip(body);
      g.fillStyle = ink(.82 * a);
      for (let side = 0; side < 2; side++) {
        const amt = sand[side]; if (amt < .01) continue;
        const sgn = side === 0 ? 1 : -1, isDown = side === down;
        const y0 = isDown ? GH * .86 * (1 - amt * .78) : 1.2, y1 = isDown ? GH * .86 : 1.2 + GH * .7 * amt;
        for (const gr of this.grains) { const y = sgn * (y0 + gr[0] * (y1 - y0)); ell(g, cx + gr[1] * prof(y) * .88 - .55, Y(y) - .55, 1.1, 1.1); g.fill(); }
      }
      if (this.flowing) {
        const yEnd = Y((down === 0 ? 1 : -1) * GH * .86 * (1 - sand[down] * .78));
        g.strokeStyle = ink(.75 * a); g.lineWidth = .8; g.setLineDash([1, 1.2]); g.lineDashOffset = -((t / 25) % 2.2) * (yEnd > cy ? 1 : -1);
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, yEnd); g.stroke(); g.setLineDash([]);
      }
      g.strokeStyle = ink(.45 * a); g.lineWidth = .55;
      for (let k = 0; k < 4; k++) {
        const f = .52 + k * .12, sh = new Path2D();
        for (let j = 0; j <= 40; j++) { const y = -GH * .86 + GH * 1.72 * j / 40; if (j === 0) sh.moveTo(cx - prof(y) * f, Y(y)); else sh.lineTo(cx - prof(y) * f, Y(y)); }
        g.stroke(sh);
      }
      g.restore();
      g.strokeStyle = ink(.95 * a); g.lineWidth = 1.1; g.stroke(right); g.stroke(left);
      pillar(PI * .1, true); pillar(PI * .9, true);
      cap(-first);
    }
  }

  // ---- eclipse ---------------------------------------------------------------------------
  class Eclipse extends Mark {
    constructor(c) {
      super(c); this.off = false; this.u0 = 0; this.u1 = 0; this.t0 = -1e9; this.dirX = 1; this.dur = 780;
      const r = rnd(11); this.corona = Array.from({ length: 44 }, (_, k) => [k / 44 * TWO + r() * .09, .35 + r() * .65, .35 + r() * .4]);
    }
    isOn() { return !this.off; }
    setOn(on, animate = true) {
      if (on === !this.off) return;
      this.off = !on;
      if (!animate) { this.u0 = this.u1 = this.off ? 1 : 0; this.t0 = -1e9; this.paint(); return; }
      this.u0 = this.off ? 0 : 1; this.u1 = this.off ? 1 : 2; this.t0 = now(); this.wake();
    }
    moving(t) { return t - this.t0 < this.dur; }
    moon(g, x, y, r, a) {
      if (a <= 0) return;
      const lx = -this.dirX, disc = new Path2D(); disc.ellipse(x, y, r, r, 0, 0, TWO);
      g.fillStyle = FACE; g.globalAlpha = a; g.fill(disc); g.globalAlpha = 1;
      g.save(); g.clip(disc);
      const sp = Math.min(3.4, Math.max(1.5, r * .15)), lw = Math.min(.6, Math.max(.4, r * .04));
      g.strokeStyle = ink(.5 * a);
      for (let v = -2 * r; v <= 2 * r; v += sp) line(g, x + v + lx * r, y - r, x + v - lx * r, y + r, lw);
      const shade = new Path2D(); shade.ellipse(x, y, r + 1, r + 1, 0, 0, TWO); shade.moveTo(x + lx * r * .38 + r * 1.02, y - r * .38); shade.ellipse(x + lx * r * .38, y - r * .38, r * 1.02, r * 1.02, 0, 0, TWO);
      g.clip(shade, 'evenodd'); g.strokeStyle = ink(.4 * a);
      for (let v = -2 * r; v <= 2 * r; v += sp) line(g, x + v - lx * r, y - r, x + v + lx * r, y + r, lw);
      g.restore();
      g.strokeStyle = ink(.95 * a); g.lineWidth = Math.min(1.3, Math.max(.9, r * .085)); g.stroke(disc);
    }
    draw(g, t) {
      const R = 9, p = Math.min(1, Math.max(0, (t - this.t0) / this.dur));
      const u = p >= 1 ? (this.off ? 1 : 0) : this.u0 + (this.u1 - this.u0) * easeBack(p);
      const cover = Math.max(0, 1 - Math.abs(u - 1) * 1.8);
      const seen = u <= 1 ? Math.min(1, Math.max(0, u / .45)) : Math.min(1, Math.max(0, (2 - u) / .45));
      this.wob += (this.hover * Math.sin(t / 260) * .1 - this.wob) * .12;
      const cx = 32, cy = 31;
      g.strokeStyle = ink(.18); ell(g, 32 - 13, 54 - 2.8, 26, 5.6); g.lineWidth = .7; g.stroke();
      const grow = this.off ? 1 - cover : (p < 1 ? Math.max(0, easeBack(p)) : 1);
      for (let k = 0; k < 16; k++) {
        const lng = k % 2 === 0, a = k / 16 * TWO + this.wob * 1.5, L = (lng ? 8.5 : 5) * grow; if (L < .2) continue;
        g.strokeStyle = ink(lng ? .9 : .6);
        line(g, cx + Math.cos(a) * (R + 3), cy + Math.sin(a) * (R + 3), cx + Math.cos(a) * (R + 3 + L), cy + Math.sin(a) * (R + 3 + L), lng ? 1.1 : .8);
      }
      if (cover > .02) for (const q of this.corona) {
        const a = q[0] + this.wob * 1.5, r0 = R + 2.4, r1 = r0 + (1.6 + 3.4 * q[1]) * cover;
        g.strokeStyle = ink(.55 * cover); line(g, cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, q[2]);
      }
      if (!this.off && p < 1) { const rr = R + 3 + (1 - Math.pow(1 - p, 3)) * 15; g.strokeStyle = ink(.5 * (1 - p)); ell(g, cx - rr, cy - rr, 2 * rr, 2 * rr); g.lineWidth = .8; g.stroke(); }
      ell(g, cx - R, cy - R, 2 * R, 2 * R); g.fillStyle = FACE; g.fill(); g.strokeStyle = ink(.95); g.lineWidth = 1; g.stroke();
      ell(g, cx - 2.6, cy - 2.6, 5.2, 5.2); g.strokeStyle = ink(.85); g.lineWidth = .8; g.stroke();
      ell(g, cx - .9, cy - .9, 1.8, 1.8); g.fillStyle = ink(.9); g.fill();
      const d = 25 * (1 - u);
      this.moon(g, cx + this.dirX * .85 * d + this.wob * 3, cy - .53 * d, R + 1.7, seen);
    }
  }
  return { Die, Hourglass, Eclipse };
})();
