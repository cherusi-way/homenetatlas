/* HomeNet Atlas U02 — Service Worker
   ・画面(HTML)と使い方ガイド(help.html)はネット優先：更新をすぐ反映し、つながらないときは保存済みの版を表示
   ・アイコン等（下の一覧にあるものだけ）はキャッシュ優先
   アイコンを差し替えたときは CACHE の末尾の番号を上げてください */
const CACHE = 'homenet-atlas-u02-1.2.4';
const PREFIX = 'homenet-atlas-u02-';   // 同じサイトに置いたほかの版（U01など）のキャッシュは消さない
const ASSETS = [
  './', './index.html', './help.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png',
];
const scopeURL = (p) => new URL(p, self.registration.scope).href;
const APP_PAGES = () => new Set([scopeURL('./'), scopeURL('./index.html')]);
const HELP_PAGE = () => scopeURL('./help.html');   // 使い方ガイドもオフラインで読めるように
const ASSET_URLS = () => new Set(ASSETS.map(scopeURL));

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const bare = url.origin + url.pathname;

  // アプリの画面（./ と ./index.html）：ネット優先。届いたHTMLだけを保存し直す
  if (req.mode === 'navigate') {
    if (bare === HELP_PAGE()) {
      event.respondWith(fetch(req).then((res) => {
        if (res.ok && (res.headers.get('content-type') || '').includes('text/html')) { const copy = res.clone(); event.waitUntil(caches.open(CACHE).then((c) => c.put('./help.html', copy))); }
        return res;
      }).catch(() => caches.match('./help.html')));
      return;
    }
    if (!APP_PAGES().has(bare)) return;   // 同じフォルダのほかのページ（README など）はそのまま通す
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && (res.headers.get('content-type') || '').includes('text/html')) {
            const copy = res.clone();
            event.waitUntil(caches.open(CACHE).then((c) => c.put('./index.html', copy)));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // アイコン・マニフェスト：一覧にあるものだけキャッシュ優先（ほかは触らない）
  if (!ASSET_URLS().has(bare)) return;
  event.respondWith(
    caches.match(bare).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); event.waitUntil(caches.open(CACHE).then((c) => c.put(bare, copy))); }
      return res;
    }))
  );
});
