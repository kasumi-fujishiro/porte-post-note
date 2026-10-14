// 在庫管理・予約サイト(ポルテ予約サイト)との連携の決まり。GASに頼らない部分(Node.jsでテストする)。
// 相手の「読むだけの窓口」の形は、連携のお願いの資料(10月14日)のとおり。
// 投稿ノートからは読むだけで、相手のデータを書きかえない。値段は読まない。

const PARTNER_SOURCE = 'partner';
const PARTNER_BY = 'ポルテ予約サイト';
const NEW_WAIT = '待ち', NEW_RESERVED = '予約ずみ', NEW_SKIP = 'しない';

// カテゴリごとの色(投稿ノートの管理ページで、あとから変えられる)
const CATEGORY_COLOR = { cake: 'pink', whole: 'brown', yakigashi: 'yellow' };

const cleanText = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

// 窓口の答えを検査して、使う形にする。返り値:{ value, error }
function parsePartnerFeed(data) {
  if (!data || typeof data !== 'object') return { error: '答えがJSONではありません' };
  if (!Array.isArray(data.products)) return { error: 'products がありません' };
  const products = [], seen = new Set();
  data.products.forEach(p => {
    const id = cleanText(p && p.id);
    if (!/^[a-z0-9-]{1,60}$/.test(id) || seen.has(id)) return; // IDがおかしいもの、重なるものは使わない
    seen.add(id);
    const name = cleanText(p.name);
    if (!name) return;
    products.push({ id, name, desc: cleanText(p.description), category: cleanText(p.category), imageUrl: cleanText(p.imageUrl), sort: +p.sort || 0 });
  });
  const shop = data.shop || {};
  const regular = Array.isArray(shop.regularHolidays) ? shop.regularHolidays.map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6) : null;
  const closed = (Array.isArray(data.closedDays) ? data.closedDays : []).filter(c => c && /^\d{4}-\d{2}-\d{2}$/.test(c.date || '')).map(c => ({ date: c.date, note: cleanText(c.note) }));
  const confirmations = {};
  (Array.isArray(data.calendarConfirmations) ? data.calendarConfirmations : []).forEach(c => {
    if (c && /^\d{4}-\d{2}$/.test(c.month || '') && c.confirmedAt) confirmations[c.month] = String(c.confirmedAt);
  });
  // closedAll:定休日(祝日は営業)と臨時休業を合わせたお休み(予約サイトが今日〜再来月の末を出す)。あればこれを使う
  const closedAll = Array.isArray(data.closedAll) ? data.closedAll.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)) : null;
  const from = /^\d{4}-\d{2}-\d{2}/.test(data.generatedAt || '') ? String(data.generatedAt).slice(0, 10) : '';
  return { value: { version: +data.version || 0, products, regular, hours: cleanText(shop.hours), closed, closedAll, from, confirmations }, error: '' };
}

// 写真のURLが、決めた相手のサイトのものか(ほかのサイトの画像は読まない)
function allowedImage(url, origin) {
  return !!url && !!origin && /^https:\/\//.test(origin) && String(url).indexOf(origin) === 0 && !/\s/.test(url);
}

// 説明は60文字まで(投稿ノートの決まり)。長いときは切って「…」
function shortDesc(s) {
  const t = cleanText(s);
  return t.length > 60 ? t.slice(0, 59) + '…' : t;
}

