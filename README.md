# YachtFlow API

Backend API για το YachtFlow: κρεοπωλείο + yacht/chef παραγγελίες.

## Railway deploy

1. Δημιούργησε νέο GitHub repo: `yachtflow-api`
2. Ανέβασε όλα τα αρχεία αυτού του φακέλου.
3. Railway → New Service → Deploy from GitHub repo.
4. Στο API service → Variables βάλε:

```env
DATABASE_URL=το DATABASE_URL από το Railway Postgres
```

5. Settings → Deploy:

```bash
Build Command: npm install && npx prisma generate && npx prisma db push
Start Command: npm run start
```

6. Generate Domain.

## Local development

```bash
npm install
cp .env.example .env
npx prisma db push
npm run db:seed
npm run dev
```

## Endpoints

```txt
GET    /health
GET    /yachts
POST   /yachts
PUT    /yachts/:id
DELETE /yachts/:id

GET    /products
POST   /products
PUT    /products/:id

GET    /orders
GET    /orders/:id
POST   /orders
PUT    /orders/:id
PUT    /orders/:id/status
```

## Example create yacht

```json
{
  "name": "M/Y Serenity",
  "marina": "Gouvia Marina",
  "berth": "D-42",
  "chefName": "John Carter",
  "phone": "+30 694 000 1122",
  "vipLevel": "Platinum",
  "notes": "Premium meat client. Vacuum packed."
}
```

## Example create order

```json
{
  "yachtId": 1,
  "status": "pending",
  "priority": "urgent",
  "deliveryAt": "2026-05-25T18:00:00.000Z",
  "deliveryNote": "Deliver stern side",
  "notes": "Chef requested thick cuts",
  "items": [
    { "productId": 1, "quantity": 4, "unit": "pcs", "notes": "1.2kg each" },
    { "productId": 5, "quantity": 4, "unit": "kg" }
  ]
}
```
