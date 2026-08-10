import prisma from "./config/prisma";

(async () => {
  console.log("[Migration] Starting product category migration...");

  try {
    const products = await prisma.product.findMany({
      include: {
        varients: {
          include: {
            variant: {
              include: {
                subCategory: true,
              },
            },
          },
        },
      },
    });

    console.log(`[Migration] Found ${products.length} products to check.`);

    let migratedCount = 0;
    for (const product of products) {
      // Find categoryId via first variant's subcategory
      let catId = product.varients[0]?.variant?.subCategory?.categoryId;

      if (!catId) {
        // Fallback: search for any category or use a default one
        const defaultCat = await prisma.category.findFirst();
        if (defaultCat) {
          catId = defaultCat.id;
          console.log(
            `[Migration] No category found for product "${product.name}". Using default category: "${defaultCat.name}".`,
          );
        }
      }

      if (catId) {
        await prisma.product.update({
          where: { id: product.id },
          data: { categoryId: catId },
        });
        migratedCount++;
      } else {
        console.warn(
          `[Migration] Warning: Could not assign a category to product "${product.name}" (no categories exist in DB).`,
        );
      }
    }

    console.log(`[Migration] Successfully updated ${migratedCount} products.`);
  } catch (err) {
    console.error("[Migration] Migration failed with error:", err);
  } finally {
    await prisma.$disconnect();
    console.log("[Migration] Finished database connection release.");
  }
})();
