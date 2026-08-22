import env from "@/config/env";
import prisma from "@/config/prisma";
import { getIO } from "@/config/socket";
import {
  Certification,
  Prisma,
  Product,
  ProductCombo,
  ProductVariant,
} from "@/generated/prisma";
import { sendMail } from "@/services/transporter.service";
import ApiError from "@/utils/ApiError";
import isValidObjectId from "@/utils/isValidObjectId";
import calculatePagination, { PaginationOptions } from "@/utils/pagination";
import { getPeriodRange, Period } from "@/utils/vendorStats";
import { status as httpStatus } from "http-status";

const COLLECTION_NAME = "Product"; // check your actual Mongo collection name
const ATLAS_SEARCH_INDEX = "default"; // Atlas Search index name

type VariantPayload =
  Prisma.ProductVariantUncheckedCreateWithoutProductInput & {
    price: number;
  };

type BulkVariantPayload =
  Prisma.ProductVariantUncheckedCreateWithoutProductInput & {
    price: number;
    variantName: string;
  };

/**
 * Helper to build comprehensive multi-field search conditions for products.
 * Searches across name, description, ingredients, healthBenefits, usageInstructions,
 * storageInstructions, tags, attributes, originCountry, brand, category, subcategory, and variants.
 */
const buildProductSearchWhereClause = (searchStr: string): Prisma.ProductWhereInput => {
  const cleanSearch = searchStr.trim();
  if (!cleanSearch) return {};

  const tokens = cleanSearch.split(/\s+/).filter((t) => t.length > 0);

  const buildSingleTokenCondition = (token: string): Prisma.ProductWhereInput => ({
    OR: [
      { name: { contains: token, mode: "insensitive" } },
      { description: { contains: token, mode: "insensitive" } },
      { ingredients: { contains: token, mode: "insensitive" } },
      { healthBenefits: { contains: token, mode: "insensitive" } },
      { usageInstructions: { contains: token, mode: "insensitive" } },
      { storageInstructions: { contains: token, mode: "insensitive" } },
      { originCountry: { contains: token, mode: "insensitive" } },
      { tags: { hasSome: [token] } },
      { attributes: { hasSome: [token] } },
      { brand: { name: { contains: token, mode: "insensitive" } } },
      { category: { name: { contains: token, mode: "insensitive" } } },
      {
        varients: {
          some: {
            variant: {
              OR: [
                { name: { contains: token, mode: "insensitive" } },
                { description: { contains: token, mode: "insensitive" } },
                { subCategory: { name: { contains: token, mode: "insensitive" } } },
                { subCategory: { category: { name: { contains: token, mode: "insensitive" } } } },
              ],
            },
          },
        },
      },
    ],
  });

  if (tokens.length <= 1) {
    return buildSingleTokenCondition(cleanSearch);
  }

  return {
    OR: [
      { AND: tokens.map((token) => buildSingleTokenCondition(token)) },
      buildSingleTokenCondition(cleanSearch),
    ],
  };
};

const createProduct = async (
  data: Prisma.ProductUncheckedCreateInput & {
    varients: (VariantPayload & { variantName?: string })[];
  },
) => {
  const { varients, ...productData } = data;

  if (!productData.brandId || !isValidObjectId(productData.brandId)) {
    let defaultBrand = await prisma.brand.findFirst();
    if (!defaultBrand) {
      defaultBrand = await prisma.brand.create({
        data: { name: "General Brand", description: "Default brand" },
      });
    }
    productData.brandId = defaultBrand.id;
  }

  if (!productData.hsnId || !isValidObjectId(productData.hsnId)) {
    let defaultHsn = await prisma.hsnConfig.findFirst();
    if (!defaultHsn) {
      defaultHsn = await prisma.hsnConfig.create({
        data: { hsnCode: "9999", description: "General HSN", gstRate: 18 },
      });
    }
    productData.hsnId = defaultHsn.id;
  }

  const resolvedVarients = await Promise.all(
    varients.map(async (variant) => {
      const { price: _p, variantName, ...rest } = variant as any;
      let targetVariantId = rest.variantId;

      if (variantName || !targetVariantId) {
        const vName = (variantName || "Standard").trim();
        let matchedVariant = await prisma.variant.findFirst({
          where: { name: { equals: vName, mode: "insensitive" } },
        });

        if (!matchedVariant) {
          let subCat =
            (await prisma.subCategory.findFirst({
              where: { categoryId: productData.categoryId },
            })) || (await prisma.subCategory.findFirst());

          if (!subCat) {
            let cat = await prisma.category.findFirst();
            if (!cat) {
              cat = await prisma.category.create({
                data: {
                  name: "General Category",
                  imageUrl:
                    "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=200",
                },
              });
            }
            subCat = await prisma.subCategory.create({
              data: {
                name: "General SubCategory",
                categoryId: cat.id,
              },
            });
          }

          matchedVariant = await prisma.variant.create({
            data: {
              name: vName,
              description: `${vName} variant option`,
              subCategoryId: subCat.id,
            },
          });
        }
        targetVariantId = matchedVariant.id;
      }

      return {
        ...rest,
        variantId: targetVariantId,
        prices: {
          create: {
            price: variant.price,
            discountedPrice:
              variant.price -
              variant.price * ((variant.discountPercentage ?? 0) / 100),
          },
        },
      };
    }),
  );

  return prisma.product.create({
    data: {
      ...productData,
      varients: {
        create: resolvedVarients,
      },
    },
    include: {
      brand: true,
      hsn: true,
      varients: {
        include: {
          prices: true,
          variant: true,
        },
      },
      createdBy: true,
    },
  });
};

