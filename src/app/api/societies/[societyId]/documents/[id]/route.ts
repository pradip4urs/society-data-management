import { context, failure } from "@/server/http";
import { downloadDocument } from "@/server/documents";
export async function GET(
  request: Request,
  args: { params: Promise<{ societyId: string; id: string }> },
) {
  try {
    const { societyId, id } = await args.params;
    const result = await downloadDocument(
      await context(request, societyId),
      id,
    );
    return new Response(new Uint8Array(result.bytes), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": `attachment; filename="${result.row.originalName.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(result.row.originalName)}`,
      },
    });
  } catch (error) {
    return failure(error);
  }
}
