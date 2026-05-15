import { prisma } from "../../../helpers/prisma.js";
import { emitNotification } from "../../../helpers/socketHelper.js";
import { NotificationType } from "@prisma/client";

const createNotification = async (payload: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: any;
}) => {
  const result = await prisma.notification.create({
    data: payload,
  });

  // Emit real-time notification
  emitNotification(payload.userId, result);

  return result;
};

const notifyAdmins = async (payload: {
  type: NotificationType;
  title: string;
  message: string;
  metadata?: any;
}) => {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });

  const notifications = await Promise.all(
    admins.map((admin) =>
      createNotification({
        userId: admin.id,
        ...payload,
      })
    )
  );

  return notifications;
};

const getMyNotifications = async (userId: string) => {
  const result = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return result;
};

const markAsRead = async (notificationId: string) => {
  return await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
};

const markAllAsRead = async (userId: string) => {
  return await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
};

export const NotificationService = {
  createNotification,
  notifyAdmins,
  getMyNotifications,
  markAsRead,
  markAllAsRead,
};