const createManyProducts = async (
  data: (Prisma.ProductCreateInput & {
    varients: BulkVariantPayload[]; // each item has: price, variantName, plus ProductVariant fields (except variantId)
  })[],
) => {
  // run each product creation in its own transaction so a failure in one
  // doesn't roll back all the others
  return Promise.all(
    data.map((newData, _index) =>
      prisma.$transaction(async (tx) => {
        const { varients, ...productData } = newData;

        // 1) Resolve all variant names -> variant records
        const found = await Promise.all(
          varients.map((v) =>
            tx.variant.findUnique({
              where: { name: v.variantName },
              select: {
                id: true,
                name: true,
                subCategory: { select: { categoryId: true } },
              },
            }),
          ),
        );

        // 2) Collect missing variants (by name) and fail if any not found
        const missing: string[] = [];

        found.forEach((rec, i) => {
          if (!rec) missing.push(varients[i].variantName);
        });
        if (missing.length) {
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            `createManyProducts: Unknown variant(s): ${missing.join(", ")}`,
          );
        }

        // 4) Create product with nested variants + prices
        // Strip helper fields (price, variantName) from each variant payload
        const product = await tx.product.create({
          data: {
            ...productData,
            varients: {
              create: varients.map((v, i) => {
                const { price, variantName: _, ...rest } = v;
                return {
                  ...rest, // fields from ProductVariantUncheckedCreateWithoutProductInput EXCLUDING variantId
                  variantId: found[i]!.id,
                  prices: { create: { price } },
                };
              }),
            },
          },
          include: {
            brand: true,
            hsn: true,
            varients: { include: { prices: true } },
          },
        });

        return product;
      }),
    ),
  );
};

