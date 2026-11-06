import type { ReactNode } from "react";

/** Stand-in for react-markdown under Jest (ESM-only): the Markdown source as plain text. */
export default function Markdown({ children }: { children?: ReactNode }) {
  return <div>{children}</div>;
}
export type Components = Record<string, unknown>;
