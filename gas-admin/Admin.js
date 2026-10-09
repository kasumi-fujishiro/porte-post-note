// 管理ページ(ウェブアプリ。「アクセスしたユーザーとして実行」「Googleアカウントを持つ全員」で公開する)。
// 開いた本人の権限でシートを読み書きするので、シートを共有されていない人は書けない。
// このプロジェクトには、秘密の情報を置かない(設定欄は SHEET_ID と APP_URL だけ)。

function doGet(e) {
  const t = HtmlService.createTemplateFromFile('admin');
  t.appUrl = appUrl_();
  // アプリのお知らせの「確認する」から開いたときは、カレンダーのその月を直接開く
  const p = (e && e.parameter) || {};
  t.startTab = ['phrases', 'products', 'settings', 'calendar', 'logs', 'more'].includes(p.tab) ? p.tab : 'phrases';
  t.startMonth = /^\d{4}-\d{2}$/.test(p.month || '') ? p.month : '';
  return t.evaluate()
    .setTitle('投稿ノート 登録・確認')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); // アプリの中に埋めこめるか試すため
}

function appUrl_() {
  const u = prop_('APP_URL');
  return u.endsWith('/') ? u : u + '/';
}

// 画面に出す内容をまとめて返す。
// 共有されていないシートを開こうとすると、Googleはここで処理を打ち切る(try で受けとめられない)。
// そのときは画面の側で失敗の文を見て、「開けません」の案内を出す(admin.html の noAccess)
function getState() {
  let me = '';
  try { me = Session.getActiveUser().getEmail(); } catch (e) { me = ''; }
  try {
    return state_(me);
  } catch (e) {
    const detail = String((e && e.message) || e);
    console.log(`getState が失敗しました(${me}):${detail}`);
    return { error: /permission|権限|access|アクセス/i.test(detail) ? 'noaccess' : 'failed', me, detail };
  }
}

// いま開いている人のアカウント(シートには触らない)。シートを開けなかったときの案内に使う
function whoAmI() {
  try { return Session.getActiveUser().getEmail(); } catch (e) { return ''; }
}

function state_(me) {
  const book = book_();
  const tables = { settings: readTable_('settings'), phrases: readTable_('phrases'), products: readTable_('products'), calendars: readTable_('calendars'), reservations: readTable_('reservations') };
  const { feed, problems } = buildFeed(tables, '', null);
  let canEdit = false;
  try { canEdit = book.getOwner().getEmail() === me || book.getEditors().some(u => u.getEmail() === me); } catch (e) { canEdit = false; }
  const pick = (r, keys) => keys.reduce((o, k) => (o[k] = r[k] || '', o), { hidden: String(r.hidden).toUpperCase() === 'TRUE', ex: String(r.ex).toUpperCase() === 'TRUE' });
  const settings = {};
  tables.settings.forEach(r => { settings[r.key] = r.value; });
  return {
    me, canEdit, version: feed.version, appUrl: appUrl_(), sheetUrl: book.getUrl(),
    phrases: tables.phrases.filter(r => r.id).map(r => pick(r, ['id', 'cat', 'text', 'order'])),
    products: tables.products.filter(r => r.id).map(r => pick(r, ['id', 'name', 'desc', 'color', 'order'])),
    settings, problems, logs: logSummary(readTable_('logs'), 200),
    calendars: tables.calendars.filter(r => /^\d{4}-\d{2}$/.test(r.month || '')).map(r => ({
      month: r.month, days: parseDays(r.days || '', r.month) || {}, note: r.note || '', state: r.state || '未確認', confirmedAt: r.confirmedAt || '', confirmedBy: r.confirmedBy || ''
    })),
    // 月ごとの、いちばん新しい予約
    reservations: latestReservations_(tables.reservations),
    recent: tables.reservations.filter(r => r.id).sort((a, b) => ((a.createdAt || '') < (b.createdAt || '') ? 1 : -1)).slice(0, 10)
      .map(r => ({ id: r.id, month: r.month, state: r.state, postTo: r.postTo, postDate: r.postDate, mediaId: r.mediaId, lastError: r.lastError, tries: r.tries, updatedAt: r.updatedAt })),
    calendarState: feed.calendarState, schedule: feed.settings.schedule, regular: feed.settings.regular, firstUse: feed.settings.firstUse, postTo: feed.settings.postTo
  };
}

