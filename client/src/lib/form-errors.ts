import { ClientResponseError } from "pocketbase";

type FieldError = { code?: string; message?: string };

export type SetFieldError = (name: string, error: { type: string; message: string }) => void;

/**
 * Maps a PocketBase validation error onto form fields.
 *
 * PocketBase returns `{ data: { <field>: { code, message } } }` for 400 responses. Every field
 * that exists on the form gets an inline error; the returned string is what is left to show
 * globally (a toast), or `null` if everything was attached to a field.
 */
export function applyServerErrors(
  error: unknown,
  setError: SetFieldError,
  fields?: readonly string[],
): string | null {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : "Something went wrong";
  }

  const data = (error.response?.data ?? {}) as Record<string, FieldError>;
  let attached = 0;
  for (const [name, fieldError] of Object.entries(data)) {
    if (fields && !fields.includes(name)) continue;
    setError(name, { type: "server", message: fieldError?.message || "Invalid value" });
    attached += 1;
  }

  if (attached > 0) return null;
  return error.response?.message || error.message || "Request failed";
}
