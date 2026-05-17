import { PrismaClient, SubscriptionDuration, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting complete project database seeding...");

  // 1. Seed Algorithm Settings
  console.log("👉 Seeding algorithm settings...");
  await prisma.algorithmSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      horseWeight: 45.0,
      jockeyWeight: 35.0,
      fatherWeight: 8.0,
      motherWeight: 6.0,
      damSireWeight: 2.0,
      pedigreeWeight: 5.0,
      earningsWeight: 5.0,
      weightEffectWeight: 10.0,
      bigThreshold: 20,
      mediumThreshold: 40,
      smallThreshold: 60,
    },
  });

  // 2. Seed Subscription Plans
  console.log("👉 Seeding subscription plans...");
  const plans = [
    {
      name: "Basic Monthly",
      duration: SubscriptionDuration.MONTHLY,
      price: 29.99,
      features: ["Access to daily races", "Basic horse analysis", "Email support"],
    },
    {
      name: "Premium Monthly",
      duration: SubscriptionDuration.MONTHLY,
      price: 59.99,
      features: ["Everything in Basic", "Advanced AI predictions", "Jockey performance stats", "Priority support"],
    },
    {
      name: "Basic Yearly",
      duration: SubscriptionDuration.YEARLY,
      price: 299.99,
      features: ["Access to daily races", "Basic horse analysis", "Email support", "2 months free"],
    },
    {
      name: "Premium Yearly",
      duration: SubscriptionDuration.YEARLY,
      price: 599.99,
      features: ["Everything in Basic", "Advanced AI predictions", "Jockey performance stats", "Priority support", "Best value"],
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { id: plan.name.toLowerCase().replace(/ /g, "-") },
      update: plan,
      create: {
        id: plan.name.toLowerCase().replace(/ /g, "-"),
        ...plan,
      },
    });
  }

  // 3. Seed Dummy Users (Including Device Logged In & Web Accounts)
  console.log("👉 Seeding dummy users & subscription details...");

  const usersToSeed = [
    {
      id: "user_alex_rider_01",
      name: "Alex Rider",
      username: "alexrider",
      email: "alex@rider.com",
      phone: "+15550199",
      role: Role.USER,
      isVerified: true,
      deviceId: "device_iphone_15_pro_abc123",
      subscription: {
        plan: "PREMIUM",
        planId: "premium-monthly",
        startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        endDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000), // 25 days later
        isActive: true,
      }
    },
    {
      id: "user_maria_santos_02",
      name: "Maria Santos",
      username: "mariasantos",
      email: "maria@santos.com",
      phone: "+34612345678",
      role: Role.USER,
      isVerified: true,
      deviceId: "device_google_pixel_8_pqr012",
      subscription: {
        plan: "PREMIUM",
        planId: "premium-yearly",
        startDate: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000), // 100 days ago
        endDate: new Date(Date.now() + 265 * 24 * 60 * 60 * 1000), // 265 days later
        isActive: true,
      }
    },
    {
      id: "user_expired_samsung_03",
      name: "Samsung Active Expired Account",
      username: "samsungexpired",
      email: "samsung@expired.com",
      phone: "+15550244",
      role: Role.USER,
      isVerified: false,
      deviceId: "device_samsung_s24_xyz789",
      subscription: {
        plan: "PREMIUM",
        planId: "basic-monthly",
        startDate: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), // 35 days ago
        endDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // Expired 5 days ago (set to active so cron can expire it!)
        isActive: true,
      }
    },
    {
      id: "user_ipad_free_04",
      name: "Free iPad Device Account",
      username: "ipadfree",
      email: "ipad@free.com",
      phone: "+15550777",
      role: Role.USER,
      isVerified: false,
      deviceId: "device_ipad_pro_def456",
      subscription: null
    },
    {
      id: "user_oneplus_expired_05",
      name: "OnePlus Permanently Expired",
      username: "oneplusexpired",
      email: "oneplus@expired.com",
      role: Role.USER,
      isVerified: false,
      deviceId: "device_oneplus_12_mno345",
      subscription: {
        plan: "PREMIUM",
        planId: "premium-yearly",
        startDate: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000), // 400 days ago
        endDate: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), // Expired 35 days ago
        isActive: false,
      }
    },
    {
      id: "user_sony_subscribed_06",
      name: "Sony Premium Subscriber",
      username: "sonysubscribed",
      email: "sony@premium.com",
      role: Role.USER,
      isVerified: true,
      deviceId: "device_sony_xperia_777",
      subscription: {
        plan: "PREMIUM",
        planId: "basic-yearly",
        startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        endDate: new Date(Date.now() + 355 * 24 * 60 * 60 * 1000), // 355 days later
        isActive: true,
      }
    }
  ];

  for (const item of usersToSeed) {
    // Delete existing subscription if any to prevent unique constraint failures
    await prisma.subscription.deleteMany({
      where: { userId: item.id }
    });

    const userObj = {
      name: item.name,
      username: item.username,
      email: item.email,
      phone: item.phone || null,
      role: item.role,
      isVerified: item.isVerified,
      deviceId: item.deviceId,
    };

    const user = await prisma.user.upsert({
      where: { id: item.id },
      update: userObj,
      create: {
        id: item.id,
        ...userObj
      }
    });

    if (item.subscription) {
      await prisma.subscription.create({
        data: {
          userId: user.id,
          plan: item.subscription.plan,
          planId: item.subscription.planId,
          startDate: item.subscription.startDate,
          endDate: item.subscription.endDate,
          isActive: item.subscription.isActive,
        }
      });
    }
  }

  console.log("🎉 Seeding completed successfully. Test database is populated!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
