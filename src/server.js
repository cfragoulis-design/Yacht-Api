import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { yachtRouter } from "./routes/yachts.js";
import { productRouter } from "./routes/products.js";
import { orderRouter } from "./routes/orders.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    name: "YachtFlow API",
    status: "running",
    endpoints: ["/health", "/yachts", "/products", "/orders"]
  });
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/yachts", yachtRouter);
app.use("/products", productRouter);
app.use("/orders", orderRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error", details: err.message });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`YachtFlow API running on port ${PORT}`);
});
