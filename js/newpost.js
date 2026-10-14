// 予約サイトとの連携のうち、スタッフの画面でする部分。
// ・予約サイトで登録された新作を、ベルのお知らせから開いて、ワンタップでフィードに投稿する(お店の合言葉つき)
// ・予約サイトで確認された営業カレンダーの画像を、開いたときに裏で描いて送る(合言葉を覚えているスマホだけ)
// ・「新作・季節」で、お店の写真(予約サイトの商品写真)を使う
// 写真は、公開窓口(GAS)が予約サイトから読んで渡す(ほかのサイトの画像を直接描くと、保存できなくなるため)。
import { FORMATS } from './data.js?v=21';
import { draw, cropAxis } from './draw.js?v=21';
import { monthInfo } from './calendar.js?v=21';
import { CONFIG } from '../config.js?v=21';
import { ls } from './store.js?v=21';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pass = () => ls.get('pn-pass', '');

function b64ToBlob(b64, type) {
  const bin = atob(b64), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type: type || 'image/jpeg' });
}
async function blobToB64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
  return btoa(s);
}
const toJpeg = c => new Promise(r => c.toBlob(r, 'image/jpeg', 0.92));
const send = async body => (await fetch(CONFIG.feedUrl, { method: 'POST', body: JSON.stringify(body) })).json();

// お店の写真(予約サイトの商品写真)を受けとる
export async function shopPhoto(id) {
  const r = await (await fetch(`${CONFIG.feedUrl}?api=photo&id=${encodeURIComponent(id)}`)).json();
  if (!r.ok) throw new Error(r.error || 'お店の写真を読めませんでした。');
  return b64ToBlob(r.data, r.type);
}

