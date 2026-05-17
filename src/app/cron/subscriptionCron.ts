import { PrismaClient } from "@prisma/client";
import cron from "node-cron";

const prisma = new PrismaClient();

export const checkExpiredSubscriptions = async () => {
  console.log(`[${new Date().toISOString()}] Running expired subscriptions cron check...`);
  
  try {
    const expiredCount = await prisma.subscription.updateMany({
      where: {
        isActive: true,
        endDate: {
          lt: new Date(),
        },
      },
      data: {
        isActive: false,
      },
    });
    
    if (expiredCount.count > 0) {
      console.log(`[${new Date().toISOString()}] Successfully expired ${expiredCount.count} subscriptions.`);
    } else {
      console.log(`[${new Date().toISOString()}] No expired subscriptions found.`);
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
