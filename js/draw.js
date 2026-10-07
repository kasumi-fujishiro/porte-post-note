// 画像を描く処理(試作版の drawOpen / drawNew / drawPark / drawCal / brush / ink / block を整理したもの)。
// 画面の部品には触らず、渡された内容 s だけを見て描く。
import { THEMES, SEASONS } from './data.js?v=2';
import { WEEK, layout } from './text.js?v=2';

export const F_TITLE = '"Potta One","Hiragino Maru Gothic ProN","Hiragino Sans","Noto Sans JP",sans-serif';
export const F_HAND = '"Yusei Magic","Hiragino Maru Gothic ProN","Hiragino Sans","Noto Sans JP",sans-serif';
const INK = '#3B2A20', CREAM = '#FBF4E6';

const theme = k => THEMES[k] || THEMES.pink;
const measurer = (c, fam) => (t, s) => { c.font = `${s}px ${fam}`; return c.measureText(t).width; };

// 同じ形の「ゆらぎ」を毎回出すための、決まった乱数
function rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

// 筆でさっと引いたような色の帯
export function brush(c, x, y, w, h, color, seed, alpha = 1) {
  const r = rng(seed || 7), n = 6;
  c.save(); c.strokeStyle = color; c.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const yy = y + h * (i + 0.5) / n + (r() - 0.5) * h * 0.08;
    const x0 = x - w * 0.02 + r() * w * 0.05, x1 = x + w + w * 0.02 - r() * w * 0.06;
    c.globalAlpha = alpha * (0.84 + r() * 0.16); c.lineWidth = h / n * 1.6;
    c.beginPath(); c.moveTo(x0, yy + h * 0.05);
    c.quadraticCurveTo((x0 + x1) / 2, yy + (r() - 0.5) * h * 0.12, x1, yy - h * 0.05); c.stroke();
  }
  c.restore();
}

// 文字。shadow: 右下にずらした色つきの影 / stroke: 細い縁取り
export function ink(c, text, x, y, size, fam, o = {}) {
  c.font = `${size}px ${fam}`; c.textAlign = o.align || 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round'; c.lineCap = 'round';
  if (o.shadow) {
    const d = size * 0.055; c.strokeStyle = o.shadow; c.fillStyle = o.shadow; c.lineWidth = size * 0.15;
    c.strokeText(text, x + d, y + d); c.fillText(text, x + d, y + d); c.strokeText(text, x, y);
  } else if (o.stroke) { c.strokeStyle = o.stroke; c.lineWidth = size * (o.sw || 0.2); c.strokeText(text, x, y); }
  c.fillStyle = o.color || '#FFFFFF'; c.fillText(text, x, y);
}

