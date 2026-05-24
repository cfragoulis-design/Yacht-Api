import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();
const prisma = new PrismaClient();

async function main() {
  const products = [
    { name: "Tomahawk dry aged", category: "Premium beef", unit: "kg", price: 68 },
    { name: "Ribeye Black Angus", category: "Premium beef", unit: "kg", price: 48 },
    { name: "Japanese Wagyu A5", category: "Wagyu", unit: "kg", price: 240 },
    { name: "Lamb rack", category: "Lamb", unit: "kg", price: 42 },
    { name: "Minced beef", category: "Daily prep", unit: "kg", price: 14 },
    { name: "Chicken breast", category: "Poultry", unit: "kg", price: 12 }
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { id: products.indexOf(product) + 1 },
      update: product,
      create: product
    });
  }

  await prisma.yacht.create({
    data: {
      name: "M/Y Serenity",
      marina: "Gouvia Marina",
      berth: "D-42",
      chefName: "John Carter",
      phone: "+30 694 000 1122",
      vipLevel: "Platinum",
      notes: "Prefers premium cuts, vacuum packed. No nuts onboard. Delivery stern side."
    }
  });

  console.log("Seed completed");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
