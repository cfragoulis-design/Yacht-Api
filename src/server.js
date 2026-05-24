import express from "express";
import { PrismaClient } from "@prisma/client";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

dotenv.config();

const prisma = new PrismaClient();
const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || "CHANGE_ME_IN_RAILWAY";
const SETUP_SECRET = process.env.SETUP_SECRET || "";
const VAT_RATE = Number(process.env.VAT_RATE || 0.13);

function sendError(res, error, status = 500) {
  console.error(error);
  res.status(status).json({
    ok: false,
    error: error.message || "Internal Server Error"
  });
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active
  };
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";

    if (!token) return res.status(401).json({ ok: false, error: "Missing auth token" });

    const payload = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: Number(payload.id) } });

    if (!user || !user.active) return res.status(401).json({ ok: false, error: "Invalid or inactive user" });

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ ok: false, error: "Invalid auth token" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ ok: false, error: "Insufficient permissions" });
    next();
  };
}

async function audit(req, action, entity, entityId, metadata = {}) {
  try {
    await prisma.auditEvent.create({
      data: {
        userId: req.user?.id || null,
        action,
        entity,
        entityId: entityId ? String(entityId) : null,
        metadata: JSON.stringify(metadata)
      }
    });
  } catch (error) {
    console.error("Audit failed:", error);
  }
}

async function orderEvent(orderId, status, message, createdBy) {
  try {
    await prisma.orderEvent.create({
      data: {
        orderId: Number(orderId),
        status,
        message: message || null,
        createdBy: createdBy || null
      }
    });
  } catch (error) {
    console.error("Order event failed:", error);
  }
}

function orderInclude() {
  return {
    yacht: true,
    items: { include: { product: true } },
    events: { orderBy: { createdAt: "asc" } }
  };
}

function calculateTotals(items) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
  const vat = Number((subtotal * VAT_RATE).toFixed(2));
  const total = Number((subtotal + vat).toFixed(2));
  return { subtotal: Number(subtotal.toFixed(2)), vat, total };
}

function orderDeliveryData(body, yacht) {
  return {
    contactName: body.contactName || yacht?.chefName || null,
    contactPhone: body.contactPhone || yacht?.phone || null,
    deliveryLocation: body.deliveryLocation || yacht?.marina || null,
    deliveryBerth: body.deliveryBerth || yacht?.berth || null,
    deliveryMapUrl: body.deliveryMapUrl || null,
    deliveryNotes: body.deliveryNotes || null
  };
}

async function getFullOrder(id) {
  return prisma.order.findUnique({
    where: { id: Number(id) },
    include: orderInclude()
  });
}

app.get("/", (req, res) => {
  res.json({ ok: true, app: "YachtFlow API", version: "2.2.0" });
});

app.get("/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, database: "connected" });
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/auth/setup-admin", async (req, res) => {
  try {
    const existingUsers = await prisma.user.count();
    if (existingUsers > 0) return res.status(409).json({ ok: false, error: "Admin already exists" });

    if (!SETUP_SECRET) return res.status(500).json({ ok: false, error: "SETUP_SECRET is missing in Railway variables" });
    if (req.body.setupSecret !== SETUP_SECRET) return res.status(401).json({ ok: false, error: "Invalid setup secret" });
    if (!req.body.email || !req.body.password || !req.body.name) {
      return res.status(400).json({ ok: false, error: "name, email and password are required" });
    }

    const passwordHash = await bcrypt.hash(req.body.password, 10);
    const user = await prisma.user.create({
      data: {
        name: req.body.name,
        email: req.body.email.toLowerCase().trim(),
        passwordHash,
        role: "admin",
        active: true
      }
    });

    res.status(201).json({ ok: true, user: publicUser(user), token: signToken(user) });
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").toLowerCase().trim();
    const password = String(req.body.password || "");
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.active) return res.status(401).json({ ok: false, error: "Invalid login" });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ ok: false, error: "Invalid login" });

    await audit({ user }, "login", "User", user.id);
    res.json({ ok: true, user: publicUser(user), token: signToken(user) });
  } catch (error) {
    sendError(res, error);
  }
});

app.get("/auth/me", auth, async (req, res) => {
  res.json({ ok: true, user: publicUser(req.user) });
});

