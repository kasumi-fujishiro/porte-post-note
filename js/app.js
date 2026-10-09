// スタッフの画面の動き。ひとこと・商品・お店の設定は、GASの公開窓口から受け取る配信データ(端末に保存した写し)で動く。
import { FORMATS, KINDS } from './data.js?v=11';
import { cachedFeed, fallbackFeed, fetchFeed } from './feed.js?v=11';
import { enqueueLog, flushLogs, pendingLogs } from './logqueue.js?v=11';
import { WEEK, iso, pad2, dateLabel } from './text.js?v=11';
import { monthInfo, noticeFor } from './calendar.js?v=11';
import { CONFIG } from '../config.js?v=11';
import { ls, photoStore } from './store.js?v=11';
import { draw } from './draw.js?v=11';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const radio = name => ($(`input[name=${name}]:checked`) || {}).value;
const setRadio = (name, v) => { const el = $(`input[name=${name}][value="${v}"]`); if (el) el.checked = true; };
const today = new Date(), todayIso = iso(today);

// LINEやInstagramの中の画面で開かれたとき
if (/Line\/|Instagram|FBAN|FBAV|FB_IAB/i.test(navigator.userAgent)) $('#inapp').hidden = false;
// 開いたまま日付が変わったら、まっさらにするために読み込み直す
document.addEventListener('visibilitychange', () => { if (!document.hidden && iso(new Date()) !== todayIso) location.reload(); });

// ---------- 配信データ(端末に保存した写し。なければ画面に入れた仮のもの) ----------
let data = cachedFeed() || fallbackFeed();
// 10月7日の試作で、端末に残したカレンダーと設定は使わないので消す
['pn-settings', 'pn-cal', 'pn-calok', 'pn-first'].forEach(k => ls.del(k));

// ---------- 作りかけ(その日のうちだけ) ----------
const d0 = ls.get('pn-draft', {}), draft = d0.day === todayIso ? d0 : {};
if (d0.day && d0.day !== todayIso) ls.del('pn-draft');
let curCat = draft.cat || '', curPhrase = draft.phrase || '';
['kind', 'fmt', 'pos'].forEach(n => { if (draft[n]) setRadio(n, draft[n]); });
$('#f-date').value = draft.date || todayIso;
if (draft.badge != null) $('#f-badge').value = draft.badge;
$('#photoPos').value = draft.photoPos ?? 50;

function saveDraft() {
  ls.set('pn-draft', {
    day: todayIso, kind: radio('kind'), fmt: radio('fmt'), pos: radio('pos'), date: $('#f-date').value,
    cat: curCat, phrase: curPhrase, product: $('#f-product').value, badge: $('#f-badge').value,
    photoPos: +$('#photoPos').value, calMonth: $('#f-calmonth').value,
    t0, recorded
  });
}

