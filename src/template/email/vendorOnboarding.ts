import env from "@/config/env";

/**
 * Generates an email template for vendor approval notification.
 * @param vendorName - Name of the vendor.
 * @returns An object with subject and HTML content for the email.
 */
export const vendorApprovedTemplate = (vendorName: string) => {
  return {
    subject: "Your Vendor Registration is Initiated!",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Congratulations ${vendorName}!</h2>
        <p>Your vendor registration has been initiated. 🎉</p>
        <p>You can now log in to our portal and complete your profile to move forward with the onboarding process.</p>
        <p><a href="${env.app.vendorPanelBaseUrl}" 
              style="background: #4CAF50; color: white; padding: 10px 20px; text-decoration: none;">
          Login Now
        </a></p>
        <p><b>- Compliance Team</b></p>
      </div>
    `,
  };
};

/**
 * Generates an email template for KYC approval notification.
 * @param vendorName - Name of the vendor.
 * @returns An object with subject and HTML content for the email.
 */
export const kycApprovedTemplate = (vendorName: string) => ({
  subject: "KYC Approved – Dashboard Access Enabled",
  html: `
    <p>Hi ${vendorName},Your KYC verification has been approved. 🎉👉 Go to Dashboard 
    </p>
    <p>- Compliance Team</p>
  `,
});

/**
 * Generates an email template for registration rejection notification.
 * @param vendorName - Name of the vendor.
 * @param reason - Optional reason for rejection.
 * @returns An object with subject and HTML content for the email.
 */
export const registrationRejectedTemplate = (
  vendorName: string,
  reason?: string,
) => ({
  subject: "Your Registration is Rejected ❌",
  html: `
    <h2>Hello ${vendorName},</h2>
    <p>We’re sorry to inform you that your registration has been rejected.</p>
    ${reason ? `<p>Reason: ${reason}</p>` : ""}
    <p>If you believe this is a mistake, please contact our support team.</p>
    <p>Best regards,<br/>The Team</p>
  `,
});

/**
 * Generates an email template for KYC rejection notification.
 * @param vendorName - Name of the vendor.
 * @param reason - Optional reason for rejection.
 * @returns An object with subject and HTML content for the email.
 */
export const kycRejectedTemplate = (vendorName: string, reason?: string) => ({
  subject: "KYC Rejected – Action Required",
  html: `

    <p>Hi ${vendorName},Your KYC request was rejected due to: ${reason ? `<p>${reason}</p>` : ""}.Please resubmit here: Resubmit KYC</p>
    <p>- Compliance Team</p>
  `,
});
