"use client";
import { useEffect, useState, useId } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "./ui/button";
export type Field = {
  name: string;
  label: string;
  type?: "date" | "number" | "email" | "textarea";
  optional?: boolean;
  options?: { value: string; label: string }[];
  default?: string;
};
export function MasterForm({
  title,
  fields,
  schema,
  save,
}: {
  title: string;
  fields: Field[];
  schema?: z.ZodType;
  save: (data: Record<string, unknown>) => Promise<void>;
}) {
  const formId = useId();
  const form = useForm<Record<string, string>>({
    defaultValues: Object.fromEntries(
      fields.map((f) => [f.name, f.default ?? ""]),
    ),
  });
  const [message, setMessage] = useState("");
  const dirty = form.formState.isDirty;
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function submit(values: Record<string, string>) {
    setMessage("");
    try {
      const data = Object.fromEntries(
        fields.map((f) => [
          f.name,
          f.name === "active"
            ? values[f.name] === "true"
            : f.type === "number"
              ? Number(values[f.name])
              : f.optional && !values[f.name]
                ? f.name.endsWith("Remarks")
                  ? ""
                  : null
                : values[f.name],
        ]),
      );
      if (schema) {
        const result = schema.safeParse(data);
        if (!result.success) {
          for (const issue of result.error.issues)
            form.setError(String(issue.path[0]), { message: issue.message });
          return;
        }
      }
      await save(data);
      form.reset();
      setMessage("Saved successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed");
    }
  }
  return (
    <section className="panel">
      <h3 className="mb-5 text-lg font-bold">{title}</h3>
      <form
        data-dirty={dirty ? "true" : "false"}
        onSubmit={form.handleSubmit(submit)}
        className="grid gap-4 sm:grid-cols-2"
      >
        {fields.map((f) => (
          <div
            key={f.name}
            className={
              "field " + (f.type === "textarea" ? "sm:col-span-2" : "")
            }
          >
            <label htmlFor={formId + f.name}>{f.label}</label>
            {f.options ? (
              <select
                id={formId + f.name}
                {...form.register(f.name, { required: !f.optional })}
              >
                <option value="">Select…</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : f.type === "textarea" ? (
              <textarea
                id={formId + f.name}
                {...form.register(f.name, { required: !f.optional })}
                rows={3}
              />
            ) : (
              <input
                id={formId + f.name}
                type={f.type ?? "text"}
                step={f.type === "number" ? "1" : undefined}
                {...form.register(f.name, { required: !f.optional })}
              />
            )}
            {form.formState.errors[f.name] && (
              <span className="error">
                {form.formState.errors[f.name]?.message || "Required"}
              </span>
            )}
          </div>
        ))}
        <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving…" : "Save"}
          </Button>
          {dirty && (
            <span className="text-xs text-amber-800">Unsaved changes</span>
          )}
          <span className="text-sm" role="status">
            {message}
          </span>
        </div>
      </form>
    </section>
  );
}
