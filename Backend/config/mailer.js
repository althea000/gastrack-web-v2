const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  family: 4,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true", // true for port 465, false for 587/25
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function validateSmtpConfiguration() {
  const missing = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"].filter((key) => !process.env[key]?.trim());
  if (missing.length) {
    throw new Error(`SMTP is not configured. Missing: ${missing.join(", ")}.`);
  }
}

async function sendMail({ to, subject, html, text }) {
  validateSmtpConfiguration();
  const from = process.env.SMTP_FROM || `"GasTrack" <${process.env.SMTP_USER}>`;
  return transporter.sendMail({ from, to, subject, html, text });
}

module.exports = { transporter, sendMail };
