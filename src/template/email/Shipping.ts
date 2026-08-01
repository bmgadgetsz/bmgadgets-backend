/**
 * Generates an email template for order shipment notification.
 * @param opts - Options containing order details and customer information.
 * @returns An object with subject and HTML content for the email.
 */
export const orderShippedTemplate = (opts: {
  firstName?: string;
  orderId: string;
  awb?: string | null;
  courier?: string | null;
  estimatedDelivery?: string | null;
  trackUrl?: string | null;
}) => {
  const name = opts.firstName ?? "Customer";
  const awbBlock = opts.awb
    ? `<p><strong>Tracking ID:</strong> ${opts.awb}</p>`
    : `<p>Tracking ID: It will be updated soon.</p>`;
  const est = opts.estimatedDelivery
    ? `<p><strong>Estimated delivery:</strong> ${opts.estimatedDelivery}</p>`
    : "";
  const track = opts.trackUrl
    ? `<p><a href="${opts.trackUrl}">Track your shipment</a></p>`
    : "";
  return {
    subject: `Your Order #${opts.orderId} Has Been Shipped 🚚`,
    html: `
      <h2>Hi ${name},</h2>
      <p>Your order <strong>#${opts.orderId}</strong> has been shipped${opts.courier ? ` via ${opts.courier}` : ""}.</p>
      ${awbBlock}
      ${est}
      ${track}
      <p>Thanks for shopping with us — hope you love your purchase!</p>
      <p>Best regards,<br/>The Team</p>
    `,
  };
};

/**
 * Generates an email template for out-for-delivery notification.
 * @param opts - Options containing order details and customer information.
 * @returns An object with subject and HTML content for the email.
 */
export const outForDeliveryTemplate = (opts: {
  firstName?: string;
  orderId: string;
  awb?: string | null;
  amountDue?: number | null;
  address?: string | null;
  trackUrl?: string | null;
}) => {
  const amountLine =
    typeof opts.amountDue === "number"
      ? `<p><strong>Amount due (COD):</strong> ₹${opts.amountDue}</p>`
      : "";
  return {
    subject: `Your Order #${opts.orderId} Is Out for Delivery 🚚`,
    html: `
      <h2>Hi ${opts.firstName ?? "Customer"},</h2>
      <p>Good news — your order <strong>#${opts.orderId}</strong> is out for delivery today.</p>
      ${amountLine}
      ${opts.address ? `<p><strong>Delivery Address:</strong> ${opts.address}</p>` : ""}
      ${opts.trackUrl ? `<p><a href="${opts.trackUrl}">Track your order</a></p>` : ""}
      <p>If you need to update delivery instructions, reply to this email or contact support.</p>
      <p>Best,<br/>The Team</p>
    `,
  };
};

/**
 * Generates an email template for delivery confirmation.
 * @param opts - Options containing order details and customer information.
 * @returns An object with subject and HTML content for the email.
 */
export const deliveryConfirmationTemplate = (opts: {
  firstName?: string;
  orderId: string;
}) => ({
  subject: `Delivery Confirmed - Order #${opts.orderId} ✅`,
  html: `
    <h2>Hi ${opts.firstName ?? "Customer"},</h2>
    <p>Your order <strong>#${opts.orderId}</strong> has been delivered successfully.</p>
    <p>Thank you for shopping with us!</p>
    <p>Best regards,<br/>The Team</p>
  `,
});

/**
 * Generates an email template for failed delivery attempt notification.
 * @param opts - Options containing order details and customer information.
 * @returns An object with subject and HTML content for the email.
 */
export const failedDeliveryAttemptTemplate = (opts: {
  firstName?: string;
  orderId: string;
  atTime?: string | null;
  trackUrl?: string | null;
}) => ({
  subject: `Delivery Attempt Failed - Order #${opts.orderId}`,
  html: `
    <h2>Hi ${opts.firstName ?? "Customer"},</h2>
    <p>We’re sorry — delivery for order <strong>#${opts.orderId}</strong> could not be completed${opts.atTime ? ` at ${opts.atTime}` : ""}.</p>
    ${opts.trackUrl ? `<p><a href="${opts.trackUrl}">Track your order</a></p>` : ""}
    <p>Please contact support if you want to reschedule or change instructions.</p>
    <p>Best,<br/>The Team</p>
  `,
});

/**
 * Generates an email template for order cancellation notification.
 * @param opts - Options containing order details and customer information.
 * @returns An object with subject and HTML content for the email.
 */
export const orderCancelledTemplate = (opts: {
  firstName?: string;
  orderId: string;
  refundAmount?: number | null;
  partial?: boolean;
  supportLink?: string | null;
}) => ({
  subject: `Order Cancelled - #${opts.orderId}`,
  html: `
    <h2>Hi ${opts.firstName ?? "Customer"},</h2>
    <p>Your order <strong>#${opts.orderId}</strong> has been cancelled.</p>
    ${opts.partial ? `<p><strong>Note:</strong> This was a partial cancellation — only some items were cancelled.</p>` : ""}
    ${typeof opts.refundAmount === "number" ? `<p><strong>Refund:</strong> ₹${opts.refundAmount} will be processed in 3–5 business days.</p>` : ""}
    ${opts.supportLink ? `<p>If you have questions, contact support: <a href="${opts.supportLink}">${opts.supportLink}</a></p>` : ""}
    <p>Best regards,<br/>The Team</p>
  `,
});

/**
 * Generates an email template for return pickup confirmation.
 * @param opts - Options containing order details and customer information.
 * @returns An object with subject and HTML content for the email.
 */
