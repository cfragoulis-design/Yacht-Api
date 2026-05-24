import express from "express";
import { PrismaClient } from "@prisma/client";
import cors from "cors";

const prisma = new PrismaClient();
const app = express();

app.use(cors({
  origin: "*"
}));

app.use(express.json());

const PORT = process.env.PORT || 8080;
