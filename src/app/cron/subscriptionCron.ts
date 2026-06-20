import { prisma } from "../../helpers/prisma.js";
import cron from "node-cron";
import { NotificationService } from "../modules/notification/notification.service.js";
import { NotificationType } from "@prisma/client";

export const checkExpiredSubscriptions = async () => {
  console.log(`[${new Date().toISOString()}] Running expired and expiring subscriptions cron check...`);
  
  try {
    // 1. Process expired subscriptions
    const expiredSubs = await prisma.subscription.findMany({
      where: {
        isActive: true,
        endDate: {
          lt: new Date(),
        },
      },
    });

    if (expiredSubs.length > 0) {
      console.log(`[${new Date().toISOString()}] Found ${expiredSubs.length} expired subscriptions to process.`);
      for (const sub of expiredSubs) {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            isActive: false,
          },
        });
        
        // Send expired notification
        await NotificationService.sendSubscriptionNotification(sub.userId, "EXPIRED");
      }
      console.log(`[${new Date().toISOString()}] Processed expiration for ${expiredSubs.length} subscriptions.`);
    } else {
      console.log(`[${new Date().toISOString()}] No newly expired subscriptions found.`);
    }

    // 2. Process subscriptions expiring soon (within 3 days)
    const warningThreshold = new Date();
    warningThreshold.setDate(warningThreshold.getDate() + 3);

    const expiringSubs = await prisma.subscription.findMany({
      where: {
        isActive: true,
        endDate: {
          gt: new Date(),
          lte: warningThreshold,
        },
      },
    });

    if (expiringSubs.length > 0) {
      let warnedCount = 0;
      for (const sub of expiringSubs) {
        // Check if they already received an EXPIRING notification in the last 7 days to avoid duplicate warnings
        const alreadyNotified = await prisma.notification.findFirst({
          where: {
            userId: sub.userId,
            type: NotificationType.SUBSCRIPTION_EXPIRING,
            title: {
              in: [
                "Subscription Expiring Soon",
                "Aboneliğiniz Yakında Sona Eriyor",
                "قرب انتهاء الاشتراك"
              ],
            },
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // last 7 days
            },
          },
        });

        if (!alreadyNotified) {
          await NotificationService.sendSubscriptionNotification(sub.userId, "EXPIRING", sub.endDate);
          warnedCount++;
        }
      }
      console.log(`[${new Date().toISOString()}] Sent expiring warning notifications to ${warnedCount} users.`);
    }

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error running expired subscriptions cron:`, error);
  }
};

export const initSubscriptionCron = () => {
  // Run every hour
  cron.schedule("0 * * * *", async () => {
    await checkExpiredSubscriptions();
  });
  
  console.log("[Subscription Cron] Cron Scheduler Initialized successfully. Running hourly check.");
  
  // Also run an immediate check on startup
  checkExpiredSubscriptions();
};
