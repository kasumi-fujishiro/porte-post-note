// 予約サイト(ポルテ予約サイト)との連携。1時間ごとの自動実行と、公開窓口から呼ぶ。
// 設定欄:PARTNER_FEED_URL(予約サイトの読むだけの窓口)、PARTNER_FEED_KEY(その合言葉。秘密)、
//         PARTNER_IMAGE_ORIGIN(写真を読んでよいサイトの頭。例:https://(予約サイト)/img/products/)、
//         SHOP_PASSCODE(スタッフの画面から投稿するときの、お店の合言葉。秘密)
// PARTNER_FEED_URL が空のあいだは、何もしない(今までどおり、管理ページで商品を登録する)。

function partnerOn_() { return !!prop_('PARTNER_FEED_URL', false); }

// 予約サイトの窓口を読む。だめなら投げる
function fetchPartner_() {
  const key = prop_('PARTNER_FEED_KEY', false);
  const res = UrlFetchApp.fetch(prop_('PARTNER_FEED_URL'), { headers: key ? { Authorization: 'Bearer ' + key } : {}, muteHttpExceptions: true, followRedirects: true });
  if (res.getResponseCode() !== 200) throw new Error(`予約サイトの窓口が ${res.getResponseCode()} を返しました`);
  let data;
  try { data = JSON.parse(res.getContentText()); } catch (e) { throw new Error('予約サイトの窓口の答えが、JSONではありません'); }
  const p = parsePartnerFeed(data);
  if (p.error) throw new Error('予約サイトの窓口の答えの形がちがいます:' + p.error);
  return p.value;
}

// 商品の写しを更新し、新作に気づいたら知らせる。営業カレンダーも写す
function syncPartner_() {
  if (!partnerOn_()) return;
  const today = nowText_().slice(0, 10);
  let feed;
  try { feed = fetchPartner_(); setProp_('PARTNER_FAILS', '0'); }
  catch (e) {
    const n = (+prop_('PARTNER_FAILS', false) || 0) + 1;
    setProp_('PARTNER_FAILS', String(n));
    logRun_('予約サイトを読む', '失敗', e.message);
    if (n >= 6) notifyOnce_(`partner-down:${today}`, `【投稿ノート】予約サイトの商品とお休みを、${n}時間読めていません。新作の投稿と営業カレンダーが止まっています。管理する人に知らせてください。`);
    return;
  }
  const rows = readTable_('products'), now = nowText_();
  // 初めての読みこみ(読む先のURLが変わったときも):今ある商品を「知っている商品」にするだけで、新作にしない。
  // 試し用の窓口から本物に切りかえたとき、本物の商品が全部新作として知らされないように
  const url = prop_('PARTNER_FEED_URL');
  const first = !rows.some(r => r.source === PARTNER_SOURCE) || prop_('PARTNER_SYNCED_URL', false) !== url;
  const plan = planProductSync(rows, feed.products, first, prop_('PARTNER_IMAGE_ORIGIN', false));
  plan.update.forEach(u => setCells_('products', u.row, Object.assign({ updatedAt: now }, u.values)));
  if (plan.add.length) appendRows_('products', plan.add.map(a => Object.assign({ updatedAt: now }, a)));
  const calChanged = syncPartnerCalendar_(feed);
  if (plan.add.length || plan.update.length || calChanged) bumpVersion_();
  setProp_('PARTNER_SYNCED_URL', url);
  logRun_('予約サイトを読む', '成功', `商品${feed.products.length}件(足した${plan.add.length}・直した${plan.update.length})${first ? '。初めての読みこみなので、新作にはしていません' : ''}`);
  if (plan.newNames.length) {
    notifyOnce_(`newprod:${today}:${plan.newNames.join('/')}`, `【投稿ノート】予約サイトに新作「${plan.newNames.join('」「')}」が登録されました。スタッフの画面を開くと、右上のベルからInstagramのフィードに投稿できます。\n${appLink_()}`);
  }
}

