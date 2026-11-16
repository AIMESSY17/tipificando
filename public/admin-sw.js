// Service worker del panel (solo /admin): lo hace instalable y muestra el panel aunque se corte internet un momento.
// Los datos SIEMPRE se piden en vivo; solo se guarda la "cáscara" de la página.
const CACHE = "tipificado-admin-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/admin"])).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET" || r.mode !== "navigate") return; // solo la página; nada de datos ni API
  e.respondWith(
    fetch(r)
      .then((res) => {
        const copia = res.clone();
        caches.open(CACHE).then((c) => c.put("/admin", copia)).catch(() => {});
        return res;
      })
      .catch(() => caches.match("/admin"))
  );
});
