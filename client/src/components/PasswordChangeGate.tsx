import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { KeyRound, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function PasswordChangeGate() {
  const utils = trpc.useUtils();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const changePassword = trpc.auth.changePassword.useMutation({
    onSuccess: async () => { toast.success("Your password has been updated."); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); await utils.auth.me.invalidate(); },
    onError: error => toast.error(error.message),
  });
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4"><Card className="w-full max-w-md border-slate-200 shadow-lg"><CardHeader><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-700 text-white"><KeyRound className="h-5 w-5" /></div><CardTitle className="pt-3 text-2xl">Choose your personal password</CardTitle><CardDescription>Your operations manager set a temporary password. Change it before continuing to your daily tasks.</CardDescription></CardHeader><CardContent><form className="space-y-4" onSubmit={event => { event.preventDefault(); if (newPassword !== confirmPassword) return toast.error("The new passwords do not match."); changePassword.mutate({ currentPassword, newPassword }); }}><div className="space-y-2"><Label htmlFor="current-password">Temporary password</Label><Input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required /></div><div className="space-y-2"><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} required /><p className="text-xs text-slate-500">Use at least 12 characters, with upper-case, lower-case, and numeric characters.</p></div><div className="space-y-2"><Label htmlFor="confirm-password">Confirm new password</Label><Input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required /></div><Button type="submit" disabled={changePassword.isPending} className="w-full bg-teal-700 hover:bg-teal-800">{changePassword.isPending ? "Updating…" : "Save password and continue"}</Button></form><div className="mt-5 flex gap-2 rounded-xl bg-teal-50 p-3 text-xs leading-relaxed text-teal-800"><ShieldCheck className="h-4 w-4 shrink-0" />Your manager cannot retrieve this new password. They can only issue a new temporary password if you need a reset.</div></CardContent></Card></main>;
}
