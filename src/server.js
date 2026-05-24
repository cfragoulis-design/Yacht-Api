import express from "express";
import { PrismaClient } from "@prisma/client";
import cors from "cors";

const prisma = new PrismaClient();
const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

const PORT = process.env.PORT || 8080;

function sendError(res, error) {
  console.error(error);
  res.status(500).json({
    ok: false,
    error: error.message || "Internal Server Error"
  });
}

app.get("/", (req, res) => {
  res.json({ ok: true, app: "YachtFlow API" });
});

app.get("/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, database: "connected" });
  } catch (error) {
    sendError(res, error);
  }
});

app.get("/yachts", async (req, res) => {
  try {
    const yachts = await prisma.yacht.findMany({
      orderBy: { createdAt: "desc" }
    });
    res.json(yachts);
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/yachts", async (req, res) => {
  try {
    const yacht = await prisma.yacht.create({
      data: {
        name: req.body.name,
        marina: req.body.marina || null,
        berth: req.body.berth || null,
        chefName: req.body.chefName || null,
        phone: req.body.phone || null,
        notes: req.body.notes || null
      }
    });
    res.status(201).json(yacht);
  } catch (error) {
    sendError(res, error);
  }
});

app.get("/products", async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }]
    });
    res.json(products);
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/products", async (req, res) => {
  try {
    const product = await prisma.product.create({
      data: {
        name: req.body.name,
        category: req.body.category || null,
        unit: req.body.unit || null,
        price: null,
        notes: req.body.notes || null
      }
    });
    res.status(201).json(product);
  } catch (error) {
    sendError(res, error);
  }
});

app.get("/orders", async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        yacht: true,
        items: { include: { product: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    res.json(orders);
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/orders", async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];

    if (!req.body.yachtId) {
      return res.status(400).json({ ok: false, error: "yachtId is required" });
    }

    if (items.length === 0) {
      return res.status(400).json({ ok: false, error: "At least one order item is required" });
    }

    const order = await prisma.order.create({
      data: {
        yachtId: Number(req.body.yachtId),
        status: req.body.status || "confirmed",
        deliveryAt: req.body.deliveryAt ? new Date(req.body.deliveryAt) : null,
        notes: req.body.notes || null,
        total: null,
        items: {
          create: items.map((item) => ({
            productId: Number(item.productId),
            quantity: Number(item.quantity),
            notes: item.notes || null
          }))
        }
      },
      include: {
        yacht: true,
        items: { include: { product: true } }
      }
    });

    res.status(201).json(order);
  } catch (error) {
    sendError(res, error);
  }
});

app.patch("/orders/:id/status", async (req, res) => {
  try {
    const order = await prisma.order.update({
      where: { id: Number(req.params.id) },
      data: { status: req.body.status },
      include: {
        yacht: true,
        items: { include: { product: true } }
      }
    });
    res.json(order);
  } catch (error) {
    sendError(res, error);
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API running on port ${PORT}`);
});
