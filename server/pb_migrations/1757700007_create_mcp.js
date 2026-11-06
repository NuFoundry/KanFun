/// <reference path="../pb_data/types.d.ts" />
// The MCP server's records (services/mcp). Only the service writes them, as a superuser; users read
// their own connections and activity and end a connection by deleting it (Settings → Connected
// apps). Codes, tokens and hashes are hidden fields: no API answer to a user ever contains them.
const OWNER = '@request.auth.id != "" && user = @request.auth.id';

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const owner = {
      name: "user",
      type: "relation",
      required: true,
      collectionId: users.id,
      cascadeDelete: true,
      maxSelect: 1,
    };
    const hidden = (name, type = "text") => ({ name, type, hidden: true });
    const autodates = [
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ];

    // Agents that registered themselves (Dynamic Client Registration); unused ones expire.
    const clients = new Collection({
      type: "base",
      name: "mcp_clients",
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: "clientId", type: "text", required: true, max: 100 },
        { name: "name", type: "text", required: true, max: 100 },
        { name: "redirectUris", type: "json", maxSize: 10_000 },
        { name: "used", type: "bool" },
        ...autodates,
      ],
      indexes: ["CREATE UNIQUE INDEX idx_mcp_clients_client ON mcp_clients (clientId)"],
    });
    app.save(clients);

    // One agent's access for one user: an OAuth connection or a personal access token.
    const grants = new Collection({
      type: "base",
      name: "mcp_grants",
      listRule: `${OWNER} && status = "active"`,
      viewRule: `${OWNER} && status = "active"`,
      createRule: null,
      updateRule: null,
      deleteRule: OWNER,
      fields: [
        owner,
        { name: "kind", type: "select", required: true, values: ["oauth", "token"], maxSelect: 1 },
        { name: "clientId", type: "text", max: 2000 },
        { name: "clientName", type: "text", max: 100 },
        { name: "clientHost", type: "text", max: 300 },
        { name: "verified", type: "bool" },
        { name: "scopes", type: "json", maxSize: 2_000 },
        {
          name: "status",
          type: "select",
          required: true,
          values: ["pending", "active"],
          maxSelect: 1,
        },
        hidden("codeHash"),
        hidden("codeChallenge"),
        hidden("codeExpires", "date"),
        hidden("redirectUri"),
        hidden("accessHash"),
        hidden("accessExpires", "date"),
        hidden("refreshHash"),
        hidden("previousRefreshHash"),
        { name: "expires", type: "date" },
        { name: "lastUsed", type: "date" },
        ...autodates,
      ],
      indexes: [
        "CREATE INDEX idx_mcp_grants_user ON mcp_grants (user, created)",
        "CREATE INDEX idx_mcp_grants_code ON mcp_grants (codeHash)",
        "CREATE INDEX idx_mcp_grants_access ON mcp_grants (accessHash)",
        "CREATE INDEX idx_mcp_grants_refresh ON mcp_grants (refreshHash)",
        "CREATE INDEX idx_mcp_grants_previous ON mcp_grants (previousRefreshHash)",
      ],
    });
    app.save(grants);

    // Every tool call: which tool, for which connection, how it ended. Never its content.
    const activity = new Collection({
      type: "base",
      name: "mcp_activity",
      listRule: OWNER,
      viewRule: OWNER,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        owner,
        { name: "grant", type: "text", max: 50 },
        { name: "clientName", type: "text", max: 100 },
        { name: "tool", type: "text", max: 100 },
        {
          name: "outcome",
          type: "select",
          required: true,
          values: ["ok", "denied", "error"],
          maxSelect: 1,
        },
        ...autodates,
      ],
      indexes: ["CREATE INDEX idx_mcp_activity_user ON mcp_activity (user, created)"],
    });
    app.save(activity);
  },
  (app) => {
    for (const name of ["mcp_activity", "mcp_grants", "mcp_clients"]) {
      app.delete(app.findCollectionByNameOrId(name));
    }
  },
);
