self.addEventListener("push", (event) => {
  const data = event.data?.json?.() || {};
  const title = data.title || "New booking";
  const options = {
    body: data.body || "Tap to open admin bookings.",
    icon: data.icon || "/gt-times/assets/images/logo.svg",
    data: { url: data.url || "/gt-times/admin/orders.html" }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification?.data?.url || "/gt-times/admin/orders.html";
  event.waitUntil(clients.openWindow(target));
});
