import shipwayService from "@/services/shipway/shipway.service";
import ApiError from "@/utils/ApiError";
import catchAsync from "@/utils/catchAsync";
import { Request, Response } from "express";
import { status as httpStatus } from "http-status";
import prisma from "@/config/prisma";
import pick from "@/utils/pick";
import warehouseService from "./warehouse.service";

const createWarehouse = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;
  // 1. Build Shipway payload
  const shipwayPayload = {
    title: payload.title,
    company: payload.company,
    contact_person_name: payload.contactPersonName ?? "",
    email: payload.email ?? "",
    phone: payload.phone ?? "",
    phone_print: payload.phonePrint ?? "",
    address_1: payload.address1 ?? "",
    address_2: payload.address2 ?? "",
    city: payload.city ?? "",
    state: payload.state ?? "",
    country: payload.country ?? "IN",
    pincode: payload.pincode ?? "",
    longitude: payload.longitude ?? "",
    latitude: payload.latitude ?? "",
    gst_no: payload.gstNo ?? "",
    fssai_code: payload.fssaiCode ?? "",
  };

  // 2. Call Shipway first
  const shipRes = await shipwayService.createWarehouseOnShipway(shipwayPayload);
  if (!shipRes.success || !shipRes.shipwayWarehouseId) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Shipway warehouse creation failed: ${shipRes.error || "Unknown error"}`,
    );
  }
  const existingWarehouse = await prisma.warehouse.findFirst({
    where: {
      shipwayWarehouseId: shipRes?.shipwayWarehouseId,
    },
  });
  if (existingWarehouse)
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Similar warehouse already exists",
    );
  const response = await warehouseService.createWarehouse({
    ...req.body,
    shipwayWarehouseId: shipRes.shipwayWarehouseId,
  });

  res.status(httpStatus.CREATED).json({
    success: true,
    message: "Warehouse created successfully",
    data: response,
  });
});

const updateWarehouse = catchAsync(async (req: Request, res: Response) => {
  const { warehouseId } = req.params;
  const response = await warehouseService.updateWarehouse(
    warehouseId,
    req.body,
  );

  res.status(httpStatus.OK).json({
    success: true,
    message: "Warehouse updated successfully",
    data: response,
  });
});

const deleteWarehouse = catchAsync(async (req: Request, res: Response) => {
  const { warehouseId } = req.params;
  const response = await warehouseService.deleteWarehouse(warehouseId);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Warehouse deleted successfully",
    data: response,
  });
});

const getWarehouseById = catchAsync(async (req: Request, res: Response) => {
  const { warehouseId } = req.params;
  const response = await warehouseService.getWarehouseById(warehouseId);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Warehouse fetched successfully",
    data: response,
  });
});

const getPaginatedWarehouses = catchAsync(
  async (req: Request, res: Response) => {
    const filters = pick(req.query, ["search", "vendorId"]);
    const options = pick(req.query, ["sort_by", "sort_order", "limit", "page"]);

    const response = await warehouseService.getPaginatedWarehouses(
      filters,
      options,
    );

    res.status(httpStatus.OK).json({
      success: true,
      message: "Warehouses fetched successfully",
      data: response,
    });
  },
);

const warehouseController = {
  getPaginatedWarehouses,
  getWarehouseById,
  deleteWarehouse,
  updateWarehouse,
  createWarehouse,
};

export default warehouseController;
