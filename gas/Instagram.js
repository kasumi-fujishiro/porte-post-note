// Facebookページのトークンで、Instagramに画像を投稿する。
// 流れ:下書き(コンテナ)を作る → 準備ができたか確かめる → 公開する

function graphUrl_(path) {
  return `https://graph.facebook.com/${prop_('GRAPH_VERSION')}/${path}`;
}

// トークンは、URLではなく送る中身(payload)に入れる。ログには出さない
function graph_(method, path, params) {
  const token = prop_('META_PAGE_TOKEN');
  const opts = { method, muteHttpExceptions: true };
  let url = graphUrl_(path);
  if (method === 'get') {
    const q = Object.entries(Object.assign({}, params, { access_token: token }))
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    url += '?' + q;
  } else {
    opts.payload = Object.assign({}, params, { access_token: token });
  }
  const res = UrlFetchApp.fetch(url, opts);
  let json = {};
  try { json = JSON.parse(res.getContentText()); } catch (e) { /* JSONでない応答 */ }
  return { code: res.getResponseCode(), json };
}

// はっきりしたエラーを、分かる言葉にする。token: true なら、トークンのやり直しが必要
function graphError_(r) {
  const e = (r.json && r.json.error) || {};
  const token = e.code === 190 || e.code === 102 || (e.type === 'OAuthException' && /token/i.test(e.message || ''));
  return { token, text: `(${r.code} / code ${e.code || '-'}) ${e.message || '応答がありません'}` };
}

// 下書きを作る。kind: 'feed' または 'story'
function igCreateContainer_(imageUrl, kind, caption) {
  const params = { image_url: imageUrl };
  if (kind === 'story') params.media_type = 'STORIES';
  else if (caption) params.caption = caption;
  const r = graph_('post', `${prop_('IG_USER_ID')}/media`, params);
  if (r.code !== 200 || !r.json.id) {
    const e = graphError_(r);
    throw new Error((e.token ? 'トークンが使えません。' : '下書きを作れませんでした。') + e.text);
  }
  return r.json.id;
}

// 準備ができるまで待つ。Metaの案内どおり、1分に1回、5回まで
function igWaitReady_(containerId) {
  Utilities.sleep(5000);
  for (let i = 0; i < 5; i++) {
    const r = graph_('get', containerId, { fields: 'status_code' });
    const s = r.json.status_code;
    if (s === 'FINISHED') return 'FINISHED';
    if (s === 'ERROR' || s === 'EXPIRED') return s;
    if (i < 4) Utilities.sleep(60000);
  }
  return 'IN_PROGRESS';
}

// 公開する。返り値は投稿のID
function igPublish_(containerId) {
  const r = graph_('post', `${prop_('IG_USER_ID')}/media_publish`, { creation_id: containerId });
  if (r.code !== 200 || !r.json.id) {
    const e = graphError_(r);
    throw new Error((e.token ? 'トークンが使えません。' : '公開できませんでした。') + e.text);
  }
  return r.json.id;
}
