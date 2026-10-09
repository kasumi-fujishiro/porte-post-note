// サービスワーカー:電波がないときにも動くように、画面のファイルを端末に保存する。
// ・ページ(index.html)は、まず通信で新しいものを取りに行き、だめなときだけ保存したものを使う(新しい版がすぐ届く)
// ・版の番号(?v=)つきのファイルは、保存したものを使う(番号が変われば別のファイルになる)
// ・書体は、一度使ったものを保存しておく
// 版を上げるときは、VERSION と、下の一覧の ?v= を、index.html と同じ番号にする。
const VERSION = 'v12';
const CACHE = `post-note-${VERSION}`;
const FONT_CACHE = 'post-note-fonts';
const SHELL = [
  './',
  'index.html',
  'manifest.json',
  'css/style.css?v=12',
  'config.js?v=12',
  'js/app.js?v=12',
  'js/data.js?v=12',
  'js/text.js?v=12',
  'js/store.js?v=12',
  'js/draw.js?v=12',
  'js/feed.js?v=12',
  'js/logqueue.js?v=12',
  'js/calendar.js?v=12',
  'images/parking.jpg?v=12'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('post-note-') && k !== CACHE && k !== FONT_CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 書体(Google Fonts):保存したものがあれば使い、裏で新しくする
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONT_CACHE).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== location.origin) return; // 公開窓口(GAS)などは、そのまま通す

  // アプリのページ:通信を先に。だめなら保存したもの(テストのページなどは、そのまま通す)
  const root = new URL(self.registration.scope).pathname;
  if (req.mode === 'navigate') {
    if (url.pathname !== root && url.pathname !== root + 'index.html') return;
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put('index.html', copy));
      return res;
    }).catch(() => caches.match('index.html')));
    return;
  }

  // そのほかのファイル:保存したものを先に
  e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});
