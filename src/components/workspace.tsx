"use client";
import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  LayoutDashboard,
  UsersRound,
  CarFront,
  Settings2,
  ClipboardList,
  Shield,
  Menu,
  LogOut,
  ArrowUpRight,
  Search,
  Grid2X2,
  List,
  LockKeyhole,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { redirect } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { dateDisplay } from "@/lib/utils";
import { Button } from "./ui/button";
import { DetailDialog } from "./ui/dialog";
import { FlatDirectory, type FlatRow } from "./flat-directory";
import { MasterForm, type Field } from "./master-form";
import * as schemas from "@/server/validation";
type Membership = {
  id: string;
  role: string;
  society: { id: string; name: string };
};
type Me = {
  user: { name: string; email: string; twoFactorEnabled: boolean };
  memberships: Membership[];
};
type Hierarchy = {
  id: string;
  name: string;
  blocks: { id: string; name: string }[];
}[];
type AdminData = {
  persons: { id: string; name: string }[];
  memberships: {
    id: string;
    personId: string | null;
    role: string;
    active: boolean;
    user: { name: string; email: string };
  }[];
  slots: { id: string; label: string; location: string; type: string }[];
  policy: { securityEnabled: boolean; securityVehicles: boolean };
};
type History = {
  id: string;
  startsOn: string;
  endsOn: string | null;
  person: { id: string; name: string };
  kind?: string;
};
type FlatDetail = FlatRow & {
  internalRemarks?: string;
  ownerships?: History[];
  occupancies?: (History & {
    person: { id: string; name: string; approvedPhone: string | null };
  })[];
  grants?: {
    id: string;
    membershipId: string;
    revokedAt: string | null;
    startsOn: string;
    endsOn: string | null;
  }[];
};
type Parking = {
  allocations: {
    id: string;
    type: string;
    startsOn: string;
    endsOn: string | null;
    slot: { label: string; location: string };
    flat: { id: string; number: string; block: { name: string } };
    vehicles: { registration: string; type: string; color: string }[];
  }[];
  entitlements: {
    id: string;
    basis: string;
    startsOn: string;
    endsOn: string | null;
    flat: { number: string };
    slot: { label: string };
  }[];
  limit: number;
};
type SecurityRow = {
  name: string;
  approvedContact: string | null;
  phase: string;
  block: string;
  flat: string;
  vehicles?: {
    registration: string;
    type: string;
    color: string;
    parkingSlot: string | null;
  }[];
};
type AuditRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
};
type Profile = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
} | null;
async function request<T>(
  url: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    cache: "no-store",
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401) redirect("/login");
    throw new Error(result.code ?? result.error ?? "Request failed");
  }
  return result;
}
export function Workspace() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [societyId, setSocietyId] = useState("");
  const [view, setView] = useState("overview");
  const [mobile, setMobile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flats, setFlats] = useState<FlatRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [map, setMap] = useState(false);
  const [detail, setDetail] = useState<FlatDetail | null>(null);
  const [hierarchy, setHierarchy] = useState<Hierarchy>([]);
  const [admin, setAdmin] = useState<AdminData | null>(null);
  const [parking, setParking] = useState<Parking>({
    allocations: [],
    entitlements: [],
    limit: 200,
  });
  const [profile, setProfile] = useState<Profile>(null);
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [backupState, setBackupState] = useState<{
    state: string;
    updatedAt?: string;
  }>({ state: "unknown" });
  const [security, setSecurity] = useState<SecurityRow[]>([]);
  const [securitySearched, setSecuritySearched] = useState(false);
  const [revision, setRevision] = useState(0);
  const member = me?.memberships.find((m) => m.society.id === societyId);
  const role = member?.role ?? "";
  const endpoint = useCallback(
    (path: string) => `/api/societies/${societyId}/${path}`,
    [societyId],
  );
  const refresh = () => setRevision((r) => r + 1);
  useEffect(() => {
    request<Me>("/api/me")
      .then((data) => {
        setMe(data);
        setSocietyId(data.memberships[0]?.society.id ?? "");
        if (!data.memberships.length) setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);
  useEffect(() => {
    if (!societyId || !role) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      setDetail(null);
      try {
        if (
          ["ADMIN", "CASHIER", "RESIDENT"].includes(role) &&
          ["overview", "directory", "manage"].includes(view)
        ) {
          const result = await request<{ rows: FlatRow[]; total: number }>(
            endpoint(`flats?q=${encodeURIComponent(query)}&page=${page}`),
          );
          if (!cancelled) {
            setFlats(result.rows);
            setTotal(result.total);
          }
        }
        if (
          role === "ADMIN" &&
          ["manage", "parking", "settings"].includes(view)
        ) {
          const [h, a] = await Promise.all([
            request<Hierarchy>(endpoint("hierarchy")),
            request<AdminData>(endpoint("admin-data")),
          ]);
          if (!cancelled) {
            setHierarchy(h);
            setAdmin(a);
          }
          if (view === "parking") {
            const f = await request<{ rows: FlatRow[]; total: number }>(
              endpoint("flats"),
            );
            if (!cancelled) {
              setFlats(f.rows);
              setTotal(f.total);
            }
          }
        }
        if (
          view === "parking" &&
          ["ADMIN", "CASHIER", "RESIDENT"].includes(role)
        ) {
          const data = await request<Parking>(endpoint("parking"));
          if (!cancelled) setParking(data);
        }
        if (view === "profile") {
          const data = await request<Profile>(endpoint("profile"));
          if (!cancelled) setProfile(data);
        }
        if (view === "audit") {
          const data = await request<AuditRow[]>(endpoint("audit"));
          if (role === "ADMIN")
            setBackupState(await request(endpoint("backup-status")));
          if (!cancelled) setAudits(data);
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Load failed");
      }
      if (!cancelled) setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [societyId, role, view, query, page, revision, endpoint]);
  function navigate(next: string) {
    if (
      document.querySelector('form[data-dirty="true"]') &&
      !window.confirm("Leave this page and discard unsaved changes?")
    )
      return;
    setView(next);
    setMobile(false);
    setQuery("");
    setSearch("");
    setPage(1);
    setSecurity([]);
    setSecuritySearched(false);
  }
  async function openFlat(id: string) {
    try {
      setDetail(await request<FlatDetail>(endpoint(`flats/${id}`)));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const save = (resource: string) => async (data: Record<string, unknown>) => {
    await request(endpoint(resource), "POST", data);
    refresh();
  };
  async function end(resource: string, id: string) {
    const value = window.prompt(
      "End date (YYYY-MM-DD), exclusive. Ending occupancy revokes linked access immediately.",
    );
    if (!value) return;
    try {
      await request(endpoint(`${resource}/${id}`), "PATCH", { endsOn: value });
      setDetail(null);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const nav = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    ...(["ADMIN", "CASHIER", "RESIDENT"].includes(role)
      ? [
          {
            id: "directory",
            label: role === "RESIDENT" ? "My flats" : "Flat directory",
            icon: UsersRound,
          },
          { id: "parking", label: "Parking & vehicles", icon: CarFront },
        ]
      : []),
    ...(role === "ADMIN"
      ? [
          { id: "manage", label: "Manage records", icon: Building2 },
          { id: "settings", label: "Access & settings", icon: Settings2 },
        ]
      : []),
    ...(role === "SECURITY"
      ? [{ id: "security", label: "Security lookup", icon: Shield }]
      : []),
    ...(["ADMIN", "AUDITOR"].includes(role)
      ? [{ id: "audit", label: "Audit trail", icon: ClipboardList }]
      : []),
    { id: "profile", label: "My profile", icon: UsersRound },
    { id: "mfa", label: "Account security", icon: LockKeyhole },
  ];
  const title = nav.find((n) => n.id === view)?.label ?? "Overview";
  const flatOptions = flats.map((f) => ({
    value: f.id,
    label: `${f.block.name} / ${f.number}`,
  }));
  const personOptions =
    admin?.persons.map((p) => ({ value: p.id, label: p.name })) ?? [];
  const slotOptions =
    admin?.slots.map((s) => ({ value: s.id, label: s.label })) ?? [];
  const dates: Field[] = [
    { name: "startsOn", label: "Effective from", type: "date" },
    {
      name: "endsOn",
      label: "Effective until (exclusive)",
      type: "date",
      optional: true,
    },
  ];
  const flatField: Field = {
    name: "flatId",
    label: "Flat",
    options: flatOptions,
  };
  return (
    <div className="min-h-screen">
      <aside
        className={`${mobile ? "flex" : "hidden"} fixed inset-y-0 left-0 z-30 w-64 flex-col border-r border-slate-200 bg-white lg:flex`}
        aria-label="Society navigation"
      >
        <div className="flex h-20 items-center gap-3 border-b border-slate-100 px-6">
          <div className="rounded-xl bg-teal-800 p-2 text-white">
            <Building2 size={22} />
          </div>
          <strong className="text-xl tracking-tight">Society Desk</strong>
          <button
            className="ml-auto lg:hidden"
            onClick={() => setMobile(false)}
            aria-label="Close navigation"
          >
            ✕
          </button>
        </div>
        <div className="px-5 pt-7">
          <p className="mb-4 px-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
            Workspace
          </p>
          <nav className="space-y-1">
            {nav.map((n) => (
              <button
                key={n.id}
                onClick={() => navigate(n.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold ${view === n.id ? "bg-teal-50 text-teal-900" : "text-slate-600 hover:bg-slate-50"}`}
                aria-current={view === n.id ? "page" : undefined}
              >
                <n.icon size={18} />
                {n.label}
              </button>
            ))}
          </nav>
          <div className="mt-7 border-t border-slate-100 pt-5">
            <p className="px-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
              Coming in later stages
            </p>
            <p className="mt-3 px-3 text-sm leading-7 text-slate-400">
              Billing & accounting
              <br />
              Reports & payments
              <br />
              Complaints & amenities
            </p>
          </div>
        </div>
        <div className="mt-auto border-t border-slate-100 p-5">
          <p className="text-sm font-semibold">{me?.user.name ?? "Loading…"}</p>
          <p className="mt-1 text-xs text-slate-500">
            {role.toLowerCase()} workspace
          </p>
          <button
            className="mt-4 flex items-center gap-2 text-sm text-slate-600"
            onClick={async () => {
              await authClient.signOut();
              router.push("/login");
              router.refresh();
            }}
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>
      {mobile && (
        <button
          className="fixed inset-0 z-20 bg-slate-950/40 lg:hidden"
          aria-label="Dismiss navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="lg:ml-64">
        <header className="flex min-h-20 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4 lg:px-9">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu />
            </button>
            <div>
              <p className="text-xs text-slate-500">Society workspace</p>
              <label className="sr-only" htmlFor="society">
                Select society
              </label>
              <select
                id="society"
                className="max-w-52 bg-transparent text-sm font-bold sm:max-w-80"
                value={societyId}
                onChange={(e) => {
                  setSocietyId(e.target.value);
                  setFlats([]);
                  setAdmin(null);
                  setQuery("");
                  setPage(1);
                  setSecurity([]);
                }}
              >
                {me?.memberships.map((m) => (
                  <option key={m.id} value={m.society.id}>
                    {m.society.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <span className="badge bg-slate-100 text-slate-700">
            {role || "Member"}
          </span>
        </header>
        <main id="main" className="mx-auto max-w-[1500px] p-5 lg:p-9">
          <div className="mb-7">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-teal-800">
              {member?.society.name ?? "Your society"}
            </p>
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            <p className="mt-2 text-sm text-slate-600">
              {view === "overview"
                ? "A clear view of your community and its records."
                : view === "directory"
                  ? "Search your authorized flat register and current resident directory."
                  : "Manage your authorized society records."}
            </p>
          </div>
          {error && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
            >
              {error === "MFA_REQUIRED" ? (
                <>
                  <p>
                    Set up two-factor authentication before accessing privileged
                    records.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-3"
                    onClick={() => navigate("mfa")}
                  >
                    Set up account security
                  </Button>
                </>
              ) : (
                <>
                  <p>{error}</p>
                  <Button variant="outline" className="mt-3" onClick={refresh}>
                    Retry
                  </Button>
                </>
              )}
            </div>
          )}
          {loading ? (
            <div className="panel animate-pulse" role="status">
              Loading authorized records…
            </div>
          ) : !me?.memberships.length ? (
            <div className="panel">
              No active society memberships. Contact your administrator.
            </div>
          ) : (
            <>
              {view === "overview" && (
                <>
                  <div className="mb-7 grid gap-4 sm:grid-cols-3">
                    <Stat
                      label={
                        role === "RESIDENT"
                          ? "Authorized flats"
                          : "Flats in register"
                      }
                      value={
                        ["ADMIN", "CASHIER", "RESIDENT"].includes(role)
                          ? String(total)
                          : "Restricted"
                      }
                    />
                    <Stat label="Your role" value={role.toLowerCase()} />
                    <Stat
                      label="Account protection"
                      value={
                        me?.user.twoFactorEnabled
                          ? "MFA enabled"
                          : "Password + session"
                      }
                    />
                  </div>
                  <div className="mb-7 rounded-2xl bg-teal-950 p-6 text-white sm:p-8">
                    <p className="text-xs uppercase tracking-widest text-teal-200">
                      Your community workspace
                    </p>
                    <h2 className="mt-3 text-2xl font-semibold">
                      Good records make a well-run society.
                    </h2>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-teal-100">
                      Keep flat details, resident access and parking assignments
                      current. Every administrative change is recorded in the
                      audit trail.
                    </p>
                    <Button
                      variant="outline"
                      className="mt-5"
                      onClick={() =>
                        navigate(
                          role === "SECURITY"
                            ? "security"
                            : role === "AUDITOR"
                              ? "audit"
                              : "directory",
                        )
                      }
                    >
                      Open{" "}
                      {role === "SECURITY"
                        ? "security lookup"
                        : role === "AUDITOR"
                          ? "audit trail"
                          : "flat register"}
                      <ArrowUpRight size={16} />
                    </Button>
                  </div>
                  {["ADMIN", "CASHIER", "RESIDENT"].includes(role) && (
                    <>
                      <h2 className="mb-4 text-lg font-bold">
                        Flats at a glance
                      </h2>
                      <FlatDirectory
                        rows={flats.slice(0, 6)}
                        open={openFlat}
                        map
                      />
                    </>
                  )}
                </>
              )}
              {view === "directory" && (
                <>
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <form
                      className="flex flex-1 items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        setQuery(search);
                        setPage(1);
                      }}
                    >
                      <label className="sr-only" htmlFor="flat-search">
                        Search flat or block
                      </label>
                      <div className="relative w-full max-w-md">
                        <Search
                          className="absolute top-3.5 left-3 text-slate-400"
                          size={18}
                        />
                        <input
                          id="flat-search"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Search flat or block…"
                          className="w-full rounded-lg border border-slate-300 bg-white py-3 pr-3 pl-10 text-sm"
                        />
                      </div>
                      <Button type="submit">Search</Button>
                    </form>
                    <div className="flex gap-1">
                      <Button
                        variant={map ? "outline" : "default"}
                        aria-label="Table view"
                        aria-pressed={!map}
                        onClick={() => setMap(false)}
                      >
                        <List size={18} />
                      </Button>
                      <Button
                        variant={map ? "default" : "outline"}
                        aria-label="Flat map view"
                        aria-pressed={map}
                        onClick={() => setMap(true)}
                      >
                        <Grid2X2 size={18} />
                      </Button>
                    </div>
                  </div>
                  <FlatDirectory rows={flats} open={openFlat} map={map} />
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
                    <p>
                      {total} authorized flats · Page {page}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        disabled={page === 1}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        disabled={page * 50 >= total}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              )}
              {view === "manage" && role === "ADMIN" && (
                <div className="space-y-6">
                  <MasterForm
                    title="Add phase and block"
                    fields={[
                      { name: "phase", label: "Phase name" },
                      { name: "block", label: "New block name" },
                    ]}
                    save={save("hierarchy")}
                  />
                  <MasterForm
                    title="Add permanent flat"
                    schema={schemas.flatInput}
                    fields={[
                      {
                        name: "blockId",
                        label: "Block",
                        options: hierarchy.flatMap((p) =>
                          p.blocks.map((b) => ({
                            value: b.id,
                            label: `${p.name} / ${b.name}`,
                          })),
                        ),
                      },
                      { name: "number", label: "Flat number" },
                      { name: "floor", label: "Floor", type: "number" },
                      {
                        name: "flatType",
                        label: "Flat type",
                        default: "2 BHK",
                      },
                      { name: "areaSqFt", label: "Area (sq ft, decimal)" },
                      {
                        name: "billableAreaSqFt",
                        label: "Billable area (sq ft, decimal)",
                      },
                      {
                        name: "areaBasis",
                        label: "Billable-area basis",
                        default: "SUPER_BUILT_UP",
                      },
                      {
                        name: "classification",
                        label: "Classification",
                        options: [
                          "OWNER_OCCUPIED",
                          "TENANT_OCCUPIED",
                          "VACANT",
                          "UNSOLD",
                        ].map((value) => ({
                          value,
                          label: value.replaceAll("_", " "),
                        })),
                      },
                      {
                        name: "internalRemarks",
                        label: "Internal remarks",
                        type: "textarea",
                        optional: true,
                      },
                      {
                        name: "residentRemarks",
                        label: "Resident-visible remarks",
                        type: "textarea",
                        optional: true,
                      },
                    ]}
                    save={async (data) =>
                      save("flats")({
                        ...data,
                        internalRemarks: data.internalRemarks ?? "",
                        residentRemarks: data.residentRemarks ?? "",
                      })
                    }
                  />
                  <MasterForm
                    title="Add person"
                    schema={schemas.personInput}
                    fields={[
                      { name: "name", label: "Full name" },
                      {
                        name: "email",
                        label: "Email",
                        type: "email",
                        optional: true,
                      },
                      { name: "phone", label: "Private phone", optional: true },
                      {
                        name: "approvedPhone",
                        label: "Approved directory phone",
                        optional: true,
                      },
                    ]}
                    save={save("persons")}
                  />
                  <p className="text-sm text-slate-600">
                    Flat selectors show the first 50 flats. Use the directory
                    for detail and history. For larger imports use the validated
                    import below.
                  </p>
                  <MasterForm
                    title="Record owner / co-owner"
                    schema={schemas.ownershipInput}
                    fields={[
                      flatField,
                      {
                        name: "personId",
                        label: "Owner",
                        options: personOptions,
                      },
                      ...dates,
                    ]}
                    save={save("ownerships")}
                  />
                  <MasterForm
                    title="Record occupant (does not grant access)"
                    schema={schemas.occupancyInput}
                    fields={[
                      flatField,
                      {
                        name: "personId",
                        label: "Occupant",
                        options: personOptions,
                      },
                      {
                        name: "kind",
                        label: "Occupant type",
                        options: ["OWNER", "TENANT", "FAMILY"].map((value) => ({
                          value,
                          label: value,
                        })),
                      },
                      ...dates,
                    ]}
                    save={save("occupancies")}
                  />
                  <MasterForm
                    title="Explicit resident access grant"
                    schema={schemas.grantInput}
                    fields={[
                      flatField,
                      {
                        name: "membershipId",
                        label: "Resident account",
                        options: admin?.memberships
                          .filter((m) => m.role === "RESIDENT" && m.active)
                          .map((m) => ({ value: m.id, label: m.user.name })),
                      },
                      {
                        name: "occupancyId",
                        label: "Linked occupancy ID (recommended for tenants)",
                        optional: true,
                      },
                      ...dates,
                    ]}
                    save={save("grants")}
                  />
                  <ImportPanel
                    endpoint={endpoint("import")}
                    refresh={refresh}
                  />
                  <h2 className="text-lg font-bold">
                    Open a flat to end ownership or occupancy
                  </h2>
                  <FlatDirectory rows={flats} open={openFlat} map={false} />
                </div>
              )}
              {view === "parking" && (
                <div className="space-y-6">
                  <section className="panel">
                    <h2 className="mb-4 text-lg font-bold">
                      Parking allocations
                    </h2>
                    <p className="mb-4 text-sm text-slate-600">
                      Effective dates are exclusive at the end. Display limited
                      to {parking.limit} latest records.
                    </p>
                    {!parking.allocations.length && (
                      <p>No authorized parking allocations.</p>
                    )}
                    <div className="grid gap-4 md:grid-cols-2">
                      {parking.allocations.map((a) => (
                        <div className="rounded-xl border p-4" key={a.id}>
                          <div className="flex justify-between">
                            <strong>
                              {a.slot.label} · {a.flat.block.name}/
                              {a.flat.number}
                            </strong>
                            <span className="badge bg-slate-100">
                              {a.type.replaceAll("_", " ")}
                            </span>
                          </div>
                          <p className="my-2 text-sm text-slate-600">
                            {a.slot.location} · {dateDisplay(a.startsOn)} →{" "}
                            {a.endsOn ? dateDisplay(a.endsOn) : "Open"}
                          </p>
                          {a.vehicles.map((car) => (
                            <p className="text-sm" key={car.registration}>
                              {car.registration} · {car.type} · {car.color}
                            </p>
                          ))}
                          {role === "ADMIN" && !a.endsOn && (
                            <Button
                              className="mt-3"
                              variant="outline"
                              onClick={() => end("allocations", a.id)}
                            >
                              End allocation
                            </Button>
                          )}
                          <p className="mt-2 text-xs text-slate-500">
                            Allocation ID: {a.id}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                  {role === "ADMIN" && (
                    <>
                      <MasterForm
                        title="Add parking slot"
                        schema={schemas.slotInput}
                        fields={[
                          { name: "label", label: "Slot identity" },
                          { name: "location", label: "Location" },
                          { name: "type", label: "Slot type" },
                        ]}
                        save={save("slots")}
                      />
                      <MasterForm
                        title="Record parking entitlement"
                        schema={schemas.entitlementInput}
                        fields={[
                          flatField,
                          {
                            name: "slotId",
                            label: "Slot",
                            options: slotOptions,
                          },
                          { name: "basis", label: "Entitlement basis" },
                          ...dates,
                        ]}
                        save={save("entitlements")}
                      />
                      <section className="panel">
                        <h3 className="mb-3 font-bold">
                          Entitlements (separate from allocations)
                        </h3>
                        {parking.entitlements.map((e) => (
                          <div
                            className="mb-3 flex flex-wrap justify-between gap-3 border-b pb-3"
                            key={e.id}
                          >
                            <span className="text-sm">
                              {e.slot.label} · Flat {e.flat.number} · {e.basis}{" "}
                              · {dateDisplay(e.startsOn)} →{" "}
                              {e.endsOn ? dateDisplay(e.endsOn) : "Open"}
                            </span>
                            {!e.endsOn && (
                              <Button
                                variant="outline"
                                onClick={() => end("entitlements", e.id)}
                              >
                                End entitlement
                              </Button>
                            )}
                          </div>
                        ))}
                      </section>
                      <MasterForm
                        title="Allocate exclusive parking"
                        schema={schemas.allocationInput}
                        fields={[
                          flatField,
                          {
                            name: "slotId",
                            label: "Slot",
                            options: slotOptions,
                          },
                          {
                            name: "type",
                            label: "Allocation type",
                            options: [
                              "OWNED",
                              "RENTED",
                              "SOCIETY_ALLOTTED",
                            ].map((value) => ({ value, label: value })),
                          },
                          ...dates,
                          {
                            name: "rentalTerms",
                            label: "Rental terms",
                            type: "textarea",
                            optional: true,
                          },
                        ]}
                        save={save("allocations")}
                      />
                      <MasterForm
                        title="Register vehicle"
                        schema={schemas.vehicleInput}
                        fields={[
                          flatField,
                          {
                            name: "allocationId",
                            label: "Parking allocation ID",
                            optional: true,
                          },
                          { name: "registration", label: "Registration" },
                          { name: "type", label: "Vehicle type" },
                          { name: "color", label: "Color" },
                          { name: "make", label: "Make", optional: true },
                          { name: "model", label: "Model", optional: true },
                        ]}
                        save={save("vehicles")}
                      />
                    </>
                  )}
                </div>
              )}
              {view === "settings" && role === "ADMIN" && admin && (
                <div className="space-y-6">
                  <section className="panel">
                    <h2 className="mb-4 text-lg font-bold">
                      Security directory policy
                    </h2>
                    <p className="mb-5 text-sm text-slate-600">
                      Only approved contacts are disclosed. Changes apply to the
                      next request.
                    </p>
                    <label className="mb-4 flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={admin.policy.securityEnabled}
                        onChange={async (e) => {
                          try {
                            await request(endpoint("policy"), "PATCH", {
                              ...admin.policy,
                              securityEnabled: e.target.checked,
                            });
                            refresh();
                          } catch (error) {
                            setError((error as Error).message);
                          }
                        }}
                      />
                      Enable security lookup
                    </label>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={admin.policy.securityVehicles}
                        onChange={async (e) => {
                          try {
                            await request(endpoint("policy"), "PATCH", {
                              ...admin.policy,
                              securityVehicles: e.target.checked,
                            });
                            refresh();
                          } catch (error) {
                            setError((error as Error).message);
                          }
                        }}
                      />
                      Include vehicle and parking fields
                    </label>
                  </section>
                  <MasterForm
                    title="Update membership role / access"
                    schema={schemas.membershipInput}
                    fields={[
                      {
                        name: "membershipId",
                        label: "Member",
                        options: admin.memberships.map((m) => ({
                          value: m.id,
                          label: `${m.user.name} (${m.role}${m.active ? "" : ", disabled"})`,
                        })),
                      },
                      {
                        name: "role",
                        label: "Role",
                        options: [
                          "ADMIN",
                          "CASHIER",
                          "RESIDENT",
                          "SECURITY",
                          "AUDITOR",
                        ].map((value) => ({ value, label: value })),
                      },
                      {
                        name: "active",
                        label: "Membership access",
                        options: [
                          { value: "true", label: "Active" },
                          { value: "false", label: "Disabled" },
                        ],
                      },
                    ]}
                    save={async (data) => {
                      await request(endpoint("memberships"), "PATCH", {
                        ...data,
                        active: data.active,
                      });
                      refresh();
                    }}
                  />
                </div>
              )}
              {view === "security" && (
                <>
                  <form
                    className="panel flex flex-wrap gap-3"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setError("");
                      try {
                        setSecurity(
                          await request<SecurityRow[]>(
                            endpoint(
                              `security?q=${encodeURIComponent(search)}`,
                            ),
                          ),
                        );
                        setSecuritySearched(true);
                      } catch (e) {
                        setSecurity([]);
                        setError((e as Error).message);
                      }
                    }}
                  >
                    <label className="field flex-1">
                      Resident name, flat or enabled vehicle registration
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        minLength={2}
                        maxLength={100}
                        required
                      />
                    </label>
                    <Button type="submit" className="self-end">
                      Look up
                    </Button>
                  </form>
                  <p className="my-4 text-sm text-slate-600">
                    Lookup is limited and audited. Approved directory fields
                    only.
                  </p>
                  {securitySearched && !security.length && (
                    <p className="panel">No matching residents.</p>
                  )}
                  <div className="grid gap-4 md:grid-cols-2">
                    {security.map((s, index) => (
                      <article className="panel" key={index}>
                        <h2 className="text-lg font-bold">{s.name}</h2>
                        <p className="mt-2">
                          {s.phase} · {s.block}/{s.flat}
                        </p>
                        <p className="my-2">
                          Approved contact:{" "}
                          {s.approvedContact ?? "Not provided"}
                        </p>
                        {s.vehicles?.map((car) => (
                          <p className="text-sm" key={car.registration}>
                            {car.registration} · {car.type} · {car.color} ·{" "}
                            {car.parkingSlot ?? "No active slot"}
                          </p>
                        ))}
                      </article>
                    ))}
                  </div>
                </>
              )}
              {view === "audit" && (
                <>
                  {role === "ADMIN" && (
                    <section className="panel mb-4">
                      <h2 className="font-bold">Last encrypted backup</h2>
                      <p className="mt-2">
                        {backupState.state}
                        {backupState.updatedAt
                          ? ` · ${dateDisplay(backupState.updatedAt)}`
                          : " · No recorded backup"}
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
                        Copies on this host require a separate off-host copy to
                        survive VM loss.
                      </p>
                    </section>
                  )}
                  <section className="panel">
                    <h2 className="mb-4 font-bold">
                      Latest 100 append-only events
                    </h2>
                    {!audits.length && <p>No audit events yet.</p>}
                    <div className="divide-y">
                      {audits.map((a) => (
                        <div
                          key={a.id}
                          className="flex flex-wrap justify-between gap-3 py-4"
                        >
                          <div>
                            <strong className="text-sm">
                              {a.action.replaceAll("_", " ")}
                            </strong>
                            <p className="mt-1 break-all text-xs text-slate-500">
                              {a.entityType} · {a.entityId}
                            </p>
                          </div>
                          <time className="text-xs text-slate-600">
                            {new Intl.DateTimeFormat("en-IN", {
                              timeZone: "Asia/Kolkata",
                              dateStyle: "medium",
                              timeStyle: "short",
                            }).format(new Date(a.createdAt))}{" "}
                            IST
                          </time>
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              )}
              {view === "profile" &&
                (profile ? (
                  <MasterForm
                    key={profile.id}
                    title="My personal profile"
                    schema={schemas.profileInput}
                    fields={[
                      { name: "name", label: "Name", default: profile.name },
                      {
                        name: "email",
                        label: "Contact email (does not change login)",
                        type: "email",
                        optional: true,
                        default: profile.email ?? "",
                      },
                      {
                        name: "phone",
                        label: "Private phone",
                        optional: true,
                        default: profile.phone ?? "",
                      },
                    ]}
                    save={async (data) => {
                      await request(endpoint("profile"), "PATCH", data);
                      refresh();
                    }}
                  />
                ) : (
                  <p className="panel">
                    No personal profile is linked. Ask an administrator to link
                    your person record.
                  </p>
                ))}
              {view === "mfa" && (
                <MfaPanel
                  enabled={me?.user.twoFactorEnabled ?? false}
                  done={async () => {
                    setMe(await request<Me>("/api/me"));
                    refresh();
                  }}
                />
              )}
            </>
          )}
        </main>
        <footer className="px-5 pb-6 text-xs text-slate-500 lg:px-9">
          Society Desk · Private records stay online · Times displayed in
          Asia/Kolkata
        </footer>
      </div>
      <DetailDialog
        open={!!detail}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
        title={
          detail ? `${detail.block.name} / ${detail.number}` : "Flat details"
        }
      >
        {detail && (
          <>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Info label="Phase" value={detail.block.phase.name} />
              <Info
                label="Floor / type"
                value={`${detail.floor} / ${detail.flatType}`}
              />
              <Info label="Area" value={`${detail.areaSqFt} sq ft`} />
              <Info
                label="Billable area"
                value={`${detail.billableAreaSqFt} sq ft · ${detail.areaBasis}`}
              />
              <Info
                label="Resident remarks"
                value={detail.residentRemarks || "None"}
              />
              {detail.internalRemarks !== undefined && (
                <Info
                  label="Internal remarks"
                  value={detail.internalRemarks || "None"}
                />
              )}
            </div>
            {["ADMIN", "RESIDENT"].includes(role) && (
              <DocumentPanel
                key={detail.id}
                endpoint={endpoint("documents")}
                flatId={detail.id}
                admin={role === "ADMIN"}
              />
            )}
            {role === "ADMIN" && (
              <>
                <div className="mt-6">
                  <MasterForm
                    title="Update flat master data"
                    schema={schemas.flatInput}
                    fields={[
                      {
                        name: "blockId",
                        label: "Block ID",
                        default: detail.block.id,
                      },
                      {
                        name: "number",
                        label: "Flat number",
                        default: detail.number,
                      },
                      {
                        name: "floor",
                        label: "Floor",
                        type: "number",
                        default: String(detail.floor),
                      },
                      {
                        name: "flatType",
                        label: "Flat type",
                        default: detail.flatType,
                      },
                      {
                        name: "areaSqFt",
                        label: "Area (sq ft)",
                        default: detail.areaSqFt,
                      },
                      {
                        name: "billableAreaSqFt",
                        label: "Billable area (sq ft)",
                        default: detail.billableAreaSqFt,
                      },
                      {
                        name: "areaBasis",
                        label: "Area basis",
                        default: detail.areaBasis,
                      },
                      {
                        name: "classification",
                        label: "Classification",
                        default: detail.classification,
                        options: [
                          "OWNER_OCCUPIED",
                          "TENANT_OCCUPIED",
                          "VACANT",
                          "UNSOLD",
                        ].map((value) => ({
                          value,
                          label: value.replaceAll("_", " "),
                        })),
                      },
                      {
                        name: "internalRemarks",
                        label: "Internal remarks",
                        type: "textarea",
                        optional: true,
                        default: detail.internalRemarks ?? "",
                      },
                      {
                        name: "residentRemarks",
                        label: "Resident-visible remarks",
                        type: "textarea",
                        optional: true,
                        default: detail.residentRemarks,
                      },
                    ]}
                    save={async (data) => {
                      await request(
                        endpoint(`flats/${detail.id}`),
                        "PATCH",
                        data,
                      );
                      setDetail(null);
                      refresh();
                    }}
                  />
                </div>
                <HistorySection
                  title="Ownership history"
                  rows={detail.ownerships ?? []}
                  end={(id) => end("ownerships", id)}
                />
                <HistorySection
                  title="Occupancy history"
                  rows={detail.occupancies ?? []}
                  end={(id) => end("occupancies", id)}
                />
                <h3 className="mt-6 mb-3 font-bold">Explicit access grants</h3>
                {detail.grants?.map((g) => (
                  <div
                    key={g.id}
                    className="mb-3 rounded-lg border p-3 text-sm"
                  >
                    <p className="break-all">{g.membershipId}</p>
                    <p className="mt-1">
                      {g.revokedAt ? "Revoked" : "Not revoked"} ·{" "}
                      {dateDisplay(g.startsOn)}
                    </p>
                    {!g.revokedAt && (
                      <Button
                        className="mt-3"
                        variant="outline"
                        onClick={async () => {
                          try {
                            await request(
                              endpoint(`grants/${g.id}`),
                              "PATCH",
                              {},
                            );
                            setDetail(null);
                            refresh();
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        Revoke access
                      </Button>
                    )}
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </DetailDialog>
    </div>
  );
}
function DocumentPanel({
  endpoint,
  flatId,
  admin,
}: {
  endpoint: string;
  flatId: string;
  admin: boolean;
}) {
  const [rows, setRows] = useState<
    { id: string; originalName: string; status: string }[]
  >([]);
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [visible, setVisible] = useState(false);
  const reload = useCallback(async () => {
    try {
      setRows(
        await request(`${endpoint}?flatId=${encodeURIComponent(flatId)}`),
      );
    } catch (e) {
      setMessage((e as Error).message);
    }
  }, [endpoint, flatId]);
  useEffect(() => {
    let active = true;
    request<{ id: string; originalName: string; status: string }[]>(
      `${endpoint}?flatId=${encodeURIComponent(flatId)}`,
    )
      .then((data) => {
        if (active) setRows(data);
      })
      .catch((e) => {
        if (active) setMessage(e.message);
      });
    return () => {
      active = false;
    };
  }, [endpoint, flatId]);
  async function upload() {
    if (!file) return;
    const form = new FormData();
    form.set("file", file);
    form.set("flatId", flatId);
    form.set("residentVisible", String(visible));
    try {
      const response = await fetch(endpoint, { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage("Queued for scanning. Refresh to check its status.");
      await reload();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <section className="mt-6 rounded-xl border p-4">
      <h3 className="font-bold">Private flat documents</h3>
      <p className="my-2 text-sm text-slate-500">
        Clean documents only. Resident sharing is limited to current authorized
        members at upload; later occupants do not inherit access.
      </p>
      {admin && (
        <div className="grid gap-3">
          <label className="field">
            PDF, PNG or JPEG · up to 10 MiB
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={visible}
              onChange={(e) => setVisible(e.target.checked)}
            />
            Share with current authorized residents
          </label>
          <Button disabled={!file} onClick={upload}>
            Upload to quarantine
          </Button>
        </div>
      )}
      <Button className="my-3" variant="outline" onClick={reload}>
        Refresh documents
      </Button>
      {!rows.length && <p className="text-sm">No accessible documents.</p>}
      {rows.map((row) => (
        <div key={row.id} className="my-2 break-all text-sm">
          {row.status === "CLEAN" ? (
            <a className="underline" href={`${endpoint}/${row.id}`}>
              {row.originalName}
            </a>
          ) : (
            row.originalName
          )}{" "}
          · {row.status}
        </div>
      ))}
      <p role="status" className="mt-3 text-sm">
        {message}
      </p>
    </section>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-bold capitalize">{value}</p>
    </div>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-xs text-slate-500">{label}</p>
      <p>{value}</p>
    </div>
  );
}
function HistorySection({
  title,
  rows,
  end,
}: {
  title: string;
  rows: History[];
  end: (id: string) => void;
}) {
  return (
    <section className="mt-6">
      <h3 className="mb-3 font-bold">{title}</h3>
      {!rows.length && <p className="text-sm text-slate-500">No records.</p>}
      {rows.map((r) => (
        <div key={r.id} className="mb-3 rounded-lg border p-3">
          <p className="font-semibold">{r.person.name}</p>
          <p className="my-2 text-sm">
            {dateDisplay(r.startsOn)} →{" "}
            {r.endsOn ? dateDisplay(r.endsOn) : "Open"}
          </p>
          <p className="break-all text-xs text-slate-500">Record ID: {r.id}</p>
          {!r.endsOn && (
            <Button
              className="mt-3"
              variant="outline"
              onClick={() => end(r.id)}
            >
              End record
            </Button>
          )}
        </div>
      ))}
    </section>
  );
}
function ImportPanel({
  endpoint,
  refresh,
}: {
  endpoint: string;
  refresh: () => void;
}) {
  const [text, setText] = useState(
    "blockId,number,floor,flatType,areaSqFt,billableAreaSqFt,areaBasis,classification\n",
  );
  const [format, setFormat] = useState("csv");
  const [preview, setPreview] = useState<{
    count: number;
    rows: unknown[];
  } | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function run(commit: boolean) {
    setBusy(true);
    setMessage("");
    try {
      const result = await request<{ count: number; rows: unknown[] }>(
        endpoint,
        "POST",
        format === "csv"
          ? { csv: text, commit }
          : { rows: JSON.parse(text), commit },
      );
      if (commit) {
        setPreview(null);
        setMessage(`Imported ${result.count} flats.`);
        refresh();
      } else setPreview(result);
    } catch (e) {
      setPreview(null);
      setMessage((e as Error).message);
    }
    setBusy(false);
  }
  return (
    <section className="panel">
      <h3 className="mb-3 text-lg font-bold">Validated flat import</h3>
      <p className="mb-4 text-sm text-slate-600">
        Paste CSV using the required header names, or a JSON array using the
        flat schema in README. Maximum 500 rows. Existing or duplicate flats are
        rejected. Preview first; commit revalidates every row and inserts
        atomically.
      </p>
      <label className="field mb-4">
        Format
        <select
          value={format}
          onChange={(e) => {
            setFormat(e.target.value);
            setPreview(null);
          }}
        >
          <option value="csv">CSV</option>
          <option value="json">JSON</option>
        </select>
      </label>
      <label className="field">
        Flat rows
        <textarea
          rows={8}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPreview(null);
          }}
        />
      </label>
      <div className="mt-4 flex gap-3">
        <Button variant="outline" disabled={busy} onClick={() => run(false)}>
          Validate & preview
        </Button>
        <Button disabled={!preview || busy} onClick={() => run(true)}>
          Commit {preview?.count ?? ""} flats
        </Button>
      </div>
      {preview && (
        <pre className="mt-4 max-h-60 overflow-auto rounded-lg bg-slate-50 p-3 text-xs">
          {JSON.stringify(preview.rows, null, 2)}
        </pre>
      )}
      <p className="mt-3 text-sm" role="status">
        {message}
      </p>
    </section>
  );
}
function MfaPanel({
  enabled,
  done,
}: {
  enabled: boolean;
  done: () => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [uri, setUri] = useState("");
  const [backup, setBackup] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  return (
    <section className="panel max-w-2xl">
      <h2 className="mb-3 text-lg font-bold">Two-factor authentication</h2>
      {enabled ? (
        <p>
          TOTP protection is enabled. Store recovery codes securely and contact
          an operator for verified recovery.
        </p>
      ) : (
        <>
          <p className="mb-5 text-sm text-slate-600">
            Required for privileged roles. Add the enrollment URI to your
            authenticator, save recovery codes securely, then verify a code.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const result = await authClient.twoFactor.enable({ password });
              if (result.error)
                setMessage(result.error.message ?? "Enrollment failed");
              else if (result.data.method === "totp") {
                setUri(result.data.totpURI);
                setBackup(result.data.backupCodes);
              }
            }}
          >
            <label className="field">
              Current password
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <Button className="mt-3" type="submit">
              Begin enrollment
            </Button>
          </form>
          {uri && (
            <>
              <label className="field mt-5">
                Authenticator enrollment URI (secret)
                <textarea readOnly value={uri} rows={3} />
              </label>
              <p className="mt-4 font-semibold">
                Recovery codes — store securely
              </p>
              <pre className="my-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">
                {backup.join("\n")}
              </pre>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const result = await authClient.twoFactor.verifyTotp({
                    code,
                  });
                  if (result.error)
                    setMessage(result.error.message ?? "Verification failed");
                  else {
                    setUri("");
                    setBackup([]);
                    setPassword("");
                    setMessage("MFA enabled.");
                    await done();
                  }
                }}
              >
                <label className="field">
                  Six-digit authenticator code
                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                  />
                </label>
                <Button className="mt-3" type="submit">
                  Verify enrollment
                </Button>
              </form>
            </>
          )}
        </>
      )}
      <p className="mt-4 text-sm" role="status">
        {message}
      </p>
    </section>
  );
}
