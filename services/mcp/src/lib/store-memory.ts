import type { Activity, Grant, RegisteredClient, Store } from "./types";

/** In-memory store for tests: the same behaviour as store.ts, without PocketBase. */
export function createMemoryStore() {
  const grants = new Map<string, Grant>();
  const clients = new Map<string, RegisteredClient & { used: boolean }>();
  const activity: Activity[] = [];
  let next = 1;

  const store: Store = {
    async createGrant(grant) {
      const created = { ...grant, id: `g${next++}` };
      grants.set(created.id, created);
      return created;
    },
    async updateGrant(id, changes) {
      const grant = grants.get(id);
      if (grant) grants.set(id, { ...grant, ...changes });
    },
    async deleteGrant(id) {
      grants.delete(id);
    },
    async findGrant(field, hash) {
      if (!hash) return null;
      return [...grants.values()].find((grant) => grant[field] === hash) ?? null;
    },
    async countTokens(user) {
      return [...grants.values()].filter((g) => g.user === user && g.kind === "token").length;
    },
    async createClient(client) {
      clients.set(client.clientId, { ...client, used: false });
    },
    async findClient(clientId) {
      const client = clients.get(clientId);
      return client ? { clientId, name: client.name, redirectUris: client.redirectUris } : null;
    },
    async markClientUsed(clientId) {
      const client = clients.get(clientId);
      if (client) client.used = true;
    },
    async logActivity(entry) {
      activity.push(entry);
    },
  };
  return { ...store, grants, clients, activity };
}
