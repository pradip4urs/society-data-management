import { parse } from "csv-parse/sync";
import { z } from "zod";
import { DomainError } from "./errors";
import { flatInput } from "./validation";
export function parseFlatCsv(input: unknown) {
  const { csv, commit } = z
    .object({ csv: z.string().min(1).max(400000), commit: z.boolean() })
    .strict()
    .parse(input);
  try {
    const headers = [
      "blockId",
      "number",
      "floor",
      "flatType",
      "areaSqFt",
      "billableAreaSqFt",
      "areaBasis",
      "classification",
      "internalRemarks",
      "residentRemarks",
    ];
    const rows: Record<string, string>[] = parse(csv, {
      bom: true,
      skip_empty_lines: true,
      max_record_size: 4096,
      columns: (columns: string[]) => {
        if (
          columns.length !== new Set(columns).size ||
          columns.some((c) => !headers.includes(c)) ||
          headers.slice(0, 8).some((c) => !columns.includes(c))
        )
          throw new Error("Invalid CSV headers");
        return columns;
      },
    });
    if (!rows.length || rows.length > 500)
      throw new Error("CSV requires 1–500 rows");
    return {
      commit,
      rows: rows.map((row, i) => {
        if (!/^-?\d+$/.test(row.floor))
          throw new Error(`Invalid floor on row ${i + 2}`);
        const parsed = flatInput.safeParse({
          ...row,
          floor: Number(row.floor),
        });
        if (!parsed.success) throw new Error(`Invalid fields on row ${i + 2}`);
        return parsed.data;
      }),
    };
  } catch (error) {
    throw new DomainError(
      400,
      error instanceof Error &&
        /^(Invalid CSV headers|CSV requires|Invalid floor on row|Invalid fields on row)/.test(
          error.message,
        )
        ? error.message
        : "CSV is malformed",
    );
  }
}
