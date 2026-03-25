# Images et bande passante (Vercel)

## Ce n’est pas Next.js

Ce projet utilise **Vite + React**. Le composant **`next/image`** n’existe pas ici. Les équivalents utiles sont :

- attributs HTML **`loading="lazy"`** / **`decoding="async"`** ;
- composant **`RasterImage`** (`src/components/RasterImage.tsx`) : WebP local + repli PNG ;
- **fichiers plus légers** (WebP) : c’est ce qui impacte le plus la facture.

## Pourquoi la bande passante explose

Sur Vercel, **chaque octet servi** depuis ton déploiement (fichiers dans `public/`, HTML, JS, CSS) compte. Le lazy-loading **ne divise pas** le total si les utilisateurs finissent par faire défiler toute la liste : ça évite surtout de **télécharger tout en même temps au premier écran**. La vraie réduction vient du **poids de chaque image** (WebP, dimensions raisonnables).

## Ce qui a été mis en place dans le code

- **`RasterImage`** : pour les URLs sous `/images/…`, charge d’abord le `.webp` s’il existe, sinon le PNG/JPEG d’origine.
- **`ItemIcon`** et plusieurs grilles : **`loading="lazy"`** par défaut (au lieu de `eager` partout).
- Page détail produit : **`loading="eager"`** + **`fetchPriority="high"`** sur l’image héro (LCP).

## Générer les WebP (recommandé)

```bash
npm install
npm run optimize:images
```

Cela parcourt `public/`, crée un fichier `.webp` à côté de chaque PNG/JPEG, et affiche le gain de taille. Commit les `.webp` dans le dépôt pour que Vercel les serve.

## Autres pistes si ça reste trop cher

- **Héberger les médias ailleurs** (S3 + CloudFront, Cloudflare R2, etc.) pour sortir le gros du trafic de Vercel.
- **Ne pas commiter** des centaines de grosses images dans `public/` si elles changent souvent ; utiliser un stockage objet + URLs stables.
- **CDN / cache** : les assets statiques sont en général bien mis en cache par le navigateur ; le coût vient surtout du **nombre de visites × taille des fichiers**.

## CSS

Le CSS **ne compresse pas** les PNG. Au mieux, `background-size` / `object-fit` changent l’**affichage**, pas les octets téléchargés. Pour alléger : **WebP/AVIF** ou images redimensionnées aux tailles d’affichage réelles.
