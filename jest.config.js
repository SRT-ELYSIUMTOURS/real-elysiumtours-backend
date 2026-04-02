module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: [
    "**/*.test.js",
    "**/*.spec.js",
  ],
  setupFiles: ["<rootDir>/tests/setup.js"],
  coverageDirectory: "coverage",
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "/tests/",
    "/scripts/",
    "/docs/",
  ],
  coverageThreshold: {
    "services/*.service.js": {
      branches: 70,
      functions: 70,
      lines: 70,
    },
  },
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
};
