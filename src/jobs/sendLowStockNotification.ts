import env from "@/config/env";
import prisma from "@/config/prisma";
import { getIO } from "@/config/socket";
import cron from "node-cron";

// Function to send low stock notifications
const sendLowStockNotification = async () => {
  // Fetch products with low stock
  const lowStockProduct = await prisma.product.findMany({
    where: {
      OR: [
        {
          varients: {
            some: {
              warehouseStocks: {
                some: {
                  productCount: { lt: env.app.lowStockThreshold },
                },
              },
            },
          },
        },
        {
          combos: {
            some: {
              warehouseStocks: {
                some: {
                  comboCount: { lt: env.app.lowStockThreshold },
                },
              },
            },
          },
        },
      ],
    },
    include: {
      createdBy: true,
    },
  });

  // Create notifications for low stock products
  await prisma.notification.createMany({
    // @ts-expect-error list is filtered
    data: lowStockProduct
      .map((p) => {
        if (!p.createdBy) return undefined;
        return {
          type: "PRODUCT_STOCK_LOW",
          title: `Stock low for ${p.name}.`,
          receiverId: p.createdBy.userId,
          productId: p.id,
        };
      })
      .filter(Boolean),
  });

  // Emit notifications via socket
  const io = getIO();
  lowStockProduct.forEach((p) => {
    if (!p.createdBy) return;
    io.to(p.createdBy.userId).emit("notification", {
      id: p.id,
    });
  });
};

// Schedule the function to run daily at midnight
cron.schedule("0 0 * * *", sendLowStockNotification, {
  timezone: "Asia/Kolkata",
});
