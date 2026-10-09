// 公開窓口(ウェブアプリ。「自分として実行」「全員」で公開する)。
// できるのは2つだけ:配信データを渡す(GET ?api=feed)、作業時間の記録を足す(POST)。

function doGet(e) {
  const api = e && e.parameter && e.parameter.api;
  if (api === 'feed') return json_(feedData_());
  return ContentService.createTextOutput('投稿ノートの公開窓口です。');
}

function doPost(e) {
  const body = e && e.postData ? e.postData.contents : '';
  return json_(appendLogs_(body));
}

function json_(obj) {
  return ContentService.createTextOutput(typeof obj === 'string' ? obj : JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// 配信データ。版番号が変わるまでは、作ったものを使い回す(シートを毎回読まないため)
function feedData_() {
  const cache = CacheService.getScriptCache(), v = prop_('FEED_VERSION', false) || '0', key = 'feed:' + v;
  const hit = cache.get(key);
  if (hit) return hit;
  const tables = { settings: readTable_('settings'), phrases: readTable_('phrases'), products: readTable_('products'), calendars: readTable_('calendars') };
  let alert = null;
  try { alert = JSON.parse(prop_('AUTO_ALERT', false) || 'null'); } catch (err) { alert = null; }
  const generatedAt = Utilities.formatDate(new Date(), 'Asia/Tokyo', "yyyy-MM-dd'T'HH:mm:ssXXX");
  const { feed, problems } = buildFeed(tables, generatedAt, { alert });
  const text = JSON.stringify(feed);
  cache.put(key, text, 21600);
  cache.put('problems:' + v, JSON.stringify(problems), 21600);
  return text;
}

// 作業時間の記録を足す。決まった形のものを、1分30件・1日300件まで
function appendLogs_(body) {
  const { records, rejected, error } = validateLogBatch(body, Date.now());
  if (error) return { ok: false, accepted: 0, rejected, error };
  if (!records.length) return { ok: true, accepted: 0, rejected };
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { ok: false, retry: true, accepted: 0, rejected, error: '混み合っています。あとで送り直します。' };
  try {
    const cache = CacheService.getScriptCache(), now = new Date();
    const minKey = 'logmin:' + Utilities.formatDate(now, 'Asia/Tokyo', 'yyyyMMddHHmm');
    const day = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM-dd');
    const usedMinute = +(cache.get(minKey) || 0);
    const dayProp = (prop_('LOG_DAY', false) || '').split(':');
    const usedDay = dayProp[0] === day ? +dayProp[1] || 0 : 0;
    const n = allowedCount(records.length, usedMinute, usedDay);
    if (n > 0) {
      const receivedAt = nowText_();
      appendRows_('logs', records.slice(0, n).map(r => ({ receivedAt, at: r.at, kind: r.kind, fmt: r.fmt, sec: String(r.sec) })));
      cache.put(minKey, String(usedMinute + n), 120);
      setProp_('LOG_DAY', `${day}:${usedDay + n}`);
    }
    return { ok: true, accepted: n, rejected: rejected + records.length - n };
  } finally { lock.releaseLock(); }
}
