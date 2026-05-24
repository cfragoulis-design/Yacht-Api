import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.yacht.deleteMany();

  const serenity = await prisma.yacht.create({
    data: {
      name: "M/Y Serenity",
      marina: "Gouvia Marina",
      berth: "D-42",
      chefName: "Chef John",
      phone: "+30 6900000000",
      notes: "Premium yacht meat client. Prefers dry aged cuts and scheduled delivery."
    }
  });

  await prisma.yacht.create({
    data: {
      name: "M/Y Aether",
      marina: "Mykonos Marina",
      berth: "B-18",
      chefName: "Chef Maria",
      phone: "+30 6910000000",
      notes: "Often orders for private dinners and guest arrivals."
    }
  });

  await prisma.product.createMany({
    data: [
      { name: "Tomahawk Steak", category: "Premium Beef", unit: "kg", price: 48, notes: "Dry aged option available" },
      { name: "Ribeye Steak", category: "Premium Beef", unit: "kg", price: 42, notes: "Cut to requested thickness" },
      { name: "Lamb Rack", category: "Lamb", unit: "kg", price: 32, notes: "French trimmed on request" },
      { name: "Minced Beef", category: "Beef", unit: "kg", price: 14, notes: "Fresh daily" },
      { name: "Chicken Fillet", category: "Poultry", unit: "kg", price: 11, notes: "Vacuum packaging available" },
      { name: "Chef Custom Request", category: "Custom", unit: "request", price: 0, notes: "Manual pricing" }
    ]
  });

  const tomahawk = await prisma.product.findFirst({ where: { name: "Tomahawk Steak" } });
  const lamb = await prisma.product.findFirst({ where: { name: "Lamb Rack" } });

  await prisma.order.create({
    data: {
      yachtId: serenity.id,
      status: "confirmed",
      notes: "Delivery tomorrow 18:00. Call chef before arrival.",
      total: 384,
      items: {
        create: [
          { productId: tomahawk.id, quantity: 6, notes: "1.2kg each if possible" },
          { productId: lamb.id, quantity: 3, notes: "French trimmed" }
        ]
      }
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
