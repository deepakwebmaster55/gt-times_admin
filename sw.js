self.addEventListener("push", (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (error) {
      const text = event.data.text();
      data = { body: text };
    }
  }
  const title = data.title || "New booking";
  const options = {
    body: data.body || "Tap to open admin bookings.",
    icon: data.icon || "../assets/images/logo.svg",
    data: { url: data.url || "./orders.html" }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification?.data?.url || "./orders.html";
  event.waitUntil(clients.openWindow(target));
});
