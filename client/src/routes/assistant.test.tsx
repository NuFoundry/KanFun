import userEvent from "@testing-library/user-event";
import { ClientResponseError } from "pocketbase";
import { configure } from "@testing-library/react";
import { Link, Route, Routes, useLocation } from "react-router";
import { AssistantPage } from "./assistant";
import { useAiHealth, useConversation, useConversations } from "@/hooks/use-conversations";
import { streamChat } from "@/lib/api/ai";
import { createConversation, saveMessages } from "@/lib/api/conversations";
import { readAttachment } from "@/lib/attachments";
import { renderWithProviders, screen, waitFor } from "@/test/test-utils";

jest.mock("@/hooks/use-conversations", () => ({
  ...jest.requireActual("@/hooks/use-conversations"),
  useAiHealth: jest.fn(),
  useConversation: jest.fn(),
  useConversations: jest.fn(),
}));
jest.mock("@/lib/api/ai", () => ({ streamChat: jest.fn(), transcribe: jest.fn() }));
jest.mock("@/lib/attachments", () => ({
  ...jest.requireActual("@/lib/attachments"),
  readAttachment: jest.fn(),
}));
jest.mock("@/lib/api/conversations", () => ({
  ...jest.requireActual("@/lib/api/conversations"),
  createConversation: jest.fn(),
  saveMessages: jest.fn(),
}));

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderAt(path: string, { strict = false } = {}) {
  // StrictMode (as in main.tsx) mounts, unmounts and mounts again: refs and effects must
  // survive that. Testing Library applies it at the root, where React honours it.
  configure({ reactStrictMode: strict });
  return renderWithProviders(
    <Routes>
      <Route
        path="/assistant/:conversationId?"
        element={
          <>
            <AssistantPage />
            <Where />
          </>
        }
      />
    </Routes>,
    { route: path },
  );
}

async function* words(...parts: string[]): AsyncGenerator<string> {
  for (const part of parts) yield part;
}

/** A reply that never finishes until `end()` is called (or the signal aborts). */
function endless(first = "Partial") {
  let end!: () => void;
  const done = new Promise<void>((resolve) => (end = resolve));
  const stream = async function* (_m: unknown, options?: { signal?: AbortSignal }) {
    yield first;
    await Promise.race([
      done,
      new Promise<void>((resolve) =>
        options?.signal?.addEventListener("abort", () => resolve(), { once: true }),
      ),
    ]);
    if (options?.signal?.aborted) throw new DOMException("aborted", "AbortError");
  };
  return { stream, end };
}

beforeEach(() => {
  jest.mocked(useAiHealth).mockReturnValue({ data: { transcription: true } } as never);
  jest.mocked(useConversations).mockReturnValue({
    data: [{ id: "c1", title: "Blue sky", updated: "2026-10-01 10:00:00.000Z" }],
  } as never);
  jest.mocked(useConversation).mockReturnValue({ data: undefined } as never);
});

