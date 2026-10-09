// 初期設定。新しい持ち主が、GASのエディタで setupSheet を1回実行すれば終わるようにする。
// 何度実行しても壊れない(あるものはそのまま、足りないものだけ作る)。

function setupSheet() {
  const props = PropertiesService.getScriptProperties();
  let book;
  if (props.getProperty('SHEET_ID')) book = SpreadsheetApp.openById(props.getProperty('SHEET_ID'));
  else {
    book = SpreadsheetApp.create('投稿ノート データ');
    props.setProperty('SHEET_ID', book.getId());
    console.log('スプレッドシート「投稿ノート データ」を作りました。');
  }
  book.setSpreadsheetTimeZone('Asia/Tokyo');

  Object.keys(SHEETS).forEach(key => {
    const def = SHEETS[key];
    let sh = book.getSheetByName(def.name);
    const isNew = !sh;
    if (isNew) sh = book.insertSheet(def.name);
    const n = def.cols.length;
    // すべて文字として持つ(日付や数に自動で変わらないように)
    sh.getRange(1, 1, sh.getMaxRows(), n).setNumberFormat('@');
    sh.getRange(1, 1, 1, n).setValues([def.cols.map(c => c[1])]).setFontWeight('bold').setBackground('#EDF1E8');
    sh.setFrozenRows(1);
    // 見出しの行は、持ち主しか直せないようにする(管理ページは見出しを書かない)
    protectStrict_(sh, sh.getRange(1, 1, 1, n), '見出しの行は直さないでください');
    // IDの列は、手で直そうとすると注意が出るようにする(管理ページが新しい行のIDを書くので、本当の保護にはしない)
    if (def.idCol) {
      const c = def.cols.findIndex(x => x[0] === def.idCol) + 1;
      protectWarn_(sh, sh.getRange(2, c, sh.getMaxRows() - 1, 1), `${def.cols[c - 1][1]}の列は直さないでください`);
    }
    if (key === 'logs' || key === 'runs' || key === 'reservations') protectWarn_(sh, sh.getRange(2, 1, sh.getMaxRows() - 1, n), 'この表は、アプリが書きます');
    setRules_(key, sh);
    if (isNew) console.log(`シート「${def.name}」を作りました。`);
  });
  const first = book.getSheetByName('シート1') || book.getSheetByName('Sheet1');
  if (first && book.getSheets().length > 1) book.deleteSheet(first);

  // 設定の行(ないものだけ足す)
  const st = readTable_('settings'), have = new Set(st.map(r => r.key));
  const add = SETTING_ROWS.filter(r => !have.has(r[0])).map(([key, value, note]) => ({ key, value, note }));
  appendRows_('settings', add);
  // 使い始めた日が空なら、今日にする(この日より前に出す予定だった月は、知らせない)
  const fu = readTable_('settings').find(r => r.key === 'firstUse');
  if (fu && !fu.value) sheet_('settings').getRange(fu.row, 2).setValue(Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd'));

  // カレンダーの画像の原本を置く、非公開のフォルダ(持ち主だけが見られる)
  if (!props.getProperty('DRIVE_FOLDER_ID')) {
    const folder = DriveApp.createFolder('投稿ノート カレンダーの原本');
    props.setProperty('DRIVE_FOLDER_ID', folder.getId());
    console.log('ドライブに、フォルダ「投稿ノート カレンダーの原本」を作りました(共有はしません)。');
  }
  // 例(まだ1行もないときだけ)
  const now = nowText_();
  if (!readTable_('phrases').length) appendRows_('phrases', EXAMPLE_PHRASES.map(([cat, text], i) => ({ id: newId_(), cat, text, order: String(i + 1), hidden: 'FALSE', ex: 'TRUE', updatedAt: now })));
  if (!readTable_('products').length) appendRows_('products', EXAMPLE_PRODUCTS.map(([name, desc, color], i) => ({ id: newId_(), name, desc, color, order: String(i + 1), hidden: 'FALSE', ex: 'TRUE', updatedAt: now })));
  setRules_('phrases', sheet_('phrases')); setRules_('products', sheet_('products'));

  // シートを手で直したときにも版番号が上がるように、編集を見はる
  const exists = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'handleSheetEdit');
  if (!exists) ScriptApp.newTrigger('handleSheetEdit').forSpreadsheet(book).onEdit().create();

  // 1時間ごとの自動実行(予約の投稿、知らせ)
  if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'hourlyJob')) {
    ScriptApp.newTrigger('hourlyJob').timeBased().everyHours(1).create();
    console.log('1時間ごとの自動実行(hourlyJob)を作りました。');
  }

  bumpVersion_();
  logRun_('setupSheet', '成功', '初期設定');
  console.log(`できました。シート:${book.getUrl()}`);
}

// 持ち主しか直せない保護。前に「注意だけ」で作ったものがあれば、強くする
function protectStrict_(sh, range, why) {
  let p = sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).find(x => x.getDescription() === why);
  if (!p) p = range.protect().setDescription(why);
  p.setWarningOnly(false);
  p.addEditor(Session.getEffectiveUser());
  p.removeEditors(p.getEditors().filter(u => u.getEmail() !== Session.getEffectiveUser().getEmail()));
  if (p.canDomainEdit()) p.setDomainEdit(false);
}

function protectWarn_(sh, range, why) {
  const exists = sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).some(p => p.getDescription() === why);
  if (!exists) range.protect().setDescription(why).setWarningOnly(true);
}

// えらぶ列には入力規則をつける
function setRules_(key, sh) {
  const col = k => SHEETS[key].cols.findIndex(x => x[0] === k) + 1;
  const rows = sh.getMaxRows() - 1;
  const list = vals => SpreadsheetApp.newDataValidation().requireValueInList(vals, true).setAllowInvalid(false).build();
  const check = SpreadsheetApp.newDataValidation().requireCheckbox('TRUE', 'FALSE').build();
  if (key === 'phrases' || key === 'products') { sh.getRange(2, col('hidden'), rows, 1).setDataValidation(check); sh.getRange(2, col('ex'), rows, 1).setDataValidation(check); }
  if (key === 'products') sh.getRange(2, col('color'), rows, 1).setDataValidation(list(COLORS));
  if (key === 'calendars') sh.getRange(2, col('state'), rows, 1).setDataValidation(list(CAL_STATES));
  if (key === 'reservations') { sh.getRange(2, col('state'), rows, 1).setDataValidation(list(RES_STATES)); sh.getRange(2, col('postTo'), rows, 1).setDataValidation(list(['feed', 'story'])); }
}

// シートが手で直されたら、版番号を上げる(版番号のセル自体を直したときはそのまま)
function handleSheetEdit(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;
  try {
    const sh = e && e.range && e.range.getSheet();
    if (sh && sh.getName() === SHEETS.settings.name && e.range.getRow() > 1 && sh.getRange(e.range.getRow(), 1).getDisplayValue() === 'version') return;
    bumpVersion_();
  } finally { lock.releaseLock(); }
}
