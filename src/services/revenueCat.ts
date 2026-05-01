import { Capacitor } from '@capacitor/core';
import { Purchases } from '@revenuecat/purchases-capacitor';

const REVENUECAT_API_KEY = 'appl_JbsulqnNPXRLMbNDTvVQaCzZrBQ';

export async function initRevenueCat(userId?: string) {
  if (!Capacitor.isNativePlatform()) return;
  
  await Purchases.configure({
    apiKey: REVENUECAT_API_KEY,
    appUserID: userId || undefined,
  });
  console.log('RevenueCat configured');
}

export async function getOfferings() {
  try {
    const offerings = await Purchases.getOfferings();
    console.log('RevenueCat offerings:', JSON.stringify(offerings));
    return offerings;
  } catch (err) {
    console.error('Failed to get offerings:', err);
    return null;
  }
}

export async function purchasePackage(packageToPurchase: any) {
  try {
    const result = await Purchases.purchasePackage({ aPackage: packageToPurchase });
    console.log('Purchase result:', JSON.stringify(result));
    return result;
  } catch (err: any) {
    if (err.code === 1 || err.userCancelled) {
      console.log('User cancelled purchase');
      return null;
    }
    console.error('Purchase error:', err);
    throw err;
  }
}

export async function restorePurchases() {
  try {
    const result = await Purchases.restorePurchases();
    console.log('Restore result:', JSON.stringify(result));
    return result;
  } catch (err) {
    console.error('Restore error:', err);
    throw err;
  }
}

export async function checkSubscriptionStatus() {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const entitlements = customerInfo.customerInfo.entitlements.active;
    const isBossAccess = 'Boss Access' in entitlements;
    console.log('Boss Access active:', isBossAccess);
    return isBossAccess;
  } catch (err) {
    console.error('Check subscription error:', err);
    return false;
  }
}

export function isNativeIOS(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}

