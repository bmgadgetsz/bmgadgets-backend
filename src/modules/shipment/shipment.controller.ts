// src/modules/shipment/shipment.controller.ts
import prisma from "@/config/prisma";
import { Prisma } from "@/generated/prisma";
import catchAsync from "@/utils/catchAsync";
import ApiError from "@/utils/ApiError";
import { status as httpStatus } from "http-status";
import pick from "@/utils/pick";
import shipmentService from "./shipment.service";

const getPaginatedShipmentsHandler = catchAsync(async (req, res) => {
  const filters = pick(req.query, [
    "search",
    "status",
    "vendorId",
    "isReturn",
    "createdAtFrom",
    "createdAtTo",
    "orderId",
    "awb",
    "orderItemId",
    "isException",
  ]);
  const options = pick(req.query, ["sort_by", "sort_order", "limit", "page"]);

  const result = await shipmentService.getPaginatedShipments(filters, options);
  res.status(httpStatus.OK).json({
    success: true,
    message: "Shipments fetched successfully",
    data: result,
  });
});

const getShipmentByIdHandler = catchAsync(async (req, res) => {
  const { id } = req.params;
  const item = await shipmentService.getShipmentById(id);
  if (!item) throw new ApiError(httpStatus.NOT_FOUND, "Shipment not found");
  res.status(httpStatus.OK).json({
    success: true,
    message: "Shipment fetched successfully",
    data: item,
  });
});

const getShipmentsByOrderIdHandler = catchAsync(async (req, res) => {
  const { orderId } = req.params;
  const list = await shipmentService.getShipmentsByOrderId(orderId);
  res.status(httpStatus.OK).json({
    success: true,
    message: "Shipments for order fetched successfully",
    data: list,
  });
});

const updateShipmentHandler = catchAsync(async (req, res) => {
  const { id } = req.params;
  const payload = req.body;
  // optional: fetch to confirm existence
  const existing = await shipmentService.getShipmentById(id);
  if (!existing) throw new ApiError(httpStatus.NOT_FOUND, "Shipment not found");

  const updated = await shipmentService.updateShipment(
    id,
    payload as Partial<Prisma.ShipmentUpdateInput>,
  );
  res.status(httpStatus.OK).json({
    success: true,
    message: "Shipment updated successfully",
    data: updated,
  });
});

const deleteShipmentHandler = catchAsync(async (req, res) => {
  const { id } = req.params;
  const existing = await shipmentService.getShipmentById(id);
  if (!existing) throw new ApiError(httpStatus.NOT_FOUND, "Shipment not found");
  await shipmentService.deleteShipment(id);
  res.status(httpStatus.OK).json({
    success: true,
    message: "Shipment deleted successfully",
  });
});

const getReturnShipmentsHandler = catchAsync(async (req, res) => {
  const filters = pick(req.query, [
    "search",
    "status",
    "vendorId",
    "createdAtFrom",
    "createdAtTo",
  ]);
  const options = pick(req.query, ["sort_by", "sort_order", "limit", "page"]);
  const result = await shipmentService.getReturnShipments(filters, options);
  res.status(httpStatus.OK).json({
    success: true,
    message: "Return shipments fetched successfully",
    data: result,
  });
});

const getShipmentStats = catchAsync(async (req, res) => {
  const stats = await shipmentService.shipmentStats();
  res.status(httpStatus.OK).json({
    success: true,
    message: "Shipment stats fetched successfully",
    data: stats,
  });
});

const shipmentController = {
  getPaginatedShipmentsHandler,
  getShipmentByIdHandler,
  getShipmentsByOrderIdHandler,
  updateShipmentHandler,
  deleteShipmentHandler,
  getReturnShipmentsHandler,
  getShipmentStats,
};

export default shipmentController;
