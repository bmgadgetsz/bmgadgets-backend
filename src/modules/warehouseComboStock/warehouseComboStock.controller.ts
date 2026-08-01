import catchAsync from "@/utils/catchAsync";
import { Request, Response } from "express";
import { status as httpStatus } from "http-status";
import pick from "@/utils/pick";
import { PrismaClientKnownRequestError } from "@/generated/prisma/runtime/library";
import ApiError from "@/utils/ApiError";
import warehouseComboStockService from "./warehouseComboStock.service";

const getPaginatedWarehouseComboStocks = catchAsync(
  async (req: Request, res: Response) => {
    const filters = pick(req.query, ["search", "productComboId"]);
    const options = pick(req.query, ["sort_by", "sort_order", "limit", "page"]);

    const updated = await warehouseComboStockService.getPaginatedComboStock(
      filters,
      options,
    );

    res.status(httpStatus.OK).json({
      success: true,
      message: "Combo stocks fetch successfully",
      data: updated,
    });
  },
);

const createStock = catchAsync(async (req: Request, res: Response) => {
  const data = req.body; // absolute value

  let response;

  try {
    response = await warehouseComboStockService.createStock(data);
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "An sku already exists for this product combo and wareshouse stock. Please update the existing sku instead of creating a duplicate",
      );
    }
    throw e;
  }

  res.status(httpStatus.OK).json({
    success: true,
    message: "Combo stock created successfully",
    data: response,
  });
});

const updateStock = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = req.body; // absolute value

  const updated = await warehouseComboStockService.updateStock(id, data);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Combo stock updated successfully",
    data: updated,
  });
});

const deleteStock = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updated = await warehouseComboStockService.deleteStock(id);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Combo stocks deleted successfully",
    data: updated,
  });
});

const warehouseComboStockController = {
  createStock,
  updateStock,
  getPaginatedWarehouseComboStocks,
  deleteStock,
};

export default warehouseComboStockController;
