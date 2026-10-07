import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { failure, json } from "@/server/http";
export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return json({ error: "Sign in required" }, 401);
    const memberships = await db.societyMembership.findMany({
      where: { userId: session.user.id, active: true },
      select: {
        id: true,
        role: true,
        society: { select: { id: true, name: true } },
      },
    });
    return json({
      user: {
        name: session.user.name,
        email: session.user.email,
        twoFactorEnabled: session.user.twoFactorEnabled,
      },
      memberships,
    });
  } catch (error) {
    return failure(error);
  }
}