app.get("/users", auth, requireRole("admin"), async (req, res) => {
  try {
    const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
    res.json(users.map(publicUser));
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/users", auth, requireRole("admin"), async (req, res) => {
  try {
    if (!req.body.email || !req.body.password || !req.body.name) {
      return res.status(400).json({ ok: false, error: "name, email and password are required" });
    }

    const passwordHash = await bcrypt.hash(req.body.password, 10);
    const user = await prisma.user.create({
      data: {
        name: req.body.name,
        email: req.body.email.toLowerCase().trim(),
        passwordHash,
        role: req.body.role || "ops",
        active: true
      }
    });

    await audit(req, "create_user", "User", user.id, { role: user.role });
    res.status(201).json(publicUser(user));
  } catch (error) {
    sendError(res, error);
  }
});

app.get("/yachts", auth, async (req, res) => {
  try {
    const yachts = await prisma.yacht.findMany({ orderBy: { createdAt: "desc" } });
    res.json(yachts);
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/yachts", auth, requireRole("admin", "ops"), async (req, res) => {
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

    await audit(req, "create_yacht", "Yacht", yacht.id, { name: yacht.name });
    res.status(201).json(yacht);
  } catch (error) {
    sendError(res, error);
  }
});

app.patch("/yachts/:id", auth, requireRole("admin", "ops"), async (req, res) => {
  try {
    const yacht = await prisma.yacht.update({
      where: { id: Number(req.params.id) },
      data: {
        name: req.body.name,
        marina: req.body.marina || null,
        berth: req.body.berth || null,
        chefName: req.body.chefName || null,
        phone: req.body.phone || null,
        notes: req.body.notes || null
      }
    });

    await audit(req, "update_yacht", "Yacht", yacht.id, { name: yacht.name });
    res.json(yacht);
  } catch (error) {
    sendError(res, error);
  }
});

app.get("/products", auth, async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { active: true },
      orderBy: [{ category: "asc" }, { name: "asc" }]
    });
    res.json(products);
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/products", auth, requireRole("admin", "ops"), async (req, res) => {
  try {
    const product = await prisma.product.create({
      data: {
        name: req.body.name,
        category: req.body.category || null,
        unit: req.body.unit || null,
        price: null,
        notes: req.body.notes || null,
        active: true
      }
    });

    await audit(req, "create_product", "Product", product.id, { name: product.name });
    res.status(201).json(product);
  } catch (error) {
    sendError(res, error);
  }
});

app.get("/orders", auth, async (req, res) => {
  try {
    const where = {};
    if (req.query.status) where.status = String(req.query.status);
    if (req.query.paymentStatus) where.paymentStatus = String(req.query.paymentStatus);

    const orders = await prisma.order.findMany({
      where,
      include: orderInclude(),
      orderBy: { createdAt: "desc" }
    });
    res.json(orders);
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/orders", auth, requireRole("admin", "ops"), async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!req.body.yachtId) return res.status(400).json({ ok: false, error: "yachtId is required" });
    if (items.length === 0) return res.status(400).json({ ok: false, error: "At least one order item is required" });

    const yacht = await prisma.yacht.findUnique({ where: { id: Number(req.body.yachtId) } });
    if (!yacht) return res.status(404).json({ ok: false, error: "Yacht not found" });

    const order = await prisma.order.create({
      data: {
        yachtId: Number(req.body.yachtId),
        status: req.body.status || "confirmed",
        deliveryAt: req.body.deliveryAt ? new Date(req.body.deliveryAt) : null,
        notes: req.body.notes || null,
        ...orderDeliveryData(req.body, yacht),
        paymentStatus: "pending",
        ticketSent: false,
        items: {
          create: items.map((item) => ({
            productId: Number(item.productId),
            quantity: Number(item.quantity),
            notes: item.notes || null
          }))
        },
        events: {
          create: {
            status: req.body.status || "confirmed",
            message: "Order created",
            createdBy: req.user.name
          }
        }
      },
      include: orderInclude()
    });

    await audit(req, "create_order", "Order", order.id, { yachtId: order.yachtId });
    res.status(201).json(order);
  } catch (error) {
    sendError(res, error);
  }
});

