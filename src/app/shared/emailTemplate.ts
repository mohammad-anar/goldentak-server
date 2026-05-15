import config from "../../config/index.js";
import { IContactEmail, ICreateAccount, IResetPassword } from "../../types/emailTamplate.js";

const PRIMARY_COLOR = "#00C6CF";

const baseTemplate = (content: string) => `
<body style="margin:0; padding:0; background-color:#f4f6f8; font-family:Arial, Helvetica, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0"
          style="max-width:600px; background:#ffffff; border-radius:12px;
          padding:40px 35px; box-shadow:0 10px 30px rgba(0,0,0,0.05);">

          <!-- Brand Header -->
          <tr>
            <td align="center" style="padding-bottom:20px;">
              <h1 style="margin:0; font-size:22px; color:${PRIMARY_COLOR}; font-weight:700;">
                Fantasy MMA
              </h1>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td>
              <hr style="border:none; border-top:1px solid #eeeeee; margin:20px 0;">
            </td>
          </tr>

          <!-- Dynamic Content -->
          <tr>
            <td>
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:40px;">
              <hr style="border:none; border-top:1px solid #eeeeee; margin-bottom:20px;">
              <p style="font-size:13px; color:#888888; line-height:1.6; margin:0;">
                If you have any questions, contact our support team.
              </p>
                © ${new Date().getFullYear()} Fantasy MMA. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
`;

// ==========================
// 🔐 CREATE ACCOUNT TEMPLATE
// ==========================
const createAccount = (values: ICreateAccount) => {
  const content = `
    <h2 style="margin:0 0 20px 0; font-size:20px; color:#222;">
      Welcome ${values.name},
    </h2>

    <p style="font-size:15px; line-height:1.7; color:#555; margin-bottom:25px;">
      Thank you for creating an account with Fantasy MMA.
      Please use the verification code below to activate your account.
    </p>

    <div style="text-align:center; margin:30px 0;">
      <span style="
        display:inline-block;
        background:${PRIMARY_COLOR};
        color:#ffffff;
        padding:14px 28px;
        border-radius:8px;
        font-size:24px;
        letter-spacing:4px;
        font-weight:600;">
        ${values.otp}
      </span>
    </div>

    <p style="font-size:14px; color:#777; margin-top:10px;">
      This code is valid for <strong>5 minutes</strong>.
    </p>

    <p style="font-size:13px; color:#999; margin-top:25px;">
      If you did not request this account, please ignore this email.
    </p>
  `;

  return {
    to: values.email,
    subject: "Verify your Fantasy MMA account",
    html: baseTemplate(content),
  };
};

// ==========================
// 🔁 RESET PASSWORD (OTP)
// ==========================
const resetPassword = (values: IResetPassword) => {
  const content = `
    <h2 style="margin:0 0 20px 0; font-size:20px; color:#222;">
      Password Reset Code
    </h2>

    <p style="font-size:15px; line-height:1.7; color:#555; margin-bottom:25px;">
      Use the single-use code below to reset your password.
    </p>

    <div style="text-align:center; margin:30px 0;">
      <span style="
        display:inline-block;
        background:${PRIMARY_COLOR};
        color:#ffffff;
        padding:14px 28px;
        border-radius:8px;
        font-size:24px;
        letter-spacing:4px;
        font-weight:600;">
        ${values.otp}
      </span>
    </div>

    <p style="font-size:14px; color:#777;">
      This code expires in <strong>3 minutes</strong>.
    </p>

    <p style="font-size:13px; color:#999; margin-top:25px;">
      If you didn’t request this, you can safely ignore this email.
    </p>
  `;

  return {
    to: values.email,
    subject: "Reset your Fantasy MMA password",
    html: baseTemplate(content),
  };
};

// ==========================
// 🔗 FORGET PASSWORD (LINK)
// ==========================
const forgetPassword = (values: { email: string; token: string }) => {
  const content = `
    <h2 style="margin:0 0 20px 0; font-size:20px; color:#222;">
      Reset Your Password
    </h2>

    <p style="font-size:15px; line-height:1.7; color:#555; margin-bottom:25px;">
      Click the button below to securely reset your password.
    </p>

    <div style="text-align:center; margin:30px 0;">
      <a href="${config.frontend_url}/reset-password?token=${values.token}"
         style="
           background:${PRIMARY_COLOR};
           color:#ffffff;
           text-decoration:none;
           padding:14px 30px;
           border-radius:8px;
           font-size:15px;
           font-weight:600;
           display:inline-block;">
         Reset Password
      </a>
    </div>

    <p style="font-size:13px; color:#777;">
      This link will expire shortly for security reasons.
    </p>

    <p style="font-size:13px; color:#999; margin-top:15px;">
      If you didn’t request this password reset, you can ignore this email.
    </p>
  `;

  return {
    to: values.email,
    subject: "Password Reset Request",
    html: baseTemplate(content),
  };
};

// ==========================
// 📧 CONTACT EMAIL TEMPLATE
// ==========================
const contactEmail = (values: IContactEmail) => {
  const content = `
    <h2 style="margin:0 0 20px 0; font-size:20px; color:#222;">
      New Contact Form Message
    </h2>

    <div style="background:#f9f9f9; padding:20px; border-radius:8px; border-left:4px solid ${PRIMARY_COLOR};">
      <p style="margin:0 0 10px 0; font-size:14px; color:#555;">
        <strong>From:</strong> ${values.name} (${values.email})
      </p>
      <p style="margin:0 0 10px 0; font-size:14px; color:#555;">
        <strong>Subject:</strong> ${values.subject}
      </p>
      <hr style="border:none; border-top:1px solid #eee; margin:15px 0;">
      <p style="margin:0; font-size:15px; line-height:1.6; color:#333; white-space:pre-wrap;">
        ${values.message}
      </p>
    </div>

    <p style="font-size:13px; color:#999; margin-top:25px;">
      This message was sent via the contact form on Fantasy MMA.
    </p>
  `;

  return {
    to: config.email.from as string, // Sending to admin email
    subject: `Contact Form: ${values.subject}`,
    html: baseTemplate(content),
  };
};

export const emailTemplate = {
  createAccount,
  resetPassword,
  forgetPassword,
  contactEmail,
};
