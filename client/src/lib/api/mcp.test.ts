import { authorizationRequest, checkConsent, createToken, decideConsent, McpError } from "./mcp";

jest.mock("@/lib/pocketbase", () => ({ pb: { authStore: { token: "tok" } } }));

function answer(status: number, body: unknown) {
  return jest.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body });
}

describe("mcp api", () => {
  afterEach(() => jest.restoreAllMocks());

  it("takes the OAuth parameters from the query and nothing else", () => {
    expect(
      authorizationRequest("?client_id=c&redirect_uri=http%3A%2F%2F127.0.0.1%2Fcb&state=s&x=1"),
    ).toEqual({ client_id: "c", redirect_uri: "http://127.0.0.1/cb", state: "s" });
  });

  it("checks a request with the session", async () => {
    const consent = { client: { name: "Agent" }, scopes: ["posts:read"], optIn: [] };
    const fetchMock = answer(200, consent);
    globalThis.fetch = fetchMock;
    await expect(checkConsent({ client_id: "c" })).resolves.toEqual(consent);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:8791/mcp/oauth/check");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body)).toEqual({ client_id: "c" });
  });

  it("hands back the agent's address for errors that go back to it, throws for the rest", async () => {
    globalThis.fetch = answer(400, {
      error: "invalid_scope",
      redirect: "http://127.0.0.1/cb?error=x",
    });
    await expect(checkConsent({})).resolves.toEqual({ redirect: "http://127.0.0.1/cb?error=x" });
    globalThis.fetch = answer(400, { error: "unknown_client" });
    await expect(checkConsent({})).rejects.toEqual(new McpError(400, "unknown_client"));
  });

  it("sends the decision and returns where to go", async () => {
    const fetchMock = answer(200, { redirect: "http://127.0.0.1/cb?code=c" });
    globalThis.fetch = fetchMock;
    await expect(decideConsent({ client_id: "c" }, true, ["posts:read"])).resolves.toBe(
      "http://127.0.0.1/cb?code=c",
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      request: { client_id: "c" },
      approve: true,
      scopes: ["posts:read"],
    });
  });

  it("creates tokens and reports a full set as 409", async () => {
    globalThis.fetch = answer(201, { token: "mcp_pat_x", expires: "2027-01-01T00:00:00.000Z" });
    await expect(createToken({ name: "n", scopes: ["posts:read"], days: 30 })).resolves.toEqual({
      token: "mcp_pat_x",
      expires: "2027-01-01T00:00:00.000Z",
    });
    globalThis.fetch = answer(409, { error: "Too many tokens" });
    await expect(
      createToken({ name: "n", scopes: ["posts:read"], days: 30 }),
    ).rejects.toMatchObject({ status: 409 });
  });
});
