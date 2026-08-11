import dns from "node:dns";
import nodemailer, { type SendMailOptions } from "nodemailer";
import axios from "axios";
import env from "@/config/env.js";

dns.setDefaultResultOrder("ipv4first");

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
const isProduction = env.app.nodeEnv === "production";

const formatBrevoError = (err: unknown): string => {
  if (!axios.isAxiosError(err)) return (err as Error)?.message || String(err);
  const data = err.response?.data;
  if (typeof data === "string") return data;
  if (data && typeof data === "object") {
    const { message: brevoMessage, code } = data as {
      message?: string;
      code?: string;
    };
    return [code, brevoMessage].filter(Boolean).join(": ") || err.message;
  }
  return err.message;
};

/** Send through Brevo's HTTPS API (port 443, works on Render free tier). */
const sendViaBrevo = async (options: SendMailOptions) => {
  if (!env.email.user) {
    throw new Error(
      "EMAIL_USER is not set. Brevo requires a verified sender email in EMAIL_USER.",
    );
  }

  const toList = (Array.isArray(options.to) ? options.to : [options.to])
    .filter(Boolean)
    .map((addr) => ({ email: String(addr) }));

  if (!toList.length) {
    throw new Error("No recipient email address provided.");
  }

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

const dispatchMail = async (options: SendMailOptions): Promise<void> => {
  if (useBrevo) {
    try {
      await sendViaBrevo(options);
      return;
    } catch (err) {
      const detail = formatBrevoError(err);
      // eslint-disable-next-line no-console
      console.error(`[MAIL] Brevo API failed: ${detail}`);

      // On Render, SMTP is blocked — falling back would silently fail too.
      if (isProduction) {
        throw new Error(
          `Email delivery failed via Brevo: ${detail}. ` +
            "Verify BREVO_API_KEY and that EMAIL_USER is a verified sender in Brevo → Senders.",
        );
      }

      // eslint-disable-next-line no-console
      console.warn("[MAIL] Brevo failed in dev; trying Gmail SMTP fallback...");
    }
  }

  if (!env.email.user || !env.email.pass) {
    throw new Error(
      "Email is not configured. Set BREVO_API_KEY (production) or EMAIL_USER + EMAIL_PASS (local).",
    );
  }

  await smtpTransporter.sendMail({ from: env.email.user, ...options });
};

/** Check Brevo API key and sender verification at startup. */
export const verifyMailTransport = async (): Promise<void> => {
  if (!env.email.user) {
    // eslint-disable-next-line no-console
    console.warn("[MAIL] EMAIL_USER is not set — emails cannot be sent.");
    return;
  }

  if (useBrevo) {
    try {
      const [accountRes, sendersRes] = await Promise.all([
        axios.get("https://api.brevo.com/v3/account", {
          headers: { "api-key": env.email.brevoApiKey },
          timeout: 10000,
        }),
        axios.get("https://api.brevo.com/v3/senders", {
          headers: { "api-key": env.email.brevoApiKey },
          timeout: 10000,
        }),
      ]);

      const senders: { email?: string; active?: boolean }[] =
        sendersRes.data?.senders || [];
      const senderVerified = senders.some(
        (s) =>
          s.email?.toLowerCase() === env.email.user?.toLowerCase() && s.active,
      );

      // eslint-disable-next-line no-console
      console.log(
        `[MAIL] Brevo account OK (${accountRes.data?.email || "connected"}). ` +
          `Sender ${env.email.user}: ${senderVerified ? "verified" : "NOT VERIFIED — emails will fail"}`,
      );

      if (!senderVerified) {
        // eslint-disable-next-line no-console
        console.error(
          `[MAIL] ACTION REQUIRED: Add and verify "${env.email.user}" in Brevo → Senders & IP → Senders.`,
        );
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        `[MAIL] Brevo startup check failed: ${formatBrevoError(err)}`,
      );
    }
    return;
  }

  if (env.email.pass) {
    try {
      await smtpTransporter.verify();
      // eslint-disable-next-line no-console
      console.log("[MAIL] Gmail SMTP connection verified.");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        "[MAIL] Gmail SMTP unreachable:",
        (err as Error)?.message || err,
      );
    }
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      "[MAIL] No BREVO_API_KEY or EMAIL_PASS — email sending is disabled.",
    );
  }
};

// eslint-disable-next-line no-console
console.log(
  `[MAIL] Transport: ${useBrevo ? "Brevo HTTPS API" : "Gmail SMTP"} | sender: ${env.email.user || "(not set)"}`,
);

export const sendMail = async (to: string, subject: string, html: string) => {
  await dispatchMail({ to, subject, html });
  // eslint-disable-next-line no-console
  console.log(`[MAIL] Email sent to ${to} | subject: ${subject}`);
};

const transporter = {
  sendMail: dispatchMail,
};

export default transporter;
