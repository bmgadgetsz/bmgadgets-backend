import env from "@/config/env";
import message91Templates from "@/config/message91Templates";
import prisma from "@/config/prisma";
import { sendMail } from "@/services/transporter.service";
import sendSms from "@/utils/sendSms";
import cron from "node-cron";

// Function to send wishlist update notifications
const sendWishlistUpdateNotification = async () => {
  // Fetch wishlist items with stock or price updates
  const wishlist = await prisma.wishlistItem.findMany({
    where: {
      OR: [
        {
          productVariant: {
            OR: [
              { warehouseStocks: { some: { productCount: { gt: 0 } } } },
              {
                prices: {
                  some: {
                    createdAt: {
                      gt: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    },
                  },
                }, // Price updated in the last 24 hours
              },
            ],
          },
        },
        {
          productCombo: {
            OR: [
              { warehouseStocks: { some: { comboCount: { gt: 0 } } } },
              {
                prices: {
                  some: {
                    createdAt: {
                      gt: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    },
                  },
                }, // Price updated in the last 24 hours
              },
            ],
          },
        },
      ],
    },
    include: {
      customerProfile: { include: { user: true } },
      productVariant: {
        include: {
          warehouseStocks: { where: { productCount: { gt: 0 } } },
          prices: {
            orderBy: { createdAt: "desc" },
            where: { active: true },
            take: 1,
          },
          variant: {
            include: { subCategory: true },
          },
          product: true,
        },
      },
      productCombo: {
        include: {
          warehouseStocks: { where: { comboCount: { gt: 0 } } },
          prices: {
            orderBy: { createdAt: "desc" },
            where: { active: true },
            take: 1,
          },
          product: {
            include: {
              varients: {
                take: 1,
                include: {
                  variant: {
                    include: { subCategory: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  // Send notifications for each wishlist item
  Promise.all(
    wishlist.map(async (item) => {
      const itemType = item.productVariantId
        ? "productVariant"
        : "productCombo";
      const stock =
        (itemType === "productVariant"
          ? item.productVariant?.warehouseStocks.reduce(
              (acc, curr) => acc + curr.productCount,
              0,
            )
          : item.productCombo?.warehouseStocks.reduce(
              (acc, curr) => acc + curr.comboCount,
              0,
            )) ?? 0;
      const productId = item[itemType]?.product.id;
      const categoryId =
        itemType === "productVariant"
          ? item.productVariant?.variant.subCategory.categoryId
          : item.productCombo?.product.varients[0]?.variant.subCategory
              .categoryId;

      // eslint-disable-next-line no-console
      console.log(
        "[CRON] Sending wishlist update notification to: ",
        item.customerProfile.user.name,
      );

      // Send email notification
      await sendMail(
        item.customerProfile.user.email,
        "Update on your wishlist items",
        `
          <p>Hi ${item.customerProfile.user.name},</p>
          <p>Good news! An item from your wishlist is now available or has a new price:</p>
          <h2 style="margin: 0;">${item[itemType]?.product.name} - ${itemType === "productVariant" ? item.productVariant?.variant.name : item.productCombo?.name}</h2>
          <p style="margin: 0;">New Price: <strong>₹${item[itemType]?.prices[0]?.price}</strong></p>
          <p style="margin: 0;">Stock: <span style="color: ${stock > 10 ? "green" : "red"};">${stock > 10 ? "In Stock" : "Limited Availability"}</span></p>
          <p>Secure it now before it’s gone:</p>
          <a href="${`${env.app.frontendBaseUrl}/categories/${categoryId}/${productId}`}" style="color: blue; text-decoration: underline;">View Product</a>
          <p>Thank you for being a valued BMGadgets Customer!</p>
    `,
      );

      // Send SMS notification
      await sendSms(
        message91Templates.wishlistProductReadyAlerts,
        item.customerProfile.user.phone,
        {
          Product_name: `${item[itemType]?.product.name} - ${itemType === "productVariant" ? item.productVariant?.variant.name : item.productCombo?.name}`,
        },
      );
    }),
  );
};

// Schedule the function to run daily at noon
cron.schedule("0 12 * * *", sendWishlistUpdateNotification, {
  timezone: "Asia/Kolkata",
});
