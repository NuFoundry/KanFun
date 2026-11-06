import userEvent from "@testing-library/user-event";
import { SiteHeader } from "./site-header";
import { useAuth } from "@/lib/auth-context";
import { renderWithProviders, screen, waitFor, within } from "@/test/test-utils";

jest.mock("@/lib/auth-context");
type Auth = ReturnType<typeof useAuth>;

describe("SiteHeader", () => {
  beforeEach(() => {
    jest.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      user: { id: "u1", name: "Alice Example", email: "alice@example.com" },
      logout: jest.fn(),
    } as unknown as Auth);
  });

  it("shows the brand mark next to the app name", () => {
    renderWithProviders(<SiteHeader />);
    const brand = screen.getByTestId("brand");
    expect(brand.querySelector("img")).toHaveAttribute("src", "/favicon.svg");
    expect(brand).toHaveTextContent("KanFun");
  });

  it("puts the links into a menu on phones, which closes when one is picked", async () => {
    renderWithProviders(<SiteHeader />);
    await userEvent.click(screen.getByTestId("nav-menu"));
    const sheet = await screen.findByTestId("nav-sheet");
    await userEvent.click(within(sheet).getByRole("link", { name: "Dashboard" }));
    await waitFor(() => expect(screen.queryByTestId("nav-sheet")).not.toBeInTheDocument());
  });
});
