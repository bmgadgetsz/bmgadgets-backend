import {
  CartItem,
  CustomerProfile,
  Order,
  Product,
  ProductCombo,
  ProductVariant,
  User,
  Variant,
} from "@/generated/prisma";

const generateOrderConfirmationEmail = (
  order: Order & { createdBy: CustomerProfile & { user: Partial<User> } },
  cart: (CartItem & {
    productVariant?: ProductVariant & {
      product: Product;
      variant: Variant;
    };
    productCombo?: ProductCombo & { product: Product };
  })[],
  finalAmount: number,
) => {
  return `
    <p>Hi ${order.createdBy.user.name}</p>
    <p>Thank you for your purchase! Your order #${order.id} has been confirmed.</p>
    <p>Order Summary:</p>
    <ul>
      ${cart
        .map((cItem) => {
          const itemType = cItem.productVariant
            ? "productVariant"
            : "productCombo";
          return `<li>${cItem.quantity}x <b>${cItem[itemType]?.product.name} - ${cItem.productVariant?.variant.name ?? cItem.productCombo?.name}</b></li>`;
        })
        .join("")}
    </ul>
    <p>Total: ₹${finalAmount}</p>
    <p>Thank you for choosing BMGadgets.</p>
  `;
};

const orderTemplate = {
  generateOrderConfirmationEmail,
};
export default orderTemplate;
