// スプレッドシートを読み書きする。日付や数がシートの型に変わらないよう、値は文字で読む。

function book_() { return SpreadsheetApp.openById(prop_('SHEET_ID')); }

function sheet_(key) {
  const sh = book_().getSheetByName(SHEETS[key].name);
  if (!sh) throw new Error(`シート「${SHEETS[key].name}」がありません。setupSheet を実行してください。`);
  return sh;
}

// 1列めに中身がある、いちばん下の行(チェックボックスだけの行は数えない)
function lastDataRow_(sh) {
  const n = sh.getLastRow();
  if (n < 2) return n;
  const col = sh.getRange(1, 1, n, 1).getDisplayValues();
  for (let i = n - 1; i >= 0; i--) if (String(col[i][0]).trim() !== '') return i + 1;
  return 0;
}

// 見た目どおりの文字で読む(getDisplayValues)。返り値は行ごとのオブジェクト
function readTable_(key) {
  const sh = sheet_(key), last = lastDataRow_(sh), cols = SHEETS[key].cols.length;
  if (last < 1 || cols < 1) return [];
  return rowsToObjects(key, sh.getRange(1, 1, last, cols).getDisplayValues());
}

// 行を下に足す。obj は { 英語の名前: 値 }
function appendRows_(key, objs) {
  if (!objs.length) return;
  const sh = sheet_(key), cols = SHEETS[key].cols;
  const values = objs.map(o => cols.map(([k]) => (o[k] == null ? '' : String(o[k]))));
  sh.getRange(lastDataRow_(sh) + 1, 1, values.length, cols.length).setValues(values);
}

// 版番号(設定のシートの version)を1つ上げる。公開窓口と管理ページの両方が使う
function bumpVersion_() {
  const sh = sheet_('settings'), vals = sh.getRange(1, 1, lastDataRow_(sh), 2).getDisplayValues();
  const i = vals.findIndex(r => r[0] === 'version');
  if (i < 0) throw new Error('設定のシートに version の行がありません。');
  const next = (parseInt(vals[i][1], 10) || 0) + 1;
  sh.getRange(i + 1, 2).setValue(String(next));
  return next;
}

// 今の版番号
function currentVersion_() {
  const r = readTable_('settings').find(x => x.key === 'version');
  return r ? parseInt(r.value, 10) || 0 : 0;
}

const newId_ = () => Utilities.getUuid().replace(/-/g, '').slice(0, 10);

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
// 中身(バイト)のSHA-256を、16進の文字にする(画像が予約の記録と同じかを確かめる)
function sha256Hex_(bytes) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes).map(b => ((b + 256) % 256).toString(16).padStart(2, '0')).join('');
}

// 動作記録に1行足す。新しい500行だけ残す
function logRun_(job, result, detail) {
  try {
    const sh = sheet_('runs');
    sh.getRange(lastDataRow_(sh) + 1, 1, 1, 4).setValues([[nowText_(), job, result, String(detail || '').slice(0, 500)]]);
    const extra = lastDataRow_(sh) - 1 - 500;
    if (extra > 0) sh.deleteRows(2, extra);
  } catch (e) { console.log('動作記録に書けませんでした:' + e.message); }
}
