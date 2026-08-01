import catchAsync from "@/utils/catchAsync";
import { Request, Response } from "express";
import { status as httpStatus } from "http-status";
import warehouseStockService from "./warehouseStock.service";
import pick from "@/utils/pick";
import { PrismaClientKnownRequestError } from "@/generated/prisma/runtime/library";
import ApiError from "@/utils/ApiError";

const getPaginatedWarehouseVariantStock = catchAsync(
  async (req: Request, res: Response) => {
    const filters = pick(req.query, ["search", "productVariantId"]);
    const options = pick(req.query, ["sort_by", "sort_order", "limit", "page"]);

    const stocks = await warehouseStockService.getPaginatedVariantStock(
      filters,
      options,
    );

    res.status(httpStatus.OK).json({
      success: true,
      message: "Warehouse Stock fetched successfully",
      data: stocks,
    });
  },
);

const createStock = catchAsync(async (req: Request, res: Response) => {
  const data = req.body;
  let updated;
  try {
    updated = await warehouseStockService.createStock(data);
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "An sku already exists for this product variant and warehouse stock. Please update the existing sku instead of creating a duplicate",
      );
    }
    throw e;
  }

  res.status(httpStatus.OK).json({
    success: true,
    message: "Warehouse stock created successfully",
    data: updated,
  });
});

const updateStock = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = req.body;

  const updated = await warehouseStockService.updateStock(id, data);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Warehouse stock updated successfully",
    data: updated,
  });
});

const deleteStock = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const stocks = await warehouseStockService.deleteVariantStock(id);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Variant Stock deleted successfully",
    data: stocks,
  });
});

const warehouseStockController = {
  // getStock,
  createStock,
  updateStock,
  deleteStock,
  // adjustStock,
  getPaginatedWarehouseVariantStock,
};

export default warehouseStockController;
