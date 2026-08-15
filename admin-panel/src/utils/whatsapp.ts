/**
 * WhatsApp Helper Utility for Order Notifications
 */

export interface FormatWhatsAppOptions {
  includeTrackingLink?: boolean;
}

/**
 * Truncates text to max length with ellipsis
 */
export function truncateText(text: string, maxLength: number = 20): string {
  if (!text) return "";
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, maxLength) + "...";
}

/**
 * Formats order data into clean, structured WhatsApp Markdown message (ASCII compatible)
 */
export function formatWhatsAppOrderMessage(order: any): string {
  if (!order) return "";

  const orderId = order.id || "";
  const shortId = orderId ? orderId.slice(-6).toUpperCase() : "";
  const trackLink = "bmgadgets.in/orders/" + orderId + "/track";

  // Customer Name
  const customerName = order.createdBy?.user?.name || order.address?.name || "Customer";

  // Format Items
  const items = order.items || [];
  let itemsFormatted = "";

  if (items.length > 0) {
    itemsFormatted = items
      .map((item: any, idx: number) => {
        const rawName =
          item.productName ||
          item.comboName ||
          item.price?.productVariant?.product?.name ||
          item.price?.productCombo?.name ||
          "Product Item";

        // Product name in 20 character max with ellipsis
        const truncatedName = truncateText(rawName, 20);

        const qty = item.quantity || 1;
        const unitPrice =
          typeof item.price === "number"
            ? item.price
            : (item.price?.discountedPrice || item.price?.sellingPrice || item.price?.price || 0);

        const subtotal = unitPrice * qty;

        return (idx + 1) + ". *" + truncatedName + "*\n   Qty: " + qty + " | Rs." + subtotal.toLocaleString("en-IN");
      })
      .join("\n");
  } else {
    itemsFormatted = "- *1x Order Item*";
  }

  // Financial details
  const subtotal = order.subtotal || 0;
  const shippingCost = order.shippingCost || 0;
  const discount = order.couponDiscount || 0;
  const grandTotal =
    order.totalAmount ||
    (subtotal + shippingCost - discount) ||
    items.reduce((acc: number, item: any) => {
      const p = typeof item.price === "number" ? item.price : (item.price?.discountedPrice || item.price?.sellingPrice || 0);
      return acc + (p * (item.quantity || 1));
    }, 0);

  const paymentType = order.paymentType === "COD" ? "Cash on Delivery (COD)" : "Prepaid Online";

  const lines = [
    "*Your Order Confirmed!*",
    "",
    "Hi *" + customerName + "*, your order has been confirmed and is being processed!",
    "",
    "*Order ID:* #" + shortId,
    "*Full Ref:* " + orderId,
    "*Payment:* " + paymentType,
    "",
    "*Order Items:*",
    itemsFormatted,
    "",
    "*Total Amount:* Rs." + Number(grandTotal).toLocaleString("en-IN"),
    "",
    "*Track Your Order:*",
    "https://" + trackLink,
    "",
    "*Thank you for shopping with BMGadgets!*"
  ];

  return lines.join("\n");
}

/**
 * Formats delivery confirmation & review request WhatsApp message with links for each product
 */
export function formatWhatsAppDeliveryReviewMessage(order: any): string {
  if (!order) return "";

  const orderId = order.id || "";
  const shortId = orderId ? orderId.slice(-6).toUpperCase() : "";
  const customerName = order.createdBy?.user?.name || order.address?.name || "Valued Customer";

  const items = order.items || [];
  const reviewLinks: string[] = [];

  if (items.length > 0) {
    items.forEach((item: any, idx: number) => {
      const prod = item.price?.productVariant?.product || item.price?.productCombo?.product || item.price?.productCombo;
      const productId = prod?.id || item.productId || item.productVariantId || item.id;
      const rawName = prod?.name || item.productName || item.comboName || "Product Item";
      const name = truncateText(rawName, 25);

      if (productId) {
        const link = `https://bmgadgets.in/review?productId=${productId}&name=${encodeURIComponent(customerName)}&orderId=${shortId}`;
        reviewLinks.push(`${idx + 1}. *${name}*\nReview link: ${link}`);
      }
    });
  }

  const reviewSection =
    reviewLinks.length > 0
      ? reviewLinks.join("\n\n")
      : "Review link: https://bmgadgets.in/review?name=" + encodeURIComponent(customerName);

  const lines = [
    "*ORDER DELIVERED & THANK YOU!*",
    "",
    "Hi *" + customerName + "*,",
    "",
    "Thank you for shopping with *BMGadgets*! Your order *#" + shortId + "* has been successfully delivered. We hope you love your new bargains!",
    "",
    "*We would appreciate your quick review (No login required):*",
    "",
    reviewSection,
    "",
    "Your feedback helps us continue bringing you factory-direct deals!",
    "",
    "Thank you again for choosing *BMGadgets*! Have a wonderful day!"
  ];

  return lines.join("\n");
}

/**
 * Formats manual dispatch / shipped WhatsApp message with courier details
 */
export function formatWhatsAppDispatchMessage(order: any): string {
  if (!order) return "";

  const orderId = order.id || "";
  const shortId = orderId ? orderId.slice(-6).toUpperCase() : "";
  const customerName = order.createdBy?.user?.name || order.address?.name || "Customer";
  const partner = order.deliveryPartner || "Courier Service";
  const trackId = order.trackingId || "N/A";
  const trackLink = order.trackingUrl || "https://bmgadgets.in/orders/" + orderId + "/track";

  const lines = [
    "*YOUR ORDER HAS BEEN DISPATCHED!*",
    "",
    "Hi *" + customerName + "*, your order *#" + shortId + "* has been shipped!",
    "",
    "*Courier Partner:* " + partner,
    "*Tracking / AWB ID:* " + trackId,
    "",
    "*Track Shipment Live:*",
    trackLink,
    "",
    "*Thank you for shopping with BMGadgets!*"
  ];

  return lines.join("\n");
}

/**
 * Sanitizes phone number and builds wa.me deep link
 */
export function getWhatsAppUrl(phone: string | undefined, message: string): string {
  if (!phone) return "#";

  // Strip all non-digit characters
  let cleanPhone = phone.replace(/\D/g, "");

  // If 10 digits, assume Indian mobile number (+91)
  if (cleanPhone.length === 10) {
    cleanPhone = "91" + cleanPhone;
  }

  return "https://wa.me/" + cleanPhone + "?text=" + encodeURIComponent(message);
}
