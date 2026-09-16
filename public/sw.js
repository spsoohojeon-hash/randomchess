const CACHE='randomchess-shell-v2-8';
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(['/icon-192.png','/icon-512.png','/favicon.svg','/manifest.webmanifest'])));self.skipWaiting();});
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('randomchess-shell-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('message',event=>{if(event.data?.type==='CACHE_SHELL')event.waitUntil((async()=>{try{const cache=await caches.open(CACHE);const assets=Array.isArray(event.data.assets)?event.data.assets.slice(0,80):[];await Promise.allSettled(assets.map(async name=>{const u=new URL(name,self.location.origin);if(u.origin!==self.location.origin||!/^\/_next\/static\/.*\.(js|css|woff2?)$/.test(u.pathname))return;const a=await fetch(u.href);if(a.ok&&!a.redirected)await cache.put(u.href,a);}));const r=await fetch('/',{credentials:'same-origin'});if(r.ok&&!r.redirected&&r.headers.get('content-type')?.includes('text/html'))await(await caches.open(CACHE)).put('/',r);}catch{}})());});
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.includes('chatgpt')||url.pathname==='/callback')return;
  if(req.mode==='navigate'){
    event.respondWith((async()=>{try{const r=await fetch(req);if(url.pathname==='/'&&r.ok&&!r.redirected&&r.headers.get('content-type')?.includes('text/html'))await(await caches.open(CACHE)).put('/',r.clone());return r;}catch{return await caches.match('/')||new Response('처음 한 번 온라인으로 열어 주세요.',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});}})());return;
  }
  if(['script','style','font','image'].includes(req.destination))event.respondWith((async()=>{const old=await caches.match(req);if(old)return old;const r=await fetch(req);if(r.ok&&!r.redirected)await(await caches.open(CACHE)).put(req,r.clone());return r;})());
});