// ---------- 作業時間(触りはじめてから、保存か共有まで) ----------
let t0 = draft.t0 || 0, recorded = !!draft.recorded, tick = 0;
const LOG_MAX = 200;
const fmtSec = sec => `${Math.floor(sec / 60)}:${pad2(sec % 60)}`;
const elapsed = () => (t0 ? Math.max(1, Math.round((Date.now() - t0) / 1000)) : 0);
function showTimer(note = '') {
  const el = $('#timer'); el.textContent = `作業時間 ${fmtSec(elapsed())}${note}`; el.classList.toggle('on', !!t0 && !recorded);
}
function startTick() { clearInterval(tick); if (t0 && !recorded) tick = setInterval(showTimer, 1000); }
function touch() {
  if (t0 || recorded) return;
  t0 = Date.now(); saveDraft(); showTimer(); startTick();
}
// 保存か共有ができたときに1回だけ記録する
function record() {
  if (!t0 || recorded) return;
  const sec = elapsed(), d = new Date();
  recorded = true; clearInterval(tick);
  const log = ls.get('pn-log', []);
  const at = `${iso(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  log.unshift({ at, kind: KINDS[radio('kind')], fmt: FORMATS[radio('fmt')].name, sec });
  ls.set('pn-log', log.slice(0, LOG_MAX)); saveDraft();
  enqueueLog({ at, kind: radio('kind'), fmt: radio('fmt'), sec });
  $('#timer').textContent = `作業時間 ${fmtSec(sec)}(記録しました)`; $('#timer').classList.remove('on');
  paintLog();
}
function resetTimer() { t0 = 0; recorded = false; clearInterval(tick); showTimer(); }

// ---------- 記録の画面 ----------
function paintLog() {
  const log = ls.get('pn-log', []), tb = $('#logTable tbody'); tb.textContent = '';
  for (const r of log.slice(0, 50)) {
    const tr = document.createElement('tr');
    for (const v of [r.at, r.kind, r.fmt, r.sec]) { const td = document.createElement('td'); td.textContent = v; tr.append(td); }
    tb.append(tr);
  }
  $('#logEmpty').hidden = log.length > 0; $('#logTable').hidden = log.length === 0;
  $('#logAvg').textContent = log.length ? `${log.length}回の平均は ${Math.round(log.reduce((a, r) => a + r.sec, 0) / log.length)}秒 です。` : '';
}
$('#logCopy').addEventListener('click', async () => {
  const log = ls.get('pn-log', []);
  if (!log.length) { $('#s-log').textContent = 'まだ記録がありません。'; return; }
  const tsv = ['日時\t種類\t大きさ\t秒', ...log.map(r => [r.at, r.kind, r.fmt, r.sec].join('\t'))].join('\n');
  try { await navigator.clipboard.writeText(tsv); $('#s-log').textContent = 'コピーしました。表計算ソフトに貼り付けられます。'; }
  catch { $('#s-log').textContent = 'コピーできませんでした。'; }
});
// まちがって消さないように、2回押したときだけ消す
let clearArmed = 0;
$('#logClear').addEventListener('click', e => {
  const b = e.currentTarget;
  if (!clearArmed) {
    b.textContent = 'もう一度押すと消えます'; $('#s-log').textContent = '消した記録は戻せません。';
    clearArmed = setTimeout(() => { clearArmed = 0; b.textContent = '記録を消す'; $('#s-log').textContent = ''; }, 4000);
    return;
  }
  clearTimeout(clearArmed); clearArmed = 0; b.textContent = '記録を消す';
  ls.del('pn-log'); paintLog(); $('#s-log').textContent = '記録を消しました。';
});

// ---------- 知らせる文 ----------
function say(msg, err) { const s = $('#status'); s.textContent = msg || ''; s.classList.toggle('err', !!err); }

// ---------- 写真(端末の外には送らない) ----------
let photo = null;
function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const im = new Image(); im.onload = () => resolve(im); im.onerror = reject; im.src = URL.createObjectURL(blob);
  });
}
function setPhoto(img, note) {
  if (photo && photo.src) URL.revokeObjectURL(photo.src);
  photo = img; $('#photoState').textContent = img ? note : 'まだ写真がありません。';
  syncKind(); changed();
}
async function pickPhoto(file) {
  if (!file) return;
  $('#photoState').textContent = '写真を読み込んでいます…';
  try {
    const img = await loadImage(file);
    // 長辺1920ピクセルに縮めてから使う・保存する
    const k = Math.min(1, 1920 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(img.src);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
    const kept = blob && await photoStore.set({ day: todayIso, blob });
    $('#photoPos').value = 50; saveDraft();
    setPhoto(c, kept ? '写真が入っています。' : '写真が入っています。(この端末には残せませんでした。読み込み直すと消えます)');
  } catch {
    $('#photoState').textContent = 'この写真は読み込めませんでした。別の写真をえらんでください。';
  }
}
['#photoFile', '#photoCam'].forEach(sel => $(sel).addEventListener('change', e => { pickPhoto(e.target.files && e.target.files[0]); e.target.value = ''; }));
photoStore.get().then(async v => {
  if (!v) return;
  if (v.day !== todayIso) { photoStore.del(); return; }
  try { setPhoto(await loadImage(v.blob), '前の写真が残っています。'); } catch { photoStore.del(); }
});

// ---------- ひとこと ----------
const cats = () => [...new Set(data.phrases.map(p => p.cat))];
const phraseText = () => (data.phrases.find(p => p.id === curPhrase) || {}).text || '';
function paintPhrases() {
  const cs = cats();
  if (!data.phrases.some(p => p.id === curPhrase)) curPhrase = '';
  if (!cs.includes(curCat)) curCat = (data.phrases.find(p => p.id === curPhrase) || {}).cat || cs[0] || '';
  $('#catChips').innerHTML = cs.map(c => `<label><input type="radio" name="cat" value="${esc(c)}"${c === curCat ? ' checked' : ''}>${esc(c)}</label>`).join('');
  const items = data.phrases.filter(p => p.cat === curCat);
  $('#phraseChips').innerHTML = [`<label><input type="radio" name="phrase" value=""${curPhrase ? '' : ' checked'}>ひとことなし</label>`,
    ...items.map(p => `<label><input type="radio" name="phrase" value="${p.id}"${p.id === curPhrase ? ' checked' : ''}>${esc(p.text)}${p.ex ? '<span class="tagex">例</span>' : ''}</label>`)].join('');
}
$('#catChips').addEventListener('change', e => { curCat = e.target.value; paintPhrases(); saveDraft(); });
$('#phraseChips').addEventListener('change', e => { curPhrase = e.target.value; saveDraft(); changed(); });
$('#phraseCopy').addEventListener('click', async () => {
  const t = phraseText(), s = $('#s-phrase');
  if (!t) { s.textContent = '先に、ひとことをえらんでください。'; return; }
  try { await navigator.clipboard.writeText(t); s.textContent = 'コピーしました。'; } catch { s.textContent = 'コピーできませんでした。'; }
});

// ---------- 商品 ----------
function paintProducts() {
  const sel = $('#f-product'), keep = sel.value || draft.product;
  sel.innerHTML = data.products.map(p => `<option value="${p.id}">${esc(p.name)}${p.ex ? '(例)' : ''}</option>`).join('');
  if (data.products.some(p => p.id === keep)) sel.value = keep;
  sel.disabled = !data.products.length;
}
const product = () => data.products.find(p => p.id === $('#f-product').value) || null;

// ---------- 営業カレンダー(確認ずみの月だけ。編集はお店の人用のページで) ----------
const calendars = () => (data.calendars || []).slice().sort((a, b) => (a.month < b.month ? -1 : 1));
function paintCalendars() {
  const list = calendars(), sel = $('#f-calmonth'), keep = sel.value || draft.calMonth;
  sel.innerHTML = list.map(c => `<option value="${c.month}">${+c.month.slice(0, 4)}年${+c.month.slice(5)}月</option>`).join('');
  const nextKey = (() => { const d = new Date(today.getFullYear(), today.getMonth() + 1, 1); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; })();
  sel.value = list.some(c => c.month === keep) ? keep : list.some(c => c.month === nextKey) ? nextKey : (list[list.length - 1] || {}).month || '';
  const none = !list.length;
  $('#kind-cal').disabled = none; $('#kindCalWrap').classList.toggle('soon', none);
  $('#kindCalNote').textContent = none ? 'お店の人が確認すると、ここで保存できます' : '確認ずみの月の画像を保存する';
  if (none && radio('kind') === 'cal') setRadio('kind', 'open');
}
const calOf = () => { const c = calendars().find(x => x.month === $('#f-calmonth').value); if (!c) return null; const y = +c.month.slice(0, 4), m = +c.month.slice(5); return { ...monthInfo(y, m), map: c.days || {}, note: c.note || '' }; };

// ---------- 確認のお知らせ(ログインしていない人にも出す。確認はお店の人用のページで) ----------
function updateNotice() {
  const sch = data.settings.schedule;
  if (!sch) { $('#notice').hidden = true; return; }
  const n = noticeFor(today, sch, data.calendarState || {}, data.settings.firstUse || ''), box = $('#notice');
  const show = n.state === 'due' || n.state === 'late';
  box.hidden = !show; if (!show) return;
  const P = `${n.P.getMonth() + 1}月${n.P.getDate()}日`, small = document.createElement('small');
  box.dataset.state = n.state; box.dataset.key = n.key;
  $('#noticeText').textContent = n.state === 'late' ? `${n.tm}月の営業日が、まだ確認されていません。` : `${n.tm}月の営業日を確認してください。`;
  small.textContent = n.state === 'late' ? `投稿する日(${P})を過ぎています。お店の人に知らせてください。` : `${n.days === 0 ? `今日(${P})` : `${P}(あと${n.days}日)`}に、営業カレンダーを投稿する予定です。`;
  $('#noticeText').append(small);
  $('#noticeGo').hidden = !CONFIG.adminUrl;
}
$('#noticeGo').addEventListener('click', () => { if (CONFIG.adminUrl) location.href = `${CONFIG.adminUrl}?tab=calendar&month=${$('#notice').dataset.key}`; });

// ---------- 画像を描く ----------
const cv = $('#cv');
// 駐車場は、お店で決めた画像を使う
const parkImg = new Image();
parkImg.onload = () => changed();
parkImg.src = 'images/parking.jpg?v=11';
function drawState() {
  return {
    kind: radio('kind'), photo, photoPos: +$('#photoPos').value, theme: data.settings.theme, hours: data.settings.hours || '',
    open: { date: dateLabel($('#f-date').value || todayIso), pos: radio('pos'), phrase: phraseText() },
    product: product(), badge: $('#f-badge').value,
    parkImage: parkImg.complete && parkImg.naturalWidth ? parkImg : null,
    cal: calOf() || { ...monthInfo(today.getFullYear(), today.getMonth() + 1), map: {}, note: '' }
  };
}
// 使う文字の分だけ、書体を読み込む(読み込めないときは端末の丸ゴシックで描く)
const seen = new Set();
async function ensureFonts(s) {
  if (!document.fonts || !document.fonts.load) return false;
  const text = 'OPENNEW季節限定本日のおすすめ駐車場ご案内P商品をえらんでください0123456789.:– ' + WEEK.join('')
    + s.open.phrase + (s.product ? s.product.name + s.product.desc : '') + s.hours + (s.cal.note || '') + '月の営業日年お休み時間変更';
  const need = [...new Set(text)].filter(ch => !seen.has(ch));
  if (!need.length) return false;
  need.forEach(ch => seen.add(ch));
  try {
    await Promise.race([
      Promise.all(['"Potta One"', '"Yusei Magic"'].map(f => document.fonts.load(`40px ${f}`, need.join('')))),
      new Promise(r => setTimeout(r, 4000))
    ]);
  } catch { /* 読み込めなくても、代わりの書体で描ける */ }
  return true;
}
let raf = 0, version = 0;
function render() {
  if ($('#tab-make').hidden) return;
  const s = drawState();
  draw(cv, FORMATS[radio('fmt')], s);
  prepareFile();
  return s;
}
function changed() {
  version++; cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => { const s = render(); if (s) ensureFonts(s).then(ch => { if (ch) render(); }); });
}

// ---------- 保存と共有 ----------
const toBlob = () => new Promise(r => cv.toBlob(r, 'image/jpeg', 0.92));
function fileName() {
  const d = new Date();
  return `${radio('kind')}_${radio('fmt')}_${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}.jpg`;
}
const makeFile = blob => new File([blob], fileName(), { type: 'image/jpeg' });
let canShare = false;
try { canShare = !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.jpg', { type: 'image/jpeg' })] })); } catch { canShare = false; }
$('#shareBtn').hidden = !canShare;

// 共有はボタンを押した直後に呼ぶ必要があるので、画像を先に作っておく
let cached = null, prepTimer = 0;
function prepareFile() {
  if (!canShare) return;
  const v = version; clearTimeout(prepTimer);
  prepTimer = setTimeout(async () => { const b = await toBlob(); if (b && v === version) cached = { v, file: makeFile(b) }; }, 400);
}
function ready() {
  const k = radio('kind');
  if ((k === 'open' || k === 'new') && !photo) { say('写真がないと保存できません。先に「写真をえらぶ」を押してください。', true); return false; }
  if (k === 'new' && !product()) { say('商品がまだ登録されていません。', true); return false; }
  if (k === 'cal' && !calOf()) { say('確認ずみのカレンダーがありません。', true); return false; }
  if (k === 'park' && !(parkImg.complete && parkImg.naturalWidth)) { say('駐車場の画像を読み込めていません。電波のある所で、ページを読み込み直してください。', true); return false; }
  return true;
}
$('#shareBtn').addEventListener('click', async () => {
  if (!ready()) return;
  let file = cached && cached.v === version ? cached.file : null;
  if (!file) { render(); file = makeFile(await toBlob()); }
  try { await navigator.share({ files: [file] }); record(); say('共有の画面から渡しました。'); }
  catch (e) {
    if (e && e.name === 'AbortError') say('共有をやめました。');
    else say('共有できませんでした。「画像を保存する」を押して、保存してから投稿してください。', true);
  }
});
$('#saveBtn').addEventListener('click', async e => {
  if (!ready()) return;
  const btn = e.currentTarget; btn.disabled = true;
  try {
    render();
    const blob = await toBlob(), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = fileName(); document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000); record();
    say(canShare ? '保存しました。写真のアプリに入れたいときは「共有する」から「画像を保存」をえらんでください。' : '保存しました。');
  } catch {
    say('保存できませんでした。「うまく保存できないとき」を押してください。', true);
  } finally { btn.disabled = false; }
});
$('#fallbackBtn').addEventListener('click', async () => {
  if (!ready()) return;
  render(); const img = $('#fallbackImg');
  if (img.src) URL.revokeObjectURL(img.src);
  img.src = URL.createObjectURL(await toBlob()); $('#fallback').hidden = false;
  $('#fallback').scrollIntoView({ block: 'nearest' });
});
$('#newBtn').addEventListener('click', () => {
  photoStore.del(); setPhoto(null);
  resetTimer(); curPhrase = ''; $('#f-date').value = todayIso; $('#photoPos').value = 50; $('#s-phrase').textContent = '';
  $('#fallback').hidden = true; paintPhrases(); saveDraft(); changed();
  say('新しい投稿にしました。');
});

// ---------- 画面の切りかえ ----------
function syncKind() {
  const k = radio('kind');
  ['open', 'new', 'park', 'cal'].forEach(n => { $('#fs-' + n).hidden = n !== k; });
  $('#photoBox').hidden = k === 'park' || k === 'cal';
  $('#photoPosWrap').hidden = !photo;
}
function showTab() {
  const t = ['make', 'shop'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'make';
  ['make', 'shop'].forEach(n => {
    $('#tab-' + n).hidden = n !== t;
    if (n === t) $('#nav-' + n).setAttribute('aria-current', 'page'); else $('#nav-' + n).removeAttribute('aria-current');
  });
  if (t === 'make') changed();
}
addEventListener('hashchange', showTab);
$('#kinds').addEventListener('change', () => { say(''); syncKind(); saveDraft(); changed(); });
$('#fmts').addEventListener('change', () => { saveDraft(); changed(); });
['#f-date', '#photoPos', '#f-product', '#f-badge', '#f-calmonth'].forEach(sel => $(sel).addEventListener('input', () => { syncKind(); saveDraft(); changed(); }));
$$('input[name=pos]').forEach(el => el.addEventListener('change', () => { saveDraft(); changed(); }));

// 内容に触ったら、時間を計りはじめる
['input', 'change'].forEach(ev => $('#tab-make').addEventListener(ev, touch));

// ---------- お店の人用のページ ----------
$('#adminOpen').disabled = !CONFIG.adminUrl;
$('#adminSoon').hidden = !!CONFIG.adminUrl;
$('#adminOpen').addEventListener('click', () => { if (CONFIG.adminUrl) location.href = CONFIG.adminUrl; });

// ---------- 配信データの更新と、作業時間の送信 ----------
function paintFeedInfo(state) {
  const el = $('#feedInfo');
  const when = data.generatedAt ? data.generatedAt.slice(0, 16).replace('T', ' ') : '';
  el.textContent = !data.version ? 'お店のデータは、まだ受け取っていません。例として入れたひとことと商品で動いています。'
    : `お店のデータ:版 ${data.version}(${when} に作られたもの)`
      + (state === 'offline' ? '。いまは新しい版を確かめられないので、前回の内容で動いています。' : '');
  const n = pendingLogs();
  $('#logPending').textContent = n ? `まだ送れていない記録が ${n}件 あります。電波のある所で開くと送ります。` : '';
}
async function refreshFeed() {
  const [f, state] = await fetchFeed(data);
  if (f) { data = f; paintPhrases(); paintProducts(); paintCalendars(); syncKind(); updateNotice(); saveDraft(); changed(); }
  paintFeedInfo(state);
}
addEventListener('online', () => { flushLogs().then(() => paintFeedInfo()); refreshFeed(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) { refreshFeed(); flushLogs(); } });

// 電波がないときのために、画面のファイルを端末に保存する
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

paintPhrases(); paintProducts(); paintCalendars(); syncKind(); updateNotice(); paintLog(); paintFeedInfo();
refreshFeed(); flushLogs(); showTimer(recorded ? '(記録しました)' : ''); startTick(); showTab();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => changed());
