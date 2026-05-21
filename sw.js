const CACHE_NAME="randomchess-v1";
const FILES_TO_CACHE=["/","/index.html","/style.css","/app.js","/cards.js","/manifest.json"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(FILES_TO_CACHE)))});
self.addEventListener("fetch",e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))});
