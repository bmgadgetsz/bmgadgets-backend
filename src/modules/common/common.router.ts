import upload from "@/config/multer";
import handleAuth from "@/middleware/handleAuth";
import validateRequest from "@/middleware/validateRequest";
import { Router } from "express";
import commonValidator from "./common.validator";
import commonController from "./common.controller";

const commonRouter = Router();

commonRouter
  .route("/file-upload")
  .post(
    handleAuth(),
    upload.array("file"),
    validateRequest(commonValidator.fileUpload),
    commonController.uploadSingleFile,
  );

export default commonRouter;

commonRouter.post("/file-upload-public", upload.array("file"), commonController.uploadSingleFile);