function sparkle(c, x, y, r, color) {
  c.save(); c.fillStyle = color; c.globalAlpha = 0.95; c.beginPath();
  for (let i = 0; i < 8; i++) { const a = Math.PI / 4 * i, rr = i % 2 ? r * 0.32 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath(); c.fill(); c.restore();
}
function heart(c, x, y, s, color) {
  c.save(); c.strokeStyle = color; c.lineWidth = s * 0.16; c.lineJoin = 'round'; c.beginPath();
  c.moveTo(x, y + s * 0.35);
  c.bezierCurveTo(x - s * 0.9, y - s * 0.25, x - s * 0.35, y - s * 0.85, x, y - s * 0.3);
  c.bezierCurveTo(x + s * 0.35, y - s * 0.85, x + s * 0.9, y - s * 0.25, x, y + s * 0.35);
  c.stroke(); c.restore();
}

// ---------- 季節の飾り(営業カレンダー用)。x, y が中心、r が半径、a が傾き ----------
function petals(c, x, y, r, n, a, color, rr = 0.42, dist = 0.52) {
  c.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const t = a + Math.PI * 2 * i / n;
    c.beginPath(); c.arc(x + Math.cos(t) * r * dist, y + Math.sin(t) * r * dist, r * rr, 0, Math.PI * 2); c.fill();
  }
}
function dot(c, x, y, r, color) { c.fillStyle = color; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
function starPath(c, x, y, r, n, inner, a) {
  c.beginPath();
  for (let i = 0; i < n * 2; i++) { const t = a - Math.PI / 2 + Math.PI * i / n, rr = i % 2 ? r * inner : r; c.lineTo(x + Math.cos(t) * rr, y + Math.sin(t) * rr); }
  c.closePath();
}
const MOTIFS = {
  plum(c, x, y, r, a, color) { petals(c, x, y, r, 5, a, color, 0.42, 0.5); dot(c, x, y, r * 0.22, '#F6D36B'); },
  sakura(c, x, y, r, a, color) {
    c.fillStyle = color;
    for (let i = 0; i < 5; i++) {
      const t = a + Math.PI * 2 * i / 5;
      c.save(); c.translate(x, y); c.rotate(t);
      c.beginPath(); c.ellipse(r * 0.5, 0, r * 0.5, r * 0.3, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = CREAM; c.beginPath(); c.moveTo(r * 1.04, 0); c.lineTo(r * 0.86, -r * 0.1); c.lineTo(r * 0.86, r * 0.1); c.closePath(); c.fill();
      c.restore(); c.fillStyle = color;
    }
    dot(c, x, y, r * 0.16, '#FFFFFF');
  },
  flower4(c, x, y, r, a, color) { petals(c, x, y, r, 4, a, color, 0.4, 0.46); dot(c, x, y, r * 0.16, '#FFFFFF'); },
  sunflower(c, x, y, r, a, color) {
    c.fillStyle = color;
    for (let i = 0; i < 12; i++) {
      const t = a + Math.PI * 2 * i / 12;
      c.beginPath(); c.ellipse(x + Math.cos(t) * r * 0.62, y + Math.sin(t) * r * 0.62, r * 0.36, r * 0.15, t, 0, Math.PI * 2); c.fill();
    }
    dot(c, x, y, r * 0.38, '#7A4A26');
  },
  heart(c, x, y, r, a, color) {
    c.save(); c.translate(x, y); c.rotate(a * 0.4); c.fillStyle = color; c.beginPath();
    c.moveTo(0, r * 0.7);
    c.bezierCurveTo(-r * 1.3, -r * 0.1, -r * 0.55, -r * 1.05, 0, -r * 0.4);
    c.bezierCurveTo(r * 0.55, -r * 1.05, r * 1.3, -r * 0.1, 0, r * 0.7);
    c.fill(); c.restore();
  },
  leaf(c, x, y, r, a, color) {
    c.save(); c.translate(x, y); c.rotate(a);
    c.fillStyle = color; c.beginPath(); c.moveTo(0, r); c.quadraticCurveTo(-r * 0.9, 0, 0, -r); c.quadraticCurveTo(r * 0.9, 0, 0, r); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = r * 0.08; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, r * 0.95); c.lineTo(0, -r * 0.6); c.stroke();
    c.restore();
  },
  star(c, x, y, r, a, color) { c.fillStyle = color; starPath(c, x, y, r, 5, 0.45, a * 0.3); c.fill(); },
  maple(c, x, y, r, a, color) {
    // 5つの葉先と、そのあいだの小さなギザギザ
    c.fillStyle = color; c.beginPath();
    for (let i = 0; i < 5; i++) {
      const t = a * 0.3 - Math.PI / 2 + Math.PI * 2 * i / 5, s = Math.PI * 2 / 5, cy = y - r * 0.08;
      [[0, 1], [s * 0.2, 0.62], [s * 0.3, 0.74], [s * 0.5, 0.36], [s * 0.7, 0.74], [s * 0.8, 0.62]]
        .forEach(([d, k]) => c.lineTo(x + Math.cos(t + d) * r * k, cy + Math.sin(t + d) * r * k));
    }
    c.closePath(); c.fill();
    c.strokeStyle = color; c.lineWidth = r * 0.1; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y + r * 0.2); c.lineTo(x + r * 0.15, y + r * 1.05); c.stroke();
  },
  moon(c, x, y, r, a, color) { dot(c, x, y, r, color); dot(c, x + r * 0.45, y - r * 0.3, r * 0.85, CREAM); },
  acorn(c, x, y, r, a, color) {
    c.save(); c.translate(x, y); c.rotate(a * 0.4);
    c.fillStyle = '#C9894A'; c.beginPath(); c.ellipse(0, r * 0.2, r * 0.55, r * 0.7, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = color; c.beginPath(); c.ellipse(0, -r * 0.22, r * 0.66, r * 0.36, 0, Math.PI, 0); c.lineTo(r * 0.66, -r * 0.18); c.lineTo(-r * 0.66, -r * 0.18); c.fill();
    c.strokeStyle = color; c.lineWidth = r * 0.12; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, -r * 0.55); c.lineTo(r * 0.1, -r * 0.8); c.stroke();
    c.restore();
  },
  snow(c, x, y, r, a, color) {
    c.save(); c.translate(x, y); c.rotate(a * 0.3); c.strokeStyle = color; c.lineWidth = r * 0.13; c.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      c.rotate(Math.PI / 3); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -r);
      c.moveTo(0, -r * 0.55); c.lineTo(-r * 0.25, -r * 0.8); c.moveTo(0, -r * 0.55); c.lineTo(r * 0.25, -r * 0.8); c.stroke();
    }
    c.restore();
  }
};
// 右上と左下のすみに、3つずつ置く(1080幅のときの位置と大きさ。H は下からの距離)
const SPOTS = [[-160, 120, 70], [-292, 70, 44], [-80, 232, 36], [150, -160, 70], [282, -100, 44], [62, -205, 30]];
function seasonal(c, W, H, u, season) {
  SPOTS.forEach(([sx, sy, sr], i) => {
    const x = sx < 0 ? W + sx * u : sx * u, y = sy < 0 ? H + sy * u : sy * u;
    const k = season.motifs[i % season.motifs.length], color = season.colors[i % season.colors.length];
    c.save(); c.globalAlpha = 0.95; MOTIFS[k](c, x, y, sr * u, i * 0.7 - 0.5, color); c.restore();
  });
}

