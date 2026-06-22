"use strict";

module.exports = {
  secretKey: process.env.PAYSTACK_SECRET_KEY,
  publicKey: process.env.PAYSTACK_PUBLIC_KEY,
  webhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET,
  baseUrl: "https://api.paystack.co",
  currency: "GHS", // Ghana Cedis
  channels: ["mobile_money", "card", "bank"],
  callbackUrl: `${process.env.FRONTEND_URL}/payment/verify`,
};
