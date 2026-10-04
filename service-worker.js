/* ==================================================
   Shift+ Service Worker
================================================== */


/* ==================================================
   プッシュ通知受信
================================================== */

self.addEventListener(
  "push",
  function (event) {

    console.log(
      "★ PUSH受信"
    );


    let data = {};


    try {

      if (event.data) {

        data =
          event.data.json();

      }

    } catch (error) {

      console.error(
        "★ Pushデータ解析エラー",
        error
      );

    }


    const title =
      data.title ||
      "Shift+";


    const body =
      data.body ||
      "プッシュ通知のテストです。";


    const url =
      data.url ||
      "./";


    console.log(
      "★ 通知タイトル:",
      title
    );

    console.log(
      "★ 通知本文:",
      body
    );


    event.waitUntil(

      self.registration.showNotification(
        title,
        {

          body:
            body,

          tag:
            "shift-notification",

          renotify:
            true,

          data:
            {
              url:
                url
            }

        }
      )

    );

  }
);


/* ==================================================
   通知クリック
================================================== */

self.addEventListener(
  "notificationclick",
  function (event) {

    console.log(
      "★ 通知クリック"
    );


    event.notification.close();


    const notificationData =
      event.notification.data || {};


    const targetUrl =
      notificationData.url ||
      "./";


    event.waitUntil(

      clients.matchAll(
        {
          type:
            "window",

          includeUncontrolled:
            true
        }
      )

      .then(
        function (clientList) {


          /*
           * すでにShift+が開いている場合
           */

          for (
            const client
            of clientList
          ) {

            if (
              "focus" in client
            ) {

              return client.focus();

            }

          }


          /*
           * 開いていない場合
           */

          if (
            clients.openWindow
          ) {

            return clients.openWindow(
              targetUrl
            );

          }

        }
      )

    );

  }
);


/* ==================================================
   Service Workerインストール
================================================== */

self.addEventListener(
  "install",
  function (event) {

    console.log(
      "★ Shift+ Service Worker install"
    );

    self.skipWaiting();

  }
);


/* ==================================================
   Service Worker有効化
================================================== */

self.addEventListener(
  "activate",
  function (event) {

    console.log(
      "★ Shift+ Service Worker activate"
    );

    event.waitUntil(
      self.clients.claim()
    );

  }
);
