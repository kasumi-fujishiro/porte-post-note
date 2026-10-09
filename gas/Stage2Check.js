// 段階2の確かめ:「GitHubに画像を置く → ページのトークンでテスト用Instagramに投稿する」がGASだけで通るか。
// GASのエディタで、上の関数を選んで「実行」を、check0 から順に押す。結果は「実行ログ」に出る。
// テスト用のInstagramにだけ使う(お店のアカウントのIDを設定欄に入れない)。

const STAGE2_KEYS = ['META_PAGE_TOKEN', 'FB_PAGE_ID', 'GRAPH_VERSION', 'GITHUB_TOKEN', 'GITHUB_REPO', 'IMAGE_BASE_URL'];

// 0. 設定欄に、必要な名前がそろっているか(値は表示しない)
function check0_settings() {
  const p = PropertiesService.getScriptProperties().getProperties();
  const need = STAGE2_KEYS.concat(['IG_USER_ID']);
  need.forEach(k => console.log(`${p[k] ? '○' : '×'} ${k}`));
  const missing = STAGE2_KEYS.filter(k => !p[k]);
  console.log(missing.length ? `足りない名前:${missing.join('、')}` : 'そろっています。IG_USER_ID は、次の check1 で調べます。');
}

// 1. ページのトークンで、Facebookページと、つながっているInstagramを確かめる
function check1_page() {
  const r = graph_('get', prop_('FB_PAGE_ID'), { fields: 'name,instagram_business_account{id,username}' });
  if (r.code !== 200) throw new Error('ページを読めませんでした。' + graphError_(r).text);
  const ig = r.json.instagram_business_account;
  console.log(`Facebookページ:${r.json.name}`);
  if (!ig) { console.log('このページには、Instagramのプロアカウントがつながっていません。'); return; }
  console.log(`つながっているInstagram:@${ig.username}(ID ${ig.id})`);
  const now = prop_('IG_USER_ID', false);
  if (now === ig.id) console.log('IG_USER_ID は、すでにこのIDです。');
  else console.log(`テスト用のアカウントでまちがいなければ、設定欄の IG_USER_ID に ${ig.id} を入れてください。`);
}

// 2. 試しの画像を、GitHubの calendar/ に置く
function check2_github() {
  const base = imageBaseUrl_(), stamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd-HHmmss');
  ['feed', 'story'].forEach(kind => {
    const src = UrlFetchApp.fetch(`${base}tests/assets/sample-${kind}.jpg`);
    const blob = src.getBlob().setContentType('image/jpeg');
    const put = githubPutImage_(`calendar/test-${stamp}-${kind}.jpg`, blob, `段階2の確かめ:試しの画像(${kind})を置く`);
    setProp_(`TEST_${kind.toUpperCase()}_PATH`, put.path);
    setProp_(`TEST_${kind.toUpperCase()}_SIZE`, String(put.size));
    console.log(`置きました:${put.path}(${put.size}バイト)`);
  });
  console.log('GitHub Pagesに出るまで1〜数分かかります。次は check3_public を実行してください。');
}

// 3. 置いた画像が、GitHub Pagesの公開URLで開けるか(大きさも一致するか)
function check3_public() {
  ['FEED', 'STORY'].forEach(k => {
    const url = imageBaseUrl_() + prop_(`TEST_${k}_PATH`), size = +prop_(`TEST_${k}_SIZE`);
    const ok = waitForPublicImage_(url, size, 150);
    console.log(`${ok ? '○ 開けます' : '× まだ開けません'}:${url}`);
  });
}

// 4. フィードに投稿する
function check4_feed() { stage2Post_('feed'); }

// 5. ストーリーズに投稿する
function check5_story() { stage2Post_('story'); }

function stage2Post_(kind) {
  const url = imageBaseUrl_() + prop_(`TEST_${kind.toUpperCase()}_PATH`);
  console.log(`下書きを作ります:${url}`);
  const id = igCreateContainer_(url, kind, '投稿ノートの試し投稿です(段階2の確かめ)');
  console.log(`下書きのID:${id}。準備ができるのを待ちます(最大5分)`);
  const s = igWaitReady_(id);
  if (s !== 'FINISHED') { console.log(`準備ができませんでした(${s})。少し待ってから、もう一度実行してください。`); return; }
  const mediaId = igPublish_(id);
  console.log(`○ 公開しました。投稿のID:${mediaId}`);
}
