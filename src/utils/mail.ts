import env from "@/config/env";
import transporter from "@/services/transporter.service";

const sendEmail = async (to: string, subject: string, html: string) => {
  if (env.app.nodeEnv === "development") {
    // eslint-disable-next-line no-console
    console.log(`📧 Email skipped in development: ${subject}`);
    return;
  }

  await transporter.sendMail({
    from: env.email.user,
    to,
    subject,
    html,
  });

  // eslint-disable-next-line no-console
  console.log(`✅ Email sent to ${to}`);
};

export default sendEmail;
