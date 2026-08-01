import { Router } from "express";
import handleAuth from "@/middleware/handleAuth";
import validateRequest from "@/middleware/validateRequest";
import checkPermission from "@/middleware/checkPermission";
import userController from "./user.controller";
import userValidator from "./user.validator";

const userRouter = Router();

userRouter.get(
  "/user-stats",
  handleAuth(),
  checkPermission(["USER_MANAGEMENT"], "READ"),
  userController.getUserStats,
);
userRouter.get(
  "/recent-users",
  handleAuth(),
  checkPermission(["USER_MANAGEMENT"], "WRITE"),
  userController.getRecentUsers,
);

userRouter
  .route("/")
  .post(
    handleAuth(),
    checkPermission(["USER_MANAGEMENT"], "WRITE"),
    validateRequest(userValidator.createUserSchema),
    userController.createUser,
  );

userRouter.get(
  "/",
  handleAuth(),
  checkPermission(["USER_MANAGEMENT"], "READ"),
  userController.getPaginatedUsers,
);
userRouter
  .route("/:id")
  .patch(
    handleAuth(),
    validateRequest(userValidator.updateUserSchema),
    userController.updateUser,
  )
  .delete(
    handleAuth(),
    checkPermission(["USER_MANAGEMENT"], "DELETE", { openForCustomers: true }),
    userController.deleteUser,
  );

userRouter
  .route("/cart")
  .post(
    handleAuth(),
    validateRequest(userValidator.createCartItemSchema),
    userController.addCartItem,
  )
  .get(handleAuth(), userController.getCartItem);
userRouter
  .route("/cart/:targetId")
  .patch(
    handleAuth(),
    validateRequest(userValidator.updateCartItemSchema),
    userController.updateCartItem,
  )
  .delete(handleAuth(), userController.removeCartItem);

userRouter
  .route("/wishlist")
  .post(
    handleAuth(),
    validateRequest(userValidator.addItemToWishListSchema),
    userController.addItemToWishList,
  )
  .get(handleAuth(), userController.getWishlistItems);
userRouter
  .route("/wishlist/:targetId")
  .delete(handleAuth(), userController.removeItemFromWishList);

userRouter
  .route("/addresses")
  .get(handleAuth(), userController.getAddresses)
  .post(
    handleAuth(),
    validateRequest(userValidator.createAddressSchema),
    userController.createAddress,
  );

userRouter
  .route("/addresses/:id")
  .patch(
    handleAuth(),
    validateRequest(userValidator.updateAddressSchema),
    userController.updateAddress,
  );

userRouter.post(
  "/wallet/topup",
  handleAuth(),
  validateRequest(userValidator.topupWalletSchema),
  userController.topupWallet,
);
userRouter.post("/wallet/verify-payment", userController.veirfyTopupPayment);
userRouter.get(
  "/wallet/logs",
  handleAuth(),
  userController.getPaginatedWalletLogs,
);

export default userRouter;
