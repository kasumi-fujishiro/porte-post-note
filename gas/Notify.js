// LINEの知らせ。お店の中だけで使うLINE公式アカウントから、友だち全員あてに送る。
// お客さん向けのLINE公式アカウントのトークンは、ぜったいに入れない(お客さんに届いてしまう)。
// LINEからの受け取り(Webhook)は作らない。

// アプリへのリンク。LINEの中のブラウザではなく、いつものブラウザで開く指定をつける
function appLink_() {
  return imageBaseUrl_() + '?openExternalBrowser=1';
}

function lineBroadcast_(text) {
  const token = prop_('LINE_CHANNEL_TOKEN', false);
  if (!token) { logRun_('LINEで知らせる', '見送り', 'LINE_CHANNEL_TOKEN が入っていません:' + text.slice(0, 60)); return false; }
  const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/broadcast', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ messages: [{ type: 'text', text }] })
  });
  const ok = res.getResponseCode() === 200;
  logRun_('LINEで知らせる', ok ? '成功' : '失敗', ok ? text.slice(0, 60) : `${res.getResponseCode()} ${res.getContentText().slice(0, 200)}`);
  return ok;
}

// 同じ知らせは1回だけ送る(key ごとに、送った日時を設定欄に残す)
function notifyOnce_(key, text) {
  const k = 'SENT_' + key.replace(/[^A-Za-z0-9:_-]/g, '_');
  if (prop_(k, false)) return;
  if (lineBroadcast_(text)) setProp_(k, nowText_());
}
