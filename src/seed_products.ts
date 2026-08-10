import prisma from "./config/prisma";

async function main() {
  console.log("[Seeder] Starting product catalog seeding...");

  // 1. Fetch the Origin Vendor Profile
  const vendor = await prisma.vendorProfile.findFirst({
    where: { isOriginO: true },
  });
  if (!vendor) {
    throw new Error(
      "Seed vendor profile with isOriginO = true not found. Please run main seed script first.",
    );
  }
  console.log(
    `[Seeder] Linked to vendor profile: ${vendor.businessName} (${vendor.id})`,
  );

  // 2. Seed HSN Configs
  console.log("[Seeder] Seeding HSN Configs...");
  const hsnsData = [
    {
      hsnCode: "8517",
      description: "Smartphones & Handheld Wireless Electronics",
      gstRate: 18,
    },
    {
      hsnCode: "8518",
      description: "Headphones, Earphones & Audio Accessories",
      gstRate: 18,
    },
    { hsnCode: "8504", description: "Power Adaptors & Chargers", gstRate: 18 },
    {
      hsnCode: "9102",
      description: "Smartwatches & Wearable Trackers",
      gstRate: 18,
    },
  ];
  const hsnConfigs = [];
  for (const data of hsnsData) {
    let config = await prisma.hsnConfig.findUnique({
      where: { hsnCode: data.hsnCode },
    });
    if (!config) {
      config = await prisma.hsnConfig.create({ data });
    }
    hsnConfigs.push(config);
  }

  // 3. Seed Brands
  console.log("[Seeder] Seeding Brands...");
  const brandsData = [
    {
      name: "Apple",
      description: "Premium consumer electronics and software",
      imageUrl:
        "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=150",
    },
    {
      name: "Samsung",
      description: "Global technology leader in electronics and displays",
      imageUrl:
        "https://images.unsplash.com/photo-1610792516307-ea5acd9c3b00?w=150",
    },
    {
      name: "Anker",
      description: "Leading charging technology innovator",
      imageUrl:
        "https://images.unsplash.com/photo-1616401784845-180882ba9ba8?w=150",
    },
    {
      name: "Sony",
      description: "Industry-standard audio, imaging and gaming tech",
      imageUrl:
        "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=150",
    },
  ];
  const brands = [];
  for (const data of brandsData) {
    let brand = await prisma.brand.findUnique({ where: { name: data.name } });
    if (!brand) {
      brand = await prisma.brand.create({ data });
    }
    brands.push(brand);
  }

  // 4. Seed Categories, Subcategories & Variants
  console.log("[Seeder] Seeding Categories, Subcategories & Variants...");
  const catData = [
    {
      name: "Mobile Devices",
      imageUrl:
        "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=300",
      description: "Smartphones, tablets and cellular products",
      subCategories: [
        {
          name: "Smartphones",
          description: "Next-generation cellular smartphones",
          variants: ["Pro Max Space Black 256GB", "Standard Navy 128GB"],
        },
      ],
    },
    {
      name: "Audio Accessories",
      imageUrl:
        "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300",
      description: "Premium headphones, earbuds and portable speakers",
      subCategories: [
        {
          name: "ANC Headphones",
          description: "Active Noise Cancelling headphones and headsets",
          variants: ["Over-Ear Silver Elite", "Over-Ear Matte Black"],
        },
      ],
    },
    {
      name: "Power Accessories",
      imageUrl:
        "https://images.unsplash.com/photo-1624456779934-2e9154a4ad9c?w=300",
      description: "Wall adapters, desktop chargers and high-speed hubs",
      subCategories: [
        {
          name: "Charging Hubs",
          description: "Multi-port high wattage USB power adapters",
          variants: ["65W GaN Charger White", "100W GaN Desktop Station"],
        },
      ],
    },
  ];

  for (const cData of catData) {
    let category = await prisma.category.findUnique({
      where: { name: cData.name },
    });
    if (!category) {
      category = await prisma.category.create({
        data: {
          name: cData.name,
          imageUrl: cData.imageUrl,
          description: cData.description,
          availableTags: ["Premium", "Latest", "Top Pick"],
        },
      });
    }

    for (const sData of cData.subCategories) {
      let subCategory = await prisma.subCategory.findUnique({
        where: { name: sData.name },
      });
      if (!subCategory) {
        subCategory = await prisma.subCategory.create({
          data: {
            name: sData.name,
            description: sData.description,
            categoryId: category.id,
          },
        });
      }

      for (const vName of sData.variants) {
        const variant = await prisma.variant.findUnique({
          where: { name: vName },
        });
        if (!variant) {
          await prisma.variant.create({
            data: {
              name: vName,
              description: `Standard edition of ${vName}`,
              subCategoryId: subCategory.id,
            },
          });
        }
      }
    }
  }

  // 5. Seed Primary Warehouse
  console.log("[Seeder] Seeding Primary Warehouse...");
  let warehouse = await prisma.warehouse.findFirst();
  if (!warehouse) {
    warehouse = await prisma.warehouse.create({
      data: {
        company: "BMGadgets Logistics",
        title: "Primary Delhi Fulfillment Center",
        contactPersonName: "Warehouse Admin",
        email: "delhi-fulfillment@bmgadgets.com",
        phone: "9876543210",
        address1: "Plot 105, Sector 4, Dwarka, New Delhi",
        city: "New Delhi",
        state: "Delhi",
        country: "India",
        pincode: "110075",
        gstNo: "07AAAAA1111A1Z1",
        vendorId: vendor.id,
        active: true,
      },
    });
  }
  console.log(`[Seeder] Using warehouse: ${warehouse.title}`);

  // 6. Seed Products, ProductVariants, Prices & Stocks
  console.log("[Seeder] Seeding Products...");

  const phoneHsn = hsnConfigs.find((h) => h.hsnCode === "8517")!;
  const audioHsn = hsnConfigs.find((h) => h.hsnCode === "8518")!;
  const chargerHsn = hsnConfigs.find((h) => h.hsnCode === "8504")!;

  const appleBrand = brands.find((b) => b.name === "Apple")!;
  const sonyBrand = brands.find((b) => b.name === "Sony")!;
  const ankerBrand = brands.find((b) => b.name === "Anker")!;

  const iphoneVariant = await prisma.variant.findFirst({
    where: { name: { contains: "Pro Max" } },
  });
  const headphonesVariant = await prisma.variant.findFirst({
    where: { name: { contains: "Matte Black" } },
  });
  const chargerVariant = await prisma.variant.findFirst({
    where: { name: { contains: "65W GaN" } },
  });

  const mobileCat = await prisma.category.findUnique({
    where: { name: "Mobile Devices" },
  });
  const audioCat = await prisma.category.findUnique({
    where: { name: "Audio Accessories" },
  });
  const powerCat = await prisma.category.findUnique({
    where: { name: "Power Accessories" },
  });

  const productsToSeed = [
    {
      name: "Apple iPhone 15 Pro Max",
      brandId: appleBrand.id,
      hsnId: phoneHsn.id,
      originCountry: "India",
      description:
        "The ultimate iPhone experience featuring a rugged titanium design, A17 Pro chip, and advanced telephoto camera lens.",
      ingredients:
        "Titanium chassis, Ceramic shield glass, recycled cobalt batteries.",
      healthBenefits:
        "Ergonomic tactile feedback and advanced focus tracking features.",
      usageInstructions:
        "Power on with side lock button and follow setup wizard.",
      storageInstructions:
        "Store at ambient temperatures between 0 to 35 degrees C.",
      certifications: ["VEGAN"] as any,
      thumbnailImageUrl:
        "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=300",
      imageUrls: [
        "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=300",
        "https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=300",
      ],
      tags: ["smartphone", "flagship", "ios"],
      active: true,
      featured: true,
      productStatus: "ACCEPTED" as any,
      createdById: vendor.id,
      categoryId: mobileCat!.id,
      variantToLink: iphoneVariant,
      variantDetails: {
        price: 139900,
        discountedPrice: 134900,
        discountPercentage: 3,
        weightInGrams: 221,
      },
    },
    {
      name: "Sony WH-1000XM5 Noise Cancelling Headset",
      brandId: sonyBrand.id,
      hsnId: audioHsn.id,
      originCountry: "Malaysia",
      description:
        "Industry-leading active noise cancelling overhead headphones with high resolution wireless audio and smart listening tech.",
      ingredients:
        "Eco-friendly synthetic leather, carbon-fiber composite materials.",
      healthBenefits:
        "Protects hearing from excessive background city decibel spikes.",
      usageInstructions:
        "Connect over Bluetooth using pairing mode or NFC tap.",
      storageInstructions:
        "Store inside hard carry shell case when not in use.",
      certifications: ["NON_GMO"] as any,
      thumbnailImageUrl:
        "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300",
      imageUrls: [
        "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300",
        "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=300",
      ],
      tags: ["audio", "anc", "wireless"],
      active: true,
      featured: true,
      productStatus: "ACCEPTED" as any,
      createdById: vendor.id,
      categoryId: audioCat!.id,
      variantToLink: headphonesVariant,
      variantDetails: {
        price: 29990,
        discountedPrice: 24990,
        discountPercentage: 16,
        weightInGrams: 250,
      },
    },
    {
      name: "Anker Nano II 65W Rapid Charger",
      brandId: ankerBrand.id,
      hsnId: chargerHsn.id,
      originCountry: "China",
      description:
        "Ultra-compact Gallium Nitride (GaN) fast wall adapter supporting Power Delivery charging speeds for laptops and smartphones.",
      ingredients:
        "Solid copper contact pins, high performance fireproof outer shell plastics.",
      healthBenefits:
        "Reduces thermal footprint during active heavy laptop recharging.",
      usageInstructions:
        "Plug into active AC wall socket and connect type-c cables.",
      storageInstructions:
        "Keep away from humid locations or active water sources.",
      certifications: ["CRUELTY_FREE"] as any,
      thumbnailImageUrl:
        "https://images.unsplash.com/photo-1624456779934-2e9154a4ad9c?w=300",
      imageUrls: [
        "https://images.unsplash.com/photo-1624456779934-2e9154a4ad9c?w=300",
      ],
      tags: ["charger", "gan", "power"],
      active: true,
      featured: false,
      productStatus: "ACCEPTED" as any,
      createdById: vendor.id,
      categoryId: powerCat!.id,
      variantToLink: chargerVariant,
      variantDetails: {
        price: 3999,
        discountedPrice: 3499,
        discountPercentage: 12,
        weightInGrams: 110,
      },
    },
  ];

  for (const pSeed of productsToSeed) {
    let product = await prisma.product.findFirst({
      where: { name: pSeed.name },
    });
    if (!product) {
      product = await prisma.product.create({
        data: {
          name: pSeed.name,
          brandId: pSeed.brandId,
          hsnId: pSeed.hsnId,
          originCountry: pSeed.originCountry,
          description: pSeed.description,
          ingredients: pSeed.ingredients,
          healthBenefits: pSeed.healthBenefits,
          usageInstructions: pSeed.usageInstructions,
          storageInstructions: pSeed.storageInstructions,
          certifications: pSeed.certifications,
          thumbnailImageUrl: pSeed.thumbnailImageUrl,
          imageUrls: pSeed.imageUrls,
          tags: pSeed.tags,
          active: pSeed.active,
          featured: pSeed.featured,
          isFlashDeal: (pSeed as any).isFlashDeal ?? true,
          productStatus: pSeed.productStatus,
          createdById: pSeed.createdById,
          categoryId: pSeed.categoryId,
        },
      });
    }

    if (pSeed.variantToLink) {
      let productVariant = await prisma.productVariant.findFirst({
        where: { productId: product.id, variantId: pSeed.variantToLink.id },
      });
      if (!productVariant) {
        productVariant = await prisma.productVariant.create({
          data: {
            productId: product.id,
            variantId: pSeed.variantToLink.id,
            discountPercentage: pSeed.variantDetails.discountPercentage,
            weightInGrams: pSeed.variantDetails.weightInGrams,
            mfgDate: new Date("2026-01-01T00:00:00Z"),
            expiryDate: new Date("2028-12-31T00:00:00Z"),
            active: true,
          },
        });

        // Seed Price
        await prisma.price.create({
          data: {
            price: pSeed.variantDetails.price,
            discountedPrice: pSeed.variantDetails.discountedPrice,
            productVariantId: productVariant.id,
            active: true,
          },
        });

        // Seed Warehouse Stock
        await prisma.warehouseStock.create({
          data: {
            warehouseId: warehouse.id,
            productVariantId: productVariant.id,
            productCount: 45, // start stock count
          },
        });
      }
    }
  }

  console.log(
    "[Seeder] Successfully seeded mock gadgets, categories, brands, variants, and stock!",
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
