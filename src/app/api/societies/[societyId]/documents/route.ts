import { context, checkOrigin, failure, json, multipart } from "@/server/http";
import { requireCapability } from "@/server/permissions";
import { rateLimit } from "@/server/rate-limit";
import { uploadDocument, listDocuments } from "@/server/documents";
import { DomainError } from "@/server/errors";
import { z } from "zod";
export async function GET(
  request: Request,
  args: { params: Promise<{ societyId: string }> },
) {
  try {
    const ctx = await context(request, (await args.params).societyId);
    const query = z
      .object({ flatId: z.string().min(1).max(100) })
      .strict()
      .parse(Object.fromEntries(new URL(request.url).searchParams));
    return json(await listDocuments(ctx, query.flatId));
  } catch (error) {
    return failure(error);
  }
}
export async function POST(
  request: Request,
  args: { params: Promise<{ societyId: string }> },
) {
  try {
    checkOrigin(request);
    const ctx = await context(request, (await args.params).societyId);
    requireCapability(ctx, "master.write");
    await rateLimit(`upload:${ctx.societyId}:${ctx.userId}`, 10);
    // Caddy also applies a body limit; reject chunked/unknown length before buffering.
    const size = Number(request.headers.get("content-length"));
    if (!size || size > 10500000)
      throw new DomainError(
        413,
        "Upload size is required and limited to 10 MiB",
      );
    const form = await multipart(request);
    const file = form.get("file");
    if (
      [...form.keys()].some(
        (key) => !["file", "flatId", "residentVisible"].includes(key),
      ) ||
      form.getAll("file").length !== 1 ||
      form.getAll("flatId").length !== 1
    )
      throw new DomainError(400, "Unexpected or duplicate upload fields");
    if (!(file instanceof File) || typeof form.get("flatId") !== "string")
      throw new DomainError(400, "File and flat are required");
    return json(
      await uploadDocument(
        ctx,
        String(form.get("flatId")),
        file,
        form.get("residentVisible") === "true",
      ),
      202,
    );
  } catch (error) {
    return failure(error);
  }
}
