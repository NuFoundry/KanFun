import PocketBase from "pocketbase";
import { env } from "@/lib/env";
import type { TypedPocketBase } from "@/lib/pb-types";

/** Single PocketBase client for the whole app. Auth state persists in localStorage. */
export const pb = new PocketBase(env.pocketbaseUrl) as TypedPocketBase;

// React StrictMode + React Query fire duplicate requests; don't let the SDK cancel them.
pb.autoCancellation(false);
