import nodemailer from "nodemailer";
import env from "@/config/env.js";

// Create a reusable transporter object
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: env.email.user,
    pass: env.email.pass,
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
