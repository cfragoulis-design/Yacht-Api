
// Revenue + Ticket backend upgrade
// Replace ONLY the relevant sections in your existing server.js

app.post("/orders/:id/prepare", async (req, res) => {
  try {
    const { items, subtotal, vat, total } = req.body;

    for (const item of items) {
      await prisma.orderItem.update({
        where: { id: item.id },
        data: {
          actualWeight: Number(item.actualWeight),
          customPrice: Number(item.customPrice),
          lineTotal: Number(item.lineTotal),
        },
      });
    }

    const order = await prisma.order.update({
      where: { id: Number(req.params.id) },
      data: {
        subtotal: Number(subtotal),
        vat: Number(vat),
        total: Number(total),
        status: "ready",
      },
      include: {
        yacht: true,
        items: {
          include: { product: true },
        },
      },
    });

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
