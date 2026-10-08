import {
  bootstrapAdmin,
  bootstrapStatus,
  InstallationAlreadyInitialized,
} from "../src/server/bootstrap";
import { db } from "../src/server/db";
import { ZodError } from "zod";
let password = "";
try {
  if (process.argv.includes("--check")) {
    const { initialized } = await bootstrapStatus();
    console.log(
      initialized
        ? "Installation already initialized. First-admin bootstrap is unavailable; sign in or provision another account in the existing society."
        : "Installation is empty. First-admin bootstrap is available; supply the three BOOTSTRAP settings and a 16–128 character password on stdin.",
    );
    if (initialized) process.exitCode = 2;
  } else {
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
  }
} catch (error) {
  if (error instanceof InstallationAlreadyInitialized) {
    console.error(
      "Bootstrap refused: this installation already has users or a society. It does not reset an existing password. Sign in or use dist/provision-user.js for an additional account. Use a distinct COMPOSE_PROJECT_NAME and data/secrets directories for a separate empty installation; do not delete existing volumes.",
    );
  } else if (error instanceof ZodError) {
    const settings = {
      societyName: "BOOTSTRAP_SOCIETY_NAME",
      name: "BOOTSTRAP_ADMIN_NAME",
      email: "BOOTSTRAP_ADMIN_EMAIL",
      password: "password on stdin (16–128 characters)",
    };
    const fields = [
      ...new Set(
        error.issues.map(
          (issue) =>
            settings[issue.path[0] as keyof typeof settings] ??
            "bootstrap input",
        ),
      ),
    ];
    console.error(
      `Bootstrap input is missing or invalid: ${fields.join(", ")}.`,
    );
  } else {
    console.error(
      "Bootstrap failed while reading input or connecting to the database. Check input size, deployment credential preflight and applied migrations. No password or database error details are logged.",
    );
  }
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
