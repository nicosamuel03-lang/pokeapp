import type { CapacitorConfig } from '@capacitor/cli';

const APP_DARK_BG = '#111111';

const config: CapacitorConfig = {
  appId: 'com.pokevault.app',
  appName: 'PokéVault',
  webDir: 'dist',
  server: {
    url: 'https://pokeapp-weld.vercel.app',
    cleartext: true,
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
