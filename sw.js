const CACHE_NAME = "kinmu-app-v5";

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json"
];


/* =========================================================
   インストール
========================================================= */

self.addEventListener(
  "install",
  event => {

    event.waitUntil(

      caches
        .open(CACHE_NAME)
        .then(
          cache => {

            return cache.addAll(
              FILES_TO_CACHE
            );

          }
        )

    );

    self.skipWaiting();

  }
);


/* =========================================================
   有効化
========================================================= */

self.addEventListener(
  "activate",
  event => {

    event.waitUntil(

      caches
        .keys()
        .then(
          keys => {

            return Promise.all(

              keys
                .filter(
                  key =>
                    key !== CACHE_NAME
                )
                .map(
                  key =>
                    caches.delete(key)
                )

            );

          }
        )

    );

    self.clients.claim();

  }
);


/* =========================================================
   ファイル取得
========================================================= */

self.addEventListener(
  "fetch",
  event => {

    event.respondWith(

      fetch(event.request)

        .then(
          response => {

            const responseClone =
              response.clone();

            caches
              .open(CACHE_NAME)
              .then(
                cache => {

                  cache.put(
                    event.request,
                    responseClone
                  );

                }
              );

            return response;

          }
        )

        .catch(
          () => {

            return caches.match(
              event.request
            );

          }
        )

    );

  }
);
