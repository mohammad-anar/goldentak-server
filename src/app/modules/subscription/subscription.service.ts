import { prisma } from "../../../helpers/prisma.js";
import { NotificationService } from "../notification/notification.service.js";
import { DeviceAuthService } from "../auth/device-auth.service.js";
import { 
  verifyGoogleSubscription as googleVerifier, 
  verifyAppleSubscription as appleVerifier,
  AppleVerificationPayload
} from "../../../helpers/purchaseVerification.js";
import jwt from "jsonwebtoken";

// Helper to map Store Product IDs to Database Plans
const mapProductIdToPlan = (productId: string): string => {
  const lower = productId.toLowerCase();
  if (lower.includes("yearly") || lower.includes("year")) return "YEARLY";
  if (lower.includes("monthly") || lower.includes("month")) return "MONTHLY";
  return "WEEKLY";
};

// ─────────────────────────────────────────────────────────────────────────────
// CORE SUBSCRIPTION MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────
const createSubscription = async (data: any) => {
  const { userId, plan, startDate, endDate } = data;
  console.log("Creating subscription for user:", userId, "with type:", plan);
  
  const result = await prisma.subscription.upsert({
    where: { userId },
    update: {
      plan: plan || "WEEKLY",
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isActive: true,
    },
    create: {
      userId,
      plan: plan || "WEEKLY",
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isActive: true,
    },
  });

  // Notify user that subscription is activated
  await NotificationService.sendSubscriptionNotification(userId, "ACTIVATED", new Date(endDate));

  return result;
};

const getSubscriptionByUserId = async (userId: string) => {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!subscription) {
    return {
      plan: "FREE",
      isActive: false,
      startDate: null,
      endDate: null,
    };
  }

  const isActive = subscription.isActive && new Date(subscription.endDate) > new Date();

  return {
    plan: subscription.plan,
    isActive,
    startDate: subscription.startDate,
    endDate: subscription.endDate,
  };
};