// 営業カレンダー:予約サイトで確認された月を写して、予約を作る(画像は、スタッフの画面が開いたときに描いて送る)。
// 予約サイトで確認が消えた月は、確認と予約を取り消す。変えたら true
function syncPartnerCalendar_(feed) {
  const now = nowText_(), thisMonth = now.slice(0, 7);
  const plan = partnerCalendarPlan(readTable_('calendars'), feed, thisMonth);
  if (!plan.confirm.length && !plan.unconfirm.length) return false;
  const settings = settingsMap_();
  const cancel = month => readTable_('reservations').filter(r => r.month === month && LIVE_RES.includes(r.state))
    .forEach(r => setCells_('reservations', r.row, { state: '取り消し', ticket: '', lastError: '予約サイトのお休みが変わったので、作り直しました', updatedAt: now }));
  const write = (month, vals) => {
    const row = readTable_('calendars').find(r => r.month === month);
    if (row) setCells_('calendars', row.row, vals); else appendRows_('calendars', [Object.assign({ month }, vals)]);
  };
  plan.confirm.forEach(c => {
    cancel(c.month);
    write(c.month, { days: c.daysText, note: '', state: '確認済み', confirmedAt: now, confirmedBy: PARTNER_BY });
    const id = newId_();
    appendRows_('reservations', [{
      id, month: c.month, postTo: settings.postTo === 'story' ? 'story' : 'feed', postDate: postDateFor(c.month, settings.postDay), state: '確認済み',
      imagePath: imagePathFor(c.month, id), tries: '0', createdAt: now, updatedAt: now
    }]);
    logRun_('予約サイトのカレンダーを写す', '成功', `${c.month}:確認ずみにして予約しました(画像は、スタッフの画面が開いたときに作ります)`);
  });
  plan.unconfirm.forEach(month => {
    cancel(month);
    write(month, { state: '未確認', confirmedAt: '', confirmedBy: '' });
    logRun_('予約サイトのカレンダーを写す', '成功', `${month}:予約サイトで確認が消えたので、予約を取り消しました`);
  });
  return true;
}

// スタッフの画面から、営業カレンダーの画像を受けとる(お店の合言葉つき)。画像がまだない予約にだけ
function staffCalImage_(data) {
  const pc = checkPasscode_(data.passcode);
  if (!pc.ok) return pc;
  const img = staffImage_(String(data.image || ''));
  if (img.error) return { ok: false, error: img.error };
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, retry: true, error: '混み合っています。' };
  try {
    const r = readTable_('reservations').find(x => x.month === String(data.month || '') && calImageNeeded(x));
    if (!r) return { ok: true, already: true };
    const bytes = img.bytes, blob = Utilities.newBlob(bytes, 'image/jpeg', r.imagePath.split('/').pop());
    const file = DriveApp.getFolderById(prop_('DRIVE_FOLDER_ID')).createFile(blob);
    setCells_('reservations', r.row, { imageSize: String(bytes.length), imageHash: sha256Hex_(bytes), driveFileId: file.getId(), updatedAt: nowText_() });
    publishImage_(Object.assign({}, r, { imageSize: String(bytes.length) }), blob);
    bumpVersion_();
    logRun_('営業カレンダーの画像を受けとる', '成功', `${resLabel(r)}(スタッフの画面から)`);
    return { ok: true };
  } finally { lock.releaseLock(); }
}

