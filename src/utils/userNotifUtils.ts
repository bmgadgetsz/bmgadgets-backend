// src/utils/notifyUsers.ts
import { getIO } from "@/config/socket";
import prisma from "@/config/prisma";
import { NotificationType } from "@/generated/prisma";

interface NotifyUserOptions {
  type: NotificationType;
  title: string;
  receiverIds: string[];
  orderId?: string;
  productId?: string;
}

export async function notifyUsers({
  type,
  title,
  receiverIds,
  orderId,
  productId,
}: NotifyUserOptions) {
  if (!receiverIds.length) return;

  await prisma.notification.createMany({
    data: receiverIds.map((id) => ({
      type,
      title,
      receiverId: id,
      orderId,
      productId,
    })),
  });

  const io = getIO();
  receiverIds.forEach((id) => {
    io.to(id).emit("notification", {
      title,
      type,
      orderId,
      productId,
    });
  });
}
