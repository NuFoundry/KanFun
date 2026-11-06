import {
  createClientResolver,
  isAllowedRedirect,
  isMetadataDocumentUrl,
  redirectMatches,
} from "./clients";
import { createMemoryStore } from "./store-memory";

const DOC_URL = "https://agent.dev/oauth/client.json";
const document = {
  client_id: DOC_URL,
  client_name: "Agent",
  redirect_uris: ["http://127.0.0.1/callback", "https://agent.dev/callback"],
};

describe("redirect URIs", () => {
  it("allows https, loopback http and app schemes", () => {
    for (const uri of [
      "https://agent.dev/cb",
      "http://localhost:3000/cb",
      "http://127.0.0.1/cb",
      "http://[::1]:9/cb",
      "cursor://anysphere.cursor-retrieval/oauth/callback",
      "com.example.app:/oauth",
    ]) {
      expect(isAllowedRedirect(uri)).toBe(true);
    }
  });

  it("refuses plain http elsewhere, script schemes, fragments and credentials", () => {
    for (const uri of [
      "http://agent.dev/cb",
      "javascript:alert(1)",
      "data:text/html,<script>",
      "file:///etc/passwd",
      "https://agent.dev/cb#x",
      "https://user:pw@example.com/cb",
      "not a url",
    ]) {
      expect(isAllowedRedirect(uri)).toBe(false);
    }
  });

  it("matches exactly, except the port of a loopback redirect", () => {
    expect(redirectMatches("https://agent.dev/cb", "https://agent.dev/cb")).toBe(true);
    expect(redirectMatches("https://agent.dev/cb", "https://agent.dev/cb2")).toBe(false);
    expect(redirectMatches("https://agent.dev/cb", "https://agent.dev:8443/cb")).toBe(false);
    expect(redirectMatches("http://127.0.0.1/cb", "http://127.0.0.1:53114/cb")).toBe(true);
    expect(redirectMatches("http://127.0.0.1/cb", "http://localhost:53114/cb")).toBe(false);
    expect(redirectMatches("http://127.0.0.1/cb", "http://127.0.0.1:1/other")).toBe(false);
  });
});

describe("client metadata document URLs", () => {
  it("are https URLs with a path that cannot be rewritten", () => {
    expect(isMetadataDocumentUrl(DOC_URL)).toBe(true);
    expect(isMetadataDocumentUrl("https://agent.dev/")).toBe(false);
    expect(isMetadataDocumentUrl("http://agent.dev/client.json")).toBe(false);
    expect(isMetadataDocumentUrl("https://agent.dev/a/../client.json")).toBe(false);
    expect(isMetadataDocumentUrl("https://agent.dev/client.json#x")).toBe(false);
    expect(isMetadataDocumentUrl("https://AGENT.dev/client.json")).toBe(false);
  });
});

describe("createClientResolver", () => {
  it("reads a metadata document once per TTL and calls it verified by its domain", async () => {
    let now = 0;
    const fetchJson = jest.fn(async () => document);
    const resolve = createClientResolver(createMemoryStore(), {
      fetchJson,
      ttlMs: 1000,
      now: () => now,
    });
    await expect(resolve(DOC_URL)).resolves.toEqual({
      id: DOC_URL,
      name: "Agent",
      host: "agent.dev",
      verified: true,
      redirectUris: document.redirect_uris,
    });
    await resolve(DOC_URL);
    expect(fetchJson).toHaveBeenCalledTimes(1);
    now = 1001;
    await resolve(DOC_URL);
    expect(fetchJson).toHaveBeenCalledTimes(2);
  });

  it("refuses a document that names another client, has bad redirects or wants a secret", async () => {
    const store = createMemoryStore();
    for (const bad of [
      { ...document, client_id: "https://other.dev/client.json" },
      { ...document, redirect_uris: ["http://agent.dev/cb"] },
      { ...document, token_endpoint_auth_method: "client_secret_basic" },
      "not json",
    ]) {
      const resolve = createClientResolver(store, { fetchJson: async () => bad });
      await expect(resolve(DOC_URL)).resolves.toBeNull();
    }
    const failing = createClientResolver(store, {
      fetchJson: async () => {
        throw new Error("private address");
      },
    });
    await expect(failing(DOC_URL)).resolves.toBeNull();
  });

  it("finds registered clients, unverified, known by their redirect's host", async () => {
    const store = createMemoryStore();
    await store.createClient({
      clientId: "mcp_client_1",
      name: "Claude",
      redirectUris: ["http://localhost/callback"],
    });
    const resolve = createClientResolver(store);
    await expect(resolve("mcp_client_1")).resolves.toMatchObject({
      name: "Claude",
      host: "localhost",
      verified: false,
    });
    await expect(resolve("mcp_client_2")).resolves.toBeNull();
  });
});
