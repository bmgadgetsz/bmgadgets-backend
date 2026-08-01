import prisma from "@/config/prisma";
import { sendMail } from "@/services/transporter.service";
import { z } from "zod";
import cron from "node-cron";
import env from "@/config/env";
import sendSms from "@/utils/sendSms";
import message91Templates from "@/config/message91Templates";

// Function to send cart abandonment notifications via email and SMS
const sendCartAbandonmentNotification = async () => {
  // Fetch distinct abandoned cart items
  const abandonedItems = await prisma.cartItem.findMany({
    distinct: ["customerProfileId"],
    include: { customerProfile: { include: { user: true } } },
  });

  // Send notifications for each abandoned cart
  Promise.all(
    abandonedItems.map(async (item) => {
      // eslint-disable-next-line no-console
      console.log(
        "[CRON] Sending cart abandonment notification to: ",
        item.customerProfile.user.name,
      );

      // Validate email
      const { data: safeEmail } = z
        .string()
        .email()
        .safeParse(item.customerProfile.user.email);

      // Send email to customer if valid email exists
      if (safeEmail) {
        // Fetch full cart details
        const fullCart = await prisma.cartItem.findMany({
          where: { customerProfileId: item.customerProfileId },
          include: {
            productVariant: {
              include: {
                product: true,
                variant: true,
                prices: {
                  where: { active: true },
                  orderBy: { createdAt: "desc" },
                  take: 1,
                },
                warehouseStocks: { where: { productCount: { gt: 0 } } },
              },
            },
            productCombo: {
              include: {
                product: true,
                prices: {
                  where: { active: true },
                  orderBy: { createdAt: "desc" },
                  take: 1,
                },
                warehouseStocks: { where: { comboCount: { gt: 0 } } },
              },
            },
          },
        });

        // Send email notification
        await sendMail(
          safeEmail,
          "Your cart is waiting - complete your order today",
          `
            <!-- Email content -->
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="https://origino-admin-dev.vercel.app/assets/logo-CLyTRrVq.png" alt="BMGadgets Logo" style="max-width: 180px; height: auto;">
            </div>

            <p style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 18px; color: #2c3e50; margin-bottom: 20px;">
              Hi ${item.customerProfile.user.name},
            </p>

            <p style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 16px; color: #2c3e50; margin-bottom: 15px;">
              We noticed you left some items in your cart. Complete your purchase now to ensure you don’t miss out:
            </p>

            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 20px;">
              ${fullCart
                .map((fcItem) => {
                  const itemType = fcItem.productVariant
                    ? "productVariant"
                    : "productCombo";
                  const isUnavailable =
                    fcItem[itemType]?.warehouseStocks.length === 0;
                  const productName = fcItem[itemType]?.product.name;
                  const variantName =
                    fcItem.productVariant?.variant.name ??
                    fcItem.productCombo?.name;
                  const price = fcItem[itemType]?.prices[0].price;

                  return `
                      <div style="flex: 0 0 auto; min-width: 260px; max-width: 300px; border: 1px solid ${isUnavailable ? "#e74c3c" : "#27ae60"}; background-color: ${
                        isUnavailable ? "#fdecea" : "#eafaf1"
                      }; border-radius: 6px; padding: 12px 16px;">
                        <p style="margin: 0; font-size: 16px; color: #34495e;">
                          <span style="font-weight: bold; color: #2980b9;">${fcItem.quantity}x</span> 
                          <strong>${productName} - ${variantName}(s)</strong>
                        </p>
                        ${
                          isUnavailable
                            ? `<p style="color: #e74c3c; font-weight: bold; margin: 8px 0 0 0;">⚠️ Item now unavailable</p>`
                            : `<p style="color: #27ae60; margin: 8px 0 0 0;">✅ Current Price: ₹<strong>${price}</strong></p>`
                        }
                      </div>
                    `;
                })
                .join("")}
            </div>

            <p style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 16px; color: #2c3e50; margin-top: 20px;">
              Click below to complete your order:
            </p>

            <a href="${env.app.frontendBaseUrl}/shopping-cart"
              style="display: inline-block; background-color: #007BFF; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 5px; font-weight: bold; font-size: 16px; margin-top: 10px;">
              🛒 Checkout Now
            </a>

            <p style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 16px; color: #2c3e50; margin-top: 30px;">
              Thank you for choosing <strong style="color: #007BFF;">BMGadgets</strong>!
            </p>
          `,
        );
      }

      // Send SMS notification
      await sendSms(
        message91Templates.abandonedCartReminder,
        item.customerProfile.user.phone,
        {
          Name: item.customerProfile.user.name ?? "Customer",
        },
      );
    }),
  );
};

// Schedule the function to run daily at noon
cron.schedule("0 12 * * *", sendCartAbandonmentNotification, {
  timezone: "Asia/Kolkata",
});
