import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { auth } from "./auth";
import { getContext } from "./permissions";
import { DomainError } from "./errors";
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export function checkOrigin(request: Request) {
  const allowed = new URL(
    process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  ).origin;
  if (request.headers.get("origin") !== allowed)
    throw new DomainError(403, "Invalid request origin");
}
export async function context(request: Request, societyId: string) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) throw new DomainError(401, "Sign in required");
  return getContext(session.user.id, societyId);
}
export async function body(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 512000)
    throw new DomainError(413, "Request is too large");
  const reader = request.body?.getReader();
  if (!reader) throw new DomainError(400, "Request body is required");
  const decoder = new TextDecoder();
  let raw = "",
    bytes = 0;
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    bytes += chunk.value.length;
    if (bytes > 512000) {
      await reader.cancel();
      throw new DomainError(413, "Request is too large");
    }
    raw += decoder.decode(chunk.value, { stream: true });
  }
  raw += decoder.decode();
  try {
    return JSON.parse(raw);
  } catch {
    throw new DomainError(400, "Invalid JSON");
  }
}
export async function multipart(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new DomainError(400, "Upload body is required");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.length;
    if (size > 10500000) {
      await reader.cancel();
      throw new DomainError(413, "Upload is too large");
    }
    chunks.push(chunk.value);
  }
  const data = Buffer.concat(chunks);
  try {
    return await new Response(data, {
      headers: { "Content-Type": request.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    throw new DomainError(400, "Invalid multipart upload");
  }
}
export function failure(error: unknown) {
  if (error instanceof DomainError)
    return json({ error: error.message }, error.status);
  if (error instanceof Error && error.message === "MFA_REQUIRED")
    return json(
      {
        error: "Set up two-factor authentication to continue",
        code: "MFA_REQUIRED",
      },
      403,
    );
  if (error instanceof ZodError)
    return json(
      {
        error: "Validation failed",
        issues: error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      400,
    );
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") return json({ error: "Record not found" }, 404);
    if (["P2002", "P2003", "P2004", "P2010"].includes(error.code))
      return json(
        {
          error:
            "Record conflicts with a database constraint or society boundary",
        },
        409,
      );
  }
  // Error text and input may contain PII; do not echo/log them.
  return json(
    {
      error:
        "The operation could not be completed. Retry or contact an administrator.",
    },
    500,
  );
}
