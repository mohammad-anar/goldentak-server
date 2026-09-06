import { prisma } from "../../../helpers/prisma.js";
import { jwtHelper } from "../../../helpers/jwtHelper.js";
import config from "../../../config/index.js";
import { Secret } from "jsonwebtoken";
import { NotificationService } from "../notification/notification.service.js";

// ── FREE TRIAL DURATION ───────────────────────────────────────────────────────
const FREE_TRIAL_DAYS = 7;

const deviceLogin = async (deviceId: string) => {
  // 1. Find or Create User
  let isNewUser = false;
  let user = await prisma.user.findUnique({
    where: { deviceId },
    include: { subscription: true }
  });

  if (!user) {
    isNewUser = true;
    user = await prisma.user.create({
      data: { deviceId },
      include: { subscription: true }
    });
  }

  // 2. Auto-grant FREE TRIAL for brand-new users (first login ever)
  if (isNewUser && !user.subscription) {
    const trialStart = new Date();
    const trialEnd = new Date();
    trialEnd.setDate(trialStart.getDate() + FREE_TRIAL_DAYS);

    user.subscription = await prisma.subscription.create({
      data: {
        userId: user.id,
        plan: "TRIAL",
        startDate: trialStart,
        endDate: trialEnd,
        isActive: true,
      },
    });

    // Send a welcome trial notification (non-blocking)
    const trialEndStr = trialEnd.toLocaleDateString();
    NotificationService.createTrialNotification(user.id, trialEndStr).catch(
      (err) => console.error("[DeviceAuth] Failed to send trial notification:", err)
    );

    console.log(`[DeviceAuth] 7-day free trial granted to new user: ${user.id} (expires: ${trialEnd.toISOString()})`);
  }

  // 3. Prepare Subscription Info
  const subscription = user.subscription;
  const isActive = subscription
    ? subscription.isActive && new Date(subscription.endDate) > new Date()
    : false;

  // 4. Generate JWT
  const token = jwtHelper.createToken(
    { 
      userId: user.id, 
      deviceId: user.deviceId, 
      role: user.role,
      subscription: {
        plan: subscription?.plan || "FREE",
        isActive,
        endDate: subscription?.endDate || null
      }
    },
    config.jwt.jwt_secret as Secret,
    config.jwt.jwt_expire_in as any
  );

  return {
    token,
    user
  };
};

const handleSubscriptionPurchase = async (deviceId: string, duration: string) => {
  console.log("Device purchase request:", { deviceId, duration });
  const user = await prisma.user.findUnique({
    where: { deviceId }
  });

  if (!user) throw new Error("User not found");

  const startDate = new Date();
  const endDate = new Date();
  
  const finalDuration = duration?.toUpperCase() || "WEEKLY";

  if (finalDuration === "WEEKLY") {
    endDate.setDate(startDate.getDate() + 7);
  } else if (finalDuration === "MONTHLY") {
    endDate.setMonth(startDate.getMonth() + 1);
  } else if (finalDuration === "YEARLY") {
    endDate.setFullYear(startDate.getFullYear() + 1);
  } else {
    endDate.setDate(startDate.getDate() + 7);
  }

  await prisma.subscription.upsert({
    where: { userId: user.id },
    update: {
      plan: finalDuration,
      startDate,
      endDate,
      isActive: true
    },
    create: {
      userId: user.id,
      plan: finalDuration,
      startDate,
      endDate,
      isActive: true
    }
  });

  // Return a fresh token with updated subscription info
  return await deviceLogin(deviceId);
};


export const DeviceAuthService = {
  deviceLogin,
  handleSubscriptionPurchase
};
