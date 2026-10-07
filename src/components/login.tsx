"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, ShieldCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "./ui/button";
const schema = z.object({ email: z.email(), password: z.string().min(12) });
export function Login() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [twoFactor, setTwoFactor] = useState(false);
  const [code, setCode] = useState("");
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  });
  async function signIn(data: z.infer<typeof schema>) {
    setError("");
    const result = await authClient.signIn.email(data);
    if (result.error) setError(result.error.message ?? "Sign in failed");
    else if (
      result.data &&
      "twoFactorRedirect" in result.data &&
      result.data.twoFactorRedirect
    )
      setTwoFactor(true);
    else {
      router.push("/");
      router.refresh();
    }
  }
  return (
    <main className="grid min-h-screen bg-slate-50 lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-teal-950 p-12 text-white lg:flex">
        <div className="flex items-center gap-3 text-xl font-bold">
          <Building2 /> Society Desk
        </div>
        <div>
          <p className="mb-5 text-sm uppercase tracking-[.2em] text-teal-200">
            A place for every detail
          </p>
          <h1 className="max-w-lg text-5xl font-semibold leading-tight">
            Your community.
            <br />
            Connected and cared for.
          </h1>
          <p className="mt-6 max-w-md text-lg text-teal-100">
            A secure home for your society’s flat register, resident access and
            parking records.
          </p>
        </div>
        <p className="text-sm text-teal-200">
          Stage 1 · Society administration
        </p>
      </section>
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex items-center gap-3 text-teal-900 lg:hidden">
            <Building2 />
            <strong>Society Desk</strong>
          </div>
          <ShieldCheck className="mb-6 size-10 text-teal-800" />
          <h1 className="text-3xl font-bold">Welcome home</h1>
          <p className="mt-2 mb-8 text-slate-600">
            Sign in to your society workspace.
          </p>
          {twoFactor ? (
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                const result = await authClient.twoFactor.verifyTotp({ code });
                if (result.error)
                  setError(result.error.message ?? "Verification failed");
                else {
                  router.push("/");
                  router.refresh();
                }
              }}
              className="space-y-5"
            >
              <label className="field">
                Authenticator code
                <input
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
              <Button type="submit">Verify and sign in</Button>
            </form>
          ) : (
            <form className="space-y-5" onSubmit={form.handleSubmit(signIn)}>
              <label className="field">
                Email
                <input
                  type="email"
                  autoComplete="username"
                  {...form.register("email")}
                />
                {form.formState.errors.email && (
                  <span className="error">Enter a valid email</span>
                )}
              </label>
              <label className="field">
                Password
                <input
                  type="password"
                  autoComplete="current-password"
                  {...form.register("password")}
                />
                {form.formState.errors.password && (
                  <span className="error">Use at least 12 characters</span>
                )}
              </label>
              <Button
                className="w-full"
                type="submit"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          )}
          {error && (
            <p className="mt-4 error" role="alert">
              {error}
            </p>
          )}
          <p className="mt-8 text-sm text-slate-500">
            Accounts are provisioned by your society administrator. Contact them
            if you need access.
          </p>
        </div>
      </section>
    </main>
  );
}
