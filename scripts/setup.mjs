import { execSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

if (!existsSync(".env")) {
  writeFileSync(
    ".env",
    `DATABASE_URL="file:./dev.db"\nAUTH_SECRET="${randomBytes(32).toString("base64")}"\n`
  );
  console.log("Created .env");
}

execSync("npx prisma migrate deploy", { stdio: "inherit" });
