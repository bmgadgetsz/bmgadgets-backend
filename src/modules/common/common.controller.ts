import ApiError from "@/utils/ApiError";
import catchAsync from "@/utils/catchAsync";
import s3Service from "@/utils/s3.service";
import { status as httpStatus } from "http-status";
import { randomUUID } from "crypto";

const uploadSingleFile = catchAsync(async (req, res) => {
  const directory = req.body?.directory || "general";

  if (!req.files) throw new ApiError(httpStatus.BAD_REQUEST, "No file found");

  if (!Array.isArray(req.files))
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "All files must be in the file field",
    );

  const urls = await Promise.all(
    req.files.map(async (file) =>
      s3Service.upload(
        `bmq/${directory}/${file.originalname.split(" ").join("-").split(".").join(`-${randomUUID()}.`)}`,
        file!.buffer,
        file.mimetype,
      ),
    ),
  );

  res.status(httpStatus.CREATED).json({
    success: true,
    message: "File uploaded successfully",
    data: urls,
  });
});

const commonController = {
  uploadSingleFile,
};
export default commonController;
