import { bootstrapAdmin } from "../src/server/bootstrap";
import { db } from "../src/server/db";
let password = "";
try {
  for await (const chunk of process.stdin) {
    password += chunk.toString();
    if (password.length > 256) throw new Error("Password input too long");
  }
  await bootstrapAdmin({
    societyName: process.env.BOOTSTRAP_SOCIETY_NAME,
    name: process.env.BOOTSTRAP_ADMIN_NAME,
    email: process.env.BOOTSTRAP_ADMIN_EMAIL,
    password: password.trimEnd(),
  });
  console.log(
    "First admin created. Sign in and enroll TOTP before business access.",
  );
} catch {
  console.error(
    "Bootstrap failed: check input and confirm installation is empty.",
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
