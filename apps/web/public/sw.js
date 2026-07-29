/*
 * Stoliq guest web-push service worker (docs/specs/push-notifications.md, Phase A).
 *
 * The free lock-screen "STOLIK GOTOWY" ping for Android/desktop browsers. The
 * notifier (services/notifier/functions/_shared/webpush.ts) sends a JSON payload
 * { title, body, url }; we surface it as a notification and, on tap, focus an
 * existing ticket tab or open one.
 */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_err) {
    data = {};
  }
  const title = data.title || 'Stoliq';
  const body = data.body || '';
  const url = data.url || '/';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: url,
      renotify: true,
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const target = new URL(url, self.location.origin);
      for (const client of clientList) {
        if (new URL(client.url).pathname === target.pathname && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
