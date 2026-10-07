// 画面の動き。データは今は端末の中だけ(段階3で Firestore につなぐ)。
import { THEMES, FORMATS, KINDS, PHRASES, PRODUCTS, DEFAULT_SETTINGS } from './data.js?v=6';
import { WEEK, iso, md, pad2, dateLabel } from './text.js?v=6';
import { monthKey, monthInfo, mapFor, nextState, countDays, noticeFor, simulatedNow } from './calendar.js?v=6';
import { ls, photoStore } from './store.js?v=6';
import { draw } from './draw.js?v=6';

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

// ---------- 端末に置くデータ ----------
let settings = { ...DEFAULT_SETTINGS, ...ls.get('pn-settings', {}) };
const cal = { months: {}, notes: {}, ...ls.get('pn-cal', {}) }; // 日にちの編集とひとこと
const calok = ls.get('pn-calok', {});                             // 確認の状態 { 'YYYY-MM': { at, done } }
let firstUse = ls.get('pn-first', null);
if (!firstUse) { firstUse = todayIso; ls.set('pn-first', firstUse); }
const saveCal = () => ls.set('pn-cal', cal), saveOk = () => ls.set('pn-calok', calok);

// ---------- 作りかけ(その日のうちだけ) ----------
const d0 = ls.get('pn-draft', {}), draft = d0.day === todayIso ? d0 : {};
if (d0.day && d0.day !== todayIso) ls.del('pn-draft');
let curCat = draft.cat || '', curPhrase = draft.phrase || '';
['kind', 'fmt', 'pos'].forEach(n => { if (draft[n]) setRadio(n, draft[n]); });
$('#f-date').value = draft.date || todayIso;
if (draft.badge != null) $('#f-badge').value = draft.badge;
$('#photoPos').value = draft.photoPos ?? 50;

const ySel = $('#cal-y'), mSel = $('#cal-m');
const ensureYear = y => { if (![...ySel.options].some(o => +o.value === y)) ySel.add(new Option(`${y}年`, y)); };
for (let y = today.getFullYear(); y <= today.getFullYear() + 1; y++) ensureYear(y);
for (let m = 1; m <= 12; m++) mSel.add(new Option(`${m}月`, m));
ensureYear(draft.calY || today.getFullYear());
ySel.value = draft.calY || today.getFullYear(); mSel.value = draft.calM || today.getMonth() + 1;

