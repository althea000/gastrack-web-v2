require("dotenv").config();

function validateEmailConfiguration() {
  const missing = ["RESEND_API_KEY", "RESEND_FROM"].filter((key) => !process.env[key]?.trim());
  if (missing.length) {
    throw new Error(`Email service is not configured. Missing: ${missing.join(", ")}.`);
  }
}

async function sendResendMail({ from, to, subject, html, text, attachments }) {
  validateEmailConfiguration();

  const resendAttachments = attachments?.map((attachment) => ({
    filename: attachment.filename,
    content: Buffer.isBuffer(attachment.content)
      ? attachment.content.toString("base64")
      : attachment.content,
  }));
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
      ...(resendAttachments ? { attachments: resendAttachments } : {}),
    }),
    signal: AbortSignal.timeout(15000),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Resend rejected the email (${response.status}): ${body.message || body.error || "Unknown error"}`);
  }

  return { ...body, accepted: Array.isArray(to) ? to : [to] };
}

const transporter = { sendMail: sendResendMail };

module.exports = { transporter, sendMail: sendResendMail };
