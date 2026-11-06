import userEvent from "@testing-library/user-event";
import { DevMailPage } from "./dev-mail";
import { useClearOutbox, useOutbox } from "@/hooks/use-outbox";
import { renderWithProviders, screen, within } from "@/test/test-utils";

jest.mock("@/hooks/use-outbox");
const mockedUseOutbox = jest.mocked(useOutbox);
const mockedUseClearOutbox = jest.mocked(useClearOutbox);

type Result = ReturnType<typeof useOutbox>;
const asResult = (partial: object) => partial as Result;
const mutate = jest.fn();

const mails = [
  {
    id: "m1",
    from: "KanFun <no-reply@example.com>",
    to: ["vera@example.com"],
    subject: "Verify your email",
    text: "Open http://localhost:5173/confirm-verification/t0k",
    html: '<p>Open <a href="http://localhost:5173/confirm-verification/t0k">this</a></p>',
    receivedAt: "2026-10-04T10:00:00Z",
    source: "pocketbase",
  },
  {
    id: "m2",
    from: "KanFun <no-reply@example.com>",
    to: ["vera@example.com"],
    subject: "Welcome to KanFun",
    text: "Hi Vera, no links here",
    receivedAt: "2026-10-04T10:00:01Z",
    source: "welcome",
  },
];

beforeEach(() => {
  mutate.mockReset();
  mockedUseClearOutbox.mockReturnValue({ mutate, isPending: false } as unknown as ReturnType<
    typeof useClearOutbox
  >);
});

describe("DevMailPage", () => {
  it("shows a skeleton while loading", () => {
    mockedUseOutbox.mockReturnValue(asResult({ isLoading: true }));
    renderWithProviders(<DevMailPage />);
    expect(screen.getByTestId("inbox-loading")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows errors with a retry", async () => {
    const refetch = jest.fn();
    mockedUseOutbox.mockReturnValue(
      asResult({ isError: true, error: new Error("mailer down") as Result["error"], refetch }),
    );
    renderWithProviders(<DevMailPage />);
    expect(screen.getByRole("alert")).toHaveTextContent("mailer down");
    await userEvent.click(screen.getByTestId("inbox-error-retry"));
    expect(refetch).toHaveBeenCalled();
  });

  it("shows an empty state", () => {
    mockedUseOutbox.mockReturnValue(asResult({ data: [] }));
    renderWithProviders(<DevMailPage />);
    expect(screen.getByTestId("inbox-empty")).toBeInTheDocument();
    expect(screen.getByTestId("inbox-clear")).toBeDisabled();
  });

  it("lists the mail, previews the newest one and lists its links", async () => {
    mockedUseOutbox.mockReturnValue(asResult({ data: mails }));
    renderWithProviders(<DevMailPage />);
    expect(screen.getByTestId("inbox-count")).toHaveTextContent("2");
    expect(screen.getByTestId("inbox-subject")).toHaveTextContent("Verify your email");
    expect(screen.getByTestId("inbox-preview")).toHaveAttribute(
      "srcdoc",
      expect.stringContaining("confirm-verification/t0k"),
    );
    expect(screen.getByTestId("inbox-preview")).toHaveAttribute("sandbox", "");

    await userEvent.click(screen.getByTestId("inbox-tab-links"));
    const links = within(screen.getByTestId("inbox-links")).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "http://localhost:5173/confirm-verification/t0k",
    ]);

    await userEvent.click(screen.getByTestId("inbox-item-m2"));
    expect(screen.getByTestId("inbox-subject")).toHaveTextContent("Welcome to KanFun");
    expect(screen.getByTestId("inbox-preview")).toHaveAttribute(
      "srcdoc",
      expect.stringContaining("Hi Vera"),
    );
  });

  it("refreshes on demand", async () => {
    const refetch = jest.fn();
    mockedUseOutbox.mockReturnValue(asResult({ data: mails, refetch }));
    renderWithProviders(<DevMailPage />);
    await userEvent.click(screen.getByTestId("inbox-refresh"));
    expect(refetch).toHaveBeenCalled();
  });

  it("filters by recipient and clears the outbox", async () => {
    mockedUseOutbox.mockReturnValue(asResult({ data: mails }));
    renderWithProviders(<DevMailPage />);
    await userEvent.type(screen.getByTestId("inbox-filter"), "vera");
    expect(mockedUseOutbox).toHaveBeenLastCalledWith("vera");
    await userEvent.click(screen.getByTestId("inbox-clear"));
    expect(mutate).toHaveBeenCalled();
  });
});
