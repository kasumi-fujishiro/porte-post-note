// GitHubのリポジトリに、投稿用の画像を置く。
// トークンは「このリポジトリだけ、Contents の読み書きだけ」の細かい権限のもの。

function githubApi_(method, path, body) {
  const repo = prop_('GITHUB_REPO');
  const res = UrlFetchApp.fetch(`https://api.github.com/repos/${repo}/${path}`, {
    method,
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + prop_('GITHUB_TOKEN'),
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    payload: body ? JSON.stringify(body) : undefined,
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  let json = null;
  try { json = JSON.parse(res.getContentText()); } catch (e) { /* 空の応答 */ }
  return { code, json };
}

// path(例:calendar/2026-11.jpg)に、blob を置く。同じ名前があれば上書きする。
// 返り値:{ path, size, sha }
function githubPutImage_(path, blob, message) {
  if (!/^calendar\/[a-z0-9-]+\.jpg$/.test(path)) throw new Error('画像を置けるのは calendar/ の中の .jpg だけです:' + path);
  const branch = prop_('GITHUB_BRANCH', false) || 'main';
  const old = githubApi_('get', `contents/${path}?ref=${branch}`);
  const body = { message, content: Utilities.base64Encode(blob.getBytes()), branch };
  if (old.code === 200 && old.json && old.json.sha) body.sha = old.json.sha;
  const r = githubApi_('put', `contents/${path}`, body);
  if (r.code === 401 || r.code === 403) throw new Error(`GitHubに断られました(${r.code})。トークンの権限と期限を確かめてください。`);
  if (r.code !== 200 && r.code !== 201) throw new Error(`GitHubに画像を置けませんでした(${r.code}):${r.json && r.json.message}`);
  return { path, size: blob.getBytes().length, sha: r.json.content.sha };
}

// GitHub Pagesで、画像が公開されるまで待つ。大きさ(バイト)が一致したら true
function waitForPublicImage_(url, size, maxSeconds) {
  const until = Date.now() + (maxSeconds || 240) * 1000;
  while (Date.now() < until) {
    const res = UrlFetchApp.fetch(url + '?t=' + Date.now(), { muteHttpExceptions: true, followRedirects: true });
    const type = String(res.getHeaders()['Content-Type'] || '');
    if (res.getResponseCode() === 200 && type.indexOf('image/jpeg') === 0 && res.getContent().length === size) return true;
    Utilities.sleep(15000);
  }
  return false;
}
