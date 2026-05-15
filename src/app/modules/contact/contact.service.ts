import { emailHelper } from "../../../helpers/emailHelper.js";
import { emailTemplate } from "../../shared/emailTemplate.js";
import { IContactPayload } from "./contact.interface.js";

const sendContactEmail = async (payload: IContactPayload) => {
  const template = emailTemplate.contactEmail(payload);
  await emailHelper.sendEmail(template);
  return { message: "Email sent successfully" };
};

export const ContactService = {
  sendContactEmail,
};
