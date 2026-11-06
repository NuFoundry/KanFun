/**
 * Account settings for the signed-in user. Pure functions over the PocketBase SDK; the SDK
 * updates `pb.authStore` when the current user's record changes, so the auth context follows.
 */
import { pb } from "@/lib/pocketbase";
import type { UsersResponse } from "@/lib/pb-types";

export type ProfileInput = { firstName: string; lastName: string };
export type PasswordInput = { oldPassword: string; password: string; passwordConfirm: string };

/** The display name stored in `users.name` (header, posts, emails), derived from the parts. */
export function fullName({ firstName, lastName }: ProfileInput): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
}

/** First/last name to edit: the stored parts, or a best guess from `name` for older accounts. */
export function nameParts(
  user: Partial<Pick<UsersResponse, "firstName" | "lastName" | "name">>,
): ProfileInput {
  if (user.firstName || user.lastName) {
    return { firstName: user.firstName ?? "", lastName: user.lastName ?? "" };
  }
  const [firstName = "", ...rest] = (user.name ?? "").trim().split(/\s+/).filter(Boolean);
  return { firstName, lastName: rest.join(" ") };
}

export async function updateProfile(userId: string, input: ProfileInput): Promise<UsersResponse> {
  return pb.collection("users").update<UsersResponse>(userId, {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    name: fullName(input),
  });
}

/**
 * PocketBase requires the current password and invalidates every token on success, so the
 * session is renewed with the new password right away.
 */
export async function changePassword(
  userId: string,
  email: string,
  input: PasswordInput,
): Promise<void> {
  await pb.collection("users").update(userId, input);
  await pb.collection("users").authWithPassword(email, input.password);
}

/** The link in the verification email (/auth/confirm-verification/:token). */
export async function confirmVerification(token: string): Promise<void> {
  await pb.collection("users").confirmVerification(token);
}

/** The link in the password-reset email; every older session ends. */
export async function confirmPasswordReset(token: string, password: string): Promise<void> {
  await pb.collection("users").confirmPasswordReset(token, password, password);
}

/** The link in the email-change email; PocketBase asks for the password once more. */
export async function confirmEmailChange(token: string, password: string): Promise<void> {
  await pb.collection("users").confirmEmailChange(token, password);
}
