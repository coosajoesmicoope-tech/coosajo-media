self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open('mesa-tecnica-store').then((cache) => cache.addAll([
            './mesa_tecnica_master.html',
            './manifest.json',
            './LOGO COOSAJO SIN ESLOGAN.png'
        ]))
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => response || fetch(e.request))
    );
});
