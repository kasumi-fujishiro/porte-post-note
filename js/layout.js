// スタッフの画面の形。部品(種類、写真、ひとこと、できあがり、共有など)は1組だけで、形ごとに並べ方だけを変える。
//   L:今の形(下にスクロールする)  S:1画面ずつ順に進む  A:できあがり中心  C:よく使う組み合わせ(仕上げはA)
// 形は、管理ページの「お店の設定」で決める(配信データの settings.layout)。
// URLに ?layout=a などをつけると、そのスマホだけ別の形になる(?layout=auto で元に戻る)。

export const LAYOUTS = { L: '今の形', S: '1画面ずつ', A: 'できあがり中心', C: 'よく使う組み合わせ' };

export function chooseLayout(shopLayout) {
  const q = new URLSearchParams(location.search).get('layout');
  try {
    if (q) { if (q.toLowerCase() === 'auto') localStorage.removeItem('pn-layout'); else localStorage.setItem('pn-layout', q.toUpperCase()); }
  } catch { /* 保存できない端末では、そのときだけ */ }
  let mine = null;
  try { mine = localStorage.getItem('pn-layout'); } catch { mine = null; }
  const v = String(mine || shopLayout || 'L').toUpperCase();
  return LAYOUTS[v] ? v : 'L';
}

const $ = s => document.querySelector(s);
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function btn(text, cls, onClick) { const b = el('button', cls, text); b.type = 'button'; b.addEventListener('click', onClick); return b; }
const piece = id => document.getElementById(id);

// 種類ごとの「仕上げ」の部品
const FINISH = {
  open: [['ことば', ['phraseField', 'copyRow']], ['位置', ['posRow']]],
  new: [['商品', ['fs-new']]],
  park: [],
  cal: [['月', ['fs-cal']]]
};
const NEEDS_PHOTO = k => k === 'open' || k === 'new';
const NOTICES = ['inapp', 'autoAlert', 'share', 'notice'];

