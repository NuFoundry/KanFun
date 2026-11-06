import {
  createConversation,
  deleteConversation,
  listConversations,
  renameConversation,
  saveMessages,
  titleFrom,
} from "./conversations";
import { pb } from "@/lib/pocketbase";

jest.mock("@/lib/pocketbase", () => {
  const collection = {
    getFullList: jest.fn(),
    getOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  return {
    pb: {
      authStore: { record: { id: "u1" } },
      filter: (expr: string, params: Record<string, string>) =>
        expr.replace(/\{:(\w+)\}/g, (_, key: string) => `"${params[key]}"`),
      collection: () => collection,
    },
  };
});

const collection = pb.collection("conversations") as unknown as Record<string, jest.Mock>;

describe("titleFrom", () => {
  it("takes the first line, shortened on a word boundary", () => {
    expect(titleFrom("  Hello   world\nmore")).toBe("Hello world");
    const long = "word ".repeat(30).trim();
    const title = titleFrom(long);
    expect(title.length).toBeLessThanOrEqual(61);
    expect(title.endsWith("…")).toBe(true);
    expect(title).not.toMatch(/ …$/);
  });
});

describe("conversations api", () => {
  it("lists only the user's conversations, newest first, titles only", async () => {
    collection.getFullList!.mockResolvedValue([]);
    await listConversations();
    expect(collection.getFullList).toHaveBeenCalledWith({
      filter: 'user = "u1"',
      sort: "-updated",
      fields: "id,title,updated",
    });
  });

  it("creates with the user and a title from the first message", async () => {
    collection.create!.mockResolvedValue({ id: "c1" });
    const messages = [
      { role: "user" as const, content: "Why is the sky blue?" },
      { role: "assistant" as const, content: "Scattering." },
    ];
    await createConversation(messages);
    expect(collection.create).toHaveBeenCalledWith({
      user: "u1",
      title: "Why is the sky blue?",
      messages,
    });
  });

  it("saves attached files by name and kind only, never their content", async () => {
    const report = { name: "report.pdf", kind: "pdf" as const, text: "Revenue grew 12%" };
    await createConversation([{ role: "user", content: "", files: [report] }]);
    expect(collection.create).toHaveBeenCalledWith({
      user: "u1",
      title: "report.pdf",
      messages: [{ role: "user", content: "", files: [{ name: "report.pdf", kind: "pdf" }] }],
    });
    await saveMessages("c1", [{ role: "user", content: "Hi", files: [report] }]);
    expect(collection.update).toHaveBeenCalledWith("c1", {
      messages: [{ role: "user", content: "Hi", files: [{ name: "report.pdf", kind: "pdf" }] }],
    });
  });

  it("saves, renames and deletes by id", async () => {
    await saveMessages("c1", []);
    expect(collection.update).toHaveBeenCalledWith("c1", { messages: [] });
    await renameConversation("c1", "  New title ");
    expect(collection.update).toHaveBeenCalledWith("c1", { title: "New title" });
    await deleteConversation("c1");
    expect(collection.delete).toHaveBeenCalledWith("c1");
  });

  it("refuses without a session", async () => {
    (pb.authStore as { record: unknown }).record = null;
    await expect(listConversations()).rejects.toThrow("Not signed in");
    (pb.authStore as { record: unknown }).record = { id: "u1" };
  });
});
