import bcrypt from "bcryptjs";
import config from "../config/index.js";
import { prisma } from "../helpers/prisma.js";
import { Role } from "../types/enum.js";

export const seedSuperAdmin = async () => {
  console.log("Checking for Admin with email:", config.admin.email);

  const isExist = await prisma.user.findFirst({
    where: {
      OR: [
        { email: config.admin.email },
        { username: "admin" }
      ],
    },
  });

  if (!isExist) {
    const passwordHash = await bcrypt.hash(
      config.admin.password as string,
      config.bcrypt_salt_round,
    );

    await prisma.user.create({
      data: {
        name: config.admin.name as string,
        username: "admin",
        email: config.admin.email as string,
        phone: config.admin.phone as string,
        passwordHash,
        avatarUrl: config.admin.avatar as string,
        role: Role.ADMIN,
        isVerified: true,
      },
    });

    console.log("Super admin seeded successfully.");
  } else {
    console.log("Super admin already exists.");
  }
};
