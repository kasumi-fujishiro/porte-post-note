// 1時間ごとの自動実行。予約を探して投稿し、知らせを送り、最後に正しく動いた日時を残す。
// GASは1回6分までしか動けないので、5分をめどに切り上げ、続きは次の回に引き継ぐ(下書きは24時間有効)。

const JOB_BUDGET_MS = 5 * 60 * 1000;

function settingsMap_() {
  const s = {};
  readTable_('settings').forEach(r => { s[r.key] = r.value; });
  return s;
}

// 失敗をあらわすエラー。token: トークンが使えない / definite: はっきりした失敗(やり直してよい)
function postError_(message, token, definite) {
  const e = new Error(message); e.token = !!token; e.definite = definite !== false; return e;
}

function hourlyJob() {
  const t0 = Date.now(), lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) { logRun_('自動実行', '見送り', 'ほかの実行が動いています'); return; }
  try {
    const settings = settingsMap_();
    try { publishPendingImages(); } catch (e) { logRun_('画像を公開する', '失敗', e.message); }
    readTable_('reservations').forEach(r => {
      if (Date.now() - t0 > JOB_BUDGET_MS - 60000) return; // 時間切れ。次の回に
      const act = decide(r, nowText_(), settings.postHour || 12);
      if (act === 'wait') return;
      if (act === 'unknown') return markCheck_(r, '公開を送ったあと、結果が分からないまま止まりました。Instagramで投稿されたか確かめてください。');
      if (act === 'restart') {
        const a = afterFailure(r, false);
        setCells_('reservations', r.row, { state: a.state, phase: '', tries: a.tries, lastError: '途中で止まっていました。やり直します。', updatedAt: nowText_() });
        return;
      }
      postOne_(r, act, t0, settings);
    });
    dailyChecks_(settings);
    setProp_('LAST_OK_AT', nowText_());
  } catch (e) {
    logRun_('自動実行', '失敗', e.message);
    throw e;
  } finally { lock.releaseLock(); }
}

function captionFor_(r) {
  if (r.postTo === 'story') return '';
  const m = /^(\d{4})-(\d{2})$/.exec(r.month || '');
  return m ? `${+m[1]}年${+m[2]}月の営業日のお知らせです。` : '投稿ノートのテスト投稿です。';
}

// 1件を投稿する。act: 'post'(始めから)| 'resume'(下書きの準備を待つ続き)
function postOne_(r, act, t0, settings) {
  const set = v => setCells_('reservations', r.row, Object.assign(v, { updatedAt: nowText_() }));
  try {
    const url = imageBaseUrl_() + r.imagePath;
    let containerId = r.containerId;
    if (act === 'post') {
      // 公開用の画像が開けて、大きさと中身が予約の記録と同じかを、先に確かめる
      const img = UrlFetchApp.fetch(url + '?t=' + Date.now(), { muteHttpExceptions: true });
      const bytes = img.getContent();
      if (img.getResponseCode() !== 200 || bytes.length !== +r.imageSize || sha256Hex_(bytes) !== r.imageHash) {
        throw postError_(`公開用の画像が、予約の記録と合いません(${img.getResponseCode()})。`);
      }
      set({ state: '投稿中', phase: '', lastError: '' });
      containerId = igCreateContainer_(url, r.postTo, captionFor_(r));
      // 下書きのIDは、すぐにシートに書く
      set({ containerId, phase: 'container' });
    }
    const st = igWaitUntil_(containerId, t0 + JOB_BUDGET_MS - 20000);
    if (st === 'IN_PROGRESS') { logRun_('投稿', '続きは次の回', `${r.month}:下書きの準備を待っています`); return; }
    if (st !== 'FINISHED') throw postError_(`下書きの準備ができませんでした(${st})。`);
    set({ phase: 'publishing' });
    SpreadsheetApp.flush();
    let mediaId;
    try { mediaId = igPublish_(containerId); }
    catch (e) {
      if (e.definite === false) return markCheck_(r, '公開の結果が分かりません:' + e.message);
      throw e;
    }
    set({ state: '投稿済み', phase: '', mediaId, lastError: '', tokenBad: '' });
    setProp_('TOKEN_BAD', '');
    logRun_('投稿', '成功', `${r.month}:投稿のID ${mediaId}`);
  } catch (e) {
    const a = afterFailure(r, !!e.token);
    set({ state: a.state, phase: '', containerId: '', tries: a.tries, tokenBad: a.tokenBad, lastError: e.message });
    logRun_('投稿', '失敗', `${r.month}:${e.message}`);
    if (e.token) {
      setProp_('TOKEN_BAD', 'yes');
      notifyOnce_(`token:${nowText_().slice(0, 10)}`, `【投稿ノート】Instagramに投稿するための鍵(トークン)が使えなくなりました。自動の投稿は止まっています。管理する人に、作り直しを頼んでください。今月の分は、アプリから画像を保存して手で投稿してください。\n${appLink_()}`);
    } else if (a.giveUp) {
      notifyOnce_(`failed:${r.id}`, `【投稿ノート】${monthLabel_(r.month)}を、自動で投稿できませんでした(${a.tries}回やり直しました)。アプリの「登録・確認(お店の人用)」から画像を保存して、手で投稿してください。\n${appLink_()}`);
    }
  }
}