app.patch("/orders/:id", auth, requireRole("admin", "ops"), async (req, res) => {
  try {
    const current = await prisma.order.findUnique({
      where: { id: Number(req.params.id) },
      include: { items: true, yacht: true }
    });

    if (!current) return res.status(404).json({ ok: false, error: "Order not found" });

    const updateData = {
      status: req.body.status || current.status,
      deliveryAt: req.body.deliveryAt ? new Date(req.body.deliveryAt) : current.deliveryAt,
      notes: req.body.notes ?? current.notes,
      contactName: req.body.contactName ?? current.contactName,
      contactPhone: req.body.contactPhone ?? current.contactPhone,
      deliveryLocation: req.body.deliveryLocation ?? current.deliveryLocation,
      deliveryBerth: req.body.deliveryBerth ?? current.deliveryBerth,
      deliveryMapUrl: req.body.deliveryMapUrl ?? current.deliveryMapUrl,
      deliveryNotes: req.body.deliveryNotes ?? current.deliveryNotes
    };

    const items = Array.isArray(req.body.items) ? req.body.items : null;

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: Number(req.params.id) },
        data: updateData
      });

      if (items) {
        await tx.orderItem.deleteMany({ where: { orderId: Number(req.params.id) } });
        await tx.orderItem.createMany({
          data: items.map((item) => ({
            orderId: Number(req.params.id),
            productId: Number(item.productId),
            quantity: Number(item.quantity),
            notes: item.notes || null
          }))
        });

        await tx.order.update({
          where: { id: Number(req.params.id) },
          data: {
            subtotal: null,
            vat: null,
            total: null,
            paymentStatus: "pending",
            ticketSent: false
          }
        });
      }
    });

    await orderEvent(req.params.id, "edited", "Order edited", req.user.name);
    await audit(req, "edit_order", "Order", req.params.id, { itemsChanged: Boolean(items) });

    res.json(await getFullOrder(req.params.id));
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/orders/:id/repeat", auth, requireRole("admin", "ops"), async (req, res) => {
  try {
    const original = await getFullOrder(req.params.id);
    if (!original) return res.status(404).json({ ok: false, error: "Order not found" });

    const order = await prisma.order.create({
      data: {
        yachtId: original.yachtId,
        status: "confirmed",
        deliveryAt: req.body.deliveryAt ? new Date(req.body.deliveryAt) : null,
        notes: req.body.notes || `Repeat of order #${original.id}`,
        contactName: original.contactName,
        contactPhone: original.contactPhone,
        deliveryLocation: original.deliveryLocation,
        deliveryBerth: original.deliveryBerth,
        deliveryMapUrl: original.deliveryMapUrl,
        deliveryNotes: original.deliveryNotes,
        paymentStatus: "pending",
        ticketSent: false,
        items: {
          create: original.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            notes: item.notes
          }))
        },
        events: {
          create: {
            status: "confirmed",
            message: `Repeated from order #${original.id}`,
            createdBy: req.user.name
          }
        }
      },
      include: orderInclude()
    });

    await audit(req, "repeat_order", "Order", order.id, { fromOrder: original.id });
    res.status(201).json(order);
  } catch (error) {
    sendError(res, error);
  }
});

app.patch("/orders/:id/cancel", auth, requireRole("admin", "ops"), async (req, res) => {
  try {
    await prisma.order.update({
      where: { id: Number(req.params.id) },
      data: {
        status: "cancelled",
        completedAt: new Date()
      }
    });

    await orderEvent(req.params.id, "cancelled", req.body.reason || "Order cancelled", req.user.name);
    await audit(req, "cancel_order", "Order", req.params.id, { reason: req.body.reason || null });

    res.json(await getFullOrder(req.params.id));
  } catch (error) {
    sendError(res, error);
  }
});

app.patch("/orders/:id/delivery", auth, requireRole("admin", "ops", "driver"), async (req, res) => {
  try {
    await prisma.order.update({
      where: { id: Number(req.params.id) },
      data: {
        contactName: req.body.contactName || null,
        contactPhone: req.body.contactPhone || null,
        deliveryLocation: req.body.deliveryLocation || null,
        deliveryBerth: req.body.deliveryBerth || null,
        deliveryMapUrl: req.body.deliveryMapUrl || null,
        deliveryNotes: req.body.deliveryNotes || null
      }
    });

    await orderEvent(req.params.id, "delivery_updated", "Delivery contact/location updated", req.user.name);
    await audit(req, "update_order_delivery", "Order", req.params.id);

    res.json(await getFullOrder(req.params.id));
  } catch (error) {
    sendError(res, error);
  }
});