function saveDraft() {
  ls.set('pn-draft', {
    day: todayIso, kind: radio('kind'), fmt: radio('fmt'), pos: radio('pos'), date: $('#f-date').value,
    cat: curCat, phrase: curPhrase, product: $('#f-product').value, badge: $('#f-badge').value,
    photoPos: +$('#photoPos').value, calY: +ySel.value, calM: +mSel.value,
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
  log.unshift({ at: `${iso(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`, kind: KINDS[radio('kind')], fmt: FORMATS[radio('fmt')].name, sec });
  ls.set('pn-log', log.slice(0, LOG_MAX)); saveDraft();
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
const cats = () => [...new Set(PHRASES.map(p => p.cat))];
const phraseText = () => (PHRASES.find(p => p.id === curPhrase) || {}).text || '';
function paintPhrases() {
  const cs = cats();
  if (!PHRASES.some(p => p.id === curPhrase)) curPhrase = '';
  if (!cs.includes(curCat)) curCat = (PHRASES.find(p => p.id === curPhrase) || {}).cat || cs[0] || '';
  $('#catChips').innerHTML = cs.map(c => `<label><input type="radio" name="cat" value="${esc(c)}"${c === curCat ? ' checked' : ''}>${esc(c)}</label>`).join('');
  const items = PHRASES.filter(p => p.cat === curCat);
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
$('#f-product').innerHTML = PRODUCTS.map(p => `<option value="${p.id}">${esc(p.name)}${p.ex ? '(例)' : ''}</option>`).join('');
if (PRODUCTS.some(p => p.id === draft.product)) $('#f-product').value = draft.product;
const product = () => PRODUCTS.find(p => p.id === $('#f-product').value) || null;

// ---------- 営業カレンダー ----------
const curYM = () => { const y = +ySel.value, m = +mSel.value; return { y, m, key: monthKey(y, m) }; };
const curMap = () => { const { y, m } = curYM(); return mapFor(y, m, cal.months, settings.regular); };
const dayLabel = s => (s === 'c' ? 'お休み' : s === 's' ? '時間変更' : '営業');
function paintGrid() {
  const { y, m, key } = curYM(), { first, n } = monthInfo(y, m), map = curMap(), g = $('#calgrid');
  g.textContent = '';
  WEEK.forEach(w => { const el = document.createElement('div'); el.className = 'wd'; el.textContent = w; el.setAttribute('aria-hidden', 'true'); g.append(el); });
  for (let i = 0; i < first; i++) g.append(document.createElement('span'));
  for (let d = 1; d <= n; d++) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = d; b.dataset.d = d;
    setDay(b, m, d, map[d] || ''); g.append(b);
  }
  $('#calReset').disabled = !cal.months[key];
  if (document.activeElement !== $('#f-calnote')) $('#f-calnote').value = cal.notes[key] || '';
  paintOk();
}
function setDay(b, m, d, s) {
  const w = WEEK[(monthInfo(+ySel.value, m).first + d - 1) % 7];
  b.dataset.s = s; b.setAttribute('aria-label', `${m}月${d}日(${w}) ${dayLabel(s)}`);
}
function paintOk() {
  const { m, key } = curYM(), { closed, changed: ch } = countDays(curMap()), rec = calok[key];
  const days = `お休み ${closed}日${ch ? `、時間変更 ${ch}日` : ''}`;
  $('#calOkText').textContent = rec
    ? `${m}月の営業日は確認ずみです(${rec.at})。${days}。日にちを変えると、もう一度確認が必要になります。`
    : closed + ch === 0 ? `${m}月はお休みの日が入っていません。お休みなしでよければ「この内容でOK」を押してください。`
      : `${m}月は、${days} です。まちがいがなければ「この内容でOK」を押してください。`;
  $('#calOk').hidden = !!rec; $('#calFuture').hidden = !rec;
  const done = $('#calDone'); done.disabled = !!(rec && rec.done); done.textContent = rec && rec.done ? '投稿まで済みました' : '投稿まで済んだ';
}
function unconfirm(key, why) {
  if (!calok[key]) return;
  delete calok[key]; saveOk(); $('#s-cal').textContent = why;
}
$('#calgrid').addEventListener('click', e => {
  const b = e.target.closest('button[data-d]'); if (!b) return;
  const { m, key } = curYM(), map = { ...curMap() }, d = +b.dataset.d, s = nextState(map[d]);
  if (s) map[d] = s; else delete map[d];
  cal.months[key] = map; saveCal(); setDay(b, m, d, s);
  unconfirm(key, '日にちを変えたので、確認を取り消しました。もう一度「この内容でOK」を押してください。');
  $('#calReset').disabled = false; paintOk(); updateNotice(); changed();
});
$('#calReset').addEventListener('click', () => {
  const { key } = curYM(); delete cal.months[key]; saveCal();
  unconfirm(key, '定休日どおりに戻したので、確認を取り消しました。');
  paintGrid(); updateNotice(); changed();
});
$('#f-calnote').addEventListener('input', e => { const { key } = curYM(); cal.notes[key] = e.target.value; saveCal(); changed(); });
[ySel, mSel].forEach(el => el.addEventListener('change', () => { $('#s-cal').textContent = ''; paintGrid(); saveDraft(); changed(); }));
$('#calOk').addEventListener('click', () => {
  const { key } = curYM(); calok[key] = { at: md(new Date()), done: false }; saveOk();
  $('#s-cal').textContent = ''; paintOk(); updateNotice();
});
function markDone(key) { if (!calok[key]) return; calok[key].done = true; saveOk(); paintOk(); updateNotice(); }
$('#calDone').addEventListener('click', () => markDone(curYM().key));

// ---------- 確認のお知らせ ----------
let sim = false;
const noticeNow = () => (sim ? simulatedNow(today, settings, radio('sim')) : today);
function updateNotice() {
  const now = noticeNow(), n = noticeFor(now, settings, calok, firstUse), box = $('#notice');
  const show = ['due', 'ok', 'late'].includes(n.state);
  box.hidden = !show;
  $('#noticeTag').hidden = !sim; $('#noticeTag').textContent = `表示テスト中:今日を ${md(now)} として表示しています`;
  $('#noticeTest').textContent = sim ? '表示テストをやめる' : 'お知らせの表示を試す';
  $('#simModes').hidden = !sim;
  $('#simStatus').textContent = !sim ? '' : show ? `${md(now)}として、いちばん上にお知らせを出しています。`
    : n.state === 'done' ? `${md(now)}として見ています。この月は「投稿まで済んだ」ので、お知らせは出ません。カレンダーの「定休日どおりに戻す」を押すと、確認の前に戻ります。`
      : `${md(now)}として見ています。まだお知らせを出す時期ではありません。`;
  if (!show) return;
  const text = $('#noticeText'), small = document.createElement('small'); text.textContent = ''; box.dataset.state = n.state;
  if (n.state === 'ok') {
    text.append(`${n.tm}月の営業日は確認ずみです(${n.rec.at})。`);
    small.textContent = `画像を保存して、${md(n.P)}に出るように予約投稿してください。(決めた日に自動で投稿するしくみは、これから作る部分です)`;
    $('#noticeGo').textContent = 'カレンダーを開く';
  } else if (n.state === 'late') {
    text.append(`${n.tm}月の営業日が、まだ確認されていません。`);
    small.textContent = `営業カレンダーを出す日(${md(n.P)})を過ぎています。`;
    $('#noticeGo').textContent = '営業日を確認する';
  } else {
    text.append(`${n.tm}月の営業日を確認してください。`);
    small.textContent = n.days === 0 ? `今日(${md(n.P)})が、営業カレンダーを出す日です。` : `${md(n.P)}(あと${n.days}日)に、営業カレンダーを出す予定です。`;
    $('#noticeGo').textContent = '営業日を確認する';
  }
  text.append(small);
  $('#noticeDone').hidden = n.state !== 'ok';
  box.dataset.key = n.key; box.dataset.ty = n.ty; box.dataset.tm = n.tm;
}
$('#noticeGo').addEventListener('click', () => {
  const box = $('#notice'), ty = +box.dataset.ty, tm = +box.dataset.tm;
  setRadio('kind', 'cal'); ensureYear(ty); ySel.value = ty; mSel.value = tm;
  if (location.hash !== '#make') location.hash = 'make';
  syncKind(); paintGrid(); saveDraft(); showTab();
  $('#fs-cal').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
});
$('#noticeDone').addEventListener('click', () => markDone($('#notice').dataset.key));
$('#noticeTest').addEventListener('click', () => {
  sim = !sim; updateNotice();
  if (sim && !$('#notice').hidden) $('#notice').scrollIntoView({ block: 'start' });
});
$('#simModes').addEventListener('change', updateNotice);

// ---------- お店の設定(仮) ----------
$('#set-theme').innerHTML = Object.entries(THEMES).map(([k, t]) => `<option value="${k}">${t.name}</option>`).join('');
$('#regular').innerHTML = WEEK.map((w, i) => `<label><input type="checkbox" value="${i}" aria-label="${w}曜日">${w}</label>`).join('');
for (let d = 1; d <= 28; d++) $('#set-calday').add(new Option(d, d));
[1, 2, 3, 5, 7, 10].forEach(d => $('#set-callead').add(new Option(d, d)));
function paintSettings() {
  const st = settings, act = document.activeElement;
  if ($('#set-hours') !== act) $('#set-hours').value = st.hours || '';
  $('#set-theme').value = st.theme; $('#set-calday').value = st.calday; $('#set-callead').value = st.callead; $('#set-caltarget').value = st.caltarget;
  $$('#regular input').forEach(el => { el.checked = st.regular.includes(+el.value); });
}
function readSettings() {
  settings = {
    hours: $('#set-hours').value.trim(), theme: $('#set-theme').value,
    regular: $$('#regular input:checked').map(el => +el.value),
    calday: +$('#set-calday').value, callead: +$('#set-callead').value, caltarget: $('#set-caltarget').value
  };
  ls.set('pn-settings', settings); paintGrid(); updateNotice(); changed();
}
$('#settingsForm').addEventListener('input', readSettings);
$('#settingsForm').addEventListener('change', readSettings);
$('#settingsReset').addEventListener('click', () => { settings = { ...DEFAULT_SETTINGS }; ls.del('pn-settings'); paintSettings(); paintGrid(); updateNotice(); changed(); });

// ---------- 画像を描く ----------
const cv = $('#cv');
// 駐車場は、お店で決めた画像を使う
const parkImg = new Image();
parkImg.onload = () => changed();
parkImg.src = 'images/parking.jpg?v=6';
function drawState() {
  const { y, m, key } = curYM();
  return {
    kind: radio('kind'), photo, photoPos: +$('#photoPos').value, theme: settings.theme, hours: settings.hours,
    open: { date: dateLabel($('#f-date').value || todayIso), pos: radio('pos'), phrase: phraseText() },
    product: product(), badge: $('#f-badge').value,
    parkImage: parkImg.complete && parkImg.naturalWidth ? parkImg : null,
    cal: { ...monthInfo(y, m), map: curMap(), note: (cal.notes[key] || '').trim() }
  };
}
// 使う文字の分だけ、書体を読み込む(読み込めないときは端末の丸ゴシックで描く)
const seen = new Set();
async function ensureFonts(s) {
  if (!document.fonts || !document.fonts.load) return false;
  const text = 'OPENNEW季節限定本日のおすすめ駐車場ご案内P月の営業日年お休み時間変更商品をえらんでください0123456789.:– ' + WEEK.join('')
    + s.open.phrase + (s.product ? s.product.name + s.product.desc : '') + s.hours + s.cal.note;
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
  $('#photoBox').hidden = k === 'cal' || k === 'park';
  $('#photoPosWrap').hidden = !photo;
}
function showTab() {
  const t = ['make', 'book', 'log'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'make';
  ['make', 'book', 'log'].forEach(n => {
    $('#tab-' + n).hidden = n !== t;
    if (n === t) $('#nav-' + n).setAttribute('aria-current', 'page'); else $('#nav-' + n).removeAttribute('aria-current');
  });
  if (t === 'make') changed();
}
addEventListener('hashchange', showTab);
$('#kinds').addEventListener('change', () => { say(''); syncKind(); if (radio('kind') === 'cal') paintGrid(); saveDraft(); changed(); });
$('#fmts').addEventListener('change', () => { saveDraft(); changed(); });
['#f-date', '#photoPos', '#f-product', '#f-badge'].forEach(sel => $(sel).addEventListener('input', () => { syncKind(); saveDraft(); changed(); }));
$$('input[name=pos]').forEach(el => el.addEventListener('change', () => { saveDraft(); changed(); }));

// 内容に触ったら、時間を計りはじめる(お店の設定は数えない)
['input', 'change'].forEach(ev => $('#tab-make').addEventListener(ev, e => { if (!e.target.closest('#settingsBox')) touch(); }));
$('#calgrid').addEventListener('click', touch);

paintSettings(); paintPhrases(); paintGrid(); syncKind(); updateNotice(); paintLog(); showTimer(recorded ? '(記録しました)' : ''); startTick(); showTab();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => changed());