// 写真を画像いっぱいに敷く。pos(0〜100)で上下の位置を決める
function cover(c, W, H, photo, pos) {
  if (!photo) {
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#CDB9A6'); g.addColorStop(1, '#8F7968');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    ink(c, 'ここに写真が入ります', W / 2, H / 2, W * 0.05, F_HAND, { color: 'rgba(255,255,255,.85)' });
    return;
  }
  const iw = photo.naturalWidth || photo.width, ih = photo.naturalHeight || photo.height, sc = Math.max(W / iw, H / ih), sw = W / sc, sh = H / sc;
  c.drawImage(photo, (iw - sw) / 2, (ih - sh) * (pos / 100), sw, sh, 0, 0, W, H);
}
// 写真の上下に、うすい影のグラデーション
function scrim(c, W, H, top, bottom) {
  const g1 = c.createLinearGradient(0, 0, 0, H * 0.34); g1.addColorStop(0, `rgba(0,0,0,${top})`); g1.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g1; c.fillRect(0, 0, W, H * 0.34);
  const g2 = c.createLinearGradient(0, H * 0.66, 0, H); g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(1, `rgba(0,0,0,${bottom})`);
  c.fillStyle = g2; c.fillRect(0, H * 0.66, W, H * 0.34);
}
// 複数行の文を、中央ぞろえで描く
function lines(c, text, { size, min, maxW, cx, y, lh, from = 'top', style }) {
  const bk = layout(text, { size, min, maxW, measure: measurer(c, F_HAND) });
  const h = bk.lines.length * bk.size * lh, y0 = from === 'top' ? y : y - h;
  bk.lines.forEach((l, i) => ink(c, l, cx, y0 + (i + 0.5) * bk.size * lh, bk.size, F_HAND, style));
  return h;
}

