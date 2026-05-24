import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

function handleError(res, error) {
  console.error(error);
  res.status(500).json({
    error: "Internal Server Error",
    message: error.message
  });
}

app.get("/", (req, res) => {
  res.send("YachtFlow API Running");
});

app.get("/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, database: "connected" });
  } catch (error) {
    handleError(res, error);
  }
});

app.get("/yachts", async (req, res) => {
  try {
    const yachts = await prisma.yacht.findMany({
      include: {
        orders: {
          orderBy: { createdAt: "desc" },
          take: 5
        }
      },
      orderBy: { createdAt: "desc" }
    });
    res.json(yachts);
  } catch (error) {
    handleError(res, error);
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
    handleError(res, error);
  }
});

app.get("/products", async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }]
    });
    res.json(products);
  } catch (error) {
    handleError(res, error);
  }
});

app.post("/products", async (req, res) => {
  try {
    const product = await prisma.product.create({
      data: {
        name: req.body.name,
        category: req.body.category || null,
        unit: req.body.unit || null,
        price: req.body.price ? Number(req.body.price) : null,
        notes: req.body.notes || null
      }
    });
    res.status(201).json(product);
  } catch (error) {
    handleError(res, error);
  }
});

app.get("/orders", async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        yacht: true,
        items: {
          include: { product: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    res.json(orders);
  } catch (error) {
    handleError(res, error);
  }
});

app.get("/orders/:id", async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        yacht: true,
        items: {
          include: { product: true }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json(order);
  } catch (error) {
    handleError(res, error);
  }
});

app.post("/orders", async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const order = await prisma.order.create({
      data: {
        yachtId: Number(req.body.yachtId),
        status: req.body.status || "pending",
        deliveryAt: req.body.deliveryAt ? new Date(req.body.deliveryAt) : null,
        notes: req.body.notes || null,
        total: req.body.total ? Number(req.body.total) : null,
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
        items: {
          include: { product: true }
        }
      }
    });

    res.status(201).json(order);
  } catch (error) {
    handleError(res, error);
  }
});

app.patch("/orders/:id/status", async (req, res) => {
  try {
    const order = await prisma.order.update({
      where: { id: Number(req.params.id) },
      data: { status: req.body.status },
      include: {
        yacht: true,
        items: {
          include: { product: true }
        }
      }
    });

    res.json(order);
  } catch (error) {
    handleError(res, error);
  }
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API running on port ${PORT}`);
});
