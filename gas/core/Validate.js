// シートの行を検査し、配信データを組み立てる。GASに頼らない部分(Node.jsでテストする)。
// 合わない行は配信から外し、「直してほしい行」として返す。

// 価格のように見える文字(お店の方針で、価格は載せない)
function priceLike(t) { return /([0-9０-９][0-9０-９,，]*\s*円)|([¥￥]\s*[0-9０-９])/.test(String(t)); }

const isTrue = v => String(v).toUpperCase() === 'TRUE';
const lenOk = (s, min, max) => s.length >= min && s.length <= max;
const isIsoDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s);

// 「2:c,3:c,23:s」→ { 2: 'c', 3: 'c', 23: 's' }。日にちが月にないときなどは null
function parseDays(text, month) {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return null;
  const last = new Date(+m[1], +m[2], 0).getDate(), out = {};
  if (!String(text).trim()) return out;
  for (const part of String(text).split(',')) {
    const p = /^\s*(\d{1,2})\s*:\s*([cs])\s*$/.exec(part);
    if (!p || +p[1] < 1 || +p[1] > last) return null;
    out[+p[1]] = p[2];
  }
  return out;
}
function daysToText(days) {
  return Object.keys(days).map(Number).sort((a, b) => a - b).map(d => `${d}:${days[d]}`).join(',');
}

// 設定の行を読む。合わないものは初めの値にして、問題として返す
function readSettings(rows, problems) {
  const kv = {};
  rows.forEach(r => { if (r.key) kv[r.key] = { value: r.value, row: r.row }; });
  const get = k => (kv[k] ? kv[k].value : '');
  const bad = (k, why) => problems.push({ sheet: '設定', row: kv[k] ? kv[k].row : 0, why: `${k}:${why}` });
  const num = (k, min, max, def) => {
    const v = get(k);
    if (/^\d+$/.test(v) && +v >= min && +v <= max) return +v;
    bad(k, `${min}〜${max}の数にしてください`); return def;
  };
  const s = {};
  s.version = /^\d+$/.test(get('version')) ? +get('version') : (bad('version', '数にしてください'), 1);
  s.hours = get('hours');
  if (s.hours.length > 30) { bad('hours', '30文字以内にしてください'); s.hours = ''; }
  s.theme = COLORS.includes(get('theme')) ? get('theme') : (bad('theme', `${COLORS.join(' / ')} のどれかにしてください`), 'pink');
  const reg = get('regular');
  if (/^([0-6](,[0-6])*)?$/.test(reg.replace(/\s/g, ''))) s.regular = reg ? [...new Set(reg.replace(/\s/g, '').split(',').map(Number))] : [];
  else { bad('regular', '0〜6の数をカンマで区切ってください'); s.regular = [1, 2]; }
  s.schedule = { notice1: num('notice1', 1, 28, 20), notice2: num('notice2', 1, 28, 23), postDay: num('postDay', 1, 28, 25), postHour: num('postHour', 0, 23, 12) };
  s.postTo = ['feed', 'story'].includes(get('postTo')) ? get('postTo') : (bad('postTo', 'feed か story にしてください'), 'feed');
  s.firstUse = get('firstUse');
  if (s.firstUse && !isIsoDate(s.firstUse)) { bad('firstUse', '2026-10-17 の形にしてください'); s.firstUse = ''; }
  s.lastOkAt = get('lastOkAt');
  return s;
}