describe("AssistantPage", () => {
  it("greets with suggestions and lists previous conversations", () => {
    renderAt("/assistant");
    expect(screen.getByTestId("chat-empty")).toHaveTextContent("What can I help you with?");
    expect(screen.getByRole("button", { name: "Explain what this app can do" })).toBeVisible();
    expect(screen.getByRole("link", { name: /Blue sky/ })).toHaveAttribute("href", "/assistant/c1");
    expect(screen.getByTestId("voice-start")).toBeInTheDocument();
  });

  it("hides the microphone when neither the browser nor the service turns speech into text", () => {
    jest.mocked(useAiHealth).mockReturnValue({ data: { transcription: false } } as never);
    renderAt("/assistant");
    expect(screen.queryByTestId("voice-start")).not.toBeInTheDocument();
  });

  it("streams the reply and saves a new conversation, then opens it", async () => {
    jest.mocked(streamChat).mockReturnValue(words("Hello ", "there!"));
    jest.mocked(createConversation).mockResolvedValue({ id: "c9", title: "Hi" } as never);
    renderAt("/assistant", { strict: true });
    await userEvent.type(screen.getByTestId("chat-input"), "Hi{Enter}");
    expect(await screen.findByTestId("chat-message-assistant")).toHaveTextContent("Hello there!");
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/assistant/c9"));
    expect(createConversation).toHaveBeenCalledWith([
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello there!" },
    ]);
    // Only the conversation goes out; the service builds the system prompt.
    const [messages, options] = jest.mocked(streamChat).mock.calls[0]!;
    expect(messages).toEqual([{ role: "user", content: "Hi" }]);
    expect(options?.language).toBe("en");
  });

  it("takes the next message only once a new conversation is saved", async () => {
    jest.mocked(streamChat).mockReturnValue(words("Hello."));
    let saved!: (value: unknown) => void;
    jest
      .mocked(createConversation)
      .mockReturnValue(new Promise((resolve) => (saved = resolve)) as never);
    renderAt("/assistant");
    await userEvent.type(screen.getByTestId("chat-input"), "Hi{Enter}");
    expect(await screen.findByTestId("chat-message-assistant")).toHaveTextContent("Hello.");
    // Still saving: a second message would land in another conversation.
    expect(screen.getByTestId("chat-stop")).toBeInTheDocument();
    expect(screen.queryByTestId("chat-send")).not.toBeInTheDocument();
    saved({ id: "c9", title: "Hi" });
    expect(await screen.findByTestId("chat-send")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/assistant/c9"));
  });

  it("gives the question back when the service fails before answering", async () => {
    jest.mocked(streamChat).mockImplementation(async function* () {
      yield* [];
      throw new Error("AI request failed (503)");
    });
    renderAt("/assistant");
    await userEvent.type(screen.getByTestId("chat-input"), "Hi{Enter}");
    await waitFor(() => expect(screen.getByTestId("chat-input")).toHaveValue("Hi"));
    expect(screen.queryByTestId("chat-message-user")).not.toBeInTheDocument();
    expect(createConversation).not.toHaveBeenCalled();
  });

  it("waits for a saved conversation to load before sending", async () => {
    jest.mocked(useConversation).mockReturnValue({ isLoading: true } as never);
    renderAt("/assistant/c1");
    await userEvent.type(screen.getByTestId("chat-input"), "Too early{Enter}");
    expect(streamChat).not.toHaveBeenCalled();
    expect(screen.getByTestId("chat-send")).toBeDisabled();
  });

  it("sends a bounded history with a reply limit and writes the saved record into the cache", async () => {
    const old = Array.from({ length: 60 }, (_, i) => ({
      role: i % 2 ? ("assistant" as const) : ("user" as const),
      content: `m${i}`,
    }));
    jest.mocked(useConversation).mockReturnValue({ data: { id: "c1", messages: old } } as never);
    jest.mocked(streamChat).mockReturnValue(words("Sure."));
    jest.mocked(saveMessages).mockResolvedValue({ id: "c1", messages: [] } as never);
    const { queryClient } = renderAt("/assistant/c1");
    await userEvent.type(screen.getByTestId("chat-input"), "More{Enter}");
    await waitFor(() => expect(saveMessages).toHaveBeenCalled());
    const [messages, options] = jest.mocked(streamChat).mock.calls[0]!;
    expect(messages).toHaveLength(40);
    expect(messages[0]).toEqual({ role: "assistant", content: "m21" });
    expect(options?.maxTokens).toBe(4096);
    await waitFor(() =>
      expect(queryClient.getQueryData(["conversations", "detail", "c1"])).toEqual({
        id: "c1",
        messages: [],
      }),
    );
  });

  it("stops the reply when another chat opens, and the new chat is ready to use", async () => {
    const reply = endless();
    jest.mocked(streamChat).mockImplementation(reply.stream as never);
    jest.mocked(useConversation).mockReturnValue({
      data: { id: "c1", title: "Blue sky", messages: [] },
    } as never);
    jest.mocked(saveMessages).mockResolvedValue({ id: "c1", messages: [] } as never);
    renderAt("/assistant/c1");
    await userEvent.type(screen.getByTestId("chat-input"), "Hi{Enter}");
    expect(await screen.findByTestId("chat-message-assistant")).toHaveTextContent("Partial");
    await userEvent.click(screen.getByTestId("new-chat"));
    // The abort saved what arrived and the empty chat is not blocked by the old reply.
    await waitFor(() =>
      expect(saveMessages).toHaveBeenCalledWith("c1", [
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Partial" },
      ]),
    );
    expect(screen.getByTestId("chat-empty")).toBeInTheDocument();
    expect(await screen.findByTestId("chat-send")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Thinking…" })).not.toBeInTheDocument();
  });

  it("does not pull the user back after they left during a new chat's reply", async () => {
    const reply = endless();
    jest.mocked(streamChat).mockImplementation(reply.stream as never);
    jest.mocked(createConversation).mockResolvedValue({ id: "c9", title: "Hi" } as never);
    renderWithProviders(
      <Routes>
        <Route
          path="/assistant/:conversationId?"
          element={
            <>
              <AssistantPage />
              <Where />
              <Link to="/dashboard">Leave</Link>
            </>
          }
        />
        <Route path="/dashboard" element={<Where />} />
      </Routes>,
      { route: "/assistant" },
    );
    await userEvent.type(screen.getByTestId("chat-input"), "Hi{Enter}");
    await screen.findByTestId("chat-message-assistant");
    // Leave the page: the route element unmounts and the stream is stopped.
    await userEvent.click(screen.getByRole("link", { name: "Leave" }));
    await waitFor(() =>
      expect(createConversation).toHaveBeenCalledWith([
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Partial" },
      ]),
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.getByTestId("where")).toHaveTextContent("/dashboard");
  });

  it("shows an error state for a conversation that fails to load and does not fork a new one", async () => {
    const refetch = jest.fn();
    jest.mocked(useConversation).mockReturnValue({
      isError: true,
      error: new Error("boom"),
      refetch,
    } as never);
    renderAt("/assistant/c1");
    expect(screen.getByTestId("conversation-error")).toHaveTextContent("boom");
    expect(screen.queryByTestId("chat-empty")).not.toBeInTheDocument();
    expect(screen.getByTestId("chat-send")).toBeDisabled();
    await userEvent.click(screen.getByTestId("conversation-error-retry"));
    expect(refetch).toHaveBeenCalled();
  });

  it("continues a saved conversation", async () => {
    jest.mocked(useConversation).mockReturnValue({
      data: { id: "c1", title: "Blue sky", messages: [{ role: "user", content: "Old" }] },
    } as never);
    jest.mocked(streamChat).mockReturnValue(words("Sure."));
    renderAt("/assistant/c1");
    expect(screen.getByTestId("chat-message-user")).toHaveTextContent("Old");
    await userEvent.type(screen.getByTestId("chat-input"), "More{Enter}");
    await waitFor(() =>
      expect(saveMessages).toHaveBeenCalledWith("c1", [
        { role: "user", content: "Old" },
        { role: "user", content: "More" },
        { role: "assistant", content: "Sure." },
      ]),
    );
  });

  it("sends attached files with the question and names those a reopened chat lost", async () => {
    jest.mocked(useConversation).mockReturnValue({
      data: {
        id: "c1",
        title: "Report",
        messages: [
          { role: "user", content: "", files: [{ name: "old.pdf", kind: "pdf" }] },
          { role: "assistant", content: "Read it." },
        ],
      },
    } as never);
    jest
      .mocked(readAttachment)
      .mockResolvedValue({ name: "r.pdf", kind: "pdf", size: 4, text: "Revenue" });
    // eslint-disable-next-line require-yield
    jest.mocked(streamChat).mockImplementationOnce(async function* () {
      throw new Error("The assistant is unavailable");
    });
    jest.mocked(streamChat).mockReturnValueOnce(words("Sure."));
    renderAt("/assistant/c1");
    // The saved message still lists its file, without the content.
    expect(screen.getByTestId("chat-message-user")).toHaveTextContent("old.pdf");
    await userEvent.upload(
      screen.getByTestId("attach-input"),
      new File(["%PDF"], "r.pdf", { type: "application/pdf" }),
    );
    await waitFor(() => expect(screen.getByTestId("chat-send")).toBeEnabled());

    // A failed send gives the file back with the question.
    await userEvent.click(screen.getByTestId("chat-send"));
    expect(await screen.findByRole("button", { name: "Remove r.pdf" })).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("chat-send"));
    await waitFor(() => expect(saveMessages).toHaveBeenCalled());
    expect(jest.mocked(streamChat).mock.calls[1]![0]).toEqual([
      { role: "user", content: "(Attached earlier, no longer available: old.pdf)" },
      { role: "assistant", content: "Read it." },
      { role: "user", content: "", files: [{ type: "text", name: "r.pdf", text: "Revenue" }] },
    ]);
    expect(screen.queryByTestId("composer-files")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("chat-message-user")[1]).toHaveTextContent("r.pdf");
  });

  it("shows a skeleton while a conversation loads and an empty state when it is gone", () => {
    jest.mocked(useConversation).mockReturnValue({ isLoading: true } as never);
    const { unmount } = renderAt("/assistant/c1");
    expect(screen.getByTestId("conversation-loading")).toHaveAttribute("aria-busy", "true");
    unmount();
    jest.mocked(useConversation).mockReturnValue({
      isError: true,
      error: new ClientResponseError({ status: 404 }),
    } as never);
    renderAt("/assistant/zzz");
    expect(screen.getByTestId("conversation-empty")).toHaveTextContent(
      "This conversation does not exist",
    );
  });
});
