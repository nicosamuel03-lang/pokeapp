# Configuration du webhook Stripe

## 1. Enregistrer l’URL du webhook dans le Dashboard Stripe

1. Va sur [Stripe Dashboard](https://dashboard.stripe.com) → **Developers** → **Webhooks**.
2. Clique sur **Add endpoint**.
3. **Endpoint URL** : l’URL publique de ton serveur + `/webhook`  
   Exemple : `https://pokeapp-production-52e4.up.railway.app/webhook`
4. **Events to send** : choisis **Select events** puis coche au minimum :
   - `checkout.session.completed`
5. Clique sur **Add endpoint**.

## 2. Récupérer le signing secret (STRIPE_WEBHOOK_SECRET)

1. Sur la page de l’endpoint créé, ouvre la section **Signing secret**.
2. Clique sur **Reveal** à côté de **Signing secret**.
3. Copie la valeur (elle commence par `whsec_...`).
4. Dans **Railway** (ou ton hébergeur) :  
   Variables → ajoute **STRIPE_WEBHOOK_SECRET** = cette valeur.

## 3. Variables d’environnement à configurer (Railway)

- **STRIPE_WEBHOOK_SECRET** : signing secret du webhook (étape 2).
- **SUPABASE_SERVICE_KEY** : clé **service_role** (Settings → API dans le projet Supabase).  
  À ne pas confondre avec la clé `anon` / publique.

Après modification des variables, redéploie le serveur pour que les changements soient pris en compte.