// api: { data(), loadImage(blob), ensureFonts(state), refresh(), openBell(open), paintBell() }
export function setupNewPost(api) {
  let cur = null, img = null, armed = false;
  const drawn = () => ({ kind: 'new', photo: img, photoPos: +$('#npPos').value, badge: 'NEW', theme: api.data().settings.theme, hours: api.data().settings.hours || '',
    product: cur && { name: cur.name, desc: cur.desc || '', color: cur.color }, open: { phrase: '' }, cal: { note: '' } });
  async function paintNp() {
    if (!img) return;
    const axis = cropAxis(img, FORMATS.feed.w, FORMATS.feed.h);
    $('#npPosWrap').hidden = !axis; $('#npPosWrap label').textContent = axis === 'x' ? '写真の左右の位置' : '写真の上下の位置';
    draw($('#npCv'), FORMATS.feed, drawn());
    if (await api.ensureFonts(drawn())) draw($('#npCv'), FORMATS.feed, drawn());
  }
  const say = (t, err) => { $('#npStatus').textContent = t || ''; $('#npStatus').classList.toggle('err', !!err); };
  const resetGo = () => { armed = false; $('#npGo').textContent = 'フィードに投稿する'; };
  function close() { $('#npPanel').hidden = true; $('#bellBack').hidden = true; cur = null; img = null; }
  async function open(id) {
    const p = api.data().products.find(x => x.id === id);
    if (!p) return;
    api.openBell(false);
    cur = p; img = null; resetGo(); say('お店の写真を読み込んでいます…');
    $('#npLead').textContent = `予約サイトに登録された新作「${p.name}」です。画像と文を確かめて、「フィードに投稿する」を押してください。1時間以内に、Instagramのフィードに出ます(9時〜20時台)。`;
    $('#npCaption').textContent = [p.name, p.desc].filter(Boolean).join('\n');
    $('#npPassBox').hidden = !!pass(); $('#npPass').value = '';
    $('#npPos').value = 50; $('#npPanel').hidden = false; $('#bellBack').hidden = false;
    try { img = await api.loadImage(await shopPhoto(p.id)); say(''); paintNp(); }
    catch (e) { say(e.message || 'お店の写真を読めませんでした。電波のある所で、もう一度開いてください。', true); }
  }
  $('#npPos').addEventListener('input', paintNp);
  $('#npClose').addEventListener('click', close); $('#npCancel').addEventListener('click', close);
  $('#bellBack').addEventListener('click', () => { if (!$('#npPanel').hidden) close(); });
  $('#npGo').addEventListener('click', async () => {
    if (!img || !cur) return;
    const code = pass() || $('#npPass').value.trim();
    if (!code) { say('お店の合言葉を入れてください。', true); $('#npPass').focus(); return; }
    // まちがえて押さないように、2回押したときだけ
    if (!armed) { armed = true; $('#npGo').textContent = 'もう一度押すと投稿します'; setTimeout(() => { if (armed) resetGo(); }, 5000); return; }
    resetGo(); $('#npGo').disabled = true; say('送っています…');
    try {
      const c = document.createElement('canvas'); draw(c, FORMATS.feed, drawn());
      const r = await send({ type: 'staffNewPost', productId: cur.id, passcode: code, image: await blobToB64(await toJpeg(c)) });
      if (r.bad) { ls.set('pn-pass', ''); $('#npPassBox').hidden = false; }
      if (!r.ok) { say(r.error || 'うまくいきませんでした。もう一度押してください。', true); return; }
      ls.set('pn-pass', code); close(); api.refresh();
      alert(r.message || '予約しました。');
    } catch { say('送れませんでした。電波のある所で、もう一度押してください。', true); }
    finally { $('#npGo').disabled = false; }
  });

  // ベルのお知らせ:予約サイトの新作
  function paintNewPosts() {
    const list = api.data().newPending || [], box = $('#newPosts');
    box.hidden = !list.length;
    box.innerHTML = list.map(n => `<div class="notice"><p>予約サイトに新作「${esc(n.name)}」が登録されました。Instagramのフィードに投稿しましょう。</p><div class="row"><button type="button" class="primary" data-np="${esc(n.id)}">画像を作って投稿する</button></div></div>`).join('');
  }
  $('#newPosts').addEventListener('click', e => { const b = e.target.closest('button[data-np]'); if (b) open(b.dataset.np); });

  // 営業カレンダー:合言葉を覚えているスマホなら、開いたときに裏で描いて送る(1回開くごとに、月ごとに1回だけ試す)
  const tried = new Set();
  async function autoCal() {
    const code = pass(), d = api.data();
    if (!code) return;
    for (const c of d.calPending || []) {
      if (tried.has(c.month)) continue;
      tried.add(c.month);
      const cal = (d.calendars || []).find(x => x.month === c.month);
      if (!cal) continue;
      const y = +c.month.slice(0, 4), m = +c.month.slice(5);
      const s = { kind: 'cal', theme: d.settings.theme, hours: d.settings.hours || '', cal: { ...monthInfo(y, m), map: cal.days || {}, note: cal.note || '' }, open: { phrase: '' } };
      const cv = document.createElement('canvas'), f = FORMATS[c.postTo] || FORMATS.feed;
      await api.ensureFonts(s); draw(cv, f, s);
      try {
        const r = await send({ type: 'staffCalImage', month: c.month, passcode: code, image: await blobToB64(await toJpeg(cv)) });
        if (r.bad) ls.set('pn-pass', '');
        if (r.ok) api.refresh();
      } catch { /* 電波がなければ、次に開いたときに */ }
    }
  }

  // 「新作・季節」:お店の写真を使う
  async function useShopPhoto(id, setFromBlob) {
    $('#shopPhotoState').textContent = 'お店の写真を読み込んでいます…';
    try { await setFromBlob(await shopPhoto(id)); $('#shopPhotoState').textContent = ''; }
    catch (e) { $('#shopPhotoState').textContent = e.message || 'お店の写真を読めませんでした。'; }
  }

  // このスマホに、お店の合言葉を覚えさせる(「お店の人用」の画面)
  function paintPass() { $('#passForget').hidden = !pass(); $('#passState').textContent = pass() ? 'このスマホは、お店の合言葉を覚えています。' : ''; }
  $('#passSave').addEventListener('click', async () => {
    const code = $('#passInput').value.trim();
    if (!code) return;
    $('#passState').textContent = '確かめています…';
    try {
      const r = await send({ type: 'passcode', passcode: code });
      if (!r.ok) { $('#passState').textContent = r.error || '合言葉がちがいます。'; return; }
      ls.set('pn-pass', code); $('#passInput').value = ''; paintPass(); autoCal();
    } catch { $('#passState').textContent = '確かめられませんでした。電波のある所で、もう一度押してください。'; }
  });
  $('#passForget').addEventListener('click', () => { ls.set('pn-pass', ''); paintPass(); });
  paintPass();

  return { paint() { paintNewPosts(); autoCal(); }, useShopPhoto };
}
