// 試しの投稿(テスト用のInstagramだけで使う)。設定欄の ALLOW_TEST_POSTS が yes のときだけ動く。
// お店の本番のアカウントに移すときは、ALLOW_TEST_POSTS を消し、testStopWeek を実行する。

function testGuard_() {
  if (prop_('ALLOW_TEST_POSTS', false) !== 'yes') throw new Error('試しの投稿は止めてあります(設定欄の ALLOW_TEST_POSTS が yes ではありません)。');
}

// 試しの予約を1つ作る。画像(試しのカレンダー)をGitHubに置き、公開されるのを待つ。
// このあと hourlyJob を実行すると(または次の自動実行で)、テスト用のInstagramに投稿される
function testMakeReservationNow() {
  testGuard_();
  const id = newId_(), now = nowText_();
  const blob = UrlFetchApp.fetch(imageBaseUrl_() + 'tests/assets/sample-feed.jpg').getBlob().setContentType('image/jpeg');
  const bytes = blob.getBytes(), path = `calendar/test-${id}.jpg`;
  githubPutImage_(path, blob, '試しの投稿の画像を置く');
  appendRows_('reservations', [{
    id, month: 'TEST', postTo: 'feed', postDate: now.slice(0, 10), state: '確認済み', imagePath: path,
    imageSize: String(bytes.length), imageHash: sha256Hex_(bytes), driveFileId: 'test', tries: '0',
    createdAt: now, updatedAt: now, publishedAt: now
  }]);
  const ok = waitForPublicImage_(imageBaseUrl_() + path, bytes.length, 240);
  console.log(`試しの予約を作りました(${id})。画像は${ok ? '公開されました' : 'まだ公開されていません(数分待ってください)'}。今日の${settingsMap_().postHour || 12}時を過ぎていれば、hourlyJob で投稿されます。`);
}

// 「投稿中」で止まった予約を作る(公開を送ったあとの状態)。hourlyJob を実行すると「要確認」になり、投稿されない
function testStuckPublishing() {
  testGuard_();
  const id = newId_(), now = nowText_();
  appendRows_('reservations', [{ id, month: 'TEST', postTo: 'feed', postDate: now.slice(0, 10), state: '投稿中', phase: 'publishing', containerId: 'test-container', imagePath: `calendar/test-${id}.jpg`, tries: '0', createdAt: now, updatedAt: now }]);
  console.log(`「投稿中」で止まった試しの予約を作りました(${id})。hourlyJob を実行して、「要確認」になることを確かめてください。`);
}

// 1週間の試し:毎日11時台に試しの予約を作る(12時台の自動実行で投稿される)
function testStartWeek() {
  testGuard_();
  if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'testMakeReservationNow')) {
    ScriptApp.newTrigger('testMakeReservationNow').timeBased().everyDays(1).atHour(11).create();
  }
  console.log('毎日11時台に、試しの予約を作るようにしました。やめるときは testStopWeek を実行してください。');
}

function testStopWeek() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'testMakeReservationNow').forEach(t => ScriptApp.deleteTrigger(t));
  console.log('試しの予約づくりを止めました。');
}
