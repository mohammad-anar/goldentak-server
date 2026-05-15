import { z } from "zod";

const sendContactEmailZodSchema = z.object({

  name: z.string({ message: "Name is required" }),
  email: z.string({ message: "Email is required" }).email("Invalid email format"),
  subject: z.string({ message: "Subject is required" }),
  message: z.string({ message: "Message is required" }),

});

export const ContactValidation = {
  sendContactEmailZodSchema,
};
