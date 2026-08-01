import prisma from "./config/prisma";

(async () => {
  const productVariants = await prisma.productVariant.findMany({
    where: {},
    include: {
      prices: {
        where: { active: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  Promise.all(
    productVariants.map((v) =>
      prisma.price.updateMany({
        where: { productVariantId: v.id, active: true },
        data: {
          discountedPrice:
            v.prices[0].price -
            v.prices[0].price * (v.discountPercentage / 100),
        },
      }),
    ),
  );
})();
