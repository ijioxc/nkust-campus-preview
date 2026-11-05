// 離線快取。頁面先連網拿新版，連不上才用快取，所以更新後打開一次就是新版。
// 改了要預先快取的檔案清單時，VERSION 加一，舊快取會被清掉。
const VERSION = 'v1';
const CACHE = 'campus-' + VERSION;
const FILES = ['./', './index.html', './manifest.webmanifest', './圖示/apple-touch-icon.png', './圖示/icon-192.png', './圖示/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('campus-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const url = new URL(r.url);
  // 字型：有快取就先用，背景再更新
  if (url.host === 'fonts.googleapis.com' || url.host === 'fonts.gstatic.com') {
    e.respondWith(caches.open(CACHE).then(c => c.match(r).then(hit => {
      const net = fetch(r).then(res => { if (res.ok || res.type === 'opaque') c.put(r, res.clone()); return res }).catch(() => hit);
      return hit || net;
    })));
    return;
  }
  if (url.origin !== location.origin) return;
  // 自己的檔案：先連網，成功就順便更新快取
  e.respondWith(fetch(r).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)) }
    return res;
  }).catch(() => caches.match(r, { ignoreSearch: true }).then(hit => hit || (r.mode === 'navigate' ? caches.match('./index.html') : undefined))));
});
