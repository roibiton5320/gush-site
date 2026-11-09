// The plugin's line icons (UI/Icons.h), 30 x 26 boxes, as SVG path strings.
window.Icons = (function () {
  class P {
    constructor() { this.d = ''; }
    M(x, y) { this.d += `M${x} ${y}`; return this; }
    L(x, y) { this.d += `L${x} ${y}`; return this; }
    C(a, b, c, d, e, f) { this.d += `C${a} ${b} ${c} ${d} ${e} ${f}`; return this; }
    Z() { this.d += 'Z'; return this; }
    E(x, y, w, h) { const rx = w / 2, ry = h / 2; this.d += `M${x + w} ${y + ry}A${rx} ${ry} 0 1 0 ${x} ${y + ry}A${rx} ${ry} 0 1 0 ${x + w} ${y + ry}Z`; return this; }
    R(x, y, w, h, r) { this.d += `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`; return this; }
    T(a, b, c, d, e, f) { return this.M(a, b).L(c, d).L(e, f).Z(); }
    // JUCE addCentredArc: angles from 12 o'clock, clockwise; sampled
    A(cx, cy, rx, ry, from, to, newSub = true) {
      const n = Math.max(8, Math.ceil(Math.abs(to - from) / 0.12));
      for (let i = 0; i <= n; i++) { const a = from + (to - from) * i / n, x = cx + rx * Math.sin(a), y = cy - ry * Math.cos(a); this.d += (i === 0 && newSub ? 'M' : 'L') + x.toFixed(2) + ' ' + y.toFixed(2); }
      return this;
    }
  }
  const D = {
    Tone: () => new P().M(3, 17).C(5, 7, 25, 7, 27, 17).Z().E(12, 7.5, 6, 3.4).M(8, 21).C(12, 23, 18, 23, 22, 21),
    Envelope: () => new P().M(2, 22).L(7, 5).L(12, 12).L(20, 12).L(28, 22),
    Halo: () => new P().E(11, 14, 8, 8).E(5, 7, 2.4, 2.4).E(13.8, 3, 2.4, 2.4).E(22.6, 7, 2.4, 2.4).E(2, 15, 1.8, 1.8).E(26, 15, 1.8, 1.8),
    Pitch: () => new P().M(10, 22).L(10, 5).M(6, 9).L(10, 5).L(14, 9).M(20, 4).L(20, 21).M(16, 17).L(20, 21).L(24, 17),
    Player: () => new P().E(3, 15, 6, 6).E(12, 5, 6, 6).E(21, 13, 6, 6).M(8, 16).L(13, 10).M(17.5, 9.5).L(22, 14),
    Delay: () => new P().E(2, 10, 6, 6).E(12, 11, 4.5, 4.5).E(20, 12, 3, 3).E(26, 12.5, 2, 2),
    Cosmos: () => new P().E(10, 9, 10, 10).M(4, 17).C(8, 11, 22, 9, 26, 12).M(4, 4).L(4, 7).M(2.5, 5.5).L(5.5, 5.5).M(25, 20).L(25, 23).M(23.5, 21.5).L(26.5, 21.5),
    Random: () => new P().R(6, 4, 18, 18, 3).E(10, 8, 2.4, 2.4).E(17.6, 15.6, 2.4, 2.4).E(13.8, 11.8, 2.4, 2.4),
    Wander: () => new P().M(3, 20).C(8, 8, 12, 22, 16, 12).C(19, 5, 24, 16, 27, 6),
    Motif: () => new P().A(15, 13, 9, 7, 0.4, 5.9).M(20, 3.5).L(17, 6.6).L(21, 8.8),
    Arp: () => new P().M(3, 22).L(9, 22).L(9, 16).L(15, 16).L(15, 10).L(21, 10).L(21, 4).L(27, 4),
    Filter: () => new P().M(2, 12).L(13, 12).C(17, 12, 17, 4, 19, 4).C(21, 4, 21, 12, 28, 22),
    Ring: () => { const p = new P().E(3, 7, 12, 12); return p.A(19, 13, 6, 6, 0.5, 5.6); },
    Strange: () => { const p = new P().M(15, 13); for (let k = 1; k <= 40; k++) { const t = k / 40 * 12; p.L((15 + .85 * t * Math.cos(t)).toFixed(2), (13 + .85 * t * Math.sin(t)).toFixed(2)); } return p; },
    Redo: () => new P().M(22, 9).L(10, 9).C(4, 9, 4, 20, 10, 20).L(20, 20).M(18, 5).L(22, 9).L(18, 13),
    Save: () => new P().M(15, 3).L(15, 16).M(10, 11).L(15, 16).L(20, 11).M(5, 17).L(5, 22).L(25, 22).L(25, 17),
    Left: () => new P().M(18, 5).L(10, 13).L(18, 21),
    Right: () => new P().M(12, 5).L(20, 13).L(12, 21),
    Cloud: () => new P().E(5, 11, 8, 8).E(11, 7, 9, 9).E(17, 11, 8, 8),
    Shimmer: () => new P().E(5, 17, 5, 5).M(14, 18).L(14, 12).M(12, 14).L(14, 12).L(16, 14).M(22, 12).L(22, 4).M(20, 6).L(22, 4).L(24, 6),
    Reverse: () => new P().M(3, 13).L(25, 5).L(25, 21).Z(),
    Scatter: () => new P().M(4, 18).L(8, 15).M(12, 8).L(15, 5).M(17, 20).L(21, 18).M(23, 9).L(26, 12).M(11, 15).L(13, 16),
    Stutter: () => { const p = new P(); for (let k = 0; k < 5; k++) p.M(5 + 5 * k, 8).L(5 + 5 * k, 18); return p; },
    Freeze: () => { const p = new P(); for (let k = 0; k < 3; k++) { const a = k * 1.0472; p.M(15 - 9 * Math.cos(a), 13 - 9 * Math.sin(a)).L(15 + 9 * Math.cos(a), 13 + 9 * Math.sin(a)); } return p; },
    Mute: () => new P().M(5, 19).C(5, 9, 25, 9, 25, 19).Z().M(3, 3).L(27, 24),
    Lock: () => new P().R(8, 12, 14, 11, 2).M(11, 12).L(11, 8).C(11, 3.5, 19, 3.5, 19, 8).L(19, 12).E(14.2, 16.2, 1.6, 1.6),
    Solo: () => new P().M(8, 23).C(8, 16, 22, 16, 22, 23).Z().M(12, 2).L(4, 14).M(18, 2).L(26, 14),
  };
  // an <svg> string filling its box (30:26 viewBox, drawn centred and kept in proportion), stroke width given in output px of a w-px wide box
  function svg(name, w, thick = 1.3, cls = '') {
    const sw = (thick * 30 / w).toFixed(3);
    return `<svg class="ic ${cls}" viewBox="0 0 30 26" preserveAspectRatio="xMidYMid meet" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><path d="${D[name]().d}"/></svg>`;
  }
  return { svg, names: Object.keys(D) };
})();
