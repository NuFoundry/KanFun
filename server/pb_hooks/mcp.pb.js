/// <reference path="../pb_data/types.d.ts" />
// Housekeeping for the MCP server's records (services/mcp), every night: connections and tokens
// past their expiry, authorizations nobody finished, self-registered agents that never led to a
// login within a day, and activity older than 90 days.

cronAdd("mcp_cleanup", "17 3 * * *", () => {
  const at = (msAgo) => new Date(Date.now() - msAgo).toISOString().replace("T", " ");
  const day = 24 * 60 * 60 * 1000;
  const run = (sql, params) => $app.db().newQuery(sql).bind(params).execute();

  run("DELETE FROM mcp_grants WHERE expires != '' AND expires < {:now}", { now: at(0) });
  run("DELETE FROM mcp_grants WHERE status = 'pending' AND created < {:cutoff}", {
    cutoff: at(60 * 60 * 1000),
  });
  run("DELETE FROM mcp_clients WHERE used = FALSE AND created < {:cutoff}", { cutoff: at(day) });
  run("DELETE FROM mcp_activity WHERE created < {:cutoff}", { cutoff: at(90 * day) });
});
