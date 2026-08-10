import catchAsync from "@/utils/catchAsync";
import pick from "@/utils/pick";
import { status as httpStatus } from "http-status";
import { PrismaClientKnownRequestError } from "@/generated/prisma/runtime/library";
import ApiError from "@/utils/ApiError";
import { Product, Role, User, VendorProfile } from "@/generated/prisma";
import prisma from "@/config/prisma";
import { Period } from "@/utils/vendorStats";
import { getIO } from "@/config/socket";
import redis from "@/config/redis";
import { parseProductLink } from "@/utils/productLinkParser";
import productService from "./product.service";

const createProduct = catchAsync(async (req, res, next) => {
  const data = req.body;
  const currentUser = res.locals.currentUser as User & { role: Role };

  let response: (Product & { createdBy: VendorProfile }) | undefined;
  try {
    if (!data?.createdById) {
      data.productStatus = "ACCEPTED";
      const originoVendor = await prisma?.vendorProfile.findFirst({
        where: {
          isOriginO: true,
        },
      });
      if (originoVendor) {
        data.createdById = originoVendor?.id;
      }
    } else {
      if (currentUser?.role?.isAdmin) {
        data.productStatus = "ACCEPTED";
      }
      data.active = false;
    }
    response = (await productService.createProduct(data)) as Product & {
      createdBy: VendorProfile;
    };
    if (currentUser.role.isVendor) {
      const employeesToBeNotified = await prisma.user.findMany({
        where: {
          OR: [
            { role: { isAdmin: true } },
            {
              role: {
                permissions: {
                  some: {
                    resource: "ORDER_MANAGEMENT",
                    access: { hasSome: ["WRITE", "DELETE"] },
                  },
                },
              },
            },
          ],
        },
      });
      await prisma.notification.createMany({
        data: employeesToBeNotified.map((e) => ({
          type: "VENDOR_PRODUCT_UPLOADED",
          title: `Vendor ${response?.createdBy.businessName} uploaded products pending approval.`,
          receiverId: e.id,
          productId: response?.id,
        })),
      });
      const io = getIO();
      employeesToBeNotified.forEach((vh) => {
        io.to(vh.id).emit("notification", {
          id: response?.id,
        });
      });
    }
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Same variants cannot appear multiple times in a product",
      );
    else next(error);
  }

  res.status(httpStatus.CREATED).json({
    success: true,
    message: "Product created successfully",
    data: response,
  });
});

const createManyProducts = catchAsync(async (req, res, next) => {
  const data = req.body;

  let response;
  try {
    response = await productService.createManyProducts(data);
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Same variants cannot appear multiple times in a product",
      );
    else next(error);
  }

  res.status(httpStatus.CREATED).json({
    success: true,
    message: "Products created successfully",
    data: response,
  });
});

const getProductById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const response = await productService.getProductById(id);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Product fetched successfully",
    data: response,
  });
});

const getPaginatedProducts = catchAsync(async (req, res) => {
  const filters: any = pick(req.query, [
    "search",
    "categoryId",
    "certification",
    "inStock",
    "review",
    "discount",
    "arrival",
    "minPrice",
    "maxPrice",
    "featured",
    "createdById",
    "productStatus",
    "isAdmin",
    "active",
    "approval",
    "getPopular",
    "limitedStock",
    "fromHomepage",
  ]);

  // Support query parameter aliases for price filters
  const minPrice = req.query.minPrice || req.query.min_price || req.query.min;
  const maxPrice = req.query.maxPrice || req.query.max_price || req.query.max;
  if (minPrice) filters.minPrice = String(minPrice);
  if (maxPrice) filters.maxPrice = String(maxPrice);

  const options = pick(req.query, ["sort_by", "sort_order", "limit", "page"]);

  const response = await productService.getPaginatedProducts(filters, options);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Products fetched successfully",
    data: response,
  });
});

