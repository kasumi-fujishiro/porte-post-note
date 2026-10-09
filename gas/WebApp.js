// 公開窓口(ウェブアプリ。「自分として実行」「全員」で公開する)。
// できるのは2つだけ:配信データを渡す(GET ?api=feed)、作業時間の記録を足す(POST)。

function doGet(e) {
  const api = e && e.parameter && e.parameter.api;
  if (api === 'feed') return json_(feedData_());
  return ContentService.createTextOutput('投稿ノートの公開窓口です。');
}

function doPost(e) {
  const body = e && e.postData ? e.postData.contents : '';
  // 管理ページからの、カレンダーの画像(使い捨ての合言葉つき)
  if (body.indexOf('"type":"calendarImage"') >= 0) {
    let data = null;
    try { data = JSON.parse(body); } catch (err) { data = null; }
    if (data && data.type === 'calendarImage') return json_(receiveCalendarImage_(data));
  }
  return json_(appendLogs_(body));
}

// カレンダーの画像を受けとる。合言葉と、大きさ・ハッシュ値が予約の行と合うときだけ、
// 持ち主のドライブ(非公開)に原本を置き、GitHubに公開用の写しを置く
function receiveCalendarImage_(data) {
  const resId = String(data.resId || ''), ticket = String(data.ticket || ''), b64 = String(data.image || '');
  if (!resId || !ticket || !b64) return { ok: false, error: '足りないものがあります。' };
  if (b64.length > 11 * 1024 * 1024) return { ok: false, error: '画像が大きすぎます。' };
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, retry: true, error: '混み合っています。' };
  try {
    const r = readTable_('reservations').find(x => x.id === resId);
    if (!r || !r.ticket || r.ticket !== ticket || r.state !== '確認済み') return { ok: false, error: 'この予約には、画像を受けつけられません。' };
    const bytes = Utilities.base64Decode(b64);
    if (bytes.length !== +r.imageSize || sha256Hex_(bytes) !== r.imageHash) return { ok: false, error: '画像が、予約の記録と合いません。' };
    const blob = Utilities.newBlob(bytes, 'image/jpeg', r.imagePath.split('/').pop());
    const file = DriveApp.getFolderById(prop_('DRIVE_FOLDER_ID')).createFile(blob);
    setCells_('reservations', r.row, { driveFileId: file.getId(), ticket: '', updatedAt: nowText_() });
    const published = publishImage_(r, blob);
    logRun_('カレンダーの画像を受けとる', '成功', `${r.month}:${published ? 'GitHubに公開した' : '公開は次の自動実行で'}`);
    return { ok: true, published };
  } finally { lock.releaseLock(); }
}

// GitHubに公開用の写しを置く。だめなら、次の自動実行でやり直す(原本はドライブにある)
function publishImage_(r, blob) {
  try {
    githubPutImage_(r.imagePath, blob, `営業カレンダー ${r.month} の画像を置く`);
    setCells_('reservations', r.row, { publishedAt: nowText_(), lastError: '' });
    return true;
  } catch (e) {
    setCells_('reservations', r.row, { lastError: 'GitHubに置けませんでした:' + e.message });
    logRun_('カレンダーの画像を公開する', '失敗', e.message);
    return false;
  }
}

// ドライブに原本があって、まだGitHubに公開していない予約を公開する(段階6で1時間ごとに動かす)
function publishPendingImages() {
  readTable_('reservations').filter(r => r.state === '確認済み' && r.driveFileId && !r.publishedAt).forEach(r => {
    const blob = DriveApp.getFileById(r.driveFileId).getBlob().setContentType('image/jpeg');
    publishImage_(r, blob);
  });
}

function json_(obj) {
  return ContentService.createTextOutput(typeof obj === 'string' ? obj : JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// 配信データ。版番号が変わるまでは、作ったものを使い回す(シートのほかの表を毎回読まないため)
// 版番号はシートから読む(管理ページは別のプロジェクトなので、ここの設定欄は書きかえられない)
function feedData_() {
  const cache = CacheService.getScriptCache(), v = String(currentVersion_()), key = 'feed:' + v;
  const hit = cache.get(key);
  if (hit) return hit;
  const tables = { settings: readTable_('settings'), phrases: readTable_('phrases'), products: readTable_('products'), calendars: readTable_('calendars'), reservations: readTable_('reservations') };
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
