/**
 * Assistant conversations, private to the user (API rules on `conversations`). A conversation
 * stores its messages as JSON; the list only loads titles.
 */
import type { ConversationsResponse } from "@/lib/pb-types";
import { pb } from "@/lib/pocketbase";

/**
 * A file attached to a message. Only its name and kind are saved: the content stays in the tab
 * that attached it (lib/attachments.ts), so a reopened chat lists the file without it.
 */
export type StoredFile = { name: string; kind: "image" | "pdf" | "text" };
/** A chat message as saved. */
export type StoredMessage = { role: "user" | "assistant"; content: string; files?: StoredFile[] };
export type Conversation = ConversationsResponse<StoredMessage[]>;
export type ConversationSummary = Pick<Conversation, "id" | "title" | "updated">;

const TITLE_LENGTH = 60;

/** The first line of the first message, shortened on a word boundary. */
export function titleFrom(text: string): string {
  const line = text.trim().split("\n")[0]!.replace(/\s+/g, " ");
  if (line.length <= TITLE_LENGTH) return line;
  const cut = line.slice(0, TITLE_LENGTH);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 20 ? cut.lastIndexOf(" ") : TITLE_LENGTH)}…`;
}

/** Messages as saved: files by name and kind, never their content. */
function toSaved(messages: StoredMessage[]): StoredMessage[] {
  return messages.map(({ role, content, files }) => ({
    role,
    content,
    ...(files?.length ? { files: files.map(({ name, kind }) => ({ name, kind })) } : {}),
  }));
}

function userId(): string {
  const id = pb.authStore.record?.id;
  if (!id) throw new Error("Not signed in");
  return id;
}

export async function listConversations(): Promise<ConversationSummary[]> {
  return pb.collection("conversations").getFullList<ConversationSummary>({
    filter: pb.filter("user = {:user}", { user: userId() }),
    sort: "-updated",
    fields: "id,title,updated",
  });
}

export async function getConversation(id: string): Promise<Conversation> {
  return pb.collection("conversations").getOne<Conversation>(id);
}

export async function createConversation(messages: StoredMessage[]): Promise<Conversation> {
  const first = messages[0];
  return pb.collection("conversations").create<Conversation>({
    user: userId(),
    title: titleFrom(first?.content || first?.files?.[0]?.name || ""),
    messages: toSaved(messages),
  });
}

export async function saveMessages(id: string, messages: StoredMessage[]): Promise<Conversation> {
  return pb.collection("conversations").update<Conversation>(id, { messages: toSaved(messages) });
}

export async function renameConversation(id: string, title: string): Promise<Conversation> {
  return pb.collection("conversations").update<Conversation>(id, { title: title.trim() });
}

export async function deleteConversation(id: string): Promise<void> {
  await pb.collection("conversations").delete(id);
}