function markCheck_(r, why) {
  setCells_('reservations', r.row, { state: '要確認', phase: '', lastError: why, updatedAt: nowText_() });
  logRun_('投稿', '要確認', `${r.month}:${why}`);
  notifyOnce_(`check:${r.id}`, `【投稿ノート】${monthLabel_(r.month)}が、投稿できたか分かりません。Instagramを見て、アプリの「登録・確認(お店の人用)」の「最近の投稿」で「投稿済みにする」か「もう一度出す」を選んでください。\n${appLink_()}`);
}

function monthLabel_(month) {
  const m = /^(\d{4})-(\d{2})$/.exec(month || '');
  return m ? `${+m[2]}月の営業カレンダー` : '試しの投稿';
}

// 下書きの準備ができるまで、Metaの案内どおり1分おきに確かめる。deadline を過ぎたら IN_PROGRESS を返す
function igWaitUntil_(containerId, deadline) {
  Utilities.sleep(5000);
  for (;;) {
    const r = graph_('get', containerId, { fields: 'status_code' });
    if (r.code !== 200) { const e = graphError_(r); throw postError_('下書きの状態を読めませんでした。' + e.text, e.token); }
    const s = r.json.status_code;
    if (s !== 'IN_PROGRESS') return s;
    if (Date.now() + 60000 > deadline) return 'IN_PROGRESS';
    Utilities.sleep(60000);
  }
}

// 1日に1回だけ行う確かめ(朝9時より後の最初の回)
function dailyChecks_(settings) {
  const now = nowText_(), today = now.slice(0, 10);
  if (+now.slice(11, 13) < 9 || prop_('LAST_DAILY', false) === today) return;
  setProp_('LAST_DAILY', today);

  // 翌月の分の、確認のお知らせ(20日と23日。まだ確認していなければ)
  const d = new Date(+today.slice(0, 4), +today.slice(5, 7), 1);
  const key = Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM');
  const cal = readTable_('calendars').find(r => r.month === key);
  const kind = lineNoticeKind(now, { notice1: settings.notice1 || 20, notice2: settings.notice2 || 23 }, cal && cal.state === '確認済み' ? 'confirmed' : 'unconfirmed');
  if (kind) {
    const m = +key.slice(5);
    notifyOnce_(`${kind}:${key}`, kind === 'notice1'
      ? `【投稿ノート】${m}月の営業日を確認してください。${+settings.postDay || 25}日の${settings.postHour || 12}時台に、Instagramに自動で投稿します。\n${appLink_()}`
      : `【投稿ノート】${m}月の営業日が、まだ確認されていません。${+settings.postDay || 25}日までに確認してください。\n${appLink_()}`);
  }

  // GitHubのトークンが切れる30日前
  const gh = daysUntil(today, prop_('GITHUB_TOKEN_EXPIRES', false));
  if (gh !== null && gh <= 30) notifyOnce_(`github:${prop_('GITHUB_TOKEN_EXPIRES', false)}`, `【投稿ノート】画像を置くためのGitHubの鍵が、あと${Math.max(gh, 0)}日で切れます。管理する人に、作り直しを頼んでください。`);
  // Metaのデータアクセスの有効期限の14日前
  const meta = daysUntil(today, prop_('META_DATA_ACCESS_EXPIRES', false));
  if (meta !== null && meta <= 14) notifyOnce_(`metadata:${prop_('META_DATA_ACCESS_EXPIRES', false)}`, `【投稿ノート】Instagramに投稿するための鍵の「データアクセスの有効期限」が、あと${Math.max(meta, 0)}日で来ます。管理する人に、作り直しを頼んでください。`);

  // 週に1回、トークンが使えるかを試す
  const last = prop_('TOKEN_CHECKED_AT', false);
  if (!last || daysUntil(last, today) >= 7) {
    setProp_('TOKEN_CHECKED_AT', today);
    const r = graph_('get', prop_('IG_USER_ID'), { fields: 'username' });
    if (r.code === 200) setProp_('TOKEN_BAD', '');
    else if (graphError_(r).token) {
      setProp_('TOKEN_BAD', 'yes');
      notifyOnce_(`token:${today}`, `【投稿ノート】Instagramに投稿するための鍵(トークン)が使えなくなっています。次の投稿の日までに、管理する人に作り直しを頼んでください。\n${appLink_()}`);
    }
  }
}
