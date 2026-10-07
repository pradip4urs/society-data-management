import { z } from "zod";
import { body, checkOrigin, context, failure, json } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import * as service from "@/server/services";
import { missing } from "@/server/errors";
type Params = { params: Promise<{ societyId: string; path: string[] }> };
export async function GET(request: Request, args: Params) {
  try {
    const { societyId, path } = await args.params;
    const ctx = await context(request, societyId);
    const query = new URL(request.url).searchParams;
    // Unknown query keys are rejected rather than turning into unconstrained filters.
    const q = z
      .object({
        q: z.string().max(100).optional(),
        page: z.coerce.number().int().min(1).max(10000).default(1),
      })
      .strict()
      .parse(Object.fromEntries(query));
    if (path.length > 2) throw missing();
    if (path[0] !== "flats" && path.length !== 1) throw missing();
    switch (path[0]) {
      case "flats":
        return json(
          path[1]
            ? await service.getFlat(ctx, path[1])
            : await service.listFlats(ctx, q.q, q.page),
        );
      case "hierarchy":
        return json(await service.hierarchy(ctx));
      case "admin-data":
        return json(await service.adminData(ctx));
      case "parking":
        return json(await service.listParking(ctx));
      case "profile":
        return json(await service.profile(ctx));
      case "audit":
        return json(await service.auditHistory(ctx));
      case "security":
        await rateLimit("security:" + societyId + ":" + ctx.userId, 20);
        return json(await service.securityLookup(ctx, q.q ?? ""));
      default:
        throw missing();
    }
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request, args: Params) {
  try {
    checkOrigin(request);
    const { societyId, path } = await args.params;
    const ctx = await context(request, societyId);
    await rateLimit("mutation:" + societyId + ":" + ctx.userId, 60);
    const input = await body(request);
    if (path.length !== 1) throw missing();
    if (path[0] === "import")
      return json(await service.importFlats(ctx, input));
    if (path[0] === "hierarchy")
      return json(await service.createHierarchy(ctx, input), 201);
    return json(await service.createMaster(ctx, path[0], input), 201);
  } catch (error) {
    return failure(error);
  }
}
export async function PATCH(request: Request, args: Params) {
  try {
    checkOrigin(request);
    const { societyId, path } = await args.params;
    const ctx = await context(request, societyId);
    await rateLimit("mutation:" + societyId + ":" + ctx.userId, 60);
    const input = await body(request);
    if (path.length > 2) throw missing();
    if (path[0] === "flats" && path[1])
      return json(await service.updateFlat(ctx, path[1], input));
    if (path[0] === "profile" && !path[1])
      return json(await service.updateProfile(ctx, input));
    if (path[0] === "policy" && !path[1])
      return json(await service.changePolicy(ctx, input));
    if (path[0] === "memberships" && !path[1])
      return json(await service.changeMembership(ctx, input));
    if (path[0] === "occupancies" && path[1])
      return json(await service.endOccupancy(ctx, path[1], input));
    if (
      ["ownerships", "allocations", "entitlements"].includes(path[0]) &&
      path[1]
    )
      return json(await service.endMaster(ctx, path[0], path[1], input));
    if (path[0] === "grants" && path[1]) {
      z.object({}).strict().parse(input);
      return json(await service.revokeGrant(ctx, path[1]));
    }
    throw missing();
  } catch (error) {
    return failure(error);
  }
}
