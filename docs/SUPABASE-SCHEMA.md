# Schéma Supabase attendu par l’app

Vérifie dans ton **Dashboard Supabase** (Table Editor) que les noms de tables et de colonnes correspondent **exactement** à ce qui suit (sensible à la casse).

## Table `users`

| Colonne            | Type   | Description                    |
|--------------------|--------|--------------------------------|
| `id`               | text   | ID utilisateur (ex. Clerk)     |
| `is_premium`       | boolean| Statut premium                 |
| `total_sales_count`| integer| Optionnel / legacy ; la jauge free tier utilise **`sales_counter`** (voir ci-dessous). |

## Table `sales_counter`

| Colonne   | Type    | Description |
|-----------|---------|-------------|
| `user_id` | text PK | ID Clerk (même valeur que `sales.user_id`) |
| `count`   | integer | **+1** à chaque vente enregistrée ; **jamais** décrémenté quand une ligne est supprimée dans `sales`. La jauge « Ventes utilisées » et la limite à 10 s’appuient sur ce compteur. |

Appliquer la migration `supabase/migrations/20250228180000_sales_counter.sql` (RLS permissives par défaut, à resserrer en prod si besoin).

## Table `profiles` (optionnelle)

Utilisée sur la page succès pour une mise à jour immédiate après paiement. Si la table n’existe pas, l’erreur est loguée en `SUPABASE_ERROR:` dans la console (F12).

| Colonne      | Type    | Description     |
|-------------|---------|-----------------|
| `id`        | text    | ID utilisateur  |
| `is_premium`| boolean | Statut premium |

## Table `sales`

| Colonne       | Type   | Description        |
|---------------|--------|--------------------|
| `user_id`     | text   | ID utilisateur     |
| `product_id`  | text   | ID produit         |
| `product_name`| text   | Nom du produit     |
| `image`       | text   | URL image          |
| `buy_price`   | number | Prix d’achat       |
| `sale_price`  | number | Prix de vente      |
| `quantity`    | integer| Quantité vendue    |
| `sale_date`   | text   | Date de vente (ISO)|
| `profit`      | number | Profit (calculé)   |

**Note :** Si ton dashboard utilise `price_sold` au lieu de `sale_price`, renomme la colonne en base ou adapte le code dans `salesSupabase.ts` et `ProductDetailPage.tsx` (handleVendre).

## En cas d’erreur

Ouvre la **console navigateur (F12)** et cherche les messages `SUPABASE_ERROR:`. Le détail (colonne manquante, type incorrect, etc.) s’affiche là.
