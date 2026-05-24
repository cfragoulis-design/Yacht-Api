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

function calculateOrderTotals(items) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
  const vat = Number((subtotal * 0.13).toFixed(2));
  const total = Number((subtotal + vat).toFixed(2));
  return { subtotal: Number(subtotal.toFixed(2)), vat, total };
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
        subtotal: null,
        vat: null,
        total: null,
        paymentStatus: "pending",
        ticketSent: false,
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
    const status = req.body.status;
    const order = await prisma.order.update({
      where: { id: Number(req.params.id) },
      data: {
        status,
        completedAt: status === "delivered" ? new Date() : undefined
      },
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

app.patch("/orders/:id/prepare", async (req, res) => {
  try {
    const inputItems = Array.isArray(req.body.items) ? req.body.items : [];

    const preparedItems = inputItems.map((item) => {
      const actualWeight = Number(item.actualWeight || 0);
      const customPrice = Number(item.customPrice || 0);
      const lineTotal = Number((actualWeight * customPrice).toFixed(2));

      return {
        id: Number(item.id),
        actualWeight,
        customPrice,
        lineTotal
      };
    });

    const totals = calculateOrderTotals(preparedItems);

    await Promise.all(
      preparedItems.map((item) =>
        prisma.orderItem.update({
          where: { id: item.id },
          data: {
            actualWeight: item.actualWeight,
            customPrice: item.customPrice,
            lineTotal: item.lineTotal
          }
        })
      )
    );

    const order = await prisma.order.update({
      where: { id: Number(req.params.id) },
      data: {
        subtotal: totals.subtotal,
        vat: totals.vat,
        total: totals.total,
        status: "ready"
      },
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

app.patch("/orders/:id/payment", async (req, res) => {
  try {
    const order = await prisma.order.update({
      where: { id: Number(req.params.id) },
      data: {
        paymentStatus: req.body.paymentStatus || "paid"
      },
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

app.patch("/orders/:id/ticket-sent", async (req, res) => {
  try {
    const order = await prisma.order.update({
      where: { id: Number(req.params.id) },
      data: { ticketSent: true },
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

app.get("/analytics/revenue", async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: {
        total: { not: null }
      },
      include: {
        yacht: true,
        items: { include: { product: true } }
      }
    });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - 7);

    const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const todayRevenue = orders
      .filter((order) => new Date(order.updatedAt) >= startOfToday)
      .reduce((sum, order) => sum + Number(order.total || 0), 0);
    const weekRevenue = orders
      .filter((order) => new Date(order.updatedAt) >= startOfWeek)
      .reduce((sum, order) => sum + Number(order.total || 0), 0);

    const outstanding = orders
      .filter((order) => order.paymentStatus !== "paid")
      .reduce((sum, order) => sum + Number(order.total || 0), 0);

    res.json({
      totalRevenue: Number(totalRevenue.toFixed(2)),
      todayRevenue: Number(todayRevenue.toFixed(2)),
      weekRevenue: Number(weekRevenue.toFixed(2)),
      outstanding: Number(outstanding.toFixed(2)),
      pricedOrders: orders.length
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API running on port ${PORT}`);
});