function drawOpen(c, f, u, s) {
  const W = f.w, H = f.h, T = theme(s.theme), top = f.top * u, bottom = H - f.bottom * u, cx = W / 2, o = s.open;
  cover(c, W, H, s.photo, s.photoPos); scrim(c, W, H, 0.3, 0.34);
  const dSize = 190 * u, bandH = 128 * u;
  const blockH = dSize * 1.05 + bandH + (s.hours ? 70 * u : 0), y0 = o.pos === 'top' ? top : bottom - blockH;
  ink(c, o.date, cx, y0 + dSize * 0.52, dSize, F_TITLE, { shadow: T.a });
  sparkle(c, cx - 330 * u, y0 + 40 * u, 26 * u, '#FFFFFF'); sparkle(c, cx + 350 * u, y0 + 150 * u, 18 * u, '#FFFFFF');
  heart(c, cx + 310 * u, y0 + 30 * u, 26 * u, '#FFFFFF');
  const by = y0 + dSize * 1.05; c.font = `${92 * u}px ${F_TITLE}`; const bw = c.measureText('OPEN').width + 150 * u;
  brush(c, cx - bw / 2, by, bw, bandH, T.a, 11); ink(c, 'OPEN', cx, by + bandH * 0.52, 92 * u, F_TITLE);
  if (s.hours) ink(c, s.hours, cx, by + bandH + 42 * u, 44 * u, F_HAND, { stroke: T.d });
  if (!o.phrase) return;
  const opp = o.pos === 'top';
  lines(c, o.phrase, { size: 58 * u, min: 44 * u, maxW: W - 2 * f.x * u, cx, y: opp ? bottom : top, lh: 1.5, from: opp ? 'bottom' : 'top', style: { stroke: T.d, sw: 0.24 } });
}

function drawNew(c, f, u, s) {
  const W = f.w, H = f.h, p = s.product, T = theme(p && p.color), top = f.top * u, bottom = H - f.bottom * u, cx = W / 2, maxW = W - 2 * f.x * u;
  cover(c, W, H, s.photo, s.photoPos); scrim(c, W, H, 0.34, 0.38);
  let y = top;
  if (s.badge) {
    const bs = 50 * u; c.font = `${bs}px ${F_TITLE}`; const bw = c.measureText(s.badge).width + 90 * u;
    brush(c, cx - bw / 2, y, bw, 84 * u, T.a, 23); ink(c, s.badge, cx, y + 44 * u, bs, F_TITLE); y += 110 * u;
  }
  const name = p ? p.name : '商品をえらんでください';
  // 商品名は、幅に合わせて小さくし、それでも入らなければ2行にする
  const bk = layout(name, { size: 128 * u, min: 78 * u, maxW, measure: measurer(c, F_TITLE) });
  const size = bk.lines.length === 1 ? bk.size : 84 * u;
  const nl = bk.lines.length === 1 ? bk.lines : layout(name, { size, min: size, maxW, measure: measurer(c, F_TITLE) }).lines.slice(0, 2);
  nl.forEach((l, i) => ink(c, l, cx, y + size * 0.6 + i * size * 1.2, size, F_TITLE, { shadow: T.a }));
  y += nl.length * size * 1.2 + 8 * u; c.font = `${size}px ${F_TITLE}`;
  const uw = Math.min(maxW, Math.max(...nl.map(l => c.measureText(l).width)) * 1.02); brush(c, cx - uw / 2, y, uw, 26 * u, T.a, 31);
  heart(c, cx - maxW / 2 + 20 * u, top - 34 * u, 24 * u, '#FFFFFF'); sparkle(c, cx + maxW / 2 - 16 * u, top - 20 * u, 22 * u, '#FFFFFF');
  if (p && p.desc) lines(c, p.desc, { size: 56 * u, min: 44 * u, maxW, cx, y: bottom, lh: 1.55, from: 'bottom', style: { stroke: T.d, sw: 0.24 } });
}

