const CACHE = "ieee-attendance-v1";
const SHELL_URLS = ["/", "/dashboard", "/admin", "/manifest.json"];
const QUEUE_NAME = "api-outbox";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL_URLS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
});

function isSameOrigin(urlStr) {
  try {
    return new URL(urlStr).origin === self.origin;
  } catch {
    return false;
  }
}

function isApiRequest(urlStr) {
  if (!isSameOrigin(urlStr)) return false;
  try {
    return new URL(urlStr).pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

async function openQueue() {
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open(QUEUE_NAME, 1);
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore("requests", { keyPath: "id", autoIncrement: true });
      store.createIndex("retryAt", "retryAt", { unique: false });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return db;
}

async function enqueueFailed(request) {
  const clone = request.clone();
  const body = await clone.text();
  const db = await openQueue();
  const tx = db.transaction("requests", "readwrite");
  const store = tx.objectStore("requests");
  
  await new Promise((resolve, reject) => {
    const addReq = store.add({
      url: request.url,
      method: request.method,
      headers: [...clone.headers.entries()],
      body: body || undefined,
      retryAt: Date.now() + 30_000,
      createdAt: Date.now(),
    });
    
    addReq.onsuccess = () => resolve();
    addReq.onerror = () => reject(addReq.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method === "GET") {
    if (isApiRequest(request.url)) {
      event.respondWith(networkFirst(request));
    } else if (isSameOrigin(request.url)) {
      event.respondWith(cacheFirst(request));
    }
    return;
  }
  if (isApiRequest(request.url)) {
    event.respondWith(
      fetch(request).catch(async () => {
        try {
          await enqueueFailed(request);
        } catch (err) {
          console.error("[sw] Failed to enqueue request:", err);
        }
        return new Response(JSON.stringify({ error: "Queued for retry" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      })
    );
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  return cached || fetchAndCache(request);
}

async function networkFirst(request) {
  try {
    return await fetchAndCache(request);
  } catch {
    const cached = await caches.match(request);
    return cached || new Response("Offline", { status: 503 });
  }
}

async function fetchAndCache(request) {
  const response = await fetch(request);
  if (response.ok) {
    const clone = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, clone));
  }
  return response;
}
