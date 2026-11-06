import userEvent from "@testing-library/user-event";
import { ConnectPage } from "./connect";
import { useConsentRequest, useDecideConsent } from "@/hooks/use-mcp";
import { returnToAgent } from "@/lib/api/mcp";
import { useAuth } from "@/lib/auth-context";
import { renderWithProviders, screen } from "@/test/test-utils";

jest.mock("@/hooks/use-mcp", () => ({
  ...jest.requireActual("@/hooks/use-mcp"),
  useConsentRequest: jest.fn(),
  useDecideConsent: jest.fn(),
}));
jest.mock("@/lib/api/mcp", () => ({
  ...jest.requireActual("@/lib/api/mcp"),
  returnToAgent: jest.fn(),
}));
jest.mock("@/lib/auth-context");

const consent = (client: { verified: boolean; host?: string }) => ({
  client: { name: "Agent", host: client.host ?? "agent.dev", verified: client.verified },
  redirectHost: "127.0.0.1",
  scopes: ["posts:read", "posts:write", "posts:delete"],
  optIn: ["posts:delete"],
});

function renderPage(data: unknown, state: object = {}) {
  jest.mocked(useConsentRequest).mockReturnValue({ data, ...state } as never);
  return renderWithProviders(<ConnectPage />, {
    route: "/connect?client_id=c&redirect_uri=http%3A%2F%2F127.0.0.1%2Fcb&state=s",
  });
}

describe("ConnectPage", () => {
  const mutate = jest.fn();
  beforeEach(() => {
    jest.mocked(useAuth).mockReturnValue({ user: { email: "alice@example.com" } } as never);
    jest.mocked(useDecideConsent).mockReturnValue({ mutate, isPending: false } as never);
  });

  it("shows a skeleton while the request is checked", () => {
    renderPage(undefined, { isPending: true });
    expect(screen.getByTestId("connect-loading")).toHaveAttribute("aria-busy", "true");
  });

  it("explains a request it cannot show, without sending the browser anywhere", () => {
    renderPage(undefined, { isError: true, error: new Error("unknown_client") });
    expect(screen.getByTestId("connect-error")).toHaveTextContent(
      "This connection request is not valid",
    );
    expect(returnToAgent).not.toHaveBeenCalled();
  });

  it("sends errors the agent should see straight back to it", () => {
    renderPage({ redirect: "http://127.0.0.1/cb?error=invalid_scope" });
    expect(returnToAgent).toHaveBeenCalledWith("http://127.0.0.1/cb?error=invalid_scope");
  });

  it("names a verified app by its domain, with deleting unticked", async () => {
    renderPage(consent({ verified: true }));
    expect(screen.getByText("Connect Agent")).toBeInTheDocument();
    expect(screen.getByTestId("connect-publisher")).toHaveTextContent("Published by agent.dev");
    expect(screen.queryByTestId("connect-unverified")).toBeNull();
    expect(screen.getByTestId("scope-posts:read")).toBeChecked();
    expect(screen.getByTestId("scope-posts:delete")).not.toBeChecked();

    await userEvent.click(screen.getByTestId("scope-posts:write"));
    await userEvent.click(screen.getByTestId("connect-allow"));
    expect(mutate).toHaveBeenCalledWith(
      { approve: true, scopes: ["posts:read"] },
      expect.anything(),
    );
  });

  it("warns about an app that named itself", () => {
    renderPage(consent({ verified: false }));
    expect(screen.getByTestId("connect-unverified")).toHaveTextContent("Unverified app");
  });

  it("cannot allow without a permission, and denying goes back to the agent", async () => {
    mutate.mockImplementation((_vars, { onSuccess }) => onSuccess("http://127.0.0.1/cb?error=x"));
    renderPage(consent({ verified: true }));
    await userEvent.click(screen.getByTestId("scope-posts:read"));
    await userEvent.click(screen.getByTestId("scope-posts:write"));
    expect(screen.getByTestId("connect-allow")).toBeDisabled();
    await userEvent.click(screen.getByTestId("connect-deny"));
    expect(mutate.mock.calls[0][0]).toMatchObject({ approve: false });
    expect(returnToAgent).toHaveBeenCalledWith("http://127.0.0.1/cb?error=x");
    expect(screen.getByTestId("connect-done")).toBeInTheDocument();
  });
});
