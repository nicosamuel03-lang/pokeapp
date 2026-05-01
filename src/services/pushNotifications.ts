import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";
import { apiUrl } from "../config/apiUrl";

export async function registerPushNotifications() {
  if (!Capacitor.isNativePlatform()) return;

  const permissionResult = await PushNotifications.requestPermissions();
  console.log("Permission result:", JSON.stringify(permissionResult));
  if (permissionResult.receive !== "granted") return;

  // Add listeners BEFORE registering so we catch the token
  await PushNotifications.addListener("registration", async (token) => {
    console.log("Push token:", token.value);
    localStorage.setItem('pushDeviceToken', token.value);

    // Send token to backend
    try {
      const response = await fetch(apiUrl('/api/device-tokens'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: 'ios-device',
          token: token.value, 
          platform: 'ios' 
        })
      });
      console.log("Push token sent to backend:", response.ok);
    } catch (err) {
      console.error("Failed to send push token:", err);
    }
  });

  await PushNotifications.addListener("registrationError", (error) => {
    console.error("Push registration error:", JSON.stringify(error));
  });

  await PushNotifications.addListener("pushNotificationReceived", (notification) => {
    console.log("Push notification received:", JSON.stringify(notification));
  });

  await PushNotifications.addListener("pushNotificationActionPerformed", async (action) => {
    console.log("Push notification action performed:", JSON.stringify(action));
    const link = action.notification?.data?.link;
    if (link) {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url: link });
    }
  });

  // Now register
  await PushNotifications.register();
  console.log("PushNotifications.register() called");
}

export async function sendTokenToBackend(userId: string, clerkToken: string) {
  const token = localStorage.getItem('pushDeviceToken');
  if (!token) return;
  try {
    await fetch(apiUrl("/api/device-tokens"), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${clerkToken}` },
      body: JSON.stringify({ userId, token, platform: 'ios' })
    });
    console.log("Push token sent to backend");
  } catch (err) {
    console.error("Failed to send push token to backend:", err);
  }
}

export async function checkPushPermissionStatus(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  const status = await PushNotifications.checkPermissions();
  console.log("Push permission status:", JSON.stringify(status));
  return status.receive === "granted";
}

export async function unregisterPushNotifications() {
  if (!Capacitor.isNativePlatform()) return;
  await PushNotifications.removeAllListeners();
}
