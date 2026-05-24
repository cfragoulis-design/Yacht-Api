import express from "express";
import { PrismaClient } from "@prisma/client";
import cors from "cors";

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;

app.get("/", (req, res) => {
  res.json({
    ok: true,
    app: "YachtFlow API",
  });
});

app.get("/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      ok: true,
      database: "connected",
    });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e.message,
    });
  }
});

app.get("/seed", async (req, res) => {
  try {
    await prisma.product.createMany({
      data: [
        {
          name: "Black Angus Ribeye",
          price: 48,
          category: "Beef",
        },
        {
          name: "Tomahawk Steak",
          price: 72,
          category: "Premium",
        },
        {
          name: "Wagyu Striploin",
          price: 95,
          category: "Luxury",
        },
      ],
      skipDuplicates: true,
    });

    await prisma.yacht.createMany({
      data: [
        {
          name: "M/Y Serenity",
          marina: "Gouvia Marina",
          chefName: "John Carter"
        },
        {
          name: "M/Y Blue Ocean",
          marina: "Mykonos Marina",
          chefName: "Marco Bellini"
        },
      ],
      skipDuplicates: true,
    });

    res.json({
      ok: true,
      message: "Database seeded",
    });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e.message,
    });
  }
});

app.get("/products", async (req, res) => {
  const products = await prisma.product.findMany();

  res.json(products);
});

app.get("/yachts", async (req, res) => {
  const yachts = await prisma.yacht.findMany();

  res.json(yachts);
});

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});
