"use strict";

module.exports = {
  redis: process.env.REDIS_URL || "redis://localhost:6379",
  queues: {
    PAYMENT_REMINDERS: "payment-reminders",
    SLA_TRACKER: "sla-tracker",
    EMAIL_QUEUE: "email-queue",
    NOTIFICATION_QUEUE: "notification-queue",
    OTP_EXPIRY: "otp-expiry",
    AUTO_CANCEL_UNCONFIRMED: "auto-cancel-unconfirmed",
    EXPIRE_WAITLIST_OFFERS: "expire-waitlist-offers",
  },
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
  },
};