// ひとこと・商品の行を検査する。返り値は配る行だけ(しまったものは配らない)
function checkPhrases(rows, problems) {
  const seen = new Set(), out = [];
  rows.forEach(r => {
    const why = !r.id ? 'IDが空です'
      : seen.has(r.id) ? 'IDが重なっています'
        : !lenOk(r.cat || '', 1, 20) ? '状況を1〜20文字にしてください'
          : !lenOk(r.text || '', 1, 40) ? 'ひとことを1〜40文字にしてください'
            : priceLike(r.text) || priceLike(r.cat) ? '価格のような文字が入っています(価格は載せません)' : '';
    if (r.id) seen.add(r.id);
    if (why) { problems.push({ sheet: 'ひとこと', row: r.row, why }); return; }
    if (isTrue(r.hidden)) return;
    out.push({ id: r.id, cat: r.cat, text: r.text, ex: isTrue(r.ex), order: +r.order || 0 });
  });
  return sortByOrder(out);
}
function checkProducts(rows, problems) {
  const seen = new Set(), out = [];
  rows.forEach(r => {
    const why = !r.id ? 'IDが空です'
      : seen.has(r.id) ? 'IDが重なっています'
        : !lenOk(r.name || '', 1, 30) ? '商品名を1〜30文字にしてください'
          : (r.desc || '').length > 60 ? '説明を60文字以内にしてください'
            : !COLORS.includes(r.color) ? `色を ${COLORS.join(' / ')} のどれかにしてください`
              : priceLike(r.name) || priceLike(r.desc) ? '価格のような文字が入っています(価格は載せません)' : '';
    if (r.id) seen.add(r.id);
    if (why) { problems.push({ sheet: '商品', row: r.row, why }); return; }
    if (isTrue(r.hidden)) return;
    out.push({ id: r.id, name: r.name, desc: r.desc || '', color: r.color, ex: isTrue(r.ex), order: +r.order || 0 });
  });
  return sortByOrder(out);
}
function sortByOrder(list) {
  return list.map((x, i) => ({ x, i })).sort((a, b) => a.x.order - b.x.order || a.i - b.i).map(({ x }) => { delete x.order; return x; });
}

// カレンダーの行。確認済みの月だけ中身を配る。確認前の月は「まだ」とだけ伝える
function checkCalendars(rows, problems) {
  const calendars = [], calendarState = {}, seen = new Set();
  rows.forEach(r => {
    const days = parseDays(r.days || '', r.month || '');
    const why = !/^\d{4}-\d{2}$/.test(r.month || '') ? '月を 2026-11 の形にしてください'
      : seen.has(r.month) ? '同じ月が2行あります'
        : !days ? '日ごとの状態を「2:c,3:c,23:s」の形にしてください(c=お休み、s=時間変更)'
          : (r.note || '').length > 40 ? 'ひとことを40文字以内にしてください'
            : priceLike(r.note) ? '価格のような文字が入っています(価格は載せません)'
              : !CAL_STATES.includes(r.state) ? `確認を ${CAL_STATES.join(' / ')} のどちらかにしてください` : '';
    if (r.month) seen.add(r.month);
    if (why) { problems.push({ sheet: 'カレンダー', row: r.row, why }); return; }
    if (r.state === '確認済み') { calendars.push({ month: r.month, days, note: r.note || '' }); calendarState[r.month] = 'confirmed'; }
    else calendarState[r.month] = 'unconfirmed';
  });
  return { calendars, calendarState };
}

// 配信データを組み立てる。tables は { settings, phrases, products, calendars } の行の配列
// auto は自動投稿の状態({ lastOkAt, alert })。返り値:{ feed, problems }
function buildFeed(tables, generatedAt, auto) {
  const problems = [];
  const settings = readSettings(tables.settings || [], problems);
  const phrases = checkPhrases(tables.phrases || [], problems);
  const products = checkProducts(tables.products || [], problems);
  const { calendars, calendarState } = checkCalendars(tables.calendars || [], problems);
  const version = settings.version;
  delete settings.version;
  const lastOkAt = settings.lastOkAt;
  delete settings.lastOkAt;
  return {
    feed: { version, generatedAt, settings, phrases, products, calendars, calendarState, auto: { lastOkAt, alert: (auto && auto.alert) || null } },
    problems
  };
}

if (typeof module !== 'undefined') module.exports = { priceLike, parseDays, daysToText, readSettings, checkPhrases, checkProducts, checkCalendars, buildFeed };
