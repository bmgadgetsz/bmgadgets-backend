import { z } from "zod";

// Define schema for updating notification
const updateNotificationSchema = z.object({
  body: z.strictObject({
    isRead: z.boolean().optional(), // Optional boolean to mark notification as read
  }),
});

// Export the notification validator
const notificationValidator = {
  updateNotificationSchema,
};
export default notificationValidator;