function drawPark(c, f, u, s) {
  const W = f.w, H = f.h, T = theme(s.theme), cx = W / 2, maxW = W - 2 * f.x * u, withPhoto = s.parkPhoto && s.photo;
  if (withPhoto) { cover(c, W, H, s.photo, s.photoPos); c.fillStyle = 'rgba(0,0,0,.36)'; c.fillRect(0, 0, W, H); }
  else { c.fillStyle = CREAM; c.fillRect(0, 0, W, H); brush(c, -60 * u, 60 * u, W * 0.7, 150 * u, T.a, 41, 0.2); brush(c, W * 0.4, H - 220 * u, W * 0.7, 150 * u, T.a, 43, 0.2); }
  const fs = 56 * u, lh = 1.75, m = measurer(c, F_HAND);
  // 案内の行は、いちばん小さくなった行に大きさをそろえる
  const size = Math.min(fs, ...s.parkLines.map(l => layout(l, { size: fs, min: 42 * u, maxW, measure: m }).size));
  const wrapped = s.parkLines.flatMap(l => layout(l, { size, min: size, maxW, measure: m }).lines.map(t => ({ t, size })));
  const total = 190 * u + 60 * u + 150 * u + 70 * u + wrapped.length * fs * lh;
  let y = f.top * u + Math.max(0, (H - (f.top + f.bottom) * u - total) / 2);
  c.fillStyle = T.a; c.beginPath(); c.arc(cx, y + 95 * u, 95 * u, 0, Math.PI * 2); c.fill(); ink(c, 'P', cx, y + 100 * u, 130 * u, F_TITLE); y += 250 * u;
  const tSize = 96 * u, title = '駐車場のご案内';
  ink(c, title, cx, y + tSize * 0.55, tSize, F_TITLE, withPhoto ? { shadow: T.a } : { color: T.d });
  y += tSize * 1.2; c.font = `${tSize}px ${F_TITLE}`; const uw = Math.min(maxW, c.measureText(title).width); brush(c, cx - uw / 2, y, uw, 24 * u, T.a, 47); y += 94 * u;
  if (!wrapped.length) ink(c, '案内の文を入れてください', cx, y + fs * lh / 2, 40 * u, F_HAND, withPhoto ? { stroke: T.d } : { color: T.d });
  wrapped.forEach((l, i) => ink(c, l.t, cx, y + (i + 0.5) * fs * lh, l.size, F_HAND, withPhoto ? { stroke: T.d, sw: 0.24 } : { color: INK }));
}

