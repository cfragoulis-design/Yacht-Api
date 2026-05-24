import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("YachtFlow API Running");
});

app.get("/yachts", async (req, res) => {
  const yachts = await prisma.yacht.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  res.json(yachts);
});

app.post("/yachts", async (req, res) => {
  const yacht = await prisma.yacht.create({
    data: req.body,
  });

  res.json(yacht);
});

app.get("/orders", async (req, res) => {
  const orders = await prisma.order.findMany({
    include: {
      yacht: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  res.json(orders);
});

app.post("/orders", async (req, res) => {
  const order = await prisma.order.create({
    data: req.body,
  });

  res.json(order);
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API running on port ${PORT}`);
});
