import { z } from "zod";
import { postTools } from "./posts";
import { defineTool, type Tool } from "./tool";

export { ToolError, type Tool, type ToolContext } from "./tool";

const whoami = defineTool({
  name: "whoami",
  title: "Who am I",
  description: "The user this connection acts for, and the permissions they granted it.",
  scope: null,
  kind: "read",
  input: z.object({}),
  async run(_input, ctx) {
    const user = await ctx.records.get("users", ctx.user);
    return { id: user.id, name: user.name, email: user.email, permissions: ctx.scopes };
  },
});

/** Every tool the server offers. Add one: a file next to posts.ts, then list it here. */
export const TOOLS: Tool[] = [whoami, ...postTools];