const getProductById = async (id: string) => {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      hsn: true,
      brand: true,
      reviews: {
        where: { approved: true },
        include: { createdBy: { include: { user: true } } },
      },
      varients: {
        where: { active: true },
        select: {
          id: true,
          pricePerGram: true,
          weightInGrams: true,
          warehouseStocks: { where: { productCount: { gt: 0 } } },
          discountPercentage: true,
          mfgDate: true,
          expiryDate: true,
          variant: {
            select: {
              id: true,
              name: true,
              subCategory: {
                select: {
                  id: true,
                  name: true,
                  category: { select: { id: true, name: true } },
                },
              },
            },
          },
          prices: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
      combos: {
        where: { active: true },
        select: {
          id: true,
          name: true,
          weightInGrams: true,
          description: true,
          imageUrl: true,
          warehouseStocks: { where: { comboCount: { gt: 0 } } },
          items: {
            select: {
              quantity: true,
              productVariant: {
                select: {
                  variant: { select: { name: true, description: true } },
                },
              },
            },
          },
          prices: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });
  if (!product) throw new ApiError(httpStatus.NOT_FOUND, "Product not found");

  await prisma.product.update({
    where: { id },
    data: { visitCount: { increment: 1 } },
  });

  return {
    ...product,
    varients: product.varients.map((v) => ({
      ...v,
      inStock: !!v.warehouseStocks.length,
      totalStock: v.warehouseStocks.reduce(
        (acc, ws) => acc + (ws.productCount || 0),
        0,
      ),
    })),
    combos: product.combos.map((c) => ({
      ...c,
      inStock: !!c.warehouseStocks.length,
      totalStock: c.warehouseStocks.reduce(
        (acc, ws) => acc + (ws.comboCount || 0),
        0,
      ),
    })),
    subCategory: product.varients[0]?.variant.subCategory,
    category: product.varients[0]?.variant.subCategory.category,
    averageReview:
      product.reviews.reduce((acc, curr) => {
        return acc + curr.rating;
      }, 0) / (product.reviews.length || 1),
    reviewCounts: product.reviews.reduce(
      (acc, curr) => {
        if (acc[`${curr.rating}`]) acc[`${curr.rating}`] += 1;
        else acc[`${curr.rating}`] = 1;

        return acc;
      },
      {} as Record<string, number>,
    ),
  };
};

const getPaginatedProducts = async (
  filters: {
    search?: string;
    categoryId?: string | string[];
    certification?: string | string[];
    inStock?: string;
    discount?: string;
    review?: string;
    arrival?: string;
    minPrice?: string;
    maxPrice?: string;
    featured?: string;
    isFlashDeal?: string;
    createdById?: string;
    productStatus?: string;
    isAdmin?: string;
    active?: string;
    approval?: string;
    getPopular?: string;
    limitedStock?: string;
    fromHomepage?: string;
  } & Partial<Product>,
  options: PaginationOptions,
) => {
  const {
    limit: take,
    skip,
    page,
    sortBy,
    sortOrder,
  } = calculatePagination(options);
  const {
    search,
    categoryId,
    certification,
    review,
    discount,
    arrival,
    minPrice,
    maxPrice,
    featured,
    isFlashDeal,
    isAdmin,
    active,
    approval,
    getPopular,
    inStock,
    limitedStock,
    fromHomepage,
    ...filterData
  } = filters;

  const variantSomeConditions: Prisma.ProductVariantWhereInput[] = [];
  const conditions: Prisma.ProductWhereInput[] = [
    {
      varients: {
        some: { AND: variantSomeConditions },
      },
      ...(isAdmin === "true" ? {} : { productStatus: "ACCEPTED" }),
    },
  ];

  // partial match
  if (search) {
    if (isValidObjectId(search)) {
      conditions.push({ id: search });
    } else {
      let hitIds: string[] = [];
      try {
        const atlasPipeline = [
          {
            $search: {
              index: ATLAS_SEARCH_INDEX,
              compound: {
                should: [
                  // Title exact phrase match (boost 15)
                  {
                    phrase: {
                      query: search,
                      path: "name",
                      score: { boost: { value: 15 } },
                    },
                  },
                  // Title fuzzy text match (boost 10)
                  {
                    text: {
                      query: search,
                      path: "name",
                      fuzzy: { maxEdits: 1, prefixLength: 1, maxExpansions: 50 },
                      score: { boost: { value: 10 } },
                    },
                  },
                  // Tags & attributes (boost 8)
                  {
                    text: {
                      query: search,
                      path: ["tags", "attributes"],
                      score: { boost: { value: 8 } },
                    },
                  },
                  // Brand and Category names (boost 7)
                  {
                    text: {
                      query: search,
                      path: ["brand.name", "category.name"],
                      score: { boost: { value: 7 } },
                    },
                  },
                  // Description (boost 5)
                  {
                    text: {
                      query: search,
                      path: "description",
                      fuzzy: { maxEdits: 1, prefixLength: 1 },
                      score: { boost: { value: 5 } },
                    },
                  },
                  // Technical specs, ingredients, features (boost 3)
                  {
                    text: {
                      query: search,
                      path: ["ingredients", "healthBenefits", "usageInstructions", "storageInstructions"],
                      score: { boost: { value: 3 } },
                    },
                  },
                ],
                minimumShouldMatch: 1,
              },
            },
          },
          { $set: { score: { $meta: "searchScore" } } },
          { $project: { _id: 1, score: 1 } },
          { $sort: { score: -1 } },
        ];

        const raw = (await prisma.$runCommandRaw({
          aggregate: COLLECTION_NAME,
          pipeline: atlasPipeline,
          cursor: {},
        })) as any;

        const hits = raw?.cursor?.firstBatch ?? [];
        hitIds = hits
          .map((h: any) =>
            h._id?.$oid?.toString
              ? h._id.$oid.toString()
              : h._id?.toString
              ? h._id.toString()
              : undefined,
          )
          .filter(Boolean) as string[];
      } catch (e) {
        hitIds = [];
      }

      if (hitIds.length > 0) {
        conditions.push({ id: { in: hitIds } });
      } else {
        // Fall back to tokenized multi-field Prisma database search
        conditions.push(buildProductSearchWhereClause(search));
      }
    }
  }

  if (limitedStock === "true") {
    variantSomeConditions.push({
      warehouseStocks: {
        some: { productCount: { lte: env.app.lowStockThreshold, gt: 0 } },
      },
    });
  }

  if (categoryId) {
    const categoryIds = Array.isArray(categoryId) ? categoryId : [categoryId];

    conditions.push({
      categoryId: { in: categoryIds },
    });
  }
  if (certification) {
    const certifications = Array.isArray(certification)
      ? certification
      : [certification];

    conditions.push({
      certifications: { hasSome: certifications as Certification[] },
    });
  }
  if (inStock === "true") {
    variantSomeConditions.push({
      warehouseStocks: { some: { productCount: { gt: 0 } } },
    });
  } else if (inStock === "false") {
    variantSomeConditions.push({
      warehouseStocks: { some: { productCount: { lte: 0 } } },
    });
  }
  if (review && Number(review)) {
    conditions.push({
      reviews: { some: { rating: { gte: Number(review) } } },
    });
  }
  if (discount && Number(discount) > 0) {
    variantSomeConditions.push({
      discountPercentage: { gte: Number(discount) },
    });
  }
  if (arrival && Number(arrival) > 0) {
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date(
      new Date().getTime() - Number(arrival) * 24 * 60 * 60 * 1000,
    );
    startDate.setHours(0, 0, 0, 0);

    conditions.push({
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    });
  }
  if (minPrice !== undefined || maxPrice !== undefined) {
    const minVal =
      minPrice !== undefined && !isNaN(Number(minPrice))
        ? Number(minPrice)
        : undefined;
    const maxVal =
      maxPrice !== undefined && !isNaN(Number(maxPrice))
        ? Number(maxPrice)
        : undefined;

    if (minVal !== undefined || maxVal !== undefined) {
      const priceFilter: any = {};
      if (minVal !== undefined) priceFilter.gte = minVal;
      if (maxVal !== undefined) priceFilter.lte = maxVal;

      variantSomeConditions.push({
        prices: {
          some: {
            active: true,
            OR: [
              {
                discountedPrice: {
                  gt: 0,
                  ...priceFilter,
                },
              },
              {
                discountedPrice: { lte: 0 },
                price: priceFilter,
              },
            ],
          },
        },
      });
    }
  }
  if (featured) {
    conditions.push({ featured: featured === "true" });
  }

  if (isFlashDeal) {
    conditions.push({ isFlashDeal: isFlashDeal === "true" });
  }

  if (active) {
    if (active === "true") conditions.push({ active: true });
    else if (active === "false") conditions.push({ active: false });
  }

  if (!isAdmin || isAdmin === "false") {
    conditions.push({ active: true });
  }

  if (approval) {
    if (approval === "true") {
      conditions.push({
        productStatus: {
          in: ["PENDING", "REJECTED"], // both statuses
        },
      });
    } else {
      conditions.push({
        productStatus: {
          in: ["ACCEPTED"], // both statuses
        },
      });
    }
  }

  // exact match
  if (Object.keys(filterData).length > 0) {
    conditions.push({
      AND: Object.keys(filterData).map((key) => ({
        [key]: {
          equals: filterData[key as keyof typeof filterData],
        },
      })),
    });
  }

  const whereConditions = conditions.length ? { AND: conditions } : {};

  let prismaOrderBy: any = { createdAt: sortOrder };
  if (getPopular === "true") {
    prismaOrderBy = [{ orderCount: "desc" }, { visitCount: "desc" }];
  } else if (sortBy && sortBy !== "price") {
    const validProductSortFields = [
      "createdAt",
      "name",
      "orderCount",
      "visitCount",
      "active",
      "featured",
      "productStatus",
    ];
    if (validProductSortFields.includes(sortBy)) {
      prismaOrderBy = { [sortBy]: sortOrder };
    }
  }

  const [result, total] = await Promise.all([
    await prisma.product.findMany({
      where: whereConditions,
      orderBy: prismaOrderBy,
      include: {
        hsn: true,
        brand: true,
        // Include analytics only when admin is viewing
        ...(isAdmin === "true"
          ? {
              reviews: {
                select: { id: true, rating: true, approved: true },
              },
            }
          : {}),
        varients: {
          where: isAdmin === "true" ? {} : { active: true },
          select: {
            id: true,
            weightInGrams: true,
            pricePerGram: true,
            active: true,
            warehouseStocks:
              isAdmin === "true"
                ? true
                : { where: { productCount: { gt: 0 } } },
            discountPercentage: true,
            mfgDate: true,
            expiryDate: true,
            variant: {
              select: {
                id: true,
                name: true,
                subCategory: {
                  select: {
                    id: true,
                    name: true,
                    category: { select: { id: true, name: true } },
                  },
                },
              },
            },
            prices: { orderBy: { createdAt: "desc" }, take: 1 },
            // For admin: include order items to count purchases
            ...(isAdmin === "true"
              ? {
                  cartItems: false,
                }
              : {}),
          },
        },
        combos: {
          where: { active: true },
          select: {
            id: true,
            weightInGrams: true,
            name: true,
            description: true,
            imageUrl: true,
            warehouseStocks: { where: { comboCount: { gt: 0 } } },
            items: {
              select: {
                quantity: true,
                productVariant: {
                  select: {
                    variant: { select: { name: true, description: true } },
                  },
                },
              },
            },
            prices: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
        createdBy: {
          select: {
            id: true,
            companyOwnerName: true,
            contactPersonName: true,
            businessName: true,
          },
        },
      },
      skip,
      take,
    }),
    await prisma.product.count({ where: whereConditions }),
  ]);

  // Compute analytics for admin view
  if (isAdmin === "true") {
    // For each product, count return requests against its order items
    const productIds = result.map((p: any) => p.id);
    const returnCounts = await prisma.orderItem.groupBy({
      by: ["priceId"],
      where: {
        refundRequest: { isNot: null },
        price: {
          productVariant: { productId: { in: productIds } },
        },
      },
      _count: { _all: true },
    });

    // Build a map of productId -> returnRequestCount using Price -> ProductVariant -> Product
    const returnCountByProduct: Record<string, number> = {};
    for (const rc of returnCounts) {
      // Fetch the price to get productId
      const price = await prisma.price.findUnique({
        where: { id: rc.priceId },
        select: { productVariant: { select: { productId: true } } },
      });
      const pid = price?.productVariant?.productId;
      if (pid) {
        returnCountByProduct[pid] =
          (returnCountByProduct[pid] || 0) + rc._count._all;
      }
    }

    // Attach computed analytics to each product
    for (const prod of result as any[]) {
      const revs = prod.reviews || [];
      const totalRatings = revs.length;
      const avgRating =
        totalRatings > 0
          ? revs.reduce((s: number, r: any) => s + r.rating, 0) / totalRatings
          : 0;
      prod._analytics = {
        orderCount: prod.orderCount ?? 0,
        visitCount: prod.visitCount ?? 0,
        reviewCount: totalRatings,
        approvedReviewCount: revs.filter((r: any) => r.approved).length,
        avgRating: Math.round(avgRating * 10) / 10,
        returnRequestCount: returnCountByProduct[prod.id] || 0,
        isBestSeller: (prod.orderCount ?? 0) >= 10,
      };
    }
  }

  if (sortBy === "price") {
    result.sort((a: any, b: any) => {
      const getMinPrice = (p: any) => {
        let min = Infinity;
        p.varients?.forEach((v: any) => {
          v.prices?.forEach((pr: any) => {
            const effPrice =
              pr.discountedPrice !== undefined && pr.discountedPrice > 0
                ? pr.discountedPrice
                : pr.price;
            if (effPrice !== undefined && effPrice < min) {
              min = effPrice;
            }
          });
        });
        return min === Infinity ? 0 : min;
      };
      const priceA = getMinPrice(a);
      const priceB = getMinPrice(b);
      return sortOrder === "asc" ? priceA - priceB : priceB - priceA;
    });
  }

  if (limitedStock === "true" && fromHomepage === "true" && result.length < 6) {
    const fillerCount = 6 - result.length;
    const fillerProducts = await prisma.product.findMany({
      take: fillerCount,
      include: {
        hsn: true,
        brand: true,
        reviews: true,
        varients: {
          where: { active: true },
          select: {
            id: true,
            pricePerGram: true,
            weightInGrams: true,
            active: true,
            warehouseStocks: { where: { productCount: { gt: 0 } } },
            discountPercentage: true,
            mfgDate: true,
            expiryDate: true,
            variant: {
              select: {
                id: true,
                name: true,
                subCategory: {
                  select: {
                    id: true,
                    name: true,
                    category: { select: { id: true, name: true } },
                  },
                },
              },
            },
            prices: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
        combos: {
          where: { active: true },
          select: {
            id: true,
            name: true,
            weightInGrams: true,
            description: true,
            imageUrl: true,
            warehouseStocks: { where: { comboCount: { gt: 0 } } },
            items: {
              select: {
                quantity: true,
                productVariant: {
                  select: {
                    variant: { select: { name: true, description: true } },
                  },
                },
              },
            },
            prices: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
        createdBy: {
          select: {
            id: true,
            companyOwnerName: true,
            contactPersonName: true,
            businessName: true,
          },
        },
      },
    });
    result.push(...fillerProducts);
  }

  return {
    meta: { total, page, limit: take },
    data: result.map((p) => ({
      ...p,
      varients: p.varients.map((v) => ({
        ...v,
        inStock: !!v.warehouseStocks.length,
        totalStock: v.warehouseStocks.reduce(
          (acc, ws) => acc + (ws.productCount || 0),
          0,
        ),
      })),
      combos: p.combos.map((c) => ({
        ...c,
        inStock: !!c.warehouseStocks.length,
        totalStock: c.warehouseStocks.reduce(
          (acc, ws) => acc + (ws.comboCount || 0),
          0,
        ),
      })),
    })),
  };
};

const updateProduct = async (id: string, data: Partial<Product>) => {
  const updatedProduct = await prisma.product.update({
    where: { id },
    data,
    include: { brand: true, hsn: true, createdBy: true },
  });

  if (data.productStatus === "ACCEPTED" && updatedProduct.createdBy) {
    await prisma.notification.create({
      data: {
        type: "PRODUCT_ACCEPTED",
        title: `Product ${updatedProduct.name} uploaded successfully.`,
        receiverId: updatedProduct.createdBy.userId,
        productId: updatedProduct.id,
      },
    });
    const io = getIO();
    io.to(updatedProduct.createdBy.userId).emit("notification", {
      id: updatedProduct.id,
    });
  }
  if (data.productStatus === "REJECTED" && updatedProduct.createdBy) {
    await prisma.notification.create({
      data: {
        type: "PRODUCT_REJECTED",
        title: `Product ${updatedProduct.name} rejected: ${updatedProduct.rejectionReason}.`,
        receiverId: updatedProduct.createdBy.userId,
        productId: updatedProduct.id,
      },
    });
    const io = getIO();
    io.to(updatedProduct.createdBy.userId).emit("notification", {
      id: updatedProduct.id,
    });

    await sendMail(
      updatedProduct.createdBy.email,
      `Product Rejected – ${updatedProduct.name}`,
      `Hi ${updatedProduct.createdBy.contactPersonName},<br>Your product <strong>${updatedProduct.name}</strong> was rejected due to: <em>${updatedProduct.rejectionReason}</em>.<br>👉 <a href="https://yourwebsite.com/update-product/${updatedProduct.id}">Update Product</a> - Product Review Team`,
    );
  }

  return updatedProduct;
};

const deleteProduct = async (id: string) => {
  return prisma.product.delete({ where: { id } });
};

const createProductVariant = async (
  payload: Prisma.ProductVariantUncheckedCreateWithoutProductInput & {
    productId: string;
    price: number;
  },
) => {
  const { price, ...data } = payload;

  // return prisma.productVariant.upsert({
  //   where: {
  //     productId_variantId: {
  //       productId: payload.productId,
  //       variantId: payload.variantId,
  //     },
  //   },
  //   update: {
  //     ...data,
  //     active: true,
  //     prices: {
  //       updateMany: {
  //         where: { active: true },
  //         data: { active: false },
  //       },
  //       create: { price },
  //     },
  //   },
  //   create: {
  //     ...data,
  //     prices: { create: { price } },
  //   },
  // });
  return prisma.$transaction(async (tx) => {
    // Step 1: upsert variant + price
    const variant = await tx.productVariant.upsert({
      where: {
        productId_variantId: {
          productId: payload.productId,
          variantId: payload.variantId,
        },
      },
      update: {
        ...data,
        active: true,
        prices: {
          updateMany: {
            where: { active: true },
            data: { active: false },
          },
          create: { price },
        },
      },
      create: {
        ...data,
        prices: { create: { price } },
      },
      include: { prices: true, warehouseStocks: true },
    });

    return variant;
  });
};

const updateProductVariant = async (
  productId: string,
  vairantId: string,
  payload: Partial<ProductVariant> & {
    price?: number;
  },
) => {
  const productVariant = await prisma.productVariant.findUnique({
    where: { productId_variantId: { productId, variantId: vairantId } },
  });
  if (!productVariant)
    throw new ApiError(httpStatus.NOT_FOUND, "Variant not found");
  else
    return prisma.$transaction(async (tx) => {
      const { price, ...data } = payload;
      const effectiveDiscount =
        typeof payload.discountPercentage !== "undefined"
          ? payload.discountPercentage
          : productVariant.discountPercentage;

      // ------------------- Price update -------------------
      if (typeof price !== "undefined") {
        await tx.price.updateMany({
          where: {
            productVariantId: productVariant.id,
            active: true,
          },
          data: { active: false },
        });
        const calcDiscounted = Math.round(
          price * (1 - (effectiveDiscount || 0) / 100),
        );
        await tx.price.create({
          data: {
            productVariantId: productVariant.id,
            price,
            discountedPrice: calcDiscounted,
          },
        });
      } else if (typeof payload.discountPercentage !== "undefined") {
        const prices = await tx.price.findMany({
          where: { productVariantId: productVariant.id, active: true },
        });

        await Promise.all(
          prices.map((p) =>
            tx.price.update({
              where: { id: p.id },
              data: {
                discountedPrice: Math.round(
                  p.price * (1 - (payload.discountPercentage || 0) / 100),
                ),
              },
            }),
          ),
        );
      }

      return tx.productVariant.update({
        where: { productId_variantId: { productId, variantId: vairantId } },
        data,
        include: {
          prices: true, // include all prices (you could filter active if needed)
          warehouseStocks: true, // include stock per warehouse
        },
      });
    });
};

const deleteProductVariant = async (productId: string, variantId: string) => {
  const existingVariants = await prisma.productVariant.findMany({
    where: { productId, active: true },
  });
  const productVariant = await prisma.productVariant.findUnique({
    where: { productId_variantId: { productId, variantId } },
    include: { wishilisted: true, cartItems: true },
  });
  if (productVariant?.wishilisted.length || productVariant?.cartItems.length)
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Cannot delete variant that is in wishlist or cart",
    );

  if (existingVariants!.length <= 1) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Cannot delete the last variant of a product",
    );
  } else
    // Delete variant + related warehouse stocks in a transaction
    return prisma.$transaction(async (tx) => {
      await tx.warehouseStock.deleteMany({
        where: { productVariantId: productVariant!.id },
      });

      return tx.productVariant.delete({
        where: { productId_variantId: { productId, variantId } },
      });
    });
};

const createProductCombo = (
  data: ProductCombo & {
    items: {
      quantity: number;
      productVariantId: string;
    }[];
    price: number;
  },
) => {
  return prisma.$transaction(async (tx) => {
    const { items, price, ...productCombo } = data;

    const productComboData = await tx.productCombo.create({
      data: productCombo,
    });

    await tx.comboItem.createMany({
      data: items.map((item) => ({
        productComboId: productComboData.id,
        ...item,
      })),
    });

    await tx.price.create({
      data: {
        price,
        productComboId: productComboData.id,
        productVariantId: items[0].productVariantId,
      },
    });

    return tx.productCombo.findUnique({
      where: { id: productComboData.id },
      include: { items: true, prices: true },
    });
  });
};

const updateProductCombo = (
  id: string,
  data: Partial<ProductCombo> & {
    items?: {
      quantity: number;
      productVariantId: string;
    }[];
    price?: number;
  },
) => {
  const { items, price, ...productCombo } = data;
  return prisma.$transaction(async (tx) => {
    const productComboData = await tx.productCombo.update({
      where: { id },
      data: productCombo,
      include: { items: true },
    });

    if (items) {
      await tx.comboItem.deleteMany({
        where: { productComboId: productComboData.id },
      });

      await tx.comboItem.createMany({
        data: items!.map((item) => ({
          productComboId: productComboData.id,
          ...item,
        })),
      });
    }

    if (price) {
      await tx.price.updateMany({
        where: { productComboId: productComboData.id },
        data: { active: false },
      });
      await tx.price.create({
        data: {
          price,
          productComboId: productComboData.id,
          productVariantId: data.items
            ? data.items[0].productVariantId
            : productComboData.items[0].id,
        },
      });
    }
    return tx.productCombo.findUnique({
      where: { id: productComboData.id },
      include: { items: true, prices: { where: { active: true } } },
    });
  });
};

const deleteProductCombo = (id: string) => {
  return prisma.productCombo.update({ where: { id }, data: { active: false } });
};

const updateProductStatus = (id: string, status: boolean) => {
  return prisma.product.update({
    where: {
      id,
    },
    data: {
      active: status,
    },
  });
};

/**
 * Product dashboard related service functions
 */
const getProductStats = async (period: Period = "Monthly") => {
  const { start, end, prevStart, prevEnd } = getPeriodRange(period);

  // current totals (restricted to current period)
  const [totalProducts, totalCategories, totalBrands] = await Promise.all([
    prisma.product.count({ where: { createdAt: { gte: start, lte: end } } }),
    prisma.category.count({ where: { createdAt: { gte: start, lte: end } } }),
    prisma.brand.count({ where: { createdAt: { gte: start, lte: end } } }),
  ]);

  // previous period totals
  const [prevProducts, prevCategories, prevBrands] = await Promise.all([
    prisma.product.count({
      where: { createdAt: { gte: prevStart, lte: prevEnd } },
    }),
    prisma.category.count({
      where: { createdAt: { gte: prevStart, lte: prevEnd } },
    }),
    prisma.brand.count({
      where: { createdAt: { gte: prevStart, lte: prevEnd } },
    }),
  ]);

  // percentage change (signed). Return null when prev === 0 to indicate "no previous"
  const pctChange = (curr: number, prev: number) => {
    if (prev === 0) {
      return prev === 0 && curr > 0 ? null : 0;
      // note: returning `null` for prev===0 and curr>0 allows frontend to show "New".
      // If you prefer numeric 100 for that case, return curr > 0 ? 100 : 0;
    }
    return ((curr - prev) / prev) * 100;
  };

  return {
    totalProducts,
    totalCategories,
    totalBrands,
    percentages: {
      products: pctChange(totalProducts, prevProducts),
      categories: pctChange(totalCategories, prevCategories),
      brands: pctChange(totalBrands, prevBrands),
    },
    period,
    periodRange: { start: start.toISOString(), end: end.toISOString() },
    previousPeriodRange: {
      start: prevStart.toISOString(),
      end: prevEnd.toISOString(),
    },
  };
};

/**
 * Top categories by revenue (labels + values)
 */
/**
 * Top categories by revenue (labels + values)
 */
const getTopCategories = async (limit = 5, period: Period = "Weekly") => {
  const { start, end } = getPeriodRange(period);

  const items = await prisma.orderItem.findMany({
    where: {
      order: {
        createdAt: { gte: start, lte: end },
        status: { not: "CANCELLED" },
      },
    },
    select: {
      quantity: true,
      returnedQuantity: true,
      price: {
        select: {
          price: true,
          discountedPrice: true,
          productVariant: {
            select: {
              product: {
                select: {
                  categoryId: true,
                  category: { select: { id: true, name: true } },
                },
              },
            },
          },
          productCombo: {
            select: {
              product: {
                select: {
                  categoryId: true,
                  category: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const revenueByCategory = new Map<
    string,
    { categoryId: string; name: string; revenue: number }
  >();

  for (const it of items) {
    const qty = Math.max(0, Number(it.quantity ?? 0) - Number(it.returnedQuantity ?? 0));
    if (qty <= 0) continue;

    const unitPrice = Number(
      it.price?.discountedPrice && it.price.discountedPrice > 0
        ? it.price.discountedPrice
        : (it.price?.price ?? 0),
    );
    const category =
      it.price?.productVariant?.product?.category ||
      it.price?.productCombo?.product?.category;
    const catId = category?.id ?? "unknown";
    const revenue = unitPrice * qty;

    const existing = revenueByCategory.get(catId);
    if (existing) existing.revenue += revenue;
    else
      revenueByCategory.set(catId, {
        categoryId: catId,
        name: category?.name ?? "Other",
        revenue,
      });
  }

  const arr = Array.from(revenueByCategory.values()).sort(
    (a, b) => b.revenue - a.revenue,
  );
  const top = arr.slice(0, limit);

  return {
    labels: top.map((t) => t.name),
    values: top.map((t) => t.revenue),
    raw: top,
  };
};

/**
 * Top products by revenue
 */
const getTopProducts = async (limit = 5, period: Period = "Weekly") => {
  const { start, end } = getPeriodRange(period);

  const items = await prisma.orderItem.findMany({
    where: {
      order: {
        createdAt: { gte: start, lte: end },
        status: { not: "CANCELLED" },
      },
    },
    select: {
      quantity: true,
      returnedQuantity: true,
      price: {
        select: {
          price: true,
          discountedPrice: true,
          productVariant: {
            select: {
              product: {
                select: {
                  id: true,
                  name: true,
                  thumbnailImageUrl: true,
                },
              },
            },
          },
          productCombo: {
            select: {
              product: {
                select: {
                  id: true,
                  name: true,
                  thumbnailImageUrl: true,
                },
              },
            },
          },
        },
      },
    },
  });

  // aggregate by product id
  const revenueByProduct = new Map<
    string,
    {
      productId: string;
      productName?: string | null;
      revenue: number;
      quantity: number;
      thumbnail?: string | null;
    }
  >();

  for (const it of items) {
    const qty = Math.max(0, Number(it.quantity ?? 0) - Number(it.returnedQuantity ?? 0));
    if (qty <= 0) continue;

    const unitPrice = Number(
      it.price?.discountedPrice && it.price.discountedPrice > 0
        ? it.price.discountedPrice
        : (it.price?.price ?? 0),
    );
    const product =
      it.price?.productVariant?.product || it.price?.productCombo?.product;
    const pid = product?.id ?? "unknown";
    const revenue = unitPrice * qty;

    const existing = revenueByProduct.get(pid);
    if (existing) {
      existing.revenue += revenue;
      existing.quantity += qty;
    } else {
      revenueByProduct.set(pid, {
        productId: pid,
        productName: product?.name ?? null,
        revenue,
        quantity: qty,
        thumbnail: product?.thumbnailImageUrl ?? null,
      });
    }
  }

  const arr = Array.from(revenueByProduct.values()).sort(
    (a, b) => b.revenue - a.revenue,
  );
  const top = arr.slice(0, limit);

  return {
    labels: top.map((t) => t.productName ?? "Unknown"),
    values: top.map((t) => t.revenue),
    raw: top,
  };
};

/**
 * Low-stock products:
 * Calculates combined warehouse stock across all variants & combos for every product.
 * Returns products with total stock below threshold.
 *
 * threshold default: 10
 */
const getLowStockProducts = async (threshold = 10) => {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      thumbnailImageUrl: true,
      varients: {
        select: {
          warehouseStocks: {
            select: { productCount: true },
          },
        },
      },
      combos: {
        select: {
          warehouseStocks: {
            select: { comboCount: true },
          },
        },
      },
    },
  });

  const lowStockItems = [];

  for (const p of products) {
    let totalVariantStock = 0;
    for (const v of p.varients) {
      for (const ws of v.warehouseStocks) {
        totalVariantStock += ws.productCount || 0;
      }
    }

    let totalComboStock = 0;
    for (const c of p.combos) {
      for (const cs of c.warehouseStocks) {
        totalComboStock += cs.comboCount || 0;
      }
    }

    const totalStock = totalVariantStock + totalComboStock;
    if (totalStock < threshold) {
      lowStockItems.push({
        productId: p.id,
        name: p.name,
        thumbnail: p.thumbnailImageUrl || null,
        totalStock,
        threshold,
      });
    }
  }

  lowStockItems.sort((a, b) => a.totalStock - b.totalStock);

  return {
    count: lowStockItems.length,
    items: lowStockItems,
  };
};

const getSearchSuggestions = async (search: string) => {
  if (!search || !search.trim()) return [];
  const cleanSearch = search.trim();

  // Search Products, Categories, and Brands in parallel for rich auto-complete suggestions
  const [products, categories, brands] = await Promise.all([
    prisma.product.findMany({
      where: {
        active: true,
        productStatus: "ACCEPTED",
        ...buildProductSearchWhereClause(cleanSearch),
      },
      select: {
        id: true,
        name: true,
        thumbnailImageUrl: true,
        categoryId: true,
        category: { select: { name: true } },
        brand: { select: { name: true } },
        varients: {
          where: { active: true },
          select: { prices: { where: { active: true }, orderBy: { createdAt: "desc" }, take: 1 } },
          take: 1,
        },
      },
      take: 6,
    }),
    prisma.category.findMany({
      where: {
        name: { contains: cleanSearch, mode: "insensitive" },
      },
      select: { id: true, name: true, imageUrl: true },
      take: 3,
    }),
    prisma.brand.findMany({
      where: {
        active: true,
        name: { contains: cleanSearch, mode: "insensitive" },
      },
      select: { id: true, name: true, imageUrl: true },
      take: 3,
    }),
  ]);

  const productSuggestions = products.map((p) => ({
    id: p.id,
    name: p.name,
    thumbnailImageUrl: p.thumbnailImageUrl || "",
    categoryId: p.categoryId || "",
    categoryName: p.category?.name || "",
    brandName: p.brand?.name || "",
    price: p.varients[0]?.prices[0]?.discountedPrice || p.varients[0]?.prices[0]?.price || 0,
    type: "product" as const,
  }));

  const categorySuggestions = categories.map((c) => ({
    id: c.id,
    name: c.name,
    thumbnailImageUrl: c.imageUrl || "",
    type: "category" as const,
  }));

  const brandSuggestions = brands.map((b) => ({
    id: b.id,
    name: b.name,
    thumbnailImageUrl: b.imageUrl || "",
    type: "brand" as const,
  }));

  return [
    ...productSuggestions,
    ...categorySuggestions,
    ...brandSuggestions,
  ];
};

const productService = {
  createProduct,
  createManyProducts,
  getProductById,
  getPaginatedProducts,

  updateProduct,
  updateProductStatus,
  deleteProduct,

  // Product Variants
  deleteProductVariant,
  updateProductVariant,
  createProductVariant,

  // Product Combo
  createProductCombo,
  updateProductCombo,
  deleteProductCombo,

  // stats
  getProductStats,
  getLowStockProducts,
  getTopProducts,
  getTopCategories,

  getSearchSuggestions,
};
export default productService;
