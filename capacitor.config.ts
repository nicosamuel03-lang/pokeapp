import type { CapacitorConfig } from '@capacitor/cli';

const APP_DARK_BG = '#111111';

const config: CapacitorConfig = {
  appId: 'com.giovanni.app',
  appName: 'Giovanni TCG',
  webDir: 'dist',
  server: {
    cleartext: true,
    allowNavigation: ['*'],
    iosScheme: 'https',
  },
  ios: {
    allowsInlineMediaPlayback: true,
    webContentsDebuggingEnabled: true,
    infoPlist: {
      NSCameraUsageDescription: 'Scanner de codes-barres pour vos produits Pokémon',
      NSPhotoLibraryAddUsageDescription: 'Sauvegarder les photos de vos produits Pokémon',
      NSPhotoLibraryUsageDescription: 'Accéder à vos photos pour scanner les codes-barres',
    },
  },
  plugins: {
    SplashScreen: {
      backgroundColor: APP_DARK_BG,
      showSpinner: false,
      launchAutoHide: true,
      launchFadeOutDuration: 0,
    },
  },
};

export default config;
