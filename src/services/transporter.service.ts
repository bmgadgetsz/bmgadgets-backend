import nodemailer from "nodemailer";
import env from "@/config/env.js";

// Create a reusable transporter object
const transporter = nodemailer.createTransport({
  host: "smtp-mail.outlook.com",
  port: 587,
  secure: false,
  auth: {
    user: env.email.user,
    pass: env.email.pass,
  },
  tls: {
    ciphers: "SSLv3",
  },
});

export const sendMail = async (to: string, subject: string, html: string) => {
  try {
    await transporter.sendMail({
      from: env.email.user,
      to,
      subject,
      html,
    });
    // eslint-disable-next-line no-console
    console.log(`[SMTP] Email sent to ${to} with subject: ${subject}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[SMTP] Error sending email:", error);
  }
};

export default transporter;
