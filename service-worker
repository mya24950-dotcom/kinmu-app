self.addEventListener("push", function (event) {

  if (!event.data) {
    return;
  }

  let data = {};

  try {
    data = event.data.json();
  } catch (error) {

    data = {
      title: "Shift+",
      body: event.data.text()
    };

  }

  const title =
    data.title ||
    "Shift+";

  const options = {

    body:
      data.body ||
      "勤務表が更新されました。",

    icon:
      "./icons/icon-192.png",

    badge:
      "./icons/icon-192.png",

    data: {

      url:
        data.url ||
        "./"

    }

  };

  event.waitUntil(

    self.registration.showNotification(
      title,
      options
    )

  );

});


self.addEventListener(
  "notificationclick",
  function (event) {

    event.notification.close();

    const url =
      event.notification.data &&
      event.notification.data.url
        ? event.notification.data.url
        : "./";

    event.waitUntil(

      clients.matchAll({
        type: "window",
        includeUncontrolled: true
      }).then(function (clientList) {

        for (
          const client of clientList
        ) {

          if (
            "focus" in client
          ) {

            client.focus();

            return client.navigate(
              url
            );

          }

        }

        if (
          clients.openWindow
        ) {

          return clients.openWindow(
            url
          );

        }

      })

    );

  }
);
