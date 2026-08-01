import catchAsync from "@/utils/catchAsync";
import pick from "@/utils/pick";
import { status as httpStatus } from "http-status";
import { PrismaClientKnownRequestError } from "@/generated/prisma/runtime/library";
import ApiError from "@/utils/ApiError";
import employeeService from "./employee.service";

const createEmployee = catchAsync(async (req, res) => {
  const data = req.body;

  let response;

  try {
    response = await employeeService.createEmployee(data);
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError(httpStatus.BAD_REQUEST, "Employee is already exists");
    }
    throw e;
  }

  res.status(httpStatus.CREATED).json({
    success: true,
    message: "Employee created successfully",
    data: response,
  });
});

const getEmployeeById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const response = await employeeService.getEmployeeById(id);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Employee fetched successfully",
    data: response,
  });
});

const getPaginatedEmployees = catchAsync(async (req, res) => {
  const filters = pick(req.query, ["search", "roleId"]);
  const options = pick(req.query, ["sort_by", "sort_order", "limit", "page"]);

  const response = await employeeService.getPaginatedEmployees(
    filters,
    options,
  );

  res.status(httpStatus.OK).json({
    success: true,
    message: "Employees fetched successfully",
    data: response,
  });
});

const updateEmployee = catchAsync(async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  let response;

  try {
    response = await employeeService.updateEmployee(id, data);
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError(httpStatus.BAD_REQUEST, "Employee is already exists");
    }
    throw e;
  }

  res.status(httpStatus.OK).json({
    success: true,
    message: "Employee updated successfully",
    data: response,
  });
});

const deleteEmployee = catchAsync(async (req, res) => {
  const { id } = req.params;

  let response;
  try {
    response = await employeeService.deleteEmployee(id);
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
    message: "Employee deleted successfully",
    data: response,
  });
});

const employeeController = {
  createEmployee,
  getEmployeeById,
  getPaginatedEmployees,
  updateEmployee,
  deleteEmployee,
};
export default employeeController;