// スタッフの画面に、お店の写真を渡す(予約サイトから写した商品の写真だけ)
function partnerPhoto_(id) {
  const r = readTable_('products').find(x => x.id === String(id || '') && x.source === PARTNER_SOURCE);
  if (!r || !allowedImage(r.imageUrl, prop_('PARTNER_IMAGE_ORIGIN', false))) return { ok: false, error: 'この商品には、お店の写真がありません。' };
  const res = UrlFetchApp.fetch(r.imageUrl, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return { ok: false, error: `お店の写真を読めませんでした(${res.getResponseCode()})。` };
  const blob = res.getBlob(), bytes = blob.getBytes();
  if (bytes.length > 6 * 1024 * 1024) return { ok: false, error: 'お店の写真が大きすぎます。' };
  return { ok: true, type: blob.getContentType() || 'image/jpeg', data: Utilities.base64Encode(bytes) };
}

// お店の合言葉を確かめる。15分に10回まちがえたら、しばらく止める
function checkPasscode_(code) {
  const cache = CacheService.getScriptCache(), fails = +(cache.get('pcfail') || 0);
  if (fails >= 10) return { ok: false, error: '合言葉を何度もまちがえたので、15分ほど止めています。' };
  const want = prop_('SHOP_PASSCODE', false);
  if (!want) return { ok: false, error: 'お店の合言葉が、まだ決まっていません。管理する人に頼んでください。' };
  if (String(code || '') !== want) { cache.put('pcfail', String(fails + 1), 900); return { ok: false, bad: true, error: '合言葉がちがいます。' }; }
  return { ok: true };
}

// 送られてきたJPEGを確かめて、バイトにする
function staffImage_(b64) {
  if (!b64 || b64.length > 11 * 1024 * 1024) return { error: '画像が大きすぎるか、ありません。' };
  let bytes;
  try { bytes = Utilities.base64Decode(b64); } catch (e) { return { error: '画像を読めませんでした。' }; }
  if (bytes.length < 1000 || bytes[0] !== -1 || bytes[1] !== -40) return { error: '画像がJPEGではありません。' }; // JPEGは FF D8 で始まる
  return { bytes };
}

// スタッフの画面から、新作の投稿を予約する(お店の合言葉つき)。投稿の文は、サーバーが商品から作る
function staffNewPost_(data) {
  const pc = checkPasscode_(data.passcode);
  if (!pc.ok) return pc;
  const img = staffImage_(String(data.image || ''));
  if (img.error) return { ok: false, error: img.error };
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, retry: true, error: '混み合っています。もう一度押してください。' };
  try {
    const p = readTable_('products').find(x => x.id === String(data.productId || '') && x.source === PARTNER_SOURCE);
    if (!p || p.newPost !== NEW_WAIT || String(p.hidden).toUpperCase() === 'TRUE') return { ok: false, error: 'この新作は、もう投稿の予約がされているか、見つかりません。' };
    const k = checkNewPost(p);
    if (k.error) return { ok: false, error: k.error };
    const now = nowText_(), slot = newPostSlot(now), id = newId_(), bytes = img.bytes;
    appendRows_('reservations', [{
      id, kind: 'new', month: '', title: p.name, caption: captionForProduct(p), productId: p.id,
      postTo: 'feed', postDate: slot.postDate, postHour: String(slot.postHour), state: '確認済み',
      imagePath: newImagePath(slot.postDate, id), imageSize: String(bytes.length), imageHash: sha256Hex_(bytes), tries: '0', createdAt: now, updatedAt: now
    }]);
    const r = readTable_('reservations').find(x => x.id === id);
    const blob = Utilities.newBlob(bytes, 'image/jpeg', r.imagePath.split('/').pop());
    const file = DriveApp.getFolderById(prop_('DRIVE_FOLDER_ID')).createFile(blob);
    setCells_('reservations', r.row, { driveFileId: file.getId() });
    publishImage_(r, blob);
    setCells_('products', p.row, { newPost: NEW_RESERVED, updatedAt: now });
    bumpVersion_();
    logRun_('新作の投稿を予約する', '成功', `${resLabel(r)}(スタッフの画面から)`);
    return { ok: true, message: `予約しました。${slotWords(slot, now, false)}に、Instagramのフィードに投稿します。` };
  } finally { lock.releaseLock(); }
}

// 試し:予約サイトの代わりに、リポジトリの試し用の窓口(tests/partner-feed.json)を読む
function testPartnerMock() {
  testGuard_();
  setProp_('PARTNER_FEED_URL', imageBaseUrl_() + 'tests/partner-feed.json');
  setProp_('PARTNER_IMAGE_ORIGIN', imageBaseUrl_() + 'tests/assets/');
  console.log('試し用の窓口を読むようにしました。hourlyJob を実行すると(または次の自動実行で)、商品が写されます。やめるときは testPartnerOff を実行してください。');
}

function testPartnerOff() {
  PropertiesService.getScriptProperties().deleteProperty('PARTNER_FEED_URL');
  console.log('予約サイトとの連携を止めました。管理ページの「商品」は、今までどおり登録できます(写した商品は残ります。不要なら「しまう」)。');
}
