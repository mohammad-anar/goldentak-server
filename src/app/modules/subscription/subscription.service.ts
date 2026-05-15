import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const getAllPlans = async () => {
  return await prisma.subscriptionPlan.findMany({
    orderBy: { price: "asc" },
  });
};

const getPlanById = async (id: string) => {
  return await prisma.subscriptionPlan.findUnique({
    where: { id },
  });
};

const createSubscription = async (data: any) => {
  const { userId, planId, startDate, endDate } = data;
  console.log("Creating subscription for user:", userId, "with plan:", planId);
  
  const planDetail = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!planDetail) {
    console.error("Plan not found for ID:", planId);
  }

  
  return await prisma.subscription.upsert({
    where: { userId },
    update: {
      plan: planDetail?.name || "CUSTOM",
      planId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isActive: true,
    },
    create: {
      userId,
      plan: planDetail?.name || "CUSTOM",
      planId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isActive: true,
    },
  });
};

export const SubscriptionService = {
  getAllPlans,
  getPlanById,
  createSubscription,
  createPlan,
  updatePlan,
};

async function createPlan(data: any) {
  return await prisma.subscriptionPlan.create({
    data: {
      ...data,
      id: data.name.toLowerCase().replace(/ /g, "-"),
    },
  });
}

async function updatePlan(id: string, data: any) {
  return await prisma.subscriptionPlan.update({
    where: { id },
    data,
  });
}



