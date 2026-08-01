import catchAsync from "@/utils/catchAsync";
import pick from "@/utils/pick";
import { status as httpStatus } from "http-status";
import prisma from "@/config/prisma";
import ApiError from "@/utils/ApiError";
import { PrismaClientKnownRequestError } from "@/generated/prisma/runtime/library";
import roleService from "./role.service";

const createRole = catchAsync(async (req, res) => {
  const data = req.body;

  // there should be only one customer role
  if (data.isCustomer) {
    const existing = await prisma.role.findFirst({
      where: { isCustomer: true },
    });

    if (existing)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Customer role already exists. Only one customer role is allowed.",
      );
  }
  // there should be only one vendor role
  if (data.isCustomer) {
    const existing = await prisma.role.findFirst({
      where: { isVendor: true },
    });

    if (existing)
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Vendor role already exists. Only one vendor role is allowed.",
      );
  }

  try {
    const response = await roleService.createRole(data);

    res.status(httpStatus.CREATED).json({
      success: true,
      message: "Role created successfully",
      data: response,
    });
  } catch (error) {
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Role with this name already exists",
      );
    throw error;
  }
});

const getRoleById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const response = await roleService.getRoleById(id);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Role fetched successfully",
    data: response,
  });
});

const getPaginatedRoles = catchAsync(async (req, res) => {
  const filters = pick(req.query, ["search", "get_all", "role", "employee"]);
  const options = pick(req.query, ["sort_by", "sort_order", "limit", "page"]);
  const response = await roleService.getPaginatedRoles(filters, options);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Roles fetched successfully",
    data: response,
  });
});

const updateRole = catchAsync(async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  const response = await roleService.updateRole(id, data);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Role updated successfully",
    data: response,
  });
});

const deleteRole = catchAsync(async (req, res) => {
  const { id } = req.params;
  try {
    const response = await roleService.deleteRole(id);

    res.status(httpStatus.OK).json({
      success: true,
      message: "Role deleted successfully",
      data: response,
    });
  } catch (error) {
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === "P2014"
    )
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Role cannot be deleted as it is associated with other resources",
      );
    throw error;
  }
});

const roleController = {
  createRole,
  getRoleById,
  getPaginatedRoles,
  updateRole,
  deleteRole,
};
export default roleController;
