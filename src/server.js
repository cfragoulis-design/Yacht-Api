import express from "express";
import { PrismaClient } from "@prisma/client";
import cors from "cors";

const prisma = new PrismaClient();
const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

const PORT = process.env.PORT || 8080;

app.get("/", (req, res) => {
  res.json({ ok: true, app: "YachtFlow API" });
});

app.get("/health", async (req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ ok: true, database: "connected" });
});

app.get("/yachts", async (req, res) => {
  const yachts = await prisma.yacht.findMany();
  res.json(yachts);
});

app.get("/products", async (req, res) => {
  const products = await prisma.product.findMany();
  res.json(products);
});

app.get("/orders", async (req, res) => {
  const orders = await prisma.order.findMany({
    include: { yacht: true, items: { include: { product: true } } },
    orderBy: { createdAt: "desc" }
  });
  res.json(orders);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API running on port ${PORT}`);
});
