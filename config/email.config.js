"use strict";

// Use OAuth2 when all three Google OAuth vars are present; fall back to SMTP app-password.
const useOAuth2 = !!(
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_REFRESH_TOKEN
);

const smtpAuth = useOAuth2
  ? {
      type: "OAuth2",
      user: process.env.GOOGLE_OAUTH_USER || process.env.SMTP_USER,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
    }
  : {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    };

module.exports = {
  smtp: {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false,
    auth: smtpAuth,
  },
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY,
  },
  from: process.env.FROM_EMAIL || process.env.GOOGLE_OAUTH_USER || process.env.SMTP_USER || "noreply@elysiumtours.com",
  fromName: "Elysium Tours",
  useSendgridFallback: !!process.env.SENDGRID_API_KEY,
  // Use Gmail REST API (HTTPS) instead of SMTP when OAuth2 creds are present.
  // SMTP is blocked on Render and many cloud platforms; HTTPS is always open.
  useGmailApi: useOAuth2,
};