function latestReservations_(rows) {
  const out = {};
  rows.filter(r => r.id && r.month).forEach(r => {
    if (!out[r.month] || (r.createdAt || '') >= (out[r.month].createdAt || '')) {
      out[r.month] = { id: r.id, state: r.state, postTo: r.postTo, postDate: r.postDate, publishedAt: r.publishedAt, mediaId: r.mediaId, lastError: r.lastError, createdAt: r.createdAt };
    }
  });
  return out;
}

// 保存の共通の流れ:ロック → 版番号を比べる → 書く → 版番号を上げる → 新しい内容を返す
function mutate_(baseVersion, fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { error: '混み合っています。少し待ってから、もう一度押してください。' };
  try {
    if (+baseVersion !== currentVersion_()) {
      return { conflict: true, error: 'ほかの人が先に変えました。新しい内容を読み直したので、確かめてから、もう一度お願いします。', state: getState() };
    }
    const r = fn();
    if (r && r.error) return r;
    bumpVersion_();
    SpreadsheetApp.flush();
    return { ok: true, message: (r && r.message) || '保存しました。', state: getState() };
  } catch (e) {
    return { error: /permission|権限|access|アクセス/i.test(e.message)
      ? 'シートに書きこめませんでした。このGoogleアカウントに、シートの「編集者」として共有されているか確かめてください。'
      : '保存できませんでした。もう一度押してみてください。(' + e.message + ')' };
  } finally { lock.releaseLock(); }
}

function nextOrder_(key) {
  return readTable_(key).reduce((m, r) => Math.max(m, +r.order || 0), 0) + 1;
}

function savePhrase(input, baseVersion) {
  const c = cleanPhrase(input);
  if (c.error) return { error: c.error };
  return mutate_(baseVersion, () => {
    const now = nowText_();
    if (input.id) { setCells_('phrases', findRow_('phrases', input.id), { cat: c.value.cat, text: c.value.text, ex: 'FALSE', updatedAt: now }); return { message: 'ひとことを直しました。' }; }
    appendRows_('phrases', [{ id: newId_(), cat: c.value.cat, text: c.value.text, order: String(nextOrder_('phrases')), hidden: 'FALSE', ex: 'FALSE', updatedAt: now }]);
    return { message: 'ひとことを登録しました。' };
  });
}

function saveProduct(input, baseVersion) {
  const c = cleanProduct(input);
  if (c.error) return { error: c.error };
  return mutate_(baseVersion, () => {
    const now = nowText_();
    if (input.id) { setCells_('products', findRow_('products', input.id), { name: c.value.name, desc: c.value.desc, color: c.value.color, ex: 'FALSE', updatedAt: now }); return { message: '商品を直しました。' }; }
    appendRows_('products', [{ id: newId_(), name: c.value.name, desc: c.value.desc, color: c.value.color, order: String(nextOrder_('products')), hidden: 'FALSE', ex: 'FALSE', updatedAt: now }]);
    return { message: '商品を登録しました。' };
  });
}

// しまう(hidden: true)/戻す(hidden: false)。消さずに印をつけるだけ
function setHidden(kind, id, hidden, baseVersion) {
  if (kind !== 'phrases' && kind !== 'products') return { error: '種類がちがいます。' };
  return mutate_(baseVersion, () => {
    setCells_(kind, findRow_(kind, id), { hidden: hidden ? 'TRUE' : 'FALSE', updatedAt: nowText_() });
    return { message: hidden ? 'しまいました。「しまったもの」から、いつでも戻せます。' : '戻しました。' };
  });
}

function saveSettings(input, baseVersion) {
  const c = cleanSettings(input);
  if (c.error) return { error: c.error };
  return mutate_(baseVersion, () => {
    const rows = readTable_('settings');
    EDITABLE_SETTINGS.forEach(k => {
      const r = rows.find(x => x.key === k);
      if (r) setCells_('settings', r.row, { value: c.value[k] });
    });
    return { message: 'お店の設定を保存しました。' };
  });
}

// 例を入れる(「例」の印つき)
function seedExamples(kind, baseVersion) {
  return mutate_(baseVersion, () => {
    const now = nowText_();
    if (kind === 'phrases') {
      let o = nextOrder_('phrases');
      appendRows_('phrases', EXAMPLE_PHRASES.map(([cat, text]) => ({ id: newId_(), cat, text, order: String(o++), hidden: 'FALSE', ex: 'TRUE', updatedAt: now })));
    } else if (kind === 'products') {
      let o = nextOrder_('products');
      appendRows_('products', EXAMPLE_PRODUCTS.map(([name, desc, color]) => ({ id: newId_(), name, desc, color, order: String(o++), hidden: 'FALSE', ex: 'TRUE', updatedAt: now })));
    } else return { error: '種類がちがいます。' };
    return { message: '例を入れました。「例」の印がついています。直すと印が消えます。' };
  });
}

