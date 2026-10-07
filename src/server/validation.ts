import { z } from "zod";
const text = z.string().trim().min(1).max(100);
export const id = z.string().min(1).max(100);
export const date = z.iso.date().transform((v) => new Date(v + "T00:00:00Z"));
export const area = z
  .string()
  .regex(
    /^(?:[1-9]\d{0,8}|0)(?:\.\d{1,3})?$/,
    "Use a positive decimal with up to 3 places",
  )
  .refine((v) => !/^0(?:\.0{1,3})?$/.test(v), "Area must be positive");
const range = { startsOn: date, endsOn: date.nullable().optional() };
const validRange = (v: { startsOn: Date; endsOn?: Date | null }) =>
  !v.endsOn || v.endsOn > v.startsOn;
export const flatInput = z
  .object({
    blockId: id,
    number: text,
    floor: z.number().int().min(-10).max(200),
    flatType: text,
    areaSqFt: area,
    billableAreaSqFt: area,
    areaBasis: text,
    classification: z.enum([
      "OWNER_OCCUPIED",
      "TENANT_OCCUPIED",
      "VACANT",
      "UNSOLD",
    ]),
    internalRemarks: z.string().max(2000).default(""),
    residentRemarks: z.string().max(2000).default(""),
  })
  .strict();
export const personInput = z
  .object({
    name: text,
    email: z.email().max(254).nullable().optional(),
    phone: z.string().max(30).nullable().optional(),
    approvedPhone: z.string().max(30).nullable().optional(),
    internalNotes: z.string().max(2000).default(""),
  })
  .strict();
export const ownershipInput = z
  .object({ flatId: id, personId: id, ...range })
  .strict()
  .refine(validRange, "End must follow start");
export const occupancyInput = z
  .object({
    flatId: id,
    personId: id,
    kind: z.enum(["OWNER", "TENANT", "FAMILY"]),
    ...range,
  })
  .strict()
  .refine(validRange, "End must follow start");
export const grantInput = z
  .object({
    membershipId: id,
    flatId: id,
    occupancyId: id.nullable().optional(),
    ...range,
  })
  .strict()
  .refine(validRange, "End must follow start");
export const allocationInput = z
  .object({
    flatId: id,
    slotId: id,
    type: z.enum(["OWNED", "RENTED", "SOCIETY_ALLOTTED"]),
    rentalTerms: z.string().max(1000).nullable().optional(),
    ...range,
  })
  .strict()
  .refine(validRange, "End must follow start");
export const entitlementInput = z
  .object({ flatId: id, slotId: id, basis: text, ...range })
  .strict()
  .refine(validRange, "End must follow start");
export const vehicleInput = z
  .object({
    flatId: id,
    allocationId: id.nullable().optional(),
    registration: text.transform((v) => v.toUpperCase().replace(/\s/g, "")),
    type: text,
    color: text,
  })
  .strict();
export const slotInput = z
  .object({ label: text, location: text, type: text })
  .strict();
export const importInput = z
  .object({ rows: z.array(flatInput).min(1).max(500), commit: z.boolean() })
  .strict();
export const profileInput = z
  .object({
    name: text,
    email: z.email().max(254).nullable().optional(),
    phone: z.string().max(30).nullable().optional(),
  })
  .strict();
export const membershipInput = z
  .object({
    membershipId: id,
    role: z.enum(["ADMIN", "CASHIER", "RESIDENT", "SECURITY", "AUDITOR"]),
    active: z.boolean(),
  })
  .strict();
export const policyInput = z
  .object({ securityEnabled: z.boolean(), securityVehicles: z.boolean() })
  .strict();
