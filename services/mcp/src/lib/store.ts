/**
 * PocketBase-backed store and the per-user records the tools use. Not unit tested: the SDK is
 * ESM-only under Jest (see AGENTS.md); app.ts is tested with store-memory.ts instead.
 */
import PocketBase, { ClientResponseError, type RecordModel } from "pocketbase";
import type { Scope } from "./scopes";
import type { Grant, Records, Store } from "./types";

type Admin = { url: string; adminEmail: string; adminPassword: string };

/** PocketBase dates ("2026-10-27 12:00:00.000Z") and the store's milliseconds (0 = unset). */
const toDate = (ms: number) => (ms ? new Date(ms).toISOString().replace("T", " ") : "");
const fromDate = (value: unknown) => (value ? Date.parse(String(value).replace(" ", "T")) : 0);
const DATES = ["codeExpires", "accessExpires", "expires", "lastUsed"] as const;
/** One literal filter per hash field: values are bound as parameters, never pasted. */
const BY_HASH = {
  codeHash: "codeHash = {:hash}",
  accessHash: "accessHash = {:hash}",
  refreshHash: "refreshHash = {:hash}",
  previousRefreshHash: "previousRefreshHash = {:hash}",
} as const;

function toRecord(grant: Partial<Omit<Grant, "id">>) {
  const record: Record<string, unknown> = { ...grant };
  for (const field of DATES) if (field in grant) record[field] = toDate(grant[field] ?? 0);
  return record;
}

function toGrant(record: RecordModel): Grant {
  const text = (field: string) => String(record[field] ?? "");
  return {
    id: record.id,
    user: text("user"),
    kind: record.kind === "token" ? "token" : "oauth",
    clientId: text("clientId"),
    clientName: text("clientName"),
    clientHost: text("clientHost"),
    verified: Boolean(record.verified),
    scopes: Array.isArray(record.scopes) ? (record.scopes as Scope[]) : [],
    status: record.status === "active" ? "active" : "pending",
    codeHash: text("codeHash"),
    codeChallenge: text("codeChallenge"),
    codeExpires: fromDate(record.codeExpires),
    redirectUri: text("redirectUri"),
    accessHash: text("accessHash"),
    accessExpires: fromDate(record.accessExpires),
    refreshHash: text("refreshHash"),
    previousRefreshHash: text("previousRefreshHash"),
    expires: fromDate(record.expires),
    lastUsed: fromDate(record.lastUsed),
  };
}

function notFound(error: unknown) {
  return error instanceof ClientResponseError && error.status === 404;
}

/**
 * The service's superuser connection: it writes `mcp_grants`, `mcp_clients` and `mcp_activity`
 * (their API rules let users read and delete their own rows, never write), and it asks PocketBase
 * for short tokens to act as a user. It never reads user data itself.
 */
export function createPocketBase(opts: Admin) {
  const pb = new PocketBase(opts.url);
  pb.autoCancellation(false);

  async function admin() {
    if (!pb.authStore.isValid) {
      await pb.collection("_superusers").authWithPassword(opts.adminEmail, opts.adminPassword);
    }
    return pb;
  }

  const store: Store = {
    async createGrant(grant) {
      return toGrant(await (await admin()).collection("mcp_grants").create(toRecord(grant)));
    },
    async updateGrant(id, changes) {
      await (await admin()).collection("mcp_grants").update(id, toRecord(changes));
    },
    async deleteGrant(id) {
      try {
        await (await admin()).collection("mcp_grants").delete(id);
      } catch (error) {
        if (!notFound(error)) throw error;
      }
    },
    async findGrant(field, hash) {
      if (!hash) return null;
      try {
        const record = await (
          await admin()
        )
          .collection("mcp_grants")
          .getFirstListItem(pb.filter(BY_HASH[field], { hash }));
        return toGrant(record);
      } catch (error) {
        if (notFound(error)) return null;
        throw error;
      }
    },
    async countTokens(user) {
      const list = await (
        await admin()
      )
        .collection("mcp_grants")
        .getList(1, 1, { filter: pb.filter('user = {:user} && kind = "token"', { user }) });
      return list.totalItems;
    },
    async createClient(client) {
      await (await admin()).collection("mcp_clients").create(client);
    },
    async findClient(clientId) {
      try {
        const record = await (
          await admin()
        )
          .collection("mcp_clients")
          .getFirstListItem(pb.filter("clientId = {:clientId}", { clientId }));
        return {
          clientId,
          name: String(record.name),
          redirectUris: Array.isArray(record.redirectUris) ? record.redirectUris : [],
        };
      } catch (error) {
        if (notFound(error)) return null;
        throw error;
      }
    },
    async markClientUsed(clientId) {
      const db = await admin();
      const record = await db
        .collection("mcp_clients")
        .getFirstListItem(pb.filter("clientId = {:clientId}", { clientId }));
      if (!record.used) await db.collection("mcp_clients").update(record.id, { used: true });
    },
    async logActivity(entry) {
      await (await admin()).collection("mcp_activity").create(entry);
    },
  };

  /**
   * PocketBase as this user sees it: a 5-minute impersonation token, kept for 4 minutes. Every
   * read and write goes through the collections' API rules exactly as in the browser. `address`
   * is the agent's IP (X-Real-IP from Caddy): PocketBase's per-IP rate limits then count each
   * agent, not this service.
   */
  const sessions = new Map<string, { client: PocketBase; expires: number }>();
  async function asUser(userId: string, address?: string): Promise<Records> {
    const hit = sessions.get(userId);
    let client = hit && hit.expires > Date.now() ? hit.client : undefined;
    if (!client) {
      client = await (await admin()).collection("users").impersonate(userId, 300);
      client.autoCancellation(false);
      sessions.set(userId, { client, expires: Date.now() + 240_000 });
      if (sessions.size > 1_000) sessions.delete(sessions.keys().next().value!);
    }
    const user = client;
    const headers: Record<string, string> = address ? { "X-Real-IP": address } : {};
    return {
      list: (collection, { page, perPage, sort, filter }) =>
        user.collection(collection).getList(page, perPage, { sort, filter, headers }),
      get: (collection, id) => user.collection(collection).getOne(id, { headers }),
      create: (collection, data) => user.collection(collection).create(data, { headers }),
      update: (collection, id, data) => user.collection(collection).update(id, data, { headers }),
      delete: async (collection, id) => {
        await user.collection(collection).delete(id, { headers });
      },
      filter: (expression, params) => user.filter(expression, params),
    };
  }

  return { store, asUser };
}
