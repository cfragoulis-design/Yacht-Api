import { Router } from "express";
import { prisma } from "../prisma.js";

export const orderRouter = Router();

orderRouter.get("/", async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      include: { yacht: true, items: { include: { product: true } } }
    });
    res.json(orders);
  } catch (err) {
    next(err);
  }
});

orderRouter.get("/:id", async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: Number(req.params.id) },
      include: { yacht: true, items: { include: { product: true } } }
    });
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (err) {
    next(err);
  }
});

orderRouter.post("/", async (req, res, next) => {
  try {
    const { yachtId, status, priority, deliveryAt, deliveryNote, notes, total, invoiceStatus, items = [] } = req.body;

    const order = await prisma.order.create({
      data: {
        yachtId: Number(yachtId),
        status: status || "pending",
        priority: priority || "normal",
        deliveryAt: deliveryAt ? new Date(deliveryAt) : null,
        deliveryNote,
        notes,
        total: total === undefined ? null : Number(total),
        invoiceStatus: invoiceStatus || "pending",
        items: {
          create: items.map((item) => ({
            productId: Number(item.productId),
            quantity: Number(item.quantity),
            unit: item.unit || "kg",
            price: item.price === undefined ? null : Number(item.price),
            notes: item.notes || null
          }))
        }
      },
      include: { yacht: true, items: { include: { product: true } } }
    });

    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

orderRouter.put("/:id/status", async (req, res, next) => {
  try {
    const order = await prisma.order.update({
      where: { id: Number(req.params.id) },
      data: { status: req.body.status },
      include: { yacht: true, items: { include: { product: true } } }
    });
    res.json(order);
  } catch (err) {
    next(err);
  }
});

orderRouter.put("/:id", async (req, res, next) => {
  try {
    const { items, ...data } = req.body;
    const order = await prisma.order.update({
      where: { id: Number(req.params.id) },
      data,
      include: { yacht: true, items: { include: { product: true } } }
    });
    res.json(order);
  } catch (err) {
    next(err);
  }
});
