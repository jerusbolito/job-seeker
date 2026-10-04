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

// Regenerate can fail with EPERM on Windows when a running dev server locks
// the query engine DLL — in that case a usable client is already in place.
try {
  execSync("npx prisma generate", { stdio: "inherit" });
} catch {
  console.warn("prisma generate failed; using existing generated client");
}
