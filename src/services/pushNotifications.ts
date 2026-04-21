import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";

export async function registerPushNotifications() {
  console.log("registerPushNotifications CALLED");
  if (!Capacitor.isNativePlatform()) return;
  console.log("Is native platform:", Capacitor.isNativePlatform());

  const permissionResult = await PushNotifications.requestPermissions();
  console.log("Permission result:", permissionResult);
  if (permissionResult.receive !== "granted") return;

  await PushNotifications.register();

  PushNotifications.addListener("registration", (token) => {
    console.log("Push token:", token.value);
  });

  PushNotifications.addListener("pushNotificationReceived", (notification) => {
    console.log("Push notification received:", notification);
  });

  PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    console.log("Push notification action performed:", action);
  });
}

export async function unregisterPushNotifications() {
  if (!Capacitor.isNativePlatform()) return;
  await PushNotifications.removeAllListeners();
}
