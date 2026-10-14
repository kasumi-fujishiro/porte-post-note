// 設定欄(スクリプトプロパティ)を読む。秘密の値は、ログに出さない。

// 秘密の情報。値はGASのエディタの「プロジェクトの設定」から、持ち主が手で入れる
const SECRET_KEYS = ['META_PAGE_TOKEN', 'GITHUB_TOKEN', 'LINE_CHANNEL_TOKEN', 'SHOP_PASSCODE', 'PARTNER_FEED_KEY'];

function prop_(key, required) {
  const v = PropertiesService.getScriptProperties().getProperty(key);
  if (required !== false && !v) throw new Error(`設定欄に「${key}」が入っていません。プロジェクトの設定 → スクリプト プロパティ で足してください。`);
  return v || '';
}

// 空の値は、書かずに行ごと消す(GASの設定欄の画面は、値が空の行があると保存できないため)
function setProp_(key, value) {
  if (SECRET_KEYS.includes(key)) throw new Error('秘密の情報は、コードから書きこみません。');
  const props = PropertiesService.getScriptProperties();
  if (value == null || String(value) === '') props.deleteProperty(key);
  else props.setProperty(key, String(value));
}

// URLの頭の部分(例:https://kasumi-fujishiro.github.io/porte-post-note/)。最後は必ず「/」
function imageBaseUrl_() {
  const b = prop_('IMAGE_BASE_URL');
  return b.endsWith('/') ? b : b + '/';
}

// 日本時間の「2026-10-09 12:03:15」
function nowText_() {
  return Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
}
