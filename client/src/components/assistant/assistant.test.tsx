import { act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { ChatComposer } from "./chat-composer";
import { ChatMessages } from "./chat-messages";
import { ConversationList } from "./conversation-list";
import { useDictation } from "./use-dictation";
import { levelOf, useVoiceRecorder } from "./use-voice-recorder";
import {
  useConversations,
  useDeleteConversation,
  useRenameConversation,
} from "@/hooks/use-conversations";
import { transcribe } from "@/lib/api/ai";
import { renderWithProviders, screen, waitFor } from "@/test/test-utils";

jest.mock("@/lib/api/ai", () => ({ transcribe: jest.fn() }));
jest.mock("./use-voice-recorder", () => ({
  ...jest.requireActual("./use-voice-recorder"),
  useVoiceRecorder: jest.fn(),
}));
jest.mock("./use-dictation", () => ({
  ...jest.requireActual("./use-dictation"),
  useDictation: jest.fn(),
}));
jest.mock("@/hooks/use-conversations", () => ({
  ...jest.requireActual("@/hooks/use-conversations"),
  useConversations: jest.fn(),
  useDeleteConversation: jest.fn(),
  useRenameConversation: jest.fn(),
}));

const recorder = (overrides: object = {}) => ({
  state: "idle",
  error: null,
  levels: [0.2, 0.8],
  elapsed: 0,
  start: jest.fn(),
  stop: jest.fn(),
  cancel: jest.fn(),
  ...overrides,
});

const dictation = (overrides: object = {}) => ({
  supported: false,
  state: "idle",
  error: null,
  start: jest.fn(),
  stop: jest.fn(),
  abort: jest.fn(),
  ...overrides,
});

function Composer(props: {
  onSend?: () => void;
  streaming?: boolean;
  onStop?: () => void;
  voice?: boolean;
  value?: string;
}) {
  const [value, setValue] = useState(props.value ?? "");
  return (
    <ChatComposer
      value={value}
      onChange={setValue}
      onSend={props.onSend ?? jest.fn()}
      onStop={props.onStop ?? jest.fn()}
      streaming={props.streaming ?? false}
      voice={props.voice}
      language="de"
    />
  );
}

describe("levelOf", () => {
  it("turns silence into 0 and loud samples into a full bar", () => {
    expect(levelOf(new Uint8Array(64).fill(128))).toBe(0);
    expect(levelOf(new Uint8Array(64).map((_, i) => (i % 2 ? 255 : 0)))).toBe(1);
  });
});

describe("ChatComposer", () => {
  beforeEach(() => {
    jest.mocked(useVoiceRecorder).mockReturnValue(recorder() as never);
    jest.mocked(useDictation).mockReturnValue(dictation() as never);
  });

  it("sends with Enter, adds a line with Shift+Enter, and only with text", async () => {
    const onSend = jest.fn();
    renderWithProviders(<Composer onSend={onSend} />);
    const input = screen.getByTestId("chat-input");
    expect(screen.getByTestId("chat-send")).toBeDisabled();
    await userEvent.type(input, "Hello{Shift>}{Enter}{/Shift}there");
    expect(input).toHaveValue("Hello\nthere");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("offers stop while a reply streams", async () => {
    const onStop = jest.fn();
    renderWithProviders(<Composer streaming onStop={onStop} />);
    await userEvent.click(screen.getByTestId("chat-stop"));
    expect(onStop).toHaveBeenCalled();
  });

  it("records with live bars, then puts the transcript into the message box", async () => {
    const audio = new Blob(["x"], { type: "audio/webm" });
    const controls = recorder({ state: "recording", stop: jest.fn(async () => audio) });
    jest.mocked(useVoiceRecorder).mockReturnValue(controls as never);
    jest.mocked(transcribe).mockResolvedValue("Hello from the mic");
    const { rerender } = renderWithProviders(<Composer />);
    // The composer hands the time limit to the recorder so a long recording is still used.
    expect(jest.mocked(useVoiceRecorder).mock.calls[0]![0]?.onLimit).toBeInstanceOf(Function);
    expect(screen.getByTestId("voice-recorder")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Recording" }).children).toHaveLength(2);

    await userEvent.click(screen.getByTestId("voice-confirm"));
    expect(transcribe).toHaveBeenCalledWith(audio, "de");
    jest.mocked(useVoiceRecorder).mockReturnValue(recorder() as never);
    rerender(<Composer />);
    await waitFor(() => expect(screen.getByTestId("chat-input")).toHaveValue("Hello from the mic"));
  });

  it("transcribes a recording that hit the time limit", async () => {
    jest.mocked(transcribe).mockResolvedValue("Long one");
    renderWithProviders(<Composer />);
    const { onLimit } = jest.mocked(useVoiceRecorder).mock.calls[0]![0]!;
    await act(async () => {
      onLimit!(new Blob(["x"], { type: "audio/webm" }));
    });
    await waitFor(() => expect(screen.getByTestId("chat-input")).toHaveValue("Long one"));
    expect(transcribe).toHaveBeenCalledTimes(1);
  });

  it("dictates where the browser recognises speech, also without server transcription", async () => {
    const controls = dictation({ supported: true });
    jest.mocked(useDictation).mockReturnValue(controls as never);
    const { unmount } = renderWithProviders(<Composer voice={false} value="Note:" streaming />);
    // The mic stays usable while a reply is being written.
    await userEvent.click(screen.getByRole("button", { name: "Dictate" }));
    expect(controls.start).toHaveBeenCalledWith("Note:");
    expect(jest.mocked(useVoiceRecorder).mock.results[0]!.value.start).not.toHaveBeenCalled();
    unmount();

    jest.mocked(useDictation).mockReturnValue(dictation({ supported: false }) as never);
    renderWithProviders(<Composer voice={false} />);
    expect(screen.queryByTestId("voice-start")).not.toBeInTheDocument();
  });

  it("shows that it listens; stop ends it, typing and sending take over", async () => {
    const controls = dictation({ supported: true, state: "listening" });
    jest.mocked(useDictation).mockReturnValue(controls as never);
    const onSend = jest.fn();
    renderWithProviders(<Composer value="Buy milk" onSend={onSend} />);
    expect(screen.getByTestId("dictation-status")).toHaveTextContent("Listening…");
    await userEvent.click(screen.getByTestId("dictation-stop"));
    expect(controls.stop).toHaveBeenCalled();
    await userEvent.type(screen.getByTestId("chat-input"), "!");
    expect(controls.abort).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByTestId("chat-send"));
    expect(controls.abort).toHaveBeenCalledTimes(2);
    expect(onSend).toHaveBeenCalled();
  });

  it("records instead when the browser turns out to have no speech service", () => {
    const controls = recorder();
    jest.mocked(useVoiceRecorder).mockReturnValue(controls as never);
    renderWithProviders(<Composer />);
    act(() => jest.mocked(useDictation).mock.calls[0]![0].onUnavailable!());
    expect(controls.start).toHaveBeenCalled();
  });

  it("attaches files from the picker and a paste, and sends a message of files only", async () => {
    const onAddFiles = jest.fn();
    const onRemoveFile = jest.fn();
    const onSend = jest.fn();
    const props = { value: "", onChange: jest.fn(), onSend, onStop: jest.fn(), streaming: false };
    const files = [{ id: "f1", name: "r.pdf", kind: "pdf" as const, size: 4, text: "Revenue" }];
    const { rerender } = renderWithProviders(
      <ChatComposer {...props} files={files} onAddFiles={onAddFiles} onRemoveFile={onRemoveFile} />,
    );
    expect(screen.getByTestId("composer-files")).toHaveTextContent("r.pdf");
    await userEvent.click(screen.getByRole("button", { name: "Remove r.pdf" }));
    expect(onRemoveFile).toHaveBeenCalledWith("f1");

    const picked = new File(["a"], "a.txt", { type: "text/plain" });
    await userEvent.upload(screen.getByTestId("attach-input"), picked);
    expect(onAddFiles).toHaveBeenLastCalledWith([picked]);
    // A screenshot is attached; a copied table (text plus a picture of it) pastes as text.
    const shot = new File(["p"], "shot.png", { type: "image/png" });
    const input = screen.getByTestId("chat-input");
    fireEvent.paste(input, { clipboardData: { files: [shot], getData: () => "" } });
    expect(onAddFiles).toHaveBeenLastCalledWith([shot]);
    fireEvent.paste(input, { clipboardData: { files: [shot], getData: () => "a\tb" } });
    expect(onAddFiles).toHaveBeenCalledTimes(2);

    await userEvent.click(screen.getByTestId("chat-send"));
    expect(onSend).toHaveBeenCalledTimes(1);
    rerender(<ChatComposer {...props} files={[{ ...files[0]!, reading: true }]} />);
    expect(screen.getByTestId("chat-send")).toBeDisabled();
    expect(screen.queryByTestId("attach-files")).not.toBeInTheDocument();
  });

  it("discards a recording", async () => {
    const controls = recorder({ state: "recording" });
    jest.mocked(useVoiceRecorder).mockReturnValue(controls as never);
    renderWithProviders(<Composer />);
    await userEvent.click(screen.getByTestId("voice-cancel"));
    expect(controls.cancel).toHaveBeenCalled();
  });
});

describe("ChatMessages", () => {
  it("shows the empty state, then messages with a typing indicator while waiting", () => {
    const { rerender } = renderWithProviders(
      <ChatMessages messages={[]} streaming={false} empty={<p>empty</p>} />,
    );
    expect(screen.getByText("empty")).toBeInTheDocument();
    rerender(
      <ChatMessages messages={[{ role: "user", content: "Hi" }]} streaming empty={<p>empty</p>} />,
    );
    expect(screen.getByTestId("chat-message-user")).toHaveTextContent("Hi");
    expect(screen.getByRole("status", { name: "Thinking…" })).toBeInTheDocument();
    act(() => {
      rerender(
        <ChatMessages
          messages={[
            { role: "user", content: "Hi" },
            { role: "assistant", content: "Hello!" },
          ]}
          streaming={false}
          empty={<p>empty</p>}
        />,
      );
    });
    expect(screen.getByTestId("chat-message-assistant")).toHaveTextContent("Hello!");
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });

  it("lists a message's files, and says when their content is gone", () => {
    renderWithProviders(
      <ChatMessages
        messages={[
          {
            role: "user",
            content: "Compare",
            files: [
              { name: "a.csv", kind: "text", text: "x" } as never,
              { name: "old.pdf", kind: "pdf" },
            ],
          },
        ]}
        streaming={false}
        empty={null}
      />,
    );
    const [kept, gone] = screen.getAllByTestId("file-chip");
    expect(kept).toHaveAttribute("title", "a.csv");
    expect(gone).toHaveAttribute(
      "title",
      "Not kept: files stay only in the tab they were attached in.",
    );
    expect(screen.getByTestId("chat-message-user")).toHaveTextContent("Compare");
  });
});

describe("ConversationList", () => {
  const remove = { mutateAsync: jest.fn(async () => undefined) };
  const rename = { mutateAsync: jest.fn(async () => undefined), isPending: false };
  beforeEach(() => {
    jest.mocked(useDeleteConversation).mockReturnValue(remove as never);
    jest.mocked(useRenameConversation).mockReturnValue(rename as never);
  });

  it("shows a skeleton, an empty hint and an error with a retry", async () => {
    jest.mocked(useConversations).mockReturnValue({ isLoading: true } as never);
    const { unmount } = renderWithProviders(<ConversationList activeId={undefined} />);
    expect(screen.getByTestId("conversations-loading")).toHaveAttribute("aria-busy", "true");
    unmount();
    jest.mocked(useConversations).mockReturnValue({ data: [] } as never);
    const second = renderWithProviders(<ConversationList activeId={undefined} />);
    expect(screen.getByTestId("conversations-empty")).toHaveTextContent("No conversations yet.");
    second.unmount();
    const refetch = jest.fn();
    jest.mocked(useConversations).mockReturnValue({
      isError: true,
      error: new Error("boom"),
      refetch,
    } as never);
    renderWithProviders(<ConversationList activeId={undefined} />);
    expect(screen.getByTestId("conversations-error")).toHaveTextContent("boom");
    await userEvent.click(screen.getByTestId("conversations-error-retry"));
    expect(refetch).toHaveBeenCalled();
  });

  it("renames a conversation from its menu", async () => {
    jest.mocked(useConversations).mockReturnValue({
      data: [{ id: "c1", title: "First", updated: "2026-10-01 10:00:00.000Z" }],
    } as never);
    renderWithProviders(<ConversationList activeId={undefined} />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Actions for First" }), { key: "Enter" });
    await userEvent.click(await screen.findByRole("menuitem", { name: "Rename" }));
    const field = screen.getByRole("textbox", { name: "Rename conversation" });
    expect(field).toHaveValue("First");
    await userEvent.clear(field);
    await userEvent.type(field, "Renamed{Enter}");
    await waitFor(() =>
      expect(rename.mutateAsync).toHaveBeenCalledWith({ id: "c1", title: "Renamed" }),
    );
  });

  it("marks the active conversation and deletes after confirmation", async () => {
    jest.mocked(useConversations).mockReturnValue({
      data: [
        { id: "c1", title: "First", updated: "2026-10-01 10:00:00.000Z" },
        { id: "c2", title: "Second", updated: "2026-10-02 10:00:00.000Z" },
      ],
    } as never);
    renderWithProviders(<ConversationList activeId="c2" />);
    expect(screen.getByRole("link", { name: /Second/ })).toHaveAttribute("aria-current", "page");
    // Radix menus open on keyboard under jsdom (AGENTS.md gotchas).
    fireEvent.keyDown(screen.getByRole("button", { name: "Actions for First" }), { key: "Enter" });
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("“First” will be deleted for good.");
    await userEvent.click(screen.getByTestId("confirm-delete-conversation"));
    await waitFor(() => expect(remove.mutateAsync).toHaveBeenCalledWith("c1"));
  });
});
