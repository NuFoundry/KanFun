import userEvent from "@testing-library/user-event";
import { ClientResponseError } from "pocketbase";
import { LoginPage } from "./login";
import { useChallenge } from "@/hooks/use-two-factor";
import { useAuth } from "@/lib/auth-context";
import { renderWithProviders, screen, within } from "@/test/test-utils";

jest.mock("@/lib/auth-context");
jest.mock("@/hooks/use-two-factor");

const login = jest.fn();

beforeEach(() => {
  jest.mocked(useAuth).mockReturnValue({
    isAuthenticated: false,
    login,
    register: jest.fn(),
  } as unknown as ReturnType<typeof useAuth>);
  jest.mocked(useChallenge).mockReturnValue({ data: { method: "app" } } as never);
});

describe("LoginPage", () => {
  it("asks for the second factor when the password was right, and goes back", async () => {
    login.mockRejectedValue(new ClientResponseError({ status: 401, response: { mfaId: "m1" } }));
    renderWithProviders(<LoginPage />);
    const form = within(screen.getByTestId("login-form"));
    await userEvent.type(form.getByLabelText("Email"), "alice@example.com");
    await userEvent.type(form.getByLabelText("Password"), "password1234");
    await userEvent.click(form.getByRole("button", { name: "Log in" }));

    expect(await screen.findByTestId("two-factor-challenge")).toBeVisible();
    expect(useChallenge).toHaveBeenCalledWith("m1");
    await userEvent.click(screen.getByRole("button", { name: "Back to sign in" }));
    expect(screen.getByTestId("login-form")).toBeVisible();
  });
});