// 商品の写しの直し方を決める。
//   rows:シートの「商品」の行(相手から写したもの source = partner だけでなく全部)
//   list:相手の商品(parsePartnerFeed の products)
//   first:初めての読みこみか(初めては、今ある商品を「知っている商品」にするだけで、新作にしない)
// 返り値:{ add: [行], update: [{ row, values }], newNames: [名前] }
function planProductSync(rows, list, first, origin) {
  const mine = {};
  rows.filter(r => r.source === PARTNER_SOURCE).forEach(r => { mine[r.id] = r; });
  const add = [], update = [], newNames = [];
  const live = new Set(list.map(p => p.id));
  list.forEach((p, i) => {
    const imageUrl = allowedImage(p.imageUrl, origin) ? p.imageUrl : '';
    const values = { name: p.name.slice(0, 30), desc: shortDesc(p.desc), category: p.category, imageUrl, order: String(i + 1) };
    const r = mine[p.id];
    if (!r) {
      // 前になかった商品:写真があれば新作として「待ち」にする(初めての読みこみは除く)
      const isNew = !first && !!imageUrl;
      add.push(Object.assign({ id: p.id, source: PARTNER_SOURCE, color: CATEGORY_COLOR[p.category] || 'pink', hidden: 'FALSE', ex: 'FALSE', newPost: isNew ? NEW_WAIT : '' }, values));
      if (isNew) newNames.push(p.name);
      return;
    }
    const changed = {};
    Object.keys(values).forEach(k => { if ((r[k] || '') !== values[k]) changed[k] = values[k]; });
    if (String(r.hidden).toUpperCase() === 'TRUE') changed.hidden = 'FALSE'; // サイトに戻った商品は、また出す
    if (Object.keys(changed).length) update.push({ row: r.row, values: changed });
  });
  // サイトから外れた商品は、しまう(消さない)
  Object.keys(mine).forEach(id => {
    const r = mine[id];
    if (!live.has(id) && String(r.hidden).toUpperCase() !== 'TRUE') update.push({ row: r.row, values: { hidden: 'TRUE' } });
  });
  return { add, update, newNames };
}

// 相手の定休日と臨時休業日から、その月のお休み({ 日: 'c' })を作る。
// closedAll(祝日は営業も入った、お休みの日の一覧)があれば、それを使う。ただし from(一覧の始まりの日)より前の日は、定休日の曜日で決める
function partnerMonthDays(month, regular, closed, closedAll, from) {
  const y = +month.slice(0, 4), m = +month.slice(5, 7), days = {};
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const two = n => String(n).padStart(2, '0');
  if (Array.isArray(closedAll)) {
    const all = new Set(closedAll);
    for (let d = 1; d <= last; d++) {
      const date = `${month}-${two(d)}`, w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      if (from && date < from ? (regular || []).includes(w) : all.has(date)) days[d] = 'c';
    }
    return days;
  }
  for (let d = 1; d <= last; d++) {
    const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if ((regular || []).includes(w)) days[d] = 'c';
  }
  (closed || []).forEach(c => { if (c.date.slice(0, 7) === month) days[+c.date.slice(8, 10)] = 'c'; });
  return days;
}

// 営業カレンダーの写し方を決める。thisMonth:今月(2026-10 の形)。今月より前の月は触らない
//   rows:シートの「カレンダー」の行  feed:parsePartnerFeed の value
// 返り値:{ confirm: [{ month, daysText }](確認ずみにして予約を作り直す月), unconfirm: [月](確認を取り消す月) }
function partnerCalendarPlan(rows, feed, thisMonth) {
  const confirm = [], unconfirm = [];
  const byMonth = {};
  rows.forEach(r => { byMonth[r.month] = r; });
  Object.keys(feed.confirmations).sort().forEach(month => {
    if (month < thisMonth) return;
    const daysText = daysToText(partnerMonthDays(month, feed.regular, feed.closed, feed.closedAll, feed.from));
    const r = byMonth[month];
    // まだ写していない、お休みが変わった、確認されていない、のどれかなら、写して予約を作り直す
    if (!r || r.days !== daysText || r.state !== '確認済み' || r.confirmedBy !== PARTNER_BY) confirm.push({ month, daysText });
  });
  // 予約サイトで確認が消えた月(お休みを直したなど)は、確認を取り消す
  rows.forEach(r => {
    if (r.month >= thisMonth && r.state === '確認済み' && r.confirmedBy === PARTNER_BY && !feed.confirmations[r.month]) unconfirm.push(r.month);
  });
  return { confirm, unconfirm };
}

// 画像がまだない営業カレンダーの予約(スタッフの画面が描いて送る)
function calImageNeeded(r) {
  return r && /^\d{4}-\d{2}$/.test(r.month || '') && r.state === '確認済み' && !r.imageHash && !r.driveFileId && !r.publishedAt;
}

if (typeof module !== 'undefined') module.exports = { partnerCalendarPlan, calImageNeeded, PARTNER_SOURCE, PARTNER_BY, NEW_WAIT, NEW_RESERVED, NEW_SKIP, CATEGORY_COLOR, parsePartnerFeed, allowedImage, shortDesc, planProductSync, partnerMonthDays };
