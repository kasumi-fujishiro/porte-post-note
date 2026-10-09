// 管理ページ(ウェブアプリ。「アクセスしたユーザーとして実行」「Googleアカウントを持つ全員」で公開する)。
// 開いた本人の権限でシートを読み書きするので、シートを共有されていない人は書けない。
// このプロジェクトには、秘密の情報を置かない(設定欄は SHEET_ID と APP_URL だけ)。

function doGet() {
  const t = HtmlService.createTemplateFromFile('admin');
  t.appUrl = appUrl_();
  return t.evaluate()
    .setTitle('投稿ノート 登録・確認')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); // アプリの中に埋めこめるか試すため
}

function appUrl_() {
  const u = prop_('APP_URL');
  return u.endsWith('/') ? u : u + '/';
}

// 画面に出す内容をまとめて返す
function getState() {
  const me = Session.getActiveUser().getEmail();
  let book;
  try { book = book_(); } catch (e) { return { error: 'noaccess', me }; }
  const tables = { settings: readTable_('settings'), phrases: readTable_('phrases'), products: readTable_('products'), calendars: readTable_('calendars') };
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
    settings, problems, logs: logSummary(readTable_('logs'), 200)
  };
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

// 1つの行の、決まった列だけを書きかえる
function setCells_(key, row, values) {
  const sh = sheet_(key), cols = SHEETS[key].cols.map(c => c[0]);
  Object.keys(values).forEach(k => {
    const c = cols.indexOf(k);
    if (c >= 0) sh.getRange(row, c + 1).setValue(String(values[k]));
  });
}
function findRow_(key, id) {
  const r = readTable_(key).find(x => x.id === id);
  if (!r) throw new Error('その行が見つかりません。読み直してください。');
  return r.row;
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
