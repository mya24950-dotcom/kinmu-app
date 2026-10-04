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
        "Pushデータ解析エラー",
        error
      );

    }


    const title =
      data.title ||
      "Shift+";


    const body =
      data.body ||
      "プッシュ通知のテストです。";


    event.waitUntil(

      self.registration.showNotification(
        title,
        {
          body: body
        }
      )

    );

  }
);


self.addEventListener(
  "notificationclick",
  function (event) {

    event.notification.close();

    event.waitUntil(

      clients.matchAll({
        type: "window",
        includeUncontrolled: true
      }).then(
        function (clientList) {

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


          if (
            clients.openWindow
          ) {

            return clients.openWindow(
              "./"
            );

          }

        }
      )

    );

  }
);
