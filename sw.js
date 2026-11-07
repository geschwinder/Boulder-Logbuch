/* Boulder-Logbuch: offline support.
   The page is loaded from the network when there is a connection (so updates arrive on their own)
   and from the cache when there is none or it takes too long. Training data is not touched here;
   it lives in the browser storage of the app. */
const CACHE = "boulder-v1";
const FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    e.respondWith(networkFirst(req, "./index.html"));
  } else {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { put(req, res.clone()); return res; })));
  }
});
async function networkFirst(req, fallback) {
  const cached = () => caches.match(req).then(hit => hit || caches.match(fallback));
  try {
    const res = await Promise.race([fetch(req), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000))]);
    if (res && res.ok) { put(req, res.clone()); put(fallback, res.clone()); return res; }
    return (await cached()) || res;
  } catch (err) {
    return (await cached()) || Response.error();
  }
}
function put(key, res) { if (res && res.ok) caches.open(CACHE).then(c => c.put(key, res)).catch(() => {}); }
