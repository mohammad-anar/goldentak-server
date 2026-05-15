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

const handleSubscriptionPurchase = async (deviceId: string, plan: string, durationDays: number) => {
  const user = await prisma.user.findUnique({
    where: { deviceId }
  });

  if (!user) throw new Error("User not found");

  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(startDate.getDate() + durationDays);

  const subscription = await prisma.subscription.upsert({
    where: { userId: user.id },
    update: {
      plan,
      startDate,
      endDate,
      isActive: true
    },
    create: {
      userId: user.id,
      plan,
      startDate,
      endDate,
      isActive: true
    }
  });

  return subscription;
};

export const DeviceAuthService = {
  deviceLogin,
  handleSubscriptionPurchase
};
