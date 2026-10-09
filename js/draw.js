// 画像を描く処理(試作版の drawOpen / drawNew / drawPark / drawCal / brush / ink / block を整理したもの)。
// 画面の部品には触らず、渡された内容 s だけを見て描く。
import { THEMES, SEASONS } from './data.js?v=8';
import { WEEK, layout } from './text.js?v=8';

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

// ---------- 季節の飾り(営業カレンダー用)。x, y が中心、r が大きさの半径、a が傾き ----------
const BROWN = '#5B3A24';
function dot(c, x, y, r, color) { c.fillStyle = color; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
function petals(c, x, y, r, n, a, color, rr = 0.42, dist = 0.52) {
  for (let i = 0; i < n; i++) { const t = a + Math.PI * 2 * i / n; dot(c, x + Math.cos(t) * r * dist, y + Math.sin(t) * r * dist, r * rr, color); }
}
function starPath(c, x, y, r, n, inner, a) {
  c.beginPath();
  for (let i = 0; i < n * 2; i++) { const t = a - Math.PI / 2 + Math.PI * i / n, rr = i % 2 ? r * inner : r; c.lineTo(x + Math.cos(t) * rr, y + Math.sin(t) * rr); }
  c.closePath();
}
function heartPath(c, r) {
  c.beginPath(); c.moveTo(0, r * 0.7);
  c.bezierCurveTo(-r * 1.3, -r * 0.1, -r * 0.55, -r * 1.05, 0, -r * 0.4);
  c.bezierCurveTo(r * 0.55, -r * 1.05, r * 1.3, -r * 0.1, 0, r * 0.7);
}
// 傾けて描くときの決まりごと
function tilt(c, x, y, a, fn) { c.save(); c.translate(x, y); c.rotate(a); fn(); c.restore(); }
function sakura(c, x, y, r, a, color) {
  for (let i = 0; i < 5; i++) {
    tilt(c, x, y, a + Math.PI * 2 * i / 5, () => {
      c.fillStyle = color; c.beginPath(); c.ellipse(r * 0.5, 0, r * 0.5, r * 0.3, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = CREAM; c.beginPath(); c.moveTo(r * 1.04, 0); c.lineTo(r * 0.86, -r * 0.1); c.lineTo(r * 0.86, r * 0.1); c.closePath(); c.fill();
    });
  }
  dot(c, x, y, r * 0.16, '#FFFFFF');
}
function leaf(c, x, y, r, a, color) {
  tilt(c, x, y, a, () => {
    c.fillStyle = color; c.beginPath(); c.moveTo(0, r); c.quadraticCurveTo(-r * 0.9, 0, 0, -r); c.quadraticCurveTo(r * 0.9, 0, 0, r); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = r * 0.08; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, r * 0.95); c.lineTo(0, -r * 0.6); c.stroke();
  });
}
function maple(c, x, y, r, a, color) {
  // 5つの葉先と、そのあいだの小さなギザギザ
  c.fillStyle = color; c.beginPath();
  const cy = y - r * 0.08, s = Math.PI * 2 / 5;
  for (let i = 0; i < 5; i++) {
    const t = a * 0.3 - Math.PI / 2 + s * i;
    [[0, 1], [s * 0.2, 0.62], [s * 0.3, 0.74], [s * 0.5, 0.36], [s * 0.7, 0.74], [s * 0.8, 0.62]]
      .forEach(([d, k]) => c.lineTo(x + Math.cos(t + d) * r * k, cy + Math.sin(t + d) * r * k));
  }
  c.closePath(); c.fill();
  c.strokeStyle = color; c.lineWidth = r * 0.1; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y + r * 0.2); c.lineTo(x + r * 0.15, y + r * 1.05); c.stroke();
}
const MOTIFS = {
  plum: (c, x, y, r, a) => { petals(c, x, y, r, 5, a, '#D9465F', 0.42, 0.5); dot(c, x, y, r * 0.22, '#F6D36B'); },
  plumPink: (c, x, y, r, a) => { petals(c, x, y, r, 5, a, '#EE9AAA', 0.42, 0.5); dot(c, x, y, r * 0.22, '#F6D36B'); },
  heart: (c, x, y, r, a) => tilt(c, x, y, a * 0.4, () => { c.fillStyle = '#E58FA8'; heartPath(c, r); c.fill(); }),
  chocoHeart: (c, x, y, r, a) => tilt(c, x, y, a * 0.4, () => {
    c.fillStyle = '#6B3E26'; heartPath(c, r); c.fill();
    // ピンクのチョコペンの線
    c.strokeStyle = '#F2A7BE'; c.lineWidth = r * 0.12; c.lineCap = 'round'; c.beginPath();
    c.moveTo(-r * 0.6, -r * 0.15); c.quadraticCurveTo(-r * 0.3, -r * 0.4, 0, -r * 0.1); c.quadraticCurveTo(r * 0.3, r * 0.2, r * 0.6, -r * 0.15); c.stroke();
  }),
  chocoBar: (c, x, y, r, a) => tilt(c, x, y, a * 0.5, () => {
    const w = r * 1.5, h = r * 1.9;
    c.fillStyle = '#6B3E26'; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, r * 0.12); c.fill();
    c.strokeStyle = '#8C5636'; c.lineWidth = r * 0.07;
    for (let i = 1; i < 2; i++) { c.beginPath(); c.moveTo(-w / 2 + w * i / 2, -h / 2); c.lineTo(-w / 2 + w * i / 2, h * 0.05); c.stroke(); }
    for (let j = 1; j < 3; j++) { c.beginPath(); c.moveTo(-w / 2, -h / 2 + h * 0.55 * j / 3); c.lineTo(w / 2, -h / 2 + h * 0.55 * j / 3); c.stroke(); }
    // 下半分は包み紙
    c.fillStyle = '#E58FA8'; c.beginPath(); c.roundRect(-w / 2 - r * 0.05, h * 0.05, w + r * 0.1, h * 0.45, r * 0.08); c.fill();
    c.fillStyle = '#FFFFFF'; c.fillRect(-w / 2 - r * 0.05, h * 0.2, w + r * 0.1, h * 0.06);
  }),
  nanohana: (c, x, y, r, a) => {
    for (const [dx, dy, k] of [[0, 0, 0.55], [-0.55, 0.35, 0.42], [0.5, 0.45, 0.4]]) {
      petals(c, x + dx * r, y + dy * r, r * k, 4, a, '#EBC21E', 0.42, 0.5); dot(c, x + dx * r, y + dy * r, r * k * 0.18, '#C9930A');
    }
  },
  leaf: (c, x, y, r, a) => leaf(c, x, y, r, a, '#5E9E32'),
  leafLight: (c, x, y, r, a) => leaf(c, x, y, r, a, '#9DCB6B'),
  sakura: (c, x, y, r, a) => sakura(c, x, y, r, a, '#EE8FAD'),
  sakuraLight: (c, x, y, r, a) => sakura(c, x, y, r, a, '#F7C2D2'),
  hydrangea: (c, x, y, r, a) => { for (const [dx, dy] of [[0, 0], [-0.5, 0.3], [0.5, 0.3], [0, 0.6], [0, -0.45]]) { petals(c, x + dx * r, y + dy * r, r * 0.42, 4, a, '#7083CC', 0.42, 0.48); dot(c, x + dx * r, y + dy * r, r * 0.06, '#FFFFFF'); } },
  hydrangeaPurple: (c, x, y, r, a) => { for (const [dx, dy] of [[0, 0], [-0.5, 0.3], [0.5, 0.3], [0, 0.6], [0, -0.45]]) { petals(c, x + dx * r, y + dy * r, r * 0.42, 4, a, '#A88FD4', 0.42, 0.48); dot(c, x + dx * r, y + dy * r, r * 0.06, '#FFFFFF'); } },
  drop: (c, x, y, r) => { c.fillStyle = '#8FB0E0'; c.beginPath(); c.moveTo(x, y - r); c.bezierCurveTo(x + r * 0.9, y + r * 0.1, x + r * 0.6, y + r, x, y + r); c.bezierCurveTo(x - r * 0.6, y + r, x - r * 0.9, y + r * 0.1, x, y - r); c.fill(); },
  star: (c, x, y, r, a) => { c.fillStyle = '#EDBB2E'; starPath(c, x, y, r, 5, 0.45, a * 0.3); c.fill(); },
  starBlue: (c, x, y, r, a) => { c.fillStyle = '#6B95D3'; starPath(c, x, y, r, 5, 0.45, a * 0.3); c.fill(); },
  sunflower: (c, x, y, r, a) => {
    c.fillStyle = '#F0AE24';
    for (let i = 0; i < 12; i++) { const t = a + Math.PI * 2 * i / 12; c.beginPath(); c.ellipse(x + Math.cos(t) * r * 0.62, y + Math.sin(t) * r * 0.62, r * 0.36, r * 0.15, t, 0, Math.PI * 2); c.fill(); }
    dot(c, x, y, r * 0.38, '#7A4A26');
  },
  // 満月:うすい光の輪と、やわらかな模様
  moon: (c, x, y, r) => {
    dot(c, x, y, r * 1.28, 'rgba(240,200,80,.18)'); dot(c, x, y, r * 1.12, 'rgba(240,200,80,.22)');
    dot(c, x, y, r, '#F0CB55');
    dot(c, x - r * 0.3, y - r * 0.2, r * 0.2, 'rgba(214,168,52,.45)'); dot(c, x + r * 0.28, y + r * 0.25, r * 0.14, 'rgba(214,168,52,.4)'); dot(c, x + r * 0.15, y - r * 0.42, r * 0.09, 'rgba(214,168,52,.4)');
  },
  // 天の川:ななめに、うすい光の粒を重ねて雲のような帯にし、小さな星をちりばめる
  milkyWay: (c, x, y, r) => {
    const x0 = x - r * 1.15, y0 = y - r * 1.35, x1 = x + r * 1.15, y1 = y + r * 1.35, rnd = rng(77);
    const len = Math.hypot(x1 - x0, y1 - y0), nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
    const at = (t, off) => [x0 + (x1 - x0) * t + nx * off, y0 + (y1 - y0) * t + ny * off];
    const spread = () => (rnd() + rnd() + rnd() - 1.5) * r * 0.42;
    for (let i = 0; i < 90; i++) {
      const t = rnd(), [px, py] = at(t, spread()), fade = Math.sin(Math.PI * t);
      dot(c, px, py, r * (0.12 + rnd() * 0.2), `rgba(127,164,218,${(0.07 * fade).toFixed(3)})`);
    }
    for (let i = 0; i < 50; i++) {
      const t = 0.06 + rnd() * 0.88, [px, py] = at(t, spread()), k = rnd();
      if (k > 0.92) { c.fillStyle = '#EDBB2E'; starPath(c, px, py, r * 0.1, 5, 0.45, 0); c.fill(); }
      else dot(c, px, py, r * (0.02 + rnd() * 0.03), k > 0.5 ? '#5F86C4' : '#E2B53C');
    }
  },
  // 笹と短冊
  sasa: (c, x, y, r0) => {
    const r = r0 * 1.3;
    c.strokeStyle = '#5E9E32'; c.lineWidth = r * 0.07; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x - r * 0.1, y + r * 0.95); c.quadraticCurveTo(x - r * 0.05, y, x + r * 0.3, y - r * 0.9); c.stroke();
    [[0.12, -0.55, -0.8], [0.25, -0.8, 0.7], [0.0, -0.1, -0.7], [0.02, -0.15, 0.8], [-0.06, 0.45, -0.6], [-0.05, 0.4, 0.7]].forEach(([dx, dy, ang]) => {
      tilt(c, x + dx * r, y + dy * r, ang, () => { c.fillStyle = '#6FAE45'; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(r * 0.22, -r * 0.1, r * 0.55, 0); c.quadraticCurveTo(r * 0.22, r * 0.1, 0, 0); c.fill(); });
    });
    // 短冊は、葉のすぐ下に吊るす
    [[0.42, -0.42, '#E4517A'], [-0.36, 0.0, '#EDBB2E'], [0.35, 0.22, '#6B95D3']].forEach(([dx, dy, col]) => {
      const tx = x + dx * r, ty = y + dy * r;
      c.strokeStyle = '#B9A07A'; c.lineWidth = r * 0.02; c.beginPath(); c.moveTo(tx, ty - r * 0.1); c.lineTo(tx, ty); c.stroke();
      c.fillStyle = col; c.fillRect(tx - r * 0.07, ty, r * 0.14, r * 0.42);
    });
  },
  // お月見だんご:三方(台)の上に、白いだんごを3・2・1と積む
  tsukimiDango: (c, x, y, r) => {
    c.fillStyle = '#C99D5E'; c.beginPath(); c.moveTo(x - r * 0.5, y + r * 0.5); c.lineTo(x + r * 0.5, y + r * 0.5); c.lineTo(x + r * 0.4, y + r * 0.9); c.lineTo(x - r * 0.4, y + r * 0.9); c.closePath(); c.fill();
    dot(c, x, y + r * 0.7, r * 0.1, CREAM);
    c.fillStyle = '#E2BF85'; c.fillRect(x - r * 0.9, y + r * 0.36, r * 1.8, r * 0.16);
    const d = r * 0.23, base = y + r * 0.36 - d;
    [[-2, 0], [0, 0], [2, 0], [-1, 1], [1, 1], [0, 2]].forEach(([k, row]) => {
      const cx = x + k * d * 1.02, cy = base - row * d * 1.72;
      dot(c, cx, cy, d, '#FFFDF4');
      c.strokeStyle = 'rgba(91,58,36,.35)'; c.lineWidth = r * 0.04; c.beginPath(); c.arc(cx, cy, d, 0, Math.PI * 2); c.stroke();
    });
  },
  // すすき:細いくきの先から、細い毛が垂れ下がる
  susuki: (c, x, y, r) => {
    c.lineCap = 'round';
    [[-0.45, -0.9, -0.25, 1], [0.05, -1.05, 0.05, -1], [0.5, -0.75, 0.3, 1]].forEach(([tx, ty, bend, dir]) => {
      const x0 = x, y0 = y + r, x1 = x + tx * r, y1 = y + ty * r;
      c.strokeStyle = '#A8935A'; c.lineWidth = r * 0.045; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(x + bend * r, y, x1, y1); c.stroke();
      c.strokeStyle = '#D1B272'; c.lineWidth = r * 0.04;
      for (let i = 0; i < 7; i++) {
        const sy = y1 + r * (0.02 + i * 0.07), sx = x1 + (x0 - x1) * (sy - y1) / (y0 - y1);
        const len = r * (0.55 - i * 0.04), sw = dir * (i % 2 ? 1 : 0.6);
        c.beginPath(); c.moveTo(sx, sy);
        c.quadraticCurveTo(sx + sw * len * 0.55, sy - len * 0.15, sx + sw * len * 0.75, sy + len * 0.45); c.stroke();
      }
    });
  },
  // 鯉のぼり:さおに、黒・赤・青のこい
  koinobori: (c, x, y, r) => {
    const px = x - r * 0.95;
    c.strokeStyle = '#8A6A44'; c.lineWidth = r * 0.07; c.lineCap = 'round'; c.beginPath(); c.moveTo(px, y - r * 1.05); c.lineTo(px, y + r * 1.1); c.stroke();
    dot(c, px, y - r * 1.1, r * 0.09, '#E0B84A');
    [['#2F3A56', -0.62, 1.75], ['#D9465F', -0.02, 1.5], ['#3F7FD1', 0.55, 1.25]].forEach(([col, dy, len], i) => {
      const x0 = px + r * 0.04, cy = y + dy * r, L = len * r, h = r * 0.42;
      c.save(); c.translate(x0, cy); c.rotate(0.06 - i * 0.03);
      c.fillStyle = col; c.beginPath();
      c.moveTo(0, -h / 2);
      c.quadraticCurveTo(L * 0.45, -h * 0.62, L * 0.8, -h * 0.3);
      c.lineTo(L, -h * 0.62); c.lineTo(L * 0.9, 0); c.lineTo(L, h * 0.62); c.lineTo(L * 0.8, h * 0.3);
      c.quadraticCurveTo(L * 0.45, h * 0.62, 0, h / 2);
      c.closePath(); c.fill();
      // うろこと目
      c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = r * 0.035;
      for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(L * (0.38 + k * 0.14), 0, h * 0.22, -Math.PI / 2, Math.PI / 2); c.stroke(); }
      dot(c, L * 0.14, -h * 0.05, h * 0.18, '#FFFFFF'); dot(c, L * 0.14, -h * 0.05, h * 0.08, '#2A2A2A');
      c.restore();
    });
  },
  // 折り紙のかぶと
  kabuto: (c, x, y, r) => {
    c.fillStyle = '#E0B84A';
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(x + s * r * 0.2, y - r * 0.05); c.lineTo(x + s * r * 0.95, y - r * 0.85); c.lineTo(x + s * r * 0.62, y + r * 0.1); c.closePath(); c.fill(); }
    c.fillStyle = '#3F7FD1'; c.beginPath(); c.moveTo(x, y - r * 0.85); c.lineTo(x - r * 0.8, y + r * 0.22); c.lineTo(x + r * 0.8, y + r * 0.22); c.closePath(); c.fill();
    c.fillStyle = '#2F5FA0'; c.fillRect(x - r * 0.9, y + r * 0.22, r * 1.8, r * 0.38);
  },
  pumpkin: (c, x, y, r) => {
    c.fillStyle = '#E8761E';
    for (const dx of [-0.42, 0.42, 0]) { c.beginPath(); c.ellipse(x + dx * r, y, r * 0.55, r * 0.72, 0, 0, Math.PI * 2); c.fill(); }
    c.strokeStyle = '#C45A10'; c.lineWidth = r * 0.05; for (const dx of [-0.2, 0.2]) { c.beginPath(); c.ellipse(x + dx * r, y, r * 0.3, r * 0.7, 0, -Math.PI / 2, Math.PI / 2, dx < 0); c.stroke(); }
    c.fillStyle = '#4E8A3A'; c.fillRect(x - r * 0.08, y - r * 0.95, r * 0.16, r * 0.3);
    // 目と口
    c.fillStyle = '#3B2A20';
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(x + s * r * 0.4, y - r * 0.05); c.lineTo(x + s * r * 0.2, y - r * 0.05); c.lineTo(x + s * r * 0.3, y - r * 0.28); c.closePath(); c.fill(); }
    c.beginPath(); c.moveTo(x - r * 0.42, y + r * 0.18); c.lineTo(x - r * 0.2, y + r * 0.42); c.lineTo(x, y + r * 0.25); c.lineTo(x + r * 0.2, y + r * 0.42); c.lineTo(x + r * 0.42, y + r * 0.18); c.closePath(); c.fill();
  },
  bat: (c, x, y, r, a) => tilt(c, x, y, a * 0.3, () => {
    c.fillStyle = '#4A3A5C'; c.beginPath(); c.moveTo(0, -r * 0.2);
    c.quadraticCurveTo(-r * 0.5, -r * 0.6, -r * 1.1, -r * 0.3);
    c.quadraticCurveTo(-r * 0.85, -r * 0.1, -r * 0.9, r * 0.2); c.quadraticCurveTo(-r * 0.65, 0, -r * 0.5, r * 0.25); c.quadraticCurveTo(-r * 0.3, r * 0.05, 0, r * 0.35);
    c.quadraticCurveTo(r * 0.3, r * 0.05, r * 0.5, r * 0.25); c.quadraticCurveTo(r * 0.65, 0, r * 0.9, r * 0.2); c.quadraticCurveTo(r * 0.85, -r * 0.1, r * 1.1, -r * 0.3);
    c.quadraticCurveTo(r * 0.5, -r * 0.6, 0, -r * 0.2); c.fill();
    dot(c, 0, -r * 0.05, r * 0.26, '#4A3A5C');
    c.beginPath(); c.moveTo(-r * 0.2, -r * 0.2); c.lineTo(-r * 0.12, -r * 0.45); c.lineTo(-r * 0.04, -r * 0.24); c.moveTo(r * 0.2, -r * 0.2); c.lineTo(r * 0.12, -r * 0.45); c.lineTo(r * 0.04, -r * 0.24); c.fill();
  }),
  candy: (c, x, y, r, a) => tilt(c, x, y, a * 0.6 - 0.4, () => {
    c.fillStyle = '#A386CF';
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * r * 0.45, 0); c.lineTo(s * r * 1.05, -r * 0.4); c.lineTo(s * r * 1.05, r * 0.4); c.closePath(); c.fill(); }
    dot(c, 0, 0, r * 0.5, '#F0A238');
    c.strokeStyle = '#FFFFFF'; c.lineWidth = r * 0.1; c.beginPath(); c.arc(0, 0, r * 0.28, Math.PI * 0.9, Math.PI * 1.9); c.stroke();
  }),
  maple: (c, x, y, r, a) => maple(c, x, y, r, a, '#D24A2A'),
  mapleYellow: (c, x, y, r, a) => maple(c, x, y, r, a, '#E9A22E'),
  tree: (c, x, y, r) => {
    c.fillStyle = BROWN; c.fillRect(x - r * 0.12, y + r * 0.7, r * 0.24, r * 0.3);
    c.fillStyle = '#3F8A4A';
    [[-0.55, 0.45], [-0.1, 0.62], [0.35, 0.78]].reverse().forEach(([top, half], i) => {
      const base = [0.75, 0.4, 0.05][i]; c.beginPath(); c.moveTo(x, y + top * r - r * 0.2); c.lineTo(x - half * r, y + base * r); c.lineTo(x + half * r, y + base * r); c.closePath(); c.fill();
    });
    [[-0.25, 0.55, '#D9465F'], [0.3, 0.3, '#EDBB2E'], [-0.15, -0.05, '#EDBB2E'], [0.15, 0.6, '#FFFFFF']].forEach(([dx, dy, col]) => dot(c, x + dx * r, y + dy * r, r * 0.09, col));
    c.fillStyle = '#EDBB2E'; starPath(c, x, y - r * 0.82, r * 0.24, 5, 0.45, 0); c.fill();
  },
  ornament: (c, x, y, r) => {
    c.strokeStyle = '#B9A07A'; c.lineWidth = r * 0.06; c.beginPath(); c.moveTo(x, y - r * 0.95); c.lineTo(x, y - r * 0.7); c.stroke();
    c.fillStyle = '#C9A44A'; c.fillRect(x - r * 0.2, y - r * 0.78, r * 0.4, r * 0.2);
    dot(c, x, y, r * 0.62, '#C8323C');
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = r * 0.09; c.lineCap = 'round'; c.beginPath(); c.arc(x, y, r * 0.42, Math.PI * 1.1, Math.PI * 1.45); c.stroke();
  },
  snow: (c, x, y, r, a) => tilt(c, x, y, a * 0.3, () => {
    c.strokeStyle = '#8FB3D6'; c.lineWidth = r * 0.13; c.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      c.rotate(Math.PI / 3); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -r);
      c.moveTo(0, -r * 0.55); c.lineTo(-r * 0.25, -r * 0.8); c.moveTo(0, -r * 0.55); c.lineTo(r * 0.25, -r * 0.8); c.stroke();
    }
  })
};
// 右上と左下のすみに、3つずつ置く(1080幅のときの位置と大きさ。マイナスは右端・下端からの距離)
const SPOTS = [[-140, 108, 64], [-292, 70, 44], [-80, 232, 36], [150, -160, 70], [282, -100, 44], [62, -205, 30]];
function seasonal(c, W, H, u, season) {
  SPOTS.forEach(([sx, sy, sr], i) => {
    const x = sx < 0 ? W + sx * u : sx * u, y = sy < 0 ? H + sy * u : sy * u;
    c.save(); MOTIFS[season.motifs[i % 3]](c, x, y, sr * u, i * 0.7 - 0.5); c.restore();
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

// 駐車場:お店で決めた画像(1200×1697)を使う。上下のオレンジの帯をのばして、大きさに合わせる
const PARK = { w: 1200, h: 1697, top: 78, bottom: 79, bar: '#D6785F' };
function drawPark(c, f, u, s) {
  const W = f.w, H = f.h, img = s.parkImage;
  c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, W, H);
  if (!img) { ink(c, '駐車場の画像を読み込んでいます', W / 2, H / 2, 44 * u, F_HAND, { color: '#8A7566' }); return; }
  // 帯をのぞいた中身を、はみ出さない大きさで真ん中に置く
  const k = Math.min(W / PARK.w, H / PARK.h), ch = PARK.h - PARK.top - PARK.bottom;
  const dw = PARK.w * k, dh = ch * k, dx = (W - dw) / 2, dy = (H - dh) / 2;
  c.drawImage(img, 0, PARK.top, PARK.w, ch, dx, dy, dw, dh);
  c.fillStyle = PARK.bar; c.fillRect(0, 0, W, Math.ceil(dy)); c.fillRect(0, Math.floor(dy + dh), W, H - Math.floor(dy + dh));
}

function drawCal(c, f, u, s) {
  const W = f.w, H = f.h, season = SEASONS[s.cal.m], T = { a: season.main, d: season.main }, cx = W / 2, x0 = f.x * u, w = W - 2 * x0, mi = s.cal, rows = Math.ceil((mi.first + mi.n) / 7);
  // 色と飾りは、その月の季節のものにする(お店の色の設定は使わない)
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
