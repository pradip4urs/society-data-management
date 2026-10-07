import { db } from "../src/server/db";
import { readDocument } from "../src/server/storage";
try {
  let count = 0;
  for (const status of ["CLEAN", "QUARANTINED", "REJECTED"] as const) {
    let cursor: string | undefined;
    for (;;) {
      const rows = await db.attachment.findMany({
        where: { status },
        orderBy: { id: "asc" },
        take: 100,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (!rows.length) break;
      for (const row of rows) {
        if (row.status === "CLEAN")
          await readDocument(
            process.env.DOCUMENT_ROOT!,
            row.id,
            "clean",
            row.sha256,
          );
        else {
          try {
            await readDocument(
              process.env.DOCUMENT_ROOT!,
              row.id,
              "quarantine",
              row.sha256,
            );
          } catch {
            if (row.status === "REJECTED")
              throw new Error("Rejected object absent");
            await readDocument(
              process.env.DOCUMENT_ROOT!,
              row.id,
              "clean",
              row.sha256,
            );
          }
        }
        count++;
      }
      cursor = rows.at(-1)!.id;
    }
  }
  console.log(
    `Verified ${count} immutable document hashes against restored metadata.`,
  );
} finally {
  await db.$disconnect();
}
