// 日付と、文字の折り返し。画面に触らない計算だけを置く(テストできるように)。

export const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
export const pad2 = n => String(n).padStart(2, '0');
export const iso = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const fromIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const md = d => `${d.getMonth() + 1}月${d.getDate()}日`;

// "2026-10-07" → "10.07"
export function dateLabel(isoDay) {
  const [, m, d] = isoDay.split('-');
  return `${m}.${d}`;
}

export const priceLike = t => /([0-9０-９][0-9０-９,，]*\s*円)|([¥￥]\s*[0-9０-９])/.test(t);

// 行の頭に来てはいけない文字
const NO_HEAD = '、。，．・）」』】!?！？ー〜…';
// このあとで切ると読みやすい文字
const GOOD_END = '、。をにはがのとでもへて';

// 英数字のまとまりと、カタカナの言葉は切らない(幅に入らないほど長いときだけ、1文字ずつに分ける)
const units = (text, size, maxW, measure) =>
  (text.match(/[A-Za-z0-9#@_'.:\-–]+|[゠-ヿ]+|\s+|./gu) || [])
    .flatMap(t => (t.length > 1 && measure(t, size) > maxW ? [...t] : [t]));

// 幅 maxW に入るように、前から詰めて行に分ける
function greedy(us, size, maxW, measure) {
  const out = [];
  let line = '';
  for (const t of us) {
    const next = line + t;
    if (line && measure(next, size) > maxW && !NO_HEAD.includes(t)) { out.push(line.trimEnd()); line = t.trimStart(); }
    else line = next;
  }
  out.push(line);
  return out;
}

// text を、大きさ size(入らなければ min まで小さく)で、幅 maxW に収める。
// measure(文字列, 大きさ) は、その文字の幅を返す関数。
// 返り値: { size, lines }
export function layout(text, { size, min, maxW, measure }) {
  // 1行に収まるなら、少し小さくしてでも1行にする
  for (let s = size; s >= min; s -= 2) {
    if (measure(text, s) <= maxW) return { size: s, lines: [text] };
  }
  const us = units(text, size, maxW, measure);
  const n = greedy(us, size, maxW, measure).length;

  // 2行のときは、長さがそろい、助詞や読点のあとで切れる場所をさがす
  if (n === 2) {
    const full = measure(text, size);
    let best = null;
    for (let i = 1; i < us.length; i++) {
      const a = us.slice(0, i).join('').trimEnd(), b = us.slice(i).join('').trimStart();
      const wa = measure(a, size), wb = measure(b, size);
      if (wa > maxW || wb > maxW || NO_HEAD.includes(us[i][0])) continue;
      const score = Math.abs(wa - wb) / full + (GOOD_END.includes(a.slice(-1)) ? 0 : 0.35);
      if (!best || score < best.score) best = { score, lines: [a, b] };
    }
    if (best) return { size, lines: best.lines };
  }

  // 3行以上: 行数が増えない範囲で幅をせまくして、長さをそろえる
  let lines = greedy(us, size, maxW, measure);
  for (let t = maxW * 0.95; t > maxW * 0.3; t -= maxW * 0.02) {
    const l2 = greedy(us, size, t, measure);
    if (l2.length > n) break;
    lines = l2;
  }
  return { size, lines };
}
