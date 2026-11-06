import type { Scope } from "./scopes";

/**
 * One agent's access for one user: an OAuth connection (`oauth`, from the consent page) or a
 * personal access token (`token`, from Settings). Only hashes of codes and tokens are stored.
 * Times are milliseconds since the epoch; 0 means unset.
 */
export type Grant = {
  id: string;
  user: string;
  kind: "oauth" | "token";
  /** The OAuth client id (a URL for a client metadata document); empty for a personal token. */
  clientId: string;
  /** The app's name, or the token's name. */
  clientName: string;
  /** The host the app is known by: its metadata document's, or for a registration its redirect's. */
  clientHost: string;
  /** false for a client that registered itself: its name is whatever it said. */
  verified: boolean;
  scopes: Scope[];
  /** `pending` until the authorization code is exchanged; users only see `active` ones. */
  status: "pending" | "active";
  codeHash: string;
  codeChallenge: string;
  codeExpires: number;
  redirectUri: string;
  accessHash: string;
  accessExpires: number;
  refreshHash: string;
  /** The refresh token before the last rotation: seeing it again means it was stolen. */
  previousRefreshHash: string;
  /** When the connection ends: the refresh token's expiry, or the personal token's. */
  expires: number;
  lastUsed: number;
};

export type NewGrant = Omit<Grant, "id">;

/** A client that registered itself (Dynamic Client Registration). */
export type RegisteredClient = {
  clientId: string;
  name: string;
  redirectUris: string[];
};

export type Activity = {
  user: string;
  grant: string;
  clientName: string;
  tool: string;
  outcome: "ok" | "denied" | "error";
};

/** Grants, registered clients and the activity log (PocketBase in production, memory in tests). */
export type Store = {
  createGrant(grant: NewGrant): Promise<Grant>;
  updateGrant(id: string, changes: Partial<NewGrant>): Promise<void>;
  deleteGrant(id: string): Promise<void>;
  findGrant(
    field: "codeHash" | "accessHash" | "refreshHash" | "previousRefreshHash",
    hash: string,
  ): Promise<Grant | null>;
  countTokens(user: string): Promise<number>;
  createClient(client: RegisteredClient): Promise<void>;
  findClient(clientId: string): Promise<RegisteredClient | null>;
  /** A registration that led to a login is kept; unused ones are deleted after a day. */
  markClientUsed(clientId: string): Promise<void>;
  logActivity(entry: Activity): Promise<void>;
};

/**
 * PocketBase records as one user sees them (their token, so API rules apply). Tools get this,
 * never a superuser client. Errors carry PocketBase's `status` (404, 400, 403).
 */
export type Records = {
  list(
    collection: string,
    query: { page: number; perPage: number; sort: string; filter: string },
  ): Promise<{
    items: Record<string, unknown>[];
    page: number;
    totalPages: number;
    totalItems: number;
  }>;
  get(collection: string, id: string): Promise<Record<string, unknown>>;
  create(collection: string, data: Record<string, unknown>): Promise<Record<string, unknown>>;
  update(
    collection: string,
    id: string,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  delete(collection: string, id: string): Promise<void>;
  /** PocketBase's filter builder: values are bound as parameters, never pasted into the filter. */
  filter(expression: string, params: Record<string, unknown>): string;
};
