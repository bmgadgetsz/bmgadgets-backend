import shipwayService from "@/services/shipway/shipway.service";
import ApiError from "@/utils/ApiError";
import catchAsync from "@/utils/catchAsync";
import { status as httpStatus } from "http-status";

const getShipwayCarrierRates = catchAsync(async (req, res) => {
  const { fromPincode, toPincode, paymentType } = req.query;
  if (!fromPincode || !toPincode) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "from and to pincodes are required",
    );
  }

  const response = await shipwayService.getShipwayCarrierRates(
    fromPincode as string,
    toPincode as string,
    paymentType as "prepaid" | "cod",
  );

  res.status(httpStatus.OK).json({
    success: true,
    message: "Carrier rates fetched successfully",
    data: response,
  });
});

const getPincodeServiceable = catchAsync(async (req, res) => {
  const { pincode, paymentType } = req.query;
  if (!pincode) {
    throw new ApiError(httpStatus.BAD_REQUEST, "pincode is required");
  }
  if (paymentType) {
    if (!["P", "C"].includes(paymentType as string)) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "paymentType must be 'P' or 'C'",
      );
    }
  }

  const response = await shipwayService.getPincodeServiceable(
    pincode as string,
    paymentType ? (paymentType as "P" | "C") : undefined,
  );

  res.status(httpStatus.OK).json({
    success: true,
    message: "Carriers for pincode serviceability fetched",
    data: response,
  });
});

const cancelReturnShipment = catchAsync(async (req, res) => {
  const { rmaNo, shipwayOrderId } = req.body;

  const response = await shipwayService.cancelReturnShipment(
    rmaNo,
    shipwayOrderId,
  );
  if (!response.success) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Shipway request unsuccessful",
    );
  }

  res.status(httpStatus.OK).json({
    success: true,
    message: "Carriers for pincode serviceability fetched",
    data: response,
  });
});

const createPickupOnShipway = catchAsync(async (req, res) => {
  const {
    pickup_date,
    pickup_time,
    office_close_time,
    package_count,
    carrier_id,
    warehouse_id,
    return_warehouse_id,
    payment_type,
    order_ids,
  } = req.body;

  const response = await shipwayService.createPickupOnShipway({
    pickup_date,
    pickup_time,
    office_close_time,
    package_count,
    carrier_id,
    warehouse_id,
    return_warehouse_id,
    payment_type,
    order_ids,
  });
  if (!response.success) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Shipway request unsuccessful",
    );
  }

  res.status(httpStatus.OK).json({
    success: true,
    message: "Pickup created successfully",
    data: response,
  });
});

const getCarriersHandler = catchAsync(async (req, res) => {
  const response = await shipwayService.getCarriers();
  if (response?.length <= 0 || typeof response === "string") {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      "Could not fetch carriers from shipway",
    );
  }
  res.status(httpStatus.OK).json({
    success: true,
    message: "carriers fetched successfully",
    data: response,
  });
});

const shipwayController = {
  getShipwayCarrierRates,
  getPincodeServiceable,
  cancelReturnShipment,
  createPickupOnShipway,
  getCarriersHandler,
};

export default shipwayController;
