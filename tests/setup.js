"use strict";

require("dotenv").config();

// Override env vars for test environment
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "error";  // Suppress logs during tests
process.env.MONGO_URI = process.env.TEST_MONGO_URI || "mongodb://localhost:27017/elysium-tours-test";
process.env.JWT_SECRET = "test-jwt-secret-do-not-use-in-production";
process.env.JWT_EXPIRY = "1h";
process.env.REFRESH_TOKEN_EXPIRY = "7d";
process.env.OTP_EXPIRY_MINUTES = "10";

// Suppress unhandled promise rejection warnings in tests
process.on("unhandledRejection", (reason) => {
  // Only log in non-test environments
  if (process.env.NODE_ENV !== "test") {
    console.error("Unhandled Rejection:", reason);
  }
});
