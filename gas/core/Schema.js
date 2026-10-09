// シートの形。シートの名前と、列の見出し(日本語)と、コードの中で使う名前の対応。
// GASに頼らない部分(Node.jsのテストでも読みこむ)。

const SHEETS = {
  settings: { name: '設定', cols: [['key', 'キー'], ['value', '値'], ['note', '説明']] },
  phrases: {
    name: 'ひとこと', idCol: 'id',
    cols: [['id', 'ID'], ['cat', '状況'], ['text', 'ひとこと'], ['order', '並び順'], ['hidden', 'しまう'], ['ex', '例'], ['updatedAt', '更新日時']]
  },
  products: {
    name: '商品', idCol: 'id',
    cols: [['id', 'ID'], ['name', '商品名'], ['desc', '説明'], ['color', '色'], ['order', '並び順'], ['hidden', 'しまう'], ['ex', '例'], ['updatedAt', '更新日時']]
  },
  calendars: {
    name: 'カレンダー', idCol: 'month',
    cols: [['month', '月'], ['days', '日ごとの状態'], ['note', 'ひとこと'], ['state', '確認'], ['confirmedAt', '確認した日時'], ['confirmedBy', '確認した人']]
  },
  reservations: {
    name: '予約', idCol: 'id',
    cols: [['id', '予約ID'], ['month', '月'], ['postTo', '投稿先'], ['postDate', '投稿日'], ['state', '状態'], ['imagePath', '画像の場所'],
      ['imageSize', '画像の大きさ'], ['imageHash', 'ハッシュ値'], ['driveFileId', '原本のファイルID'], ['containerId', '下書きID'],
      ['mediaId', '投稿ID'], ['tries', 'やり直した回数'], ['lastError', '最後のエラー'], ['createdAt', '作成日時'], ['updatedAt', '更新日時'], ['publishedAt', '画像を公開した日時'], ['ticket', '受け渡しの合言葉'], ['phase', '進み具合'], ['tokenBad', 'トークンが使えない']]
  },
  logs: { name: '作業時間', cols: [['receivedAt', '受けた日時'], ['at', '日時'], ['kind', '種類'], ['fmt', '大きさ'], ['sec', '秒']] },
  runs: { name: '動作記録', cols: [['at', '日時'], ['job', '処理'], ['result', '結果'], ['detail', '内容']] }
};

// 設定のシートの行。キーは英語、説明は日本語
const SETTING_ROWS = [
  ['version', '1', '版番号。保存するたびに1つ上がる(手で直さない)'],
  ['hours', '', '営業時間。入れると、営業中とカレンダーの画像に出る(例:10:00 – 18:00)'],
  ['theme', 'pink', '営業中の色(pink / brown / green / yellow / purple)'],
  ['regular', '1,2', '定休日の曜日。0=日 1=月 2=火 3=水 4=木 5=金 6=土。カンマで区切る'],
  ['notice1', '20', 'カレンダーの確認のお知らせを出し、LINEで知らせる日'],
  ['notice2', '23', 'まだ確認していなければ、もう一度LINEで知らせる日'],
  ['postDay', '25', 'カレンダーを投稿する日(前の月)'],
  ['postHour', '12', 'カレンダーを投稿する時(0〜23)'],
  ['postTo', 'feed', 'カレンダーの投稿先(feed=フィード / story=ストーリーズ)'],
  ['firstUse', '', '使い始めた日(2026-10-17 の形)。この日より前に出す予定だった月は、知らせない'],
  ['lastOkAt', '', '毎日の自動実行が、最後に正しく動いた日時(自動で入る)']
];

const COLORS = ['pink', 'brown', 'green', 'yellow', 'purple'];
const CAL_STATES = ['未確認', '確認済み'];
const RES_STATES = ['確認済み', '投稿中', '投稿済み', '失敗', '要確認', '取り消し'];
const LOG_KINDS = ['open', 'new', 'park', 'cal'];
const LOG_FMTS = ['story', 'feed', 'a4'];

// 見出しの行(日本語)を、コードの中の名前に読みかえる
function headerKeys(sheetKey, headerRow) {
  const map = {};
  SHEETS[sheetKey].cols.forEach(([k, label]) => { map[label] = k; });
  return headerRow.map(h => map[String(h).trim()] || null);
}

// シートの値(2次元の配列。1行目は見出し)を、行ごとのオブジェクトにする。row は2から始まるシートの行番号
function rowsToObjects(sheetKey, values) {
  if (!values.length) return [];
  const keys = headerKeys(sheetKey, values[0]);
  return values.slice(1).map((r, i) => {
    const o = { row: i + 2 };
    keys.forEach((k, j) => { if (k) o[k] = String(r[j] == null ? '' : r[j]).trim(); });
    return o;
  }).filter(o => Object.keys(o).some(k => k !== 'row' && o[k] !== '' && o[k] !== 'FALSE'));
  // チェックボックスの欄は、空の行でも「FALSE」と読めるので、それだけの行は空の行として外す
}

if (typeof module !== 'undefined') module.exports = { SHEETS, SETTING_ROWS, COLORS, CAL_STATES, RES_STATES, LOG_KINDS, LOG_FMTS, headerKeys, rowsToObjects };
