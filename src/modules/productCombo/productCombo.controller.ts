import catchAsync from "@/utils/catchAsync";
import pick from "@/utils/pick";
import { status as httpStatus } from "http-status";
import { PrismaClientKnownRequestError } from "@/generated/prisma/runtime/library";
import ApiError from "@/utils/ApiError";
import productComboService from "./productCombo.service";

const createProductCombo = catchAsync(async (req, res) => {
  const data = req.body;

  const response = await productComboService.createProductCombo(data);

  res.status(httpStatus.CREATED).json({
    success: true,
    message: "ProductCombo created successfully",
    data: response,
  });
});

const getProductComboById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const response = await productComboService.getProductComboById(id);

  res.status(httpStatus.OK).json({
    success: true,
    message: "ProductCombo fetched successfully",
    data: response,
  });
});

const getPaginatedProductCombos = catchAsync(async (req, res) => {
  const filters = pick(req.query, ["search", "vendorId", "isAdmin", "active"]);
  const options = pick(req.query, ["sort_by", "sort_order", "limit", "page"]);

  const response = await productComboService.getPaginatedProductCombos(
    filters,
    options,
  );

  res.status(httpStatus.OK).json({
    success: true,
    message: "ProductCombos fetched successfully",
    data: response,
  });
});

const updateProductCombo = catchAsync(async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  const response = await productComboService.updateProductCombo(id, data);

  res.status(httpStatus.OK).json({
    success: true,
    message: "ProductCombo updated successfully",
    data: response,
  });
});

const deleteProductCombo = catchAsync(async (req, res) => {
  const { id } = req.params;
  const response = await productComboService.deleteProductCombo(id);

  res.status(httpStatus.OK).json({
    success: true,
    message: "ProductCombo deleted successfully",
    data: response,
  });
});

const productComboController = {
  createProductCombo,
  getProductComboById,
  getPaginatedProductCombos,
  updateProductCombo,
  deleteProductCombo,
};
export default productComboController;
