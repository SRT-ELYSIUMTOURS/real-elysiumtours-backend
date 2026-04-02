"use strict";

module.exports = {
  smtp: {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  },
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY,
  },
  from: process.env.FROM_EMAIL || "noreply@elysiumtours.com",
  fromName: "Elysium Tours",
  useSendgridFallback: !!process.env.SENDGRID_API_KEY,
};