const getSubscriptionOverview = async () => {
  const now = new Date();

  // 1. Calculate stats metrics
  const totalUsers = await prisma.user.count({
    where: { role: "USER" },
  });

  const paidUsers = await prisma.subscription.count({
    where: {
      isActive: true,
      endDate: { gte: now },
    },
  });

  const freeUsers = Math.max(0, totalUsers - paidUsers);

  const expiringSoon = await prisma.subscription.count({
    where: {
      isActive: true,
      endDate: {
        gte: now,
        lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    },
  });

  const cancelled = await prisma.subscription.count({
    where: {
      OR: [
        { isActive: false },
        { endDate: { lt: now } },
      ],
    },
  });

  // 2. Fetch monthly renewals chart data (last 5 months)
  const chartData = [];
  for (let i = 4; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const monthLabel = d.toLocaleDateString("en-US", { month: "short" });
    const year = d.getFullYear();
    const month = d.getMonth();

    const startOfMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));

    const count = await prisma.subscription.count({
      where: {
        startDate: {
          gte: startOfMonth,
          lt: endOfMonth,
        },
      },
    });

    chartData.push({ month: monthLabel, renewals: count });
  }

  // 3. Recent subscriptions
  const recentSubs = await prisma.subscription.findMany({
    orderBy: { updatedAt: "desc" },
    take: 10,
    include: {
      user: {
        select: {
          name: true,
          username: true,
          email: true,
        },
      },
    },
  });

  const recentSubscriptions = recentSubs.map((sub) => {
    const userDisplay = sub.user?.name || sub.user?.username || sub.user?.email || "Device User";
    const planName = sub.plan || "WEEKLY";

    // Determine status
    let status = "Cancelled";
    if (sub.isActive && new Date(sub.endDate) >= now) {
      const expiringSoonThreshold = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      if (new Date(sub.endDate) <= expiringSoonThreshold) {
        status = "Expiring";
      } else {
        status = "Active";
      }
    }

    return {
      user: userDisplay,
      plan: planName,
      startDate: sub.startDate.toISOString().split("T")[0],
      expiry: sub.endDate.toISOString().split("T")[0],
      status,
    };
  });

  return {
    metrics: {
      freeUsers: freeUsers.toLocaleString(),
      paidUsers: paidUsers.toLocaleString(),
      expiringSoon: expiringSoon.toLocaleString(),
      cancelled: cancelled.toLocaleString(),
    },
    chartData,
    recentSubscriptions,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE PLAY SUBSCRIPTION VERIFICATION & WEBHOOKS
// ─────────────────────────────────────────────────────────────────────────────
const verifyGoogleSubscription = async (deviceId: string, productId: string, purchaseToken: string) => {
  console.log(`[GoogleVerify] Request received: deviceId=${deviceId}, productId=${productId}`);
  
  // 1. Verify with Google Developer API
  const verification = await googleVerifier(productId, purchaseToken);
  if (!verification.success) {
    throw new Error("Google Play subscription verification failed or has expired");
  }

  // 2. Fetch or create User
  let user = await prisma.user.findUnique({
    where: { deviceId }
  });

  if (!user) {
    user = await prisma.user.create({
      data: { deviceId, platform: "android" }
    });
  } else if (user.platform !== "android") {
    await prisma.user.update({
      where: { id: user.id },
      data: { platform: "android" }
    });
  }

  const plan = mapProductIdToPlan(productId);
  const startDate = new Date();
  const endDate = new Date(verification.expiryTimeMillis);

  // 3. Upsert Subscription in Database
  await prisma.subscription.upsert({
    where: { userId: user.id },
    update: {
      plan,
      startDate,
      endDate,
      isActive: true,
      googlePurchaseToken: purchaseToken,
    },
    create: {
      userId: user.id,
      plan,
      startDate,
      endDate,
      isActive: true,
      googlePurchaseToken: purchaseToken,
    }
  });

  // 4. Send notification trigger
  await NotificationService.sendSubscriptionNotification(user.id, "ACTIVATED", endDate);

  // 5. Return fresh JWT auth token
  return await DeviceAuthService.deviceLogin(deviceId);
};

const handleGoogleWebhook = async (pubSubMessage: any) => {
  try {
    const dataBase64 = pubSubMessage?.data;
    if (!dataBase64) throw new Error("Missing PubSub message data");

    const decodedString = Buffer.from(dataBase64, "base64").toString("utf-8");
    const payload = JSON.parse(decodedString);
    console.log("[GoogleWebhook] Decoded PubSub Payload:", JSON.stringify(payload));

    const notification = payload?.subscriptionNotification;
    if (!notification) {
      console.log("[GoogleWebhook] Not a subscription notification, skipping.");
      return { success: true };
    }

    const { purchaseToken, subscriptionId: productId, notificationType } = notification;
    if (!purchaseToken || !productId) {
      throw new Error("Missing required notification parameters");
    }

    console.log(`[GoogleWebhook] Processing notificationType=${notificationType} for product=${productId}`);

    // Call google publisher API to get latest state
    const verification = await googleVerifier(productId, purchaseToken);

    // Find subscription in our DB
    const existingSub = await prisma.subscription.findUnique({
      where: { googlePurchaseToken: purchaseToken },
      include: { user: true }
    });

    if (!existingSub) {
      console.warn(`[GoogleWebhook] No subscription found in DB matching purchaseToken: ${purchaseToken}`);
      return { success: false, message: "Subscription not found" };
    }

    const plan = mapProductIdToPlan(productId);
    const newEndDate = new Date(verification.expiryTimeMillis);
    const isActive = verification.success;

    // Update database record
    await prisma.subscription.update({
      where: { id: existingSub.id },
      data: {
        plan,
        endDate: newEndDate,
        isActive
      }
    });

    console.log(`[GoogleWebhook] Updated subscription for user ${existingSub.userId}: isActive=${isActive}, expires=${newEndDate}`);

    // Trigger notification if status changed
    if (!existingSub.isActive && isActive) {
      await NotificationService.sendSubscriptionNotification(existingSub.userId, "ACTIVATED", newEndDate);
    } else if (existingSub.isActive && !isActive) {
      await NotificationService.sendSubscriptionNotification(existingSub.userId, "EXPIRED", newEndDate);
    }

    return { success: true };
  } catch (err: any) {
    console.error("[GoogleWebhook] Error handling webhook event:", err.message);
    throw err;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// APPLE APP STORE SUBSCRIPTION VERIFICATION & WEBHOOKS
// ─────────────────────────────────────────────────────────────────────────────
const verifyAppleSubscription = async (
  deviceId: string,
  payload: string | AppleVerificationPayload
) => {
  console.log(`[AppleVerify] Request received for deviceId=${deviceId}`);

  // 1. Verify Apple receipt/JWS payload or query App Store Server API
  const verification = await appleVerifier(payload);
  if (!verification.success) {
    throw new Error("Apple App Store subscription verification failed or has expired");
  }

  // 2. Fetch or create User
  let user = await prisma.user.findUnique({
    where: { deviceId }
  });

  if (!user) {
    user = await prisma.user.create({
      data: { deviceId, platform: "ios" }
    });
  } else if (user.platform !== "ios") {
    await prisma.user.update({
      where: { id: user.id },
      data: { platform: "ios" }
    });
  }

  const plan = mapProductIdToPlan(verification.productId);
  const startDate = new Date();
  const endDate = new Date(verification.expiresDate);

  // 3. Upsert Subscription in Database
  await prisma.subscription.upsert({
    where: { userId: user.id },
    update: {
      plan,
      startDate,
      endDate,
      isActive: true,
      appleOriginalTransactionId: verification.originalTransactionId,
    },
    create: {
      userId: user.id,
      plan,
      startDate,
      endDate,
      isActive: true,
      appleOriginalTransactionId: verification.originalTransactionId,
    }
  });

  // 4. Send notification trigger
  await NotificationService.sendSubscriptionNotification(user.id, "ACTIVATED", endDate);

  // 5. Return fresh JWT auth token
  return await DeviceAuthService.deviceLogin(deviceId);
};

const handleAppleWebhook = async (signedPayload: string) => {
  try {
    if (!signedPayload) throw new Error("Missing signedPayload JWS from Apple Connect");

    // 1. Decode signedPayload from Apple V2 Webhook
    const decodedPayload = jwt.decode(signedPayload) as any;
    if (!decodedPayload) throw new Error("Failed to decode App Store Server JWS payload");

    console.log("[AppleWebhook] Decoded Apple Webhook Event type:", decodedPayload.notificationType);

    const data = decodedPayload?.data;
    const signedTransactionInfo = data?.signedTransactionInfo;
    if (!signedTransactionInfo) {
      console.log("[AppleWebhook] Missing signedTransactionInfo in payload, skipping.");
      return { success: true };
    }

    // 2. Decode the transaction payload inside the notification
    const decodedTransaction = jwt.decode(signedTransactionInfo) as any;
    if (!decodedTransaction) {
      throw new Error("Failed to decode signedTransactionInfo JWS inside webhook");
    }

    const originalTransactionId = decodedTransaction.originalTransactionId;
    const expiresDate = Number(decodedTransaction.expiresDate);
    const productId = decodedTransaction.productId;

    if (!originalTransactionId || !expiresDate) {
      throw new Error("Apple webhook transaction info is missing originalTransactionId or expiresDate");
    }

    console.log(`[AppleWebhook] Processing for originalTransactionId=${originalTransactionId}, productId=${productId}`);

    // 3. Find matching subscription in our DB
    const existingSub = await prisma.subscription.findUnique({
      where: { appleOriginalTransactionId: originalTransactionId },
      include: { user: true }
    });

    if (!existingSub) {
      console.warn(`[AppleWebhook] No subscription found in DB matching appleOriginalTransactionId: ${originalTransactionId}`);
      return { success: false, message: "Subscription not found" };
    }

    const notificationType = decodedPayload.notificationType;
    let isActive = existingSub.isActive;
    const plan = mapProductIdToPlan(productId);
    const newEndDate = new Date(expiresDate);

    // Map notification types to subscription states
    if (["SUBSCRIBED", "DID_RENEW", "RENEWAL_EXTENDED"].includes(notificationType)) {
      isActive = true;
    } else if (["EXPIRED", "REVOKE", "REFUND"].includes(notificationType)) {
      isActive = false;
    }

    // 4. Update Database
    await prisma.subscription.update({
      where: { id: existingSub.id },
      data: {
        plan,
        endDate: newEndDate,
        isActive
      }
    });

    console.log(`[AppleWebhook] Webhook updated subscription. Notification: ${notificationType}, User: ${existingSub.userId}, isActive: ${isActive}, Expiry: ${newEndDate}`);

    // Trigger notification if status changed
    if (!existingSub.isActive && isActive) {
      await NotificationService.sendSubscriptionNotification(existingSub.userId, "ACTIVATED", newEndDate);
    } else if (existingSub.isActive && !isActive) {
      await NotificationService.sendSubscriptionNotification(existingSub.userId, "EXPIRED", newEndDate);
    }

    return { success: true };
  } catch (err: any) {
    console.error("[AppleWebhook] Error processing App Store Connect webhook:", err.message);
    throw err;
  }
};

export const SubscriptionService = {
  createSubscription,
  getSubscriptionByUserId,
  getSubscriptionOverview,
  verifyGoogleSubscription,
  verifyAppleSubscription,
  handleGoogleWebhook,
  handleAppleWebhook,
};