app.patch("/orders/:id/status", auth, requireRole("admin", "ops", "driver"), async (req, res) => {
  try {
    const status = req.body.status;

    if (req.user.role === "driver" && !["out_for_delivery", "delivered"].includes(status)) {
      return res.status(403).json({ ok: false, error: "Driver can only set out_for_delivery or delivered" });
    }

    await prisma.order.update({
      where: { id: Number(req.params.id) },
      data: {
        status,
        completedAt: status === "delivered" ? new Date() : undefined
      }
    });

    await orderEvent(req.params.id, status, `Status changed to ${status}`, req.user.name);
    await audit(req, "update_order_status", "Order", req.params.id, { status });

    res.json(await getFullOrder(req.params.id));
  } catch (error) {
    sendError(res, error);
  }
});

app.patch("/orders/:id/prepare", auth, requireRole("admin", "ops"), async (req, res) => {
  try {
    const inputItems = Array.isArray(req.body.items) ? req.body.items : [];
    const preparedItems = inputItems.map((item) => {
      const actualWeight = Number(item.actualWeight || 0);
      const customPrice = Number(item.customPrice || 0);
      const lineTotal = Number((actualWeight * customPrice).toFixed(2));
      return { id: Number(item.id), actualWeight, customPrice, lineTotal };
    });

    if (preparedItems.some((item) => !item.id || !item.actualWeight || !item.customPrice)) {
      return res.status(400).json({ ok: false, error: "Every item needs id, actualWeight and customPrice" });
    }

    const totals = calculateTotals(preparedItems);

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

    await prisma.order.update({
      where: { id: Number(req.params.id) },
      data: {
        subtotal: totals.subtotal,
        vat: totals.vat,
        total: totals.total,
        status: "ready"
      }
    });

    await orderEvent(req.params.id, "ready", `Order prepared. Total €${totals.total}`, req.user.name);
    await audit(req, "prepare_order", "Order", req.params.id, totals);

    res.json(await getFullOrder(req.params.id));
  } catch (error) {
    sendError(res, error);
  }
});

app.patch("/orders/:id/payment", auth, requireRole("admin", "ops"), async (req, res) => {
  try {
    const paymentStatus = req.body.paymentStatus || "paid";
    await prisma.order.update({
      where: { id: Number(req.params.id) },
      data: { paymentStatus }
    });

    await orderEvent(req.params.id, paymentStatus, `Payment status: ${paymentStatus}`, req.user.name);
    await audit(req, "update_payment", "Order", req.params.id, { paymentStatus });

    res.json(await getFullOrder(req.params.id));
  } catch (error) {
    sendError(res, error);
  }
});

app.patch("/orders/:id/ticket-sent", auth, requireRole("admin", "ops"), async (req, res) => {
  try {
    await prisma.order.update({
      where: { id: Number(req.params.id) },
      data: { ticketSent: true }
    });

    await orderEvent(req.params.id, "ticket_sent", "WhatsApp payment ticket sent", req.user.name);
    await audit(req, "ticket_sent", "Order", req.params.id);

    res.json(await getFullOrder(req.params.id));
  } catch (error) {
    sendError(res, error);
  }
});

app.get("/analytics/revenue", auth, requireRole("admin", "ops"), async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: {
        total: { not: null },
        status: { not: "cancelled" }
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

    const yachtRevenue = {};
    const productRevenue = {};
    for (const order of orders) {
      const yachtName = order.yacht?.name || "Unknown";
      yachtRevenue[yachtName] = (yachtRevenue[yachtName] || 0) + Number(order.total || 0);
      for (const item of order.items || []) {
        const productName = item.product?.name || "Unknown";
        productRevenue[productName] = (productRevenue[productName] || 0) + Number(item.lineTotal || 0);
      }
    }

    const topYachts = Object.entries(yachtRevenue)
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const topProducts = Object.entries(productRevenue)
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    res.json({
      totalRevenue: Number(totalRevenue.toFixed(2)),
      todayRevenue: Number(todayRevenue.toFixed(2)),
      weekRevenue: Number(weekRevenue.toFixed(2)),
      outstanding: Number(outstanding.toFixed(2)),
      pricedOrders: orders.length,
      topYachts,
      topProducts
    });
  } catch (error) {
    sendError(res, error);
  }
});

app.get("/audit", auth, requireRole("admin"), async (req, res) => {
  try {
    const events = await prisma.auditEvent.findMany({
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 100
    });

    res.json(events.map((event) => ({ ...event, user: publicUser(event.user) })));
  } catch (error) {
    sendError(res, error);
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API running on port ${PORT}`);
});
