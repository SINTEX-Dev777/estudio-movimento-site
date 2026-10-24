/* Service worker: deixa o site instalável e abrindo mesmo sem internet.
   Ao mudar arquivos do site NÃO precisa mexer aqui: ele sempre busca a versão
   nova quando há internet. Só troque a VERSAO se quiser apagar o cache antigo. */
const VERSAO = 'site-v2';
const BASE = [
  '/', '/index.html', '/css/estilo.css', '/js/app.js', '/dados/catalogo.json',
  '/manifest.webmanifest', '/icones/favicon.svg', '/icones/icone-192.png', '/imagens/video-capa.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Páginas, estilos, scripts e dados: internet primeiro (sempre atualizado), cache se estiver offline.
async function redePrimeiro(req) {
  const cache = await caches.open(VERSAO);
  try {
    const resp = await fetch(req, { cache: 'no-cache' });
    if (resp.ok) cache.put(req, resp.clone());
    return resp;
  } catch {
    return (await cache.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? cache.match('/') : Response.error());
  }
}

// Imagens e ícones: mostra do cache na hora e atualiza em segundo plano.
async function cacheComAtualizacao(req) {
  const cache = await caches.open(VERSAO);
  const salvo = await cache.match(req);
  const rede = fetch(req).then((resp) => { if (resp.ok) cache.put(req, resp.clone()); return resp; }).catch(() => null);
  return salvo || (await rede) || Response.error();
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // YouTube, fontes etc.: o navegador cuida
  if (url.pathname.startsWith('/videos/')) return; // vídeos grandes: direto da internet
  if (url.pathname.startsWith('/imagens/') || url.pathname.startsWith('/icones/')) {
    e.respondWith(cacheComAtualizacao(req));
  } else {
    e.respondWith(redePrimeiro(req));
  }
});
