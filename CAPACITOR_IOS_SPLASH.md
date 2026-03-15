# Splash screen iOS (éviter le flash noir)

La couleur de fond du splash est définie dans `capacitor.config.ts` (`#111111`). Pour que le lancement natif iOS utilise la même couleur (pas de flash noir) :

## 1. Capacitor déjà configuré

- **capacitor.config.ts** : `plugins.SplashScreen.backgroundColor: '#111111'`, `launchFadeOutDuration: 0`, `showSpinner: false`, `launchAutoHide: true`.
- **App** : au montage, `SplashScreen.hide({ fadeOutDuration: 0 })` est appelé si on est sur une plateforme native (voir `App.tsx`).

## 2. Si le projet n’a pas encore iOS

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/splash-screen
npx cap add ios
```

Puis suivre les étapes 3 et 4.

## 3. Storyboard / écran de lancement

- Dans **ios/App/App/Info.plist** : vérifier `UILaunchStoryboardName` (souvent `LaunchScreen`). Le storyboard d’écran de lancement doit avoir le fond à **#111111**.
- Dans **ios/App/App/Base.lproj/LaunchScreen.storyboard** (ou équivalent) : définir la **Background Color** de la vue racine sur **#111111** (RGB 17, 17, 17).
- Si tu utilises **Assets** : dans **ios/App/App/Assets.xcassets/Splash.imageset** (ou l’asset de splash), s’assurer que l’arrière-plan / la couleur associée est **#111111**.

## 4. Sync et rebuild

Les changements de splash natif ne sont pas pris en compte au hot reload. Il faut :

```bash
npm run build
npx cap sync ios
```

Puis ouvrir le projet Xcode et faire un **rebuild complet** (Clean Build Folder puis Run), ou depuis la ligne de commande :

```bash
npx cap open ios
# Dans Xcode : Product → Clean Build Folder, puis Run
```

Après ça, le fond du lancement iOS doit rester **#111111** jusqu’à ce que React s’affiche, sans flash noir.
