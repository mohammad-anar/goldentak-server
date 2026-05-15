import { z } from "zod";

const createUserZodSchema = z.object({

    name: z.string({ message: "Name is required" }),
    username: z.string({ message: "Username is required" }).min(3).max(30),
    email: z.string({ message: "Email is required" }).email("Invalid email"),
    password: z
      .string({ message: "Password is required" })
      .min(8, "Password must be at least 8 characters"),
    phone: z.string().optional(),
    avatarUrl: z.string().url().optional(),
    bio: z.string().optional(),
    location: z.string().optional(),
    timezone: z.string().optional(),

});

const updateUserZodSchema = z.object({

    name: z.string().optional(),
    username: z.string().min(3).max(30).optional(),
    phone: z.string().optional(),
    avatarUrl: z.string().url().nullable().optional(),
    bio: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    timezone: z.string().optional(),

});

const loginZodSchema = z.object({

    email: z.string({ message: "Email is required" }).email("Invalid email"),
    password: z.string({ message: "Password is required" }),

});

const verifyEmailZodSchema = z.object({

    email: z.string().email(),
    otp: z.union([z.string(), z.number()]),

});

const forgetPasswordZodSchema = z.object({

    email: z.string().email(),

});

const resetPasswordZodSchema = z.object({
    password: z.string().min(8),
});

const changePasswordZodSchema = z.object({

    oldPassword: z.string({ message: "Old password is required" }),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),

});

export const UserValidation = {
  createUserZodSchema,
  updateUserZodSchema,
  loginZodSchema,
  verifyEmailZodSchema,
  forgetPasswordZodSchema,
  resetPasswordZodSchema,
  changePasswordZodSchema,
};
