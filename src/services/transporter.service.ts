import dns from "node:dns";
import nodemailer, { type SendMailOptions } from "nodemailer";
import axios from "axios";
import env from "@/config/env.js";

// Node 17+ prefers IPv6 results; many hosts (incl. Render) have no IPv6 route,
// which makes SMTP fail with ENETUNREACH even when the port itself is open.
dns.setDefaultResultOrder("ipv4first");

/**
 * IMPORTANT (production): Render FREE web services block ALL outbound SMTP
 * traffic (ports 25/465/587) at the network level since Sep 2025:
 * https://render.com/changelog/free-web-services-will-no-longer-allow-outbound-traffic-to-smtp-ports
 * Nodemailer/Gmail can therefore never connect from a free instance, no matter
 * how it is configured. The escape hatch is sending over HTTPS (port 443).
 *
 * Set BREVO_API_KEY to route all email through Brevo's HTTPS API.
 * When it is not set, we fall back to plain Gmail SMTP (works locally / on
 * paid instances).
 */
const smtpTransporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: env.email.user,
    pass: env.email.pass,
  },
  connectionTimeout: 10000,
  greetingTimeout: 5000,
  socketTimeout: 15000,
});

const useBrevo = !!env.email.brevoApiKey;

/** Send through Brevo's HTTPS API (port 443, never blocked by Render). */
const sendViaBrevo = async (options: SendMailOptions) => {
  const toList = (Array.isArray(options.to) ? options.to : [options.to])
    .filter(Boolean)
    .map((addr) => ({ email: String(addr) }));

  const attachment = (options.attachments || [])
    .filter((a) => a.content)
    .map((a) => ({
      name: a.filename || "attachment",
      content: Buffer.isBuffer(a.content)
        ? a.content.toString("base64")
        : Buffer.from(String(a.content)).toString("base64"),
    }));

  await axios.post(
    "https://api.brevo.com/v3/smtp/email",
    {
      sender: { email: env.email.user, name: "BMGadgets" },
      to: toList,
      subject: options.subject,
      htmlContent: options.html ? String(options.html) : undefined,
      textContent: options.text ? String(options.text) : undefined,
      ...(attachment.length ? { attachment } : {}),
    },
    {
      headers: {
        "api-key": env.email.brevoApiKey,
        "content-type": "application/json",
      },
      timeout: 15000,
    },
  );
};

/**
 * Unified mail dispatcher. Same call signature as nodemailer's
 * transporter.sendMail so existing call sites keep working.
 */
const dispatchMail = async (options: SendMailOptions): Promise<void> => {
  if (useBrevo) {
    try {
      await sendViaBrevo(options);
      return;
    } catch (err) {
      const detail = axios.isAxiosError(err)
        ? JSON.stringify(err.response?.data) || err.message
        : (err as Error)?.message;
      // eslint-disable-next-line no-console
      console.error(
        `[MAIL] Brevo API failed (${detail}); falling back to SMTP...`,
      );
    }
  }
  await smtpTransporter.sendMail({ from: env.email.user, ...options });
};

// Log the active transport once at startup so production logs make the
// email path obvious, and surface SMTP reachability problems immediately.
// eslint-disable-next-line no-console
console.log(
  `[MAIL] Transport: ${useBrevo ? "Brevo HTTPS API (+SMTP fallback)" : "Gmail SMTP only"}`,
);
if (!useBrevo && env.email.user && env.email.pass) {
  smtpTransporter
    .verify()
    .then(() => {
      // eslint-disable-next-line no-console
      console.log(
        "[MAIL] SMTP connection verified: smtp.gmail.com is reachable",
      );
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(
        "[MAIL] SMTP connection FAILED. If this is a Render FREE instance, outbound SMTP ports are blocked by Render - set BREVO_API_KEY to send over HTTPS instead. Error:",
        err?.message || err,
      );
    });
}

export const sendMail = async (to: string, subject: string, html: string) => {
  try {
    await dispatchMail({ to, subject, html });
    // eslint-disable-next-line no-console
    console.log(`[MAIL] Email sent to ${to} with subject: ${subject}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[MAIL] Error sending email:", error);
  }
};

// Default export keeps the nodemailer-like `.sendMail()` surface used across
// the codebase (auth OTP, payout statements, etc.).
const transporter = {
  sendMail: dispatchMail,
};

export default transporter;
