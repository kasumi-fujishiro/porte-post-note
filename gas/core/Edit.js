// 管理ページから登録される内容の検査。GASに頼らない部分(Node.jsでテストする)。
// 返り値は { value, error }。error が空でなければ、登録させずに理由を表示する。

const PRICE_MSG = '価格のような文字が入っています。お店の方針で、価格は載せません。直してから登録してください。';
const clean = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

function cleanPhrase(input) {
  const cat = clean(input && input.cat), text = clean(input && input.text);
  if (!cat) return { error: '状況を入れてください(例:雨の日)。' };
  if (!text) return { error: 'ひとことを入れてください。' };
  if (cat.length > 20) return { error: '状況は20文字以内にしてください。' };
  if (text.length > 40) return { error: `ひとことは40文字以内にしてください(今は${text.length}文字です)。` };
  if (priceLike(cat) || priceLike(text)) return { error: PRICE_MSG };
  return { value: { cat, text }, error: '' };
}

function cleanProduct(input) {
  const name = clean(input && input.name), desc = clean(input && input.desc), color = clean(input && input.color);
  if (!name) return { error: '商品名を入れてください。' };
  if (name.length > 30) return { error: '商品名は30文字以内にしてください。' };
  if (desc.length > 60) return { error: `説明は60文字以内にしてください(今は${desc.length}文字です)。` };
  if (!COLORS.includes(color)) return { error: '色をえらんでください。' };
  if (priceLike(name) || priceLike(desc)) return { error: PRICE_MSG };
  return { value: { name, desc, color }, error: '' };
}

// 管理ページで直せる設定
const EDITABLE_SETTINGS = ['hours', 'theme', 'regular', 'notice1', 'notice2', 'postDay', 'postHour', 'postTo'];

function cleanSettings(input) {
  const v = {};
  EDITABLE_SETTINGS.forEach(k => { v[k] = clean(input && input[k]); });
  v.regular = v.regular.replace(/\s/g, '');
  const problems = [];
  readSettings(EDITABLE_SETTINGS.map((k, i) => ({ row: i + 2, key: k, value: v[k] })).concat([{ row: 99, key: 'version', value: '1' }]), problems);
  if (problems.length) return { error: '設定に合わないところがあります:' + problems.map(p => p.why).join('、') };
  if (priceLike(v.hours)) return { error: PRICE_MSG };
  const n = v => +v;
  if (!(n(v.notice1) < n(v.notice2) && n(v.notice2) <= n(v.postDay))) return { error: '日程は「知らせる日1 < 知らせる日2 ≦ 投稿する日」の順にしてください。' };
  return { value: v, error: '' };
}

// 作業時間の記録のまとめ(新しい順)
function logSummary(rows, limit) {
  const list = rows.filter(r => /^\d+$/.test(r.sec || '')).map(r => ({ receivedAt: r.receivedAt, at: r.at, kind: r.kind, fmt: r.fmt, sec: +r.sec }))
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  const avg = list.length ? Math.round(list.reduce((s, r) => s + r.sec, 0) / list.length) : 0;
  return { count: list.length, avg, rows: list.slice(0, limit || 200) };
}

if (typeof module !== 'undefined') module.exports = { cleanPhrase, cleanProduct, cleanSettings, logSummary, EDITABLE_SETTINGS };
