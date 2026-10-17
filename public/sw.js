self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();

    // Determine language: Polish if starts with "pl", English as backup/fallback
    const userLang = (navigator.language || "").toLowerCase().startsWith("pl") ? "pl" : "en";

    const resolveText = (value, fallback) => {
      if (!value) return fallback;
      if (typeof value === "string") return value;
      return value[userLang] || value.en || value.pl || fallback;
    };

    const title = resolveText(data.title, "Predicto");
    const body = resolveText(
      data.body,
      userLang === "pl" ? "Masz nowe przypomnienie!" : "You have a new reminder!"
    );

    const options = {
      body,
      icon: data.icon || "/icon-192.png",
      badge: data.badge || "/badge-72.png",
      data: {
        url: data.url || "/dashboard",
      },
      vibrate: [100, 50, 100],
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error("Error displaying push notification:", err);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(targetUrl) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
