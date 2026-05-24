import { Router } from "express";
import { prisma } from "../prisma.js";

export const productRouter = Router();

productRouter.get("/", async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { active: true },
      orderBy: [{ category: "asc" }, { name: "asc" }]
    });
    res.json(products);
  } catch (err) {
    next(err);
  }
});

productRouter.post("/", async (req, res, next) => {
  try {
    const product = await prisma.product.create({ data: req.body });
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
});

productRouter.put("/:id", async (req, res, next) => {
  try {
    const product = await prisma.product.update({
      where: { id: Number(req.params.id) },
      data: req.body
    });
    res.json(product);
  } catch (err) {
    next(err);
  }
});