function drawCal(c, f, u, s) {
  const W = f.w, H = f.h, T = theme(s.theme), cx = W / 2, x0 = f.x * u, w = W - 2 * x0, mi = s.cal, rows = Math.ceil((mi.first + mi.n) / 7);
  // 帯と飾りは、その月の季節の色にする
  const season = SEASONS[mi.m];
  c.fillStyle = CREAM; c.fillRect(0, 0, W, H);
  brush(c, -80 * u, 50 * u, W * 0.6, 130 * u, season.band, 51, 0.28); brush(c, W * 0.5, H - 190 * u, W * 0.6, 130 * u, season.band, 53, 0.28);
  seasonal(c, W, H, u, season);
  const st = Object.values(mi.map), legend = [st.includes('c') && ['c', 'お休み'], st.includes('s') && ['s', '時間変更']].filter(Boolean), note = mi.note;
  const titleH = 250 * u, head = 70 * u, tail = (legend.length ? 80 * u : 0) + (note ? 70 * u : 0) + (s.hours ? 70 * u : 0);
  const cell = Math.min(w / 7, (H - (f.top + f.bottom) * u - titleH - head - tail) / rows), total = titleH + head + rows * cell + tail;
  let y = f.top * u + Math.max(0, (H - (f.top + f.bottom) * u - total) / 2);
  ink(c, `${mi.y}年`, cx, y + 26 * u, 40 * u, F_HAND, { color: T.d });
  const tSize = 100 * u, title = `${mi.m}月の営業日`; ink(c, title, cx, y + 120 * u, tSize, F_TITLE, { color: INK });
  c.font = `${tSize}px ${F_TITLE}`; const uw = c.measureText(title).width; brush(c, cx - uw / 2, y + 180 * u, uw, 24 * u, T.a, 57); y += titleH;
  const cw = w / 7;
  WEEK.forEach((d, i) => ink(c, d, x0 + cw * (i + 0.5), y + head * 0.42, 34 * u, F_HAND, { color: i === 0 ? T.a : '#8A7566' }));
  c.strokeStyle = '#8A7566'; c.globalAlpha = 0.45; c.lineWidth = 2 * u; c.beginPath(); c.moveTo(x0, y + head - 6 * u); c.lineTo(x0 + w, y + head - 6 * u); c.stroke(); c.globalAlpha = 1; y += head;
  const r = Math.min(cw, cell) * 0.4, num = Math.min(cw, cell) * 0.4;
  for (let d = 1; d <= mi.n; d++) {
    const idx = mi.first + d - 1, px = x0 + cw * (idx % 7 + 0.5), py = y + cell * (Math.floor(idx / 7) + 0.5), k = mi.map[d];
    if (k === 'c') { c.fillStyle = T.a; c.beginPath(); c.arc(px, py, r, 0, Math.PI * 2); c.fill(); }
    if (k === 's') { c.strokeStyle = T.a; c.lineWidth = 4 * u; c.beginPath(); c.arc(px, py, r - 2 * u, 0, Math.PI * 2); c.stroke(); }
    ink(c, String(d), px, py + num * 0.04, num, F_HAND, { color: k === 'c' ? '#FFFFFF' : INK });
  }
  y += rows * cell;
  if (legend.length) {
    const size = 36 * u, rr = 16 * u, gap = 50 * u; c.font = `${size}px ${F_HAND}`;
    const ws = legend.map(([, t]) => rr * 2 + 14 * u + c.measureText(t).width);
    let px = cx - (ws.reduce((a, b) => a + b, 0) + gap * (legend.length - 1)) / 2;
    legend.forEach(([k, t], i) => {
      c.beginPath(); c.arc(px + rr, y + 44 * u, rr - (k === 's' ? 2 * u : 0), 0, Math.PI * 2);
      if (k === 'c') { c.fillStyle = T.a; c.fill(); } else { c.strokeStyle = T.a; c.lineWidth = 4 * u; c.stroke(); }
      ink(c, t, px + rr * 2 + 14 * u, y + 46 * u, size, F_HAND, { color: INK, align: 'left' }); px += ws[i] + gap;
    });
    y += 80 * u;
  }
  if (note) y += lines(c, note, { size: 40 * u, min: 30 * u, maxW: w, cx, y: y + 10 * u, lh: 1.4, style: { color: INK } }) + 14 * u;
  if (s.hours) ink(c, `営業時間 ${s.hours}`, cx, y + 36 * u, 40 * u, F_HAND, { color: T.d });
}

const DRAW = { open: drawOpen, new: drawNew, park: drawPark, cal: drawCal };

export function draw(canvas, f, s) {
  if (canvas.width !== f.w || canvas.height !== f.h) { canvas.width = f.w; canvas.height = f.h; }
  const c = canvas.getContext('2d'); c.globalAlpha = 1;
  DRAW[s.kind](c, f, f.w / 1080, s);
}