const updateProduct = catchAsync(async (req, res) => {
  const { id } = req.params;
  const data = { ...(req.body as any) }; // shallow copy so we can mutate

  const currentUser = res.locals.currentUser as User & {
    role: Role;
    vendorProfile?: VendorProfile;
  };

  const product = await productService.getProductById(id);
  if (!product) {
    throw new ApiError(httpStatus.NOT_FOUND, "Product not found");
  }

  // Authorization: admin can update any product, vendor only their own
  if (
    !currentUser?.role?.isAdmin &&
    currentUser?.vendorProfile?.id !== product?.createdById
  ) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You are not authorised to update this product.",
    );
  }

  // Vendors: any edit they make should set productStatus -> PENDING (cannot self-approve)
  if (currentUser?.role?.isVendor) {
    data.productStatus = "PENDING";
    data.active = false;
    // NOTE: do not forcibly set data.active = false here because vendor may be trying to toggle active;
    // we will validate attempts to set active=true below.
  }

  // If productStatus is set to ACCEPTED without specifying active status, keep current active state
  if (
    data?.productStatus === "ACCEPTED" &&
    typeof data.active === "undefined"
  ) {
    // leave active untouched
  }

  // Helper: if the request is trying to set active=true, validate stock availability
  const isTryingToActivate =
    typeof data.active !== "undefined" && data.active === true;

  if (isTryingToActivate) {
    // gather variant ids and combo ids for the product
    const variantRecords = await prisma.productVariant.findMany({
      where: { productId: id },
      select: { id: true },
    });
    const variantIds = variantRecords.map((v) => v.id);

    const comboRecords = await prisma.productCombo.findMany({
      where: { productId: id },
      select: { id: true },
    });
    const comboIds = comboRecords.map((c) => c.id);

    // sum variant stocks
    let variantStockSum = 0;
    if (variantIds.length > 0) {
      const variantAgg = await prisma.warehouseStock.aggregate({
        _sum: { productCount: true },
        where: { productVariantId: { in: variantIds } },
      });
      variantStockSum = variantAgg._sum.productCount ?? 0;
    }

    // sum combo stocks
    let comboStockSum = 0;
    if (comboIds.length > 0) {
      const comboAgg = await prisma.warehouseComboStock.aggregate({
        _sum: { comboCount: true },
        where: { productComboId: { in: comboIds } },
      });
      comboStockSum = comboAgg._sum.comboCount ?? 0;
    }

    const totalStock = (variantStockSum ?? 0) + (comboStockSum ?? 0);
    if (totalStock <= 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Cannot activate product: no stock available in any warehouse.",
      );
    }
  }

  const response = await productService.updateProduct(id, data);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Product updated successfully",
    data: response,
  });
});

const deleteProduct = catchAsync(async (req, res) => {
  const { id } = req.params;
  const currentUser = res.locals.currentUser as User & { role: Role };
  const product = await productService.getProductById(id);

  if (!currentUser?.role?.isAdmin && currentUser?.id !== product?.createdById) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You are not authorised to delete this product.",
    );
  }

  let response;
  try {
    response = await productService.deleteProduct(id);
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Product cannot be deleted as it is associated with other resources",
      );
    throw error;
  }

  res.status(httpStatus.OK).json({
    success: true,
    message: "Product deleted successfully",
    data: response,
  });
});

const updateProductVariant = catchAsync(async (req, res) => {
  const { productId, variantId } = req.params;
  const data = req.body;

  const response = await productService.updateProductVariant(
    productId,
    variantId,
    data,
  );

  res.status(httpStatus.OK).json({
    success: true,
    message: "Product variant update successfully",
    data: response,
  });
});

const deleteProductVariant = catchAsync(async (req, res) => {
  const { productId, variantId } = req.params;

  const response = await productService.deleteProductVariant(
    productId,
    variantId,
  );

  res.status(httpStatus.OK).json({
    success: true,
    message: "Product variant delete successfully",
    data: response,
  });
});

const createProductVariant = catchAsync(async (req, res) => {
  const { productId } = req.params;
  const data = req.body;

  let response;
  try {
    response = await productService.createProductVariant({
      productId,
      ...data,
    });
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Same variants cannot appear multiple times in a product",
      );
    else throw error;
  }

  res.status(httpStatus.OK).json({
    success: true,
    message: "Product variant created successfully",
    data: response,
  });
});

const createProductCombo = catchAsync(async (req, res) => {
  const { productId } = req.params;
  const data = req.body;

  const response = await productService.createProductCombo({
    ...data,
    productId,
  });

  res.status(httpStatus.CREATED).json({
    success: true,
    message: "Product combo created successfully",
    data: response,
  });
});

const updateProductCombo = catchAsync(async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  const response = await productService.updateProductCombo(id, data);

  res.status(httpStatus.CREATED).json({
    success: true,
    message: "Product combo updated successfully",
    data: response,
  });
});

const deleteProductCombo = catchAsync(async (req, res) => {
  const { id } = req.params;

  const response = await productService.deleteProductCombo(id);

  res.status(httpStatus.CREATED).json({
    success: true,
    message: "Product combo deleted successfully",
    data: response,
  });
});

