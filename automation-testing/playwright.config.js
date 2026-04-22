/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  testDir: "./tests",
  testMatch: /.*\.recorded\.js$/,
  timeout: 30000,
  reporter: [
    ["list"],
    ["./reporters/roster-xlsx-reporter.js"],
  ],
  expect: {
    timeout: 5000,
  },
  use: {
    // Show the browser locally like Selenium, but keep CI runs headless.
    headless: !!process.env.CI,
    viewport: { width: 1440, height: 1200 },
    trace: "on-first-retry",
  },
};
