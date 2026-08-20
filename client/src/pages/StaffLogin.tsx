import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { HeartPulse, KeyRound, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { startLogin } from "@/const";

export default function StaffLogin() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const login = trpc.auth.localLogin.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      setLocation("/");
    },
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    if (user && !loading) setLocation("/");
  }, [user, loading, setLocation]);

  return <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,#ccfbf1,transparent_34%),#f7fafb] p-4 sm:p-6"><div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-5xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]"><section className="hidden rounded-3xl bg-teal-900 p-10 text-white shadow-xl lg:block"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600"><HeartPulse className="h-6 w-6" /></div><p className="mt-8 text-sm font-semibold uppercase tracking-[0.18em] text-teal-200">Hospital Operations</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">Your daily operational work, in one secure place.</h1><p className="mt-5 max-w-md text-base leading-relaxed text-teal-100">Use the account name and temporary password provided by your operations manager. You will be asked to choose a personal password the first time you sign in.</p><div className="mt-9 flex items-start gap-3 text-sm text-teal-100"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-teal-300" /><p>Account access is role-aware, so staff open directly into the tasks and operational information appropriate to them.</p></div></section><Card className="border-slate-200 bg-white/95 shadow-xl shadow-teal-950/10"><CardHeader className="space-y-2"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-700 text-white"><KeyRound className="h-5 w-5" /></div><CardTitle className="pt-2 text-2xl text-slate-950">Staff account sign in</CardTitle><CardDescription>Enter the account name and password provided by your operations manager.</CardDescription></CardHeader><CardContent><form className="space-y-4" onSubmit={event => { event.preventDefault(); login.mutate({ username, password }); }}><div className="space-y-2"><Label htmlFor="staff-account-name">Account name</Label><Input id="staff-account-name" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} placeholder="e.g. priya.nair" required /></div><div className="space-y-2"><Label htmlFor="staff-password">Password</Label><Input id="staff-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter your password" required /></div><Button type="submit" disabled={login.isPending} className="w-full bg-teal-700 hover:bg-teal-800">{login.isPending ? "Signing in…" : "Open my daily tasks"}</Button></form><div className="my-6 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />or<span className="h-px flex-1 bg-slate-200" /></div><Button type="button" variant="outline" className="w-full" onClick={() => startLogin()}>Use existing secure sign-in</Button><p className="mt-5 text-center text-xs leading-relaxed text-slate-500">Need an account or password reset? Contact your operations manager.</p></CardContent></Card></div></main>;
}