// ---------- 営業カレンダー ----------

// カレンダーの行を書く(なければ足す)
function upsertCalendar_(value, state, by) {
  const now = nowText_(), row = readTable_('calendars').find(r => r.month === value.month);
  const vals = { month: value.month, days: value.daysText, note: value.note, state, confirmedAt: state === '確認済み' ? now : '', confirmedBy: state === '確認済み' ? by : '' };
  if (row) setCells_('calendars', row.row, vals); else appendRows_('calendars', [vals]);
}

// その月の、まだ生きている予約を取り消す。返り値は取り消した数
function cancelLiveReservations_(month) {
  let n = 0;
  readTable_('reservations').filter(r => r.month === month && LIVE_RES.includes(r.state)).forEach(r => {
    setCells_('reservations', r.row, { state: '取り消し', ticket: '', updatedAt: nowText_() }); n++;
  });
  return n;
}

// 途中まで保存する(まだ確認しない)。確認ずみの月を直したときは、確認と予約を取り消す
function saveCalendar(input, baseVersion) {
  const c = cleanCalendar(input);
  if (c.error) return { error: c.error };
  return mutate_(baseVersion, () => {
    const before = readTable_('calendars').find(r => r.month === c.value.month);
    const wasOk = before && before.state === '確認済み';
    upsertCalendar_(c.value, '未確認', '');
    const n = cancelLiveReservations_(c.value.month);
    return { message: wasOk || n ? '保存しました。日にちを変えたので、確認と予約を取り消しました。もう一度「この内容でOK」を押してください。' : '途中まで保存しました。まだ確認ずみではありません。' };
  });
}

// 「この内容でOK」。カレンダーを確認済みにし、予約の行を作る。
// 画像は、このあと画面から公開窓口に送る(使い捨ての合言葉 ticket を返す)
function confirmCalendar(input, image, baseVersion) {
  const c = cleanCalendar(input);
  if (c.error) return { error: c.error };
  if (!image || !(+image.size > 0 && +image.size < 8 * 1024 * 1024) || !/^[0-9a-f]{64}$/.test(image.hash || '')) return { error: '画像を作れませんでした。読み直して、もう一度押してください。' };
  let made = null;
  const r = mutate_(baseVersion, () => {
    const me = Session.getActiveUser().getEmail();
    upsertCalendar_(c.value, '確認済み', me);
    cancelLiveReservations_(c.value.month);
    const settings = {};
    readTable_('settings').forEach(x => { settings[x.key] = x.value; });
    const id = newId_(), ticket = Utilities.getUuid().replace(/-/g, '');
    const postDate = postDateFor(c.value.month, settings.postDay);
    appendRows_('reservations', [{
      id, month: c.value.month, postTo: settings.postTo === 'story' ? 'story' : 'feed', postDate, state: '確認済み',
      imagePath: imagePathFor(c.value.month, id), imageSize: String(image.size), imageHash: image.hash, tries: '0',
      createdAt: nowText_(), updatedAt: nowText_(), ticket
    }]);
    made = { resId: id, ticket, postDate };
    return { message: `確認ずみにしました。${+postDate.slice(5, 7)}月${+postDate.slice(8)}日の${settings.postHour || 12}時台に投稿する予約を作りました。` };
  });
  if (r.ok && made) Object.assign(r, made);
  return r;
}

// 「要確認」「失敗」の予約を、お店の人が決める。action: 'posted'(投稿済みにする)| 'retry'(もう一度出す)
function resolveReservation(id, action, baseVersion) {
  return mutate_(baseVersion, () => {
    const r = readTable_('reservations').find(x => x.id === id);
    if (!r) return { error: 'その予約が見つかりません。読み直してください。' };
    if (!['要確認', '失敗'].includes(r.state)) return { error: `この予約は「${r.state}」なので、変えられません。` };
    const now = nowText_();
    if (action === 'posted') {
      setCells_('reservations', r.row, { state: '投稿済み', phase: '', lastError: 'お店の人が「投稿済み」にしました', updatedAt: now });
      return { message: '投稿済みにしました。' };
    }
    if (action === 'retry') {
      setCells_('reservations', r.row, { state: '確認済み', phase: '', containerId: '', tries: '0', tokenBad: '', lastError: '', updatedAt: now });
      return { message: 'もう一度出すことにしました。1時間以内に、自動で投稿します。' };
    }
    return { error: 'えらび方がちがいます。' };
  });
}
