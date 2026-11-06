/**
 * Two-factor sign-in (server/pb_hooks/two-factor.pb.js). Settings turns it on with an
 * authenticator app or email codes; sign-in then answers 401 with an `mfaId`, and the second step
 * completes it.
 */
import { ClientResponseError, type RecordAuthResponse, type RecordModel } from "pocketbase";
import { pb } from "@/lib/pocketbase";

export type TwoFactorMethod = "app" | "email";
export type TwoFactorStatus = { method: TwoFactorMethod | ""; recoveryCodes: number };
export type AppSetup = { secret: string; uri: string };
export type Challenge = { method: TwoFactorMethod; otpId?: string };

const post = <T>(path: string, body: Record<string, unknown> = {}) =>
  pb.send<T>(`/api/two-factor${path}`, { method: "POST", body });

export function getTwoFactor(): Promise<TwoFactorStatus> {
  return pb.send<TwoFactorStatus>("/api/two-factor", { method: "GET" });
}

/** A new secret for the authenticator app; it counts only after enableApp(). */
export function startAppSetup(): Promise<AppSetup> {
  return post<AppSetup>("/app/setup");
}

/** Returns the recovery codes, shown once. */
export async function enableApp(password: string, code: string): Promise<string[]> {
  return (await post<{ recoveryCodes: string[] }>("/app/enable", { password, code })).recoveryCodes;
}

/** Emails a code to the user's address; returns the id it is checked against. */
export async function startEmailSetup(): Promise<string> {
  return (await post<{ otpId: string }>("/email/setup")).otpId;
}

export async function enableEmail(password: string, otpId: string, code: string): Promise<void> {
  await post("/email/enable", { password, otpId, code });
}

export async function disableTwoFactor(password: string): Promise<void> {
  await post("/disable", { password });
}

export async function newRecoveryCodes(password: string): Promise<string[]> {
  return (await post<{ recoveryCodes: string[] }>("/recovery-codes", { password })).recoveryCodes;
}

/** The pending second step a sign-in error stands for, or null for any other error. */
export function mfaIdFrom(error: unknown): string | null {
  if (!(error instanceof ClientResponseError) || error.status !== 401) return null;
  const mfaId = (error.response as { mfaId?: unknown } | undefined)?.mfaId;
  return typeof mfaId === "string" && mfaId ? mfaId : null;
}

/** Which factor the sign-in needs; for email this sends the code. */
export function startChallenge(mfaId: string): Promise<Challenge> {
  return post<Challenge>("/challenge", { mfaId });
}

/** Completes the sign-in with an authenticator or recovery code and stores the session. */
export async function verifyAppCode(mfaId: string, code: string): Promise<void> {
  const auth = await post<RecordAuthResponse<RecordModel>>("/verify", { mfaId, code });
  pb.authStore.save(auth.token, auth.record);
}

/** Completes the sign-in with the emailed code (PocketBase stores the session). */
export async function verifyEmailCode(mfaId: string, otpId: string, code: string): Promise<void> {
  await pb.collection("users").authWithOTP(otpId, code.trim(), { mfaId });
}

/** What went wrong, for a message in the user's language: a field, an ended sign-in, or other. */
export function twoFactorProblem(error: unknown): "password" | "code" | "signIn" | null {
  if (!(error instanceof ClientResponseError) || error.status !== 400) return null;
  const data = (error.response?.data ?? {}) as Record<string, unknown>;
  if (data.password) return "password";
  if (data.mfaId || /MFA/.test(String(error.response?.message))) return "signIn";
  // An emailed code is checked by PocketBase itself, which answers "Invalid or expired OTP".
  if (data.code || data.otpId || /OTP/.test(String(error.response?.message))) return "code";
  return null;
}