const updateProductStatus = catchAsync(async (req, res) => {
  const { status } = req.body;
  const { productId } = req.params;
  const response = await productService.updateProductStatus(productId, status);

  // Helper: if the request is trying to set active=true, validate stock availability
  const isTryingToActivate = typeof status !== "undefined" && status === true;

  if (isTryingToActivate) {
    // gather variant ids and combo ids for the product
    const variantRecords = await prisma.productVariant.findMany({
      where: { productId },
      select: { id: true },
    });
    const variantIds = variantRecords.map((v) => v.id);

    const comboRecords = await prisma.productCombo.findMany({
      where: { productId },
      select: { id: true },
    });
    const comboIds = comboRecords.map((c) => c.id);

    // sum variant stocks
    let variantStockSum = 0;
    if (variantIds.length > 0) {
      const variantAgg = await prisma.warehouseStock.aggregate({
        _sum: { productCount: true },
        where: { productVariantId: { in: variantIds } },
      });
      variantStockSum = variantAgg._sum.productCount ?? 0;
    }

    // sum combo stocks
    let comboStockSum = 0;
    if (comboIds.length > 0) {
      const comboAgg = await prisma.warehouseComboStock.aggregate({
        _sum: { comboCount: true },
        where: { productComboId: { in: comboIds } },
      });
      comboStockSum = comboAgg._sum.comboCount ?? 0;
    }

    const totalStock = (variantStockSum ?? 0) + (comboStockSum ?? 0);
    if (totalStock <= 0) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Cannot activate product: no stock available in any warehouse.",
      );
    }

    // else: stock exists -> allow activation (data.active === true already)
  }

  res.status(httpStatus.CREATED).json({
    success: true,
    message: "Product status changed successfully",
    data: response,
  });
});

const getProductStatsHandler = catchAsync(async (req, res) => {
  const { period = "Weekly" } = req.query; // default to Weekly if not provided
  const data = await productService.getProductStats(period as Period);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Product stats fetched successfully",
    data,
  });
});
const getTopCategoriesHandler = catchAsync(async (req, res) => {
  const limit = Number(req.query.limit ?? 5);
  const period = (req.query.period as any) ?? "Weekly";
  const data = await productService.getTopCategories(limit, period);
  res.status(httpStatus.OK).json({
    success: true,
    message: "Top categories fetched successfully",
    data,
  });
});

const getTopProductsHandler = catchAsync(async (req, res) => {
  const limit = Number(req.query.limit ?? 5);
  const period = (req.query.period as any) ?? "Weekly";
  const data = await productService.getTopProducts(limit, period);
  res.status(httpStatus.OK).json({
    success: true,
    message: "Top products fetched successfully",
    data,
  });
});

const getLowStockHandler = catchAsync(async (req, res) => {
  const threshold = Number(req.query.threshold ?? 10);
  const data = await productService.getLowStockProducts(threshold);
  res.status(httpStatus.OK).json({
    success: true,
    message: "Low stock products fetched successfully",
    data,
  });
});

const getSearchSuggestions = catchAsync(async (req, res) => {
  const { search } = req.query;
  if (!search || typeof search !== "string" || search.trim() === "")
    res.status(httpStatus.OK).json({
      success: true,
      message: "Search suggestions fetched successfully",
      data: [],
    });

  let response;
  const cachedResponse = await redis.get(`search_suggestions:${search}`);
  if (cachedResponse) response = JSON.parse(cachedResponse);
  else {
    response = await productService.getSearchSuggestions(search as string);
    await redis.set(
      `search_suggestions:${search}`,
      JSON.stringify(response),
      "EX",
      1800,
    );
  }

  res.status(httpStatus.OK).json({
    success: true,
    message: "Search suggestions fetched successfully",
    data: response,
  });
});

const parseProductLinkHandler = catchAsync(async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== "string" || !url.startsWith("http")) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Please provide a valid product URL",
    );
  }

  const productData = await parseProductLink(url);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Product details pre-filled successfully",
    data: productData,
  });
});

const productController = {
  createProduct,
  createManyProducts,
  getProductById,
  getPaginatedProducts,
  updateProduct,
  deleteProduct,
  updateProductStatus,
  parseProductLinkHandler,

  updateProductVariant,
  deleteProductVariant,
  createProductVariant,

  // Product Combo
  createProductCombo,
  updateProductCombo,
  deleteProductCombo,

  // stats
  getProductStatsHandler,
  getLowStockHandler,
  getTopProductsHandler,
  getTopCategoriesHandler,

  getSearchSuggestions,
};
export default productController;
