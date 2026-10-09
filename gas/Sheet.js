// スプレッドシートを読み書きする。日付や数がシートの型に変わらないよう、値は文字で読む。

function book_() { return SpreadsheetApp.openById(prop_('SHEET_ID')); }

function sheet_(key) {
  const sh = book_().getSheetByName(SHEETS[key].name);
  if (!sh) throw new Error(`シート「${SHEETS[key].name}」がありません。setupSheet を実行してください。`);
  return sh;
}

// 見た目どおりの文字で読む(getDisplayValues)。返り値は行ごとのオブジェクト
function readTable_(key) {
  const sh = sheet_(key), last = sh.getLastRow(), cols = sh.getLastColumn();
  if (last < 1 || cols < 1) return [];
  return rowsToObjects(key, sh.getRange(1, 1, last, cols).getDisplayValues());
}

// 行を下に足す。obj は { 英語の名前: 値 }
function appendRows_(key, objs) {
  if (!objs.length) return;
  const sh = sheet_(key), cols = SHEETS[key].cols;
  const values = objs.map(o => cols.map(([k]) => (o[k] == null ? '' : String(o[k]))));
  sh.getRange(sh.getLastRow() + 1, 1, values.length, cols.length).setValues(values);
}

// 版番号を1つ上げる。設定のシートと、設定欄(配信データの使い回しに使う)の両方を直す
function bumpVersion_() {
  const sh = sheet_('settings'), vals = sh.getRange(1, 1, sh.getLastRow(), 2).getDisplayValues();
  const i = vals.findIndex(r => r[0] === 'version');
  if (i < 0) throw new Error('設定のシートに version の行がありません。');
  const next = (parseInt(vals[i][1], 10) || 0) + 1;
  sh.getRange(i + 1, 2).setValue(String(next));
  setProp_('FEED_VERSION', String(next));
  return next;
}

// 動作記録に1行足す。新しい500行だけ残す
function logRun_(job, result, detail) {
  try {
    const sh = sheet_('runs');
    sh.appendRow([nowText_(), job, result, String(detail || '').slice(0, 500)]);
    const extra = sh.getLastRow() - 1 - 500;
    if (extra > 0) sh.deleteRows(2, extra);
  } catch (e) { console.log('動作記録に書けませんでした:' + e.message); }
}
