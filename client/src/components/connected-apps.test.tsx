import { fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConnectedApps, McpActivity } from "./connected-apps";
import { useCreateToken, useGrants, useMcpActivity, useRevokeGrant } from "@/hooks/use-mcp";
import { renderWithProviders, screen } from "@/test/test-utils";

jest.mock("@/hooks/use-mcp", () => ({
  ...jest.requireActual("@/hooks/use-mcp"),
  useGrants: jest.fn(),
  useMcpActivity: jest.fn(),
  useRevokeGrant: jest.fn(),
  useCreateToken: jest.fn(),
}));

const grant = {
  id: "g1",
  kind: "oauth",
  clientName: "Claude",
  clientHost: "claude.ai",
  verified: true,
  scopes: ["posts:read", "posts:write"],
  lastUsed: "2026-10-20 10:00:00.000Z",
  expires: "2026-11-20 10:00:00.000Z",
};

describe("ConnectedApps", () => {
  const revoke = jest.fn();
  const create = jest.fn();
  beforeEach(() => {
    jest.mocked(useRevokeGrant).mockReturnValue({ mutate: revoke } as never);
    jest.mocked(useCreateToken).mockReturnValue({ mutateAsync: create, isPending: false } as never);
  });
  const withGrants = (state: object) => jest.mocked(useGrants).mockReturnValue(state as never);

  it("has loading, error and empty states", () => {
    withGrants({ isLoading: true });
    const { unmount } = renderWithProviders(<ConnectedApps />);
    expect(screen.getByTestId("connected-apps-loading")).toHaveAttribute("aria-busy", "true");
    unmount();

    const refetch = jest.fn();
    withGrants({ isError: true, error: new Error("boom"), refetch });
    const second = renderWithProviders(<ConnectedApps />);
    fireEvent.click(screen.getByTestId("connected-apps-error-retry"));
    expect(refetch).toHaveBeenCalled();
    second.unmount();

    withGrants({ data: [] });
    renderWithProviders(<ConnectedApps />);
    expect(screen.getByTestId("connected-apps-empty")).toHaveTextContent("No apps connected");
    expect(screen.getByTestId("mcp-server-url")).toHaveValue("http://localhost/mcp");
  });

  it("lists connections with their permissions and disconnects after confirming", async () => {
    withGrants({
      data: [
        grant,
        { ...grant, id: "g2", clientName: "Script", kind: "token", clientHost: "", lastUsed: "" },
        { ...grant, id: "g3", clientName: "Self-named", verified: false },
      ],
    });
    renderWithProviders(<ConnectedApps />);
    const rows = screen.getAllByTestId("grant");
    expect(rows[0]).toHaveTextContent("Read your posts and drafts · Create, edit and publish");
    expect(rows[1]).toHaveTextContent("Access token");
    expect(rows[1]).toHaveTextContent("Not used yet");
    expect(rows[2]).toHaveTextContent("Unverified");

    await userEvent.click(screen.getAllByTestId("grant-revoke")[0]!);
    await userEvent.click(screen.getByTestId("grant-revoke-confirm"));
    expect(revoke).toHaveBeenCalledWith("g1", expect.anything());
  });

  it("creates a token and shows it once", async () => {
    withGrants({ data: [] });
    create.mockResolvedValue({ token: "mcp_pat_secret", expires: "2027-01-01T00:00:00.000Z" });
    renderWithProviders(<ConnectedApps />);
    await userEvent.click(screen.getByTestId("token-create"));
    await userEvent.type(screen.getByLabelText("Name"), "Nightly import");
    await userEvent.click(screen.getByTestId("token-scope-posts:write"));
    await userEvent.click(screen.getByRole("button", { name: "Create token" }));
    expect(create).toHaveBeenCalledWith({
      name: "Nightly import",
      scopes: ["posts:read", "posts:write"],
      days: 90,
    });
    expect(await screen.findByTestId("token-value")).toHaveValue("mcp_pat_secret");
    await userEvent.click(screen.getByTestId("token-done"));
    expect(screen.queryByTestId("token-value")).toBeNull();
  });
});

describe("McpActivity", () => {
  const withActivity = (state: object) =>
    jest.mocked(useMcpActivity).mockReturnValue(state as never);

  it("has loading, error and empty states", () => {
    withActivity({ isLoading: true });
    const { unmount } = renderWithProviders(<McpActivity />);
    expect(screen.getByTestId("mcp-activity-loading")).toHaveAttribute("aria-busy", "true");
    unmount();
    withActivity({ isError: true, error: new Error("boom"), refetch: jest.fn() });
    const second = renderWithProviders(<McpActivity />);
    expect(screen.getByTestId("mcp-activity-error")).toBeInTheDocument();
    second.unmount();
    withActivity({ data: [] });
    renderWithProviders(<McpActivity />);
    expect(screen.getByTestId("mcp-activity-empty")).toBeInTheDocument();
  });

  it("lists tool calls with their outcome", () => {
    withActivity({
      data: [
        {
          id: "a1",
          tool: "create_post",
          clientName: "Claude",
          outcome: "denied",
          created: "2026-10-20 10:00:00.000Z",
        },
      ],
    });
    renderWithProviders(<McpActivity />);
    expect(screen.getByTestId("mcp-activity-entry")).toHaveTextContent("create_post");
    expect(screen.getByTestId("mcp-activity-entry")).toHaveTextContent("Refused");
  });
});