export const returnPickupConfirmedTemplate = (opts: {
  firstName?: string;
  orderId: string;
  returnId?: string | null;
  trackUrl?: string | null;
}) => ({
  subject: `Return Pickup Confirmed — Order #${opts.orderId}`,
  html: `
    <h2>Hi ${opts.firstName ?? "Customer"},</h2>
    <p>We’ve confirmed that the returned item from <strong>order #${opts.orderId}</strong> has been picked up by the courier.</p>
    ${opts.trackUrl ? `<p><a href="${opts.trackUrl}">Track return status</a></p>` : ""}
    <p>The refund will be initiated once the quality check is complete. We’ll notify you when the refund is processed.</p>
    <p>Thanks,<br/>The Team</p>
  `,
});

/**
 * Generates an email template for return received at warehouse notification.
 * @param opts - Options containing order details and customer information.
 * @returns An object with subject and HTML content for the email.
 */
export const returnReceivedAtWarehouseTemplate = (opts: {
  firstName?: string;
  orderId: string;
  returnId?: string | null;
  trackUrl?: string | null;
}) => ({
  subject: `Return Received at Warehouse — Order #${opts.orderId}`,
  html: `
    <h2>Hi ${opts.firstName ?? "Customer"},</h2>
    <p>We have received the returned item for <strong>order #${opts.orderId}</strong> at our warehouse.</p>
    <p>The refund will be initiated once the quality inspection is complete. We’ll notify you once the refund is processed.</p>
    ${opts.trackUrl ? `<p><a href="${opts.trackUrl}">Track return status</a></p>` : ""}
    <p>Thanks,<br/>The Team</p>
  `,
});

/**
 * Generates an email template for return pickup failed notification.
 * @param opts - Options containing order details and customer information.
 * @returns An object with subject and HTML content for the email.
 */
export const returnPickupFailedTemplate = (opts: {
  firstName?: string;
  orderId: string;
  atTime?: string | null;
  trackUrl?: string | null;
}) => ({
  subject: `Return Pickup Attempt Failed - Order #${opts.orderId}`,
  html: `
    <h2>Hi ${opts.firstName ?? "Customer"},</h2>
    <p>The pickup attempt for your return request (order <strong>#${opts.orderId}</strong>) could not be completed${opts.atTime ? ` at ${opts.atTime}` : ""}.</p>
    <p>We’ll update you about the re-pickup attempt soon.</p>
    ${opts.trackUrl ? `<p><a href="${opts.trackUrl}">Track return status</a></p>` : ""}
    <p>If you need urgent help, please contact support.</p>
    <p>Thanks,<br/>The Team</p>
  `,
});

/**
 * Generates an email template for return rejection notification.
 * @param opts - Options containing order details and customer information.
 * @returns An object with subject and HTML content for the email.
 */
export const returnRejectedTemplate = (opts: {
  firstName?: string;
  orderId: string;
  reason?: string | null;
  supportLink?: string | null;
}) => ({
  subject: `Return Request Rejected - Order #${opts.orderId}`,
  html: `
    <h2>Hi ${opts.firstName ?? "Customer"},</h2>
    <p>We’re sorry — the returned item from <strong>order #${opts.orderId}</strong> was rejected during inspection.${opts.reason ? `<p><strong>Reason:</strong> ${opts.reason}</p>` : ""}</p>
    ${opts.supportLink ? `<p>For assistance, contact our support team: <a href="${opts.supportLink}">${opts.supportLink}</a></p>` : ""}
    <p>Thanks,<br/>The Team</p>
  `,
});

/**
 * Generates an email template for pickup failure notification.
 * @param opts - Options containing order details and vendor information.
 * @returns An object with subject and HTML content for the email.
 */
export const pickupFailedTemplate = (opts: {
  vendorName?: string;
  orderId: string;
  rescheduleLink?: string | null;
}) => ({
  subject: `Pickup Failed – Order #${opts.orderId}`,
  html: `
    <h2>Hi ${opts.vendorName ?? "Vendor"},</h2>
    <p>Pickup for <strong>Order #${opts.orderId}</strong> could not be completed.</p>
    <p>– Logistics Team</p>
  `,
});

// SMS bodies (short)
/**
 * Generates an SMS template for return pickup confirmation.
 * @param orderId - Order ID.
 * @param track - Optional tracking URL.
 * @returns A string with the SMS content.
 */
export const returnPickupConfirmedSMS = (orderId: string, track?: string) =>
  `Item from order #${orderId} picked up. Refund after inspection. ${track ? `Track: ${track}` : ""}`;

/**
 * Generates an SMS template for return received notification.
 * @param orderId - Order ID.
 * @param track - Optional tracking URL.
 * @returns A string with the SMS content.
 */
export const returnReceivedSMS = (orderId: string, track?: string) =>
  `Return for order #${orderId} received at warehouse. Refund after inspection. ${track ? `Track: ${track}` : ""}`;

/**
 * Generates an SMS template for return pickup failure notification.
 * @param orderId - Order ID.
 * @returns A string with the SMS content.
 */
export const returnPickupFailedSMS = (orderId: string) =>
  `Pickup for return of order #${orderId} failed. Re-pickup attempt will be updated soon.`;

/**
 * Generates an SMS template for return rejection notification.
 * @param orderId - Order ID.
 * @returns A string with the SMS content.
 */
export const returnRejectedSMS = (orderId: string) =>
  `Return for order #${orderId} rejected during inspection. Contact support.`;
