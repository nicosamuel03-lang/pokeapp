import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";

export async function registerPushNotifications() {
  if (!Capacitor.isNativePlatform()) return;

  const permissionResult = await PushNotifications.requestPermissions();
  console.log("Permission result:", JSON.stringify(permissionResult));
  if (permissionResult.receive !== "granted") return;

  // Add listeners BEFORE registering so we catch the token
  await PushNotifications.addListener("registration", (token) => {
    console.log("Push token:", token.value);
  });

  await PushNotifications.addListener("registrationError", (error) => {
    console.error("Push registration error:", JSON.stringify(error));
  });

  await PushNotifications.addListener("pushNotificationReceived", (notification) => {
    console.log("Push notification received:", JSON.stringify(notification));
  });

  await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    console.log("Push notification action performed:", JSON.stringify(action));
  });

  // Now register
  await PushNotifications.register();
  console.log("PushNotifications.register() called");
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
