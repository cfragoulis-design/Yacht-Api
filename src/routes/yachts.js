import { Router } from "express";
import { prisma } from "../prisma.js";

export const yachtRouter = Router();

yachtRouter.get("/", async (req, res, next) => {
  try {
    const yachts = await prisma.yacht.findMany({
      orderBy: { createdAt: "desc" },
      include: { orders: { orderBy: { createdAt: "desc" }, take: 5 } }
    });
    res.json(yachts);
  } catch (err) {
    next(err);
  }
});

yachtRouter.get("/:id", async (req, res, next) => {
  try {
    const yacht = await prisma.yacht.findUnique({
      where: { id: Number(req.params.id) },
      include: { orders: { include: { items: { include: { product: true } } }, orderBy: { createdAt: "desc" } } }
    });
    if (!yacht) return res.status(404).json({ error: "Yacht not found" });
    res.json(yacht);
  } catch (err) {
    next(err);
  }
});

yachtRouter.post("/", async (req, res, next) => {
  try {
    const yacht = await prisma.yacht.create({ data: req.body });
    res.status(201).json(yacht);
  } catch (err) {
    next(err);
  }
});

yachtRouter.put("/:id", async (req, res, next) => {
  try {
    const yacht = await prisma.yacht.update({
      where: { id: Number(req.params.id) },
      data: req.body
    });
    res.json(yacht);
  } catch (err) {
    next(err);
  }
});

yachtRouter.delete("/:id", async (req, res, next) => {
  try {
    await prisma.yacht.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
