import ApiError from "@/utils/ApiError";
import catchAsync from "@/utils/catchAsync";
import pick from "@/utils/pick";
import { status as httpStatus } from "http-status";
import notificationService from "./notification.service";

/**
 * Handler to get paginated notifications list
 */
const getPaginatedNotifications = catchAsync(async (req, res) => {
  // Ignore any other query param/pagination option apart from these
  const filters = pick(req.query, ["search", "isRead"]);
  const options = pick(req.query, ["sort_by", "sort_order", "limit", "page"]);

  // Get current user
  const { currentUser } = res.locals;
  // add the receiver id to filters
  filters.receiverId = currentUser.id;

  // Delegate to service layer
  const response = await notificationService.getPaginatedNotifications(
    filters,
    options,
  );

  res.status(httpStatus.OK).json({
    success: true,
    message: "Notifications fetched successfully",
    data: response,
  });
});

/**
 * Handler to update a notification by id
 */
const updateNotification = catchAsync(async (req, res) => {
  // Get notification id
  const { id } = req.params;
  // Data to be updated
  const data = req.body;
  // Get current user
  const { currentUser } = res.locals;

  // If current user and notification receiver are not same then throw unauthorized error
  const notification = await notificationService.getNotificationById(id);
  if (notification?.receiverId !== currentUser.id)
    throw new ApiError(httpStatus.UNAUTHORIZED, "Unauthorized");

  // Delegate to service layer
  const response = await notificationService.updateNotification(id, data);

  res.status(httpStatus.OK).json({
    success: true,
    message: "Notification updated successfully",
    data: response,
  });
});

const notificationController = {
  getPaginatedNotifications,
  updateNotification,
};
export default notificationController;