// api: { kind(), setKind(k), quickItems(), setPhrase(id), cameraMode(), setCameraMode(m) }
export function applyLayout(name, api) {
  if (name === 'L') return;
  const root = $('#tab-make');
  document.body.dataset.layout = name;
  root.className = 'screens';
  // ほかの部品を取り出したあとの、元の入れ物は使わない
  const keep = ['kinds', 'photoBox', 'fs-open', 'posRow', 'phraseField', 'copyRow', 'fs-new', 'fs-cal', 'fs-park', 'fmts', 'stage', 'actions', 'timer', 'status', 'extraRow', 'fallback', ...NOTICES];
  const parts = {};
  keep.forEach(id => { parts[id] = piece(id); });
  // 使っていない部品は、見えない置き場にしまう(ページから外すと、ほかの処理が部品を見つけられなくなるため)
  const store = el('div', 'layout-store'); store.hidden = true; root.after(store);
  const stash = () => keep.forEach(id => parts[id] && store.append(parts[id]));
  stash(); root.textContent = '';
  const setHeaderHeight = () => {
    const top = $('.top'); document.documentElement.style.setProperty('--hdr', `${(top ? top.offsetHeight : 60) + 40}px`);
  };
  setHeaderHeight(); addEventListener('resize', setHeaderHeight);

  // 1つの画面の枠:上(戻る・題)、中(部品)、下(ボタン)
  function frame({ back, title, body, bottom }) {
    stash(); root.textContent = '';
    const f = el('section', 'scr');
    const top = el('div', 'scr-top');
    if (back) top.append(btn('←', 'back', back));
    if (title) top.append(el('h2', 'scr-title', title));
    if (back || title) f.append(top);
    const b = el('div', 'scr-body'); body.forEach(x => x && b.append(x)); f.append(b);
    if (bottom && bottom.length) { const bt = el('div', 'scr-bottom'); bottom.forEach(x => x && bt.append(x)); f.append(bt); }
    root.append(f);
    window.scrollTo(0, 0);
    window.dispatchEvent(new Event('pn:layout'));
  }
  const notices = () => NOTICES.map(id => parts[id]);
  const bottomParts = () => [parts.actions, parts.status, parts.timer, parts.extraRow];

  // できあがり中心(A)の1画面。tabs:種類に合わせた切りかえ
  let tab = '';
  function editor(back) {
    const k = api.kind();
    const tabs = [...(NEEDS_PHOTO(k) ? [['写真', ['photoBox']]] : []), ...FINISH[k], ['大きさ', ['fmts']]];
    if (!tabs.some(t => t[0] === tab)) tab = tabs[0][0];
    const bar = el('div', 'tabbar'); bar.setAttribute('role', 'tablist');
    const panel = el('div', 'scr-panel');
    function showTab(name) {
      tab = name; panel.textContent = '';
      tabs.find(t => t[0] === name)[1].forEach(id => panel.append(parts[id]));
      if (k === 'park') panel.append(parts['fs-park']);
      [...bar.children].forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
    }
    tabs.forEach(([n]) => { const b = btn(n, 'tab', () => showTab(n)); b.dataset.tab = n; b.setAttribute('role', 'tab'); bar.append(b); });
    parts.kinds.classList.add('compact');
    frame({ back, title: back ? '仕上げ' : '', body: [back ? null : parts.kinds, ...(back ? [] : notices()), parts.stage, bar, panel, parts.fallback], bottom: bottomParts() });
    showTab(tab);
  }

  if (name === 'A') {
    editor(null);
    parts.kinds.addEventListener('change', () => editor(null));
    return;
  }

  if (name === 'S') {
    // 種類ごとの、画面の順番
    const STEPS = { open: ['photo', 'words', 'finish'], new: ['photo', 'product', 'finish'], cal: ['month', 'finish'], park: ['finish'] };
    const goKind = () => {
      parts.kinds.classList.remove('compact');
      frame({ title: '何を作りますか', body: [...notices(), parts.kinds] });
    };
    function go(i) {
      const k = api.kind(), steps = STEPS[k], step = steps[i];
      const back = () => (i === 0 ? goKind() : go(i - 1));
      const next = btn('次へ', 'primary big wide', () => go(i + 1));
      if (step === 'photo') return frame({ back, title: '写真', body: [parts.stage, parts.photoBox], bottom: [next] });
      if (step === 'words') return frame({ back, title: 'ひとこと', body: [parts.phraseField, parts.copyRow], bottom: [next] });
      if (step === 'product') return frame({ back, title: '商品', body: [parts.stage, parts['fs-new']], bottom: [next] });
      if (step === 'month') return frame({ back, title: '何月の分', body: [parts.stage, parts['fs-cal']], bottom: [next] });
      const body = [parts.stage];
      if (k === 'open') body.push(parts.posRow);
      if (k === 'park') body.push(parts['fs-park']);
      body.push(parts.fmts, parts.fallback);
      frame({ back, title: 'しあげ', body, bottom: bottomParts() });
    }
    // 種類をタップしたら、次の画面へ(同じ種類をもう一度押したときも進む)
    parts.kinds.addEventListener('click', e => {
      const lab = e.target.closest('label'); if (!lab || lab.classList.contains('soon')) return;
      setTimeout(() => go(0), 0);
    });
    parts.extraRow.querySelector('#newBtn').addEventListener('click', goKind);
    goKind();
    return;
  }

  if (name === 'C') {
    function goHome() {
      parts.kinds.classList.remove('compact');
      const mode = el('div', 'seg'); mode.setAttribute('role', 'radiogroup'); mode.setAttribute('aria-label', '写真の入れ方');
      [['cam', 'その場で撮る'], ['file', '写真からえらぶ']].forEach(([v, t]) => {
        const lab = el('label'), inp = el('input'); inp.type = 'radio'; inp.name = 'cmode'; inp.value = v; inp.checked = api.cameraMode() === v;
        inp.addEventListener('change', () => api.setCameraMode(v)); lab.append(inp, t); mode.append(lab);
      });
      const list = el('div', 'quick');
      api.quickItems().forEach(q => list.append(btn(q.label, 'quick-btn', () => {
        api.setKind('open'); api.setPhrase(q.id);
        // ボタンを押した流れのまま、カメラ(または写真の選択)を開く
        parts.photoBox.querySelector(api.cameraMode() === 'file' ? '#photoFile' : '#photoCam').click();
        waitPhoto = true;
      })));
      const others = el('div', 'quick-others');
      [['new', '新作・季節'], ['park', '駐車場'], ['cal', '営業カレンダー'], ['open', '営業中を細かく作る']].forEach(([k, t]) => {
        const b = btn(t, 'small', () => { api.setKind(k); goEdit(); });
        if (k === 'cal' && parts.kinds.querySelector('#kind-cal').disabled) b.disabled = true;
        others.append(b);
      });
      frame({ title: '今日の営業中', body: [...notices(), mode, list, el('p', 'hint', 'そのほか'), others] });
    }
    function goEdit() { editor(goHome); }
    let waitPhoto = false;
    window.addEventListener('pn:photo', () => { if (waitPhoto) { waitPhoto = false; goEdit(); } });
    parts.extraRow.querySelector('#newBtn').addEventListener('click', goHome);
    goHome();
  }
}
