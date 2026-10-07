"use client";
import { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { Button } from "./ui/button";
export type FlatRow = {
  id: string;
  number: string;
  floor: number;
  flatType: string;
  areaSqFt: string;
  billableAreaSqFt: string;
  areaBasis: string;
  classification: string;
  residentRemarks: string;
  block: { id: string; name: string; phase: { id: string; name: string } };
  occupancies?: { person: { name: string; approvedPhone: string | null } }[];
};
export function Status({ value }: { value: string }) {
  return (
    <span
      className={
        "badge " +
        (value === "VACANT" || value === "UNSOLD"
          ? "bg-slate-100 text-slate-700"
          : "bg-teal-50 text-teal-900")
      }
    >
      {value.replaceAll("_", " ").toLowerCase()}
    </span>
  );
}
export function FlatDirectory({
  rows,
  open,
  map,
}: {
  rows: FlatRow[];
  open: (id: string) => void;
  map: boolean;
}) {
  const columns = useMemo<ColumnDef<FlatRow>[]>(
    () => [
      {
        accessorKey: "number",
        header: "Flat",
        cell: ({ row }) => (
          <button
            className="font-bold text-teal-800 underline underline-offset-4"
            onClick={() => open(row.original.id)}
          >
            {row.original.block.name} / {row.original.number}
          </button>
        ),
      },
      {
        id: "phase",
        accessorFn: (row) => row.block.phase.name,
        header: "Phase",
      },
      { accessorKey: "floor", header: "Floor" },
      { accessorKey: "flatType", header: "Type" },
      { accessorKey: "areaSqFt", header: "Area (sq ft)" },
      {
        accessorKey: "classification",
        header: "Occupancy",
        cell: ({ row }) => <Status value={row.original.classification} />,
      },
      {
        id: "resident",
        header: "Current resident",
        cell: ({ row }) =>
          row.original.occupancies?.map((o) => o.person.name).join(", ") || "—",
      },
    ],
    [open],
  );
  // This component is deliberately not React-Compiler memoized; TanStack owns row state.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  if (!rows.length)
    return (
      <div className="panel py-14 text-center">
        <h3 className="font-semibold">No flats to display</h3>
        <p className="mt-2 text-sm text-slate-600">
          Try a different search or ask an administrator to grant access.
        </p>
      </div>
    );
  if (map) {
    const groups = Object.groupBy(
      rows,
      (r) => `${r.block.phase.name} · ${r.block.name} · Floor ${r.floor}`,
    );
    return (
      <div className="space-y-5">
        {Object.entries(groups).map(([label, flats]) => (
          <section className="panel" key={label}>
            <h3 className="mb-4 font-bold">{label}</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {flats?.map((f) => (
                <button
                  key={f.id}
                  onClick={() => open(f.id)}
                  className="rounded-xl border border-slate-200 p-4 text-left hover:border-teal-700"
                >
                  <strong className="text-lg">{f.number}</strong>
                  <p className="my-2 text-xs text-slate-600">
                    {f.flatType} · {f.areaSqFt} sq ft
                  </p>
                  <Status value={f.classification} />
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }
  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((h) => (
                  <th key={h.id} className="whitespace-nowrap px-5 py-4">
                    <button
                      disabled={!h.column.getCanSort()}
                      onClick={h.column.getToggleSortingHandler()}
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}{" "}
                      {h.column.getIsSorted() === "asc"
                        ? "↑"
                        : h.column.getIsSorted() === "desc"
                          ? "↓"
                          : ""}
                    </button>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-5 py-5">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 md:hidden">
        {rows.map((f) => (
          <article key={f.id} className="panel">
            <div className="flex justify-between gap-2">
              <h3 className="font-bold">
                {f.block.name} / {f.number}
              </h3>
              <Status value={f.classification} />
            </div>
            <p className="my-3 text-sm text-slate-600">
              {f.block.phase.name} · Floor {f.floor} · {f.areaSqFt} sq ft
            </p>
            <p className="mb-3 text-sm">
              {f.occupancies?.map((o) => o.person.name).join(", ")}
            </p>
            <Button variant="outline" onClick={() => open(f.id)}>
              View flat
            </Button>
          </article>
        ))}
      </div>
    </>
  );
}
