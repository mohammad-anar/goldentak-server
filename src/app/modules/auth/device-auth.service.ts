import { PrismaClient } from "@prisma/client";
import { jwtHelper } from "../../../helpers/jwtHelper.js";
import config from "../../../config/index.js";
import { Secret } from "jsonwebtoken";

const prisma = new PrismaClient();

const deviceLogin = async (deviceId: string) => {
  // 1. Find or Create User
  let user = await prisma.user.findUnique({
    where: { deviceId },
    include: { subscription: true }
  });

  if (!user) {
    user = await prisma.user.create({
      data: { deviceId },
      include: { subscription: true }
    });
  }

  // 2. Prepare Subscription Info
  const subscription = user.subscription;
  const isActive = subscription ? (subscription.isActive && new Date(subscription.endDate) > new Date()) : false;

  // 3. Generate JWT
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

const handleSubscriptionPurchase = async (deviceId: string, planId: string, duration: string) => {
  console.log("Device purchase request:", { deviceId, planId, duration });
  const user = await prisma.user.findUnique({
    where: { deviceId }
  });

  if (!user) throw new Error("User not found");

  const planDetail = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!planDetail) {
    console.error("Plan not found for ID:", planId);
    throw new Error("Plan not found");
  }


  const startDate = new Date();
  const endDate = new Date();
  
  const finalDuration = duration?.toUpperCase() || planDetail.duration;

  if (finalDuration === "MONTHLY") {
    endDate.setMonth(startDate.getMonth() + 1);
  } else if (finalDuration === "YEARLY") {
    endDate.setFullYear(startDate.getFullYear() + 1);
  }

  await prisma.subscription.upsert({
    where: { userId: user.id },
    update: {
      plan: planDetail.name,
      planId: planDetail.id,
      startDate,
      endDate,
      isActive: true
    },
    create: {
      userId: user.id,
      plan: planDetail.name,
      planId: planDetail.id,
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
