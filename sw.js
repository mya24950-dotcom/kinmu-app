const CACHE_NAME = "kinmu-app-v4";

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

    /*
      新しいService Workerを
      すぐ有効化
    */

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

    /*
      開いているページにも
      新しいService Workerを適用
    */

    self.clients.claim();

  }
);


/* =========================================================
   fetch
========================================================= */

self.addEventListener(
  "fetch",
  event => {

    const request =
      event.request;


    /*
      GET以外は何もしない
    */

    if (
      request.method !== "GET"
    ) {

      return;

    }


    /*
      HTML / CSS / JS は
      必ずネットを優先
    */

    const url =
      new URL(
        request.url
      );


    const isAppFile =
      url.pathname.endsWith(
        "/index.html"
      ) ||
      url.pathname.endsWith(
        "/style.css"
      ) ||
      url.pathname.endsWith(
        "/script.js"
      ) ||
      url.pathname.endsWith(
        "/manifest.json"
      );


    if (isAppFile) {

      event.respondWith(

        fetch(
          request,
          {
            cache: "no-store"
          }
        )
        .then(
          response => {

            /*
              最新ファイルを
              キャッシュにも保存
            */

            const responseClone =
              response.clone();


            caches
              .open(CACHE_NAME)
              .then(
                cache => {

                  cache.put(
                    request,
                    responseClone
                  );

                }
              );


            return response;

          }
        )
        .catch(
          () => {

            /*
              オフライン時だけ
              キャッシュを使用
            */

            return caches.match(
              request
            );

          }
        )

      );

      return;

    }


    /*
      その他のファイル
      → ネット優先
      → 失敗したらキャッシュ
    */

    event.respondWith(

      fetch(request)
        .then(
          response => {

            const responseClone =
              response.clone();


            caches
              .open(CACHE_NAME)
              .then(
                cache => {

                  cache.put(
                    request,
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
              request
            );

          }
        )

    );

  }
);
