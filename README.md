# YachtFlow API

Backend API για κρεοπωλείο + yacht order operations.

## Railway settings

Variables:
```env
DATABASE_URL=your_railway_postgres_url
```

Build Command:
```bash
npm install
```

Pre-Deploy Command:
```bash
npx prisma db push
```

Start Command:
```bash
npm start
```

Public Networking Port:
```txt
8080
```

## Test URLs

```txt
/
 /health
 /yachts
 /products
 /orders
```

## Seed data

Run locally or from Railway shell:

```bash
npm run db:seed
```
