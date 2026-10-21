import { execFileSync } from "node:child_process";

import { testDatabaseUrl } from "./db";

/** Creates the test database if needed and applies all migrations, once per test run. */
export default function setup() {
  execFileSync(process.platform === "win32" ? "corepack.cmd" : "yarn", process.platform === "win32" ? ["yarn", "prisma", "migrate", "deploy"] : ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
    stdio: "pipe",
    shell: process.platform === "win32",
  });
}
