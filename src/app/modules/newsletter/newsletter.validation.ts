import { z } from "zod";

const createNewsletterZodSchema = z.object({

  title: z.string("Title is required"),
  description: z.string("Description is required"),

});

const updateNewsletterZodSchema = z.object({

  title: z.string().optional(),
  description: z.string().optional(),

});

export const NewsletterValidation = {
  createNewsletterZodSchema,
  updateNewsletterZodSchema,
};
