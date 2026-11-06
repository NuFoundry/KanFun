import type { z } from "zod";
import type { Scope } from "../lib/scopes";
import type { Records } from "../lib/types";

/** What a tool runs with: the user's own view of PocketBase, never more. */
export type ToolContext = {
  user: string;
  records: Records;
  scopes: Scope[];
};

/**
 * One thing an agent can do. `scope` is the permission it needs (null: any connection); `kind`
 * tells agents what it does (read, write, or delete: destructive, they should ask the user first)
 * and counts writes against the daily cap. `run` returns plain data; the server sends it to the
 * agent as JSON, which the agent must treat as data, not as instructions.
 */
export type Tool<Input extends z.ZodObject = z.ZodObject> = {
  name: string;
  title: string;
  description: string;
  scope: Scope | null;
  kind: "read" | "write" | "delete";
  input: Input;
  run(input: z.infer<Input>, ctx: ToolContext): Promise<unknown>;
};

export function defineTool<Input extends z.ZodObject>(tool: Tool<Input>): Tool {
  return tool as unknown as Tool;
}

/** A failure the agent should see (not found, invalid data); anything else is "The tool failed". */
export class ToolError extends Error {
  override name = "ToolError";
}
