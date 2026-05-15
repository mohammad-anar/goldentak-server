import { PrismaClient, SubscriptionDuration } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding subscription plans...");

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
      where: { id: plan.name.toLowerCase().replace(/ /g, "-") }, // Using name-based ID for predictable seeding
      update: plan,
      create: {
        id: plan.name.toLowerCase().replace(/ /g, "-"),
        ...plan,
      },
    });
  }

  console.log("Subscription plans seeded successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
