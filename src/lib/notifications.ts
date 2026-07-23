export function browserNotificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function currentPermission(): NotificationPermission | "unsupported" {
  if (!browserNotificationsSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestBrowserNotifications(): Promise<NotificationPermission | "unsupported"> {
  if (!browserNotificationsSupported()) return "unsupported";
  if (Notification.permission === "granted" || Notification.permission === "denied") return Notification.permission;
  return await Notification.requestPermission();
}

export function notify(title: string, body?: string) {
  if (!browserNotificationsSupported() || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body });
  } catch {
    /* noop */
  }
}