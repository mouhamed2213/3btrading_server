# 3B Trading — API serveur

Node 22 · Express 5 · TypeScript · Prisma 7 (adapter `pg`) · PostgreSQL · Supabase Storage (photos) · Zod · JWT.

## Démarrage

```bash
npm install
cp .env.example .env            # renseigner DATABASE_URL, JWT_SECRET (32+ car.), Supabase
npm run db:generate             # génère le client Prisma dans src/generated
npm run db:migrate -- --name init   # crée la migration initiale + les tables
SEED_DEMO=true npm run db:seed  # admin + données de démo (SEED_DEMO omis = admin seul)
npm run dev                     # http://localhost:4000/api
npm test                        # tests des règles de prix / facturation
```

**Supabase Storage** : créer un bucket **public** (nom = `SUPABASE_BUCKET`), puis renseigner `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` (clé à garder côté serveur uniquement). Sans ces variables, tout fonctionne sauf l'envoi de photos (réponse 503 explicite).

Production : `npm run build && npm run db:deploy && npm start`.

## Structure

```
prisma/            schema.prisma, seed.ts      (config : prisma.config.ts)
src/
  app.ts server.ts routes.ts
  config/env.ts                 variables d'environnement validées
  lib/                          prisma, storage (Supabase), erreurs, références (RES-2026-001…), pagination
  middlewares/                  auth JWT + rôles, gestion d'erreurs, upload d'images
  modules/<domaine>/            *.routes.ts · *.schemas.ts (Zod) · *.service.ts (si logique métier)
    auth users customers equipment parts media reservations worksites
    invoices maintenance inquiries dashboard public
```

Un module = un domaine métier. On n'ajoute un `*.service.ts` que lorsqu'il y a de la vraie logique (prix, facturation, disponibilité) ; les CRUD simples restent dans les routes.

## Règles métier issues du questionnaire

| Sujet | Règle implémentée |
|---|---|
| Location | Clé en main (opérateur + carburant inclus), pas de livraison (le client vient chercher la machine) |
| Tarifs de location | Journalier, par rotation (camions-bennes), dégressif dès N jours (7 par défaut) sur toute la durée |
| Sortie de machine | `POST /reservations/:id/start` refusé tant que 100 % de la période (TTC) n'est pas encaissé, sauf client **PARTENAIRE à terme** (échéance fin de mois) |
| Disponibilité | Pas de chevauchement de dates sur un même engin (verrou PostgreSQL par engin) |
| Chantiers | Forfait, au m³, à l'heure ou à la journée ; suivi quotidien des quantités ; facturation de l'avancement réel |
| Pièces | Recherche par marque, famille, compatibilité (modèle) et référence OEM ; stock + seuil d'alerte par pièce |
| Paiements | Espèces, Wave, Orange Money (référence de transaction obligatoire en mobile) ; chaque paiement génère un reçu `REC-…` |
| Documents | Proforma → acompte → facture définitive ; les acomptes sont déduits automatiquement ; suivi des impayés + historique de relances |
| Vente | Une facture définitive avec une ligne pièce décompte le stock, avec une ligne engin passe l'engin en `VENDU` (annulation = retour arrière) |
| Maintenance | Entretien interne, réparation client externe, SAV ; démarrer une intervention immobilise l'engin |

## API (préfixe `/api`, JWT `Authorization: Bearer …` sauf `/auth` et `/public`)

- `POST /auth/login` · `GET /auth/me` · `POST /auth/change-password` · `/users` (admin)
- `GET /dashboard` — KPI, état de la flotte, CA sur 6 mois, dernières réservations, alertes
- `/reservations` (+ `/:id/confirm|start|complete|cancel`) · `/equipment` (+ `/:id/availability`, `/:id/images`) · `/parts` (+ `/:id/stock`, `/:id/images`) · `DELETE /images/:id`
- `/worksites` (+ `/:id/entries`) · `/customers` · `/maintenance` (+ `/:id/start|complete|cancel`) · `/inquiries`
- `/invoices` (+ `/summary`, `/from-reservation`, `/from-worksite`, `/:id/convert|cancel|payments|reminders`) · `/payments` (reçus)
- Public : `GET /public/equipment`, `/public/equipment/:id`, `/public/parts`, `/public/parts/:id`, `/public/brands`, `POST /public/inquiries`

Listes paginées : `?page=1&limit=20` → `{ data, meta }`. Erreurs : `{ error: { code, message, details? } }`.
Montants en FCFA (entiers). Prix de location et de chantier HT ; TVA (18 %, `TAX_RATE`) ajoutée à la facturation.

## Adaptations à prévoir côté frontend

- Le formulaire de réservation propose « Forfait global » : le questionnaire ne retient que journalier / rotation / dégressif pour la location (le forfait est réservé aux chantiers).
- Les reçus sont des **paiements** (`/payments/:id`), plus un type de facture « Reçu ».
- Le catalogue public s'appuie sur `/public/equipment` (vente) et `/public/parts`.
- « Minimum d'heures facturées » (Q4.1) et état de la machine départ/retour (Q3.A) n'ont pas été traités : sans objet en location clé en main avec facturation à la journée.

## Pistes d'amélioration (hors périmètre actuel)

Génération de PDF (factures, reçus) côté serveur · envoi automatique des relances (SMS/WhatsApp) · redimensionnement des photos avant envoi (sharp) · refresh tokens · journal d'audit · pièces consommées par une intervention de maintenance.
first init
