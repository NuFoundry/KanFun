import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { ConfirmEmailChangePage, ConfirmVerificationPage, ResetPasswordPage } from "./auth-confirm";
import { confirmEmailChange, confirmPasswordReset, confirmVerification } from "@/lib/api/users";
import { useAuth } from "@/lib/auth-context";
import { renderWithProviders, screen, waitFor } from "@/test/test-utils";

jest.mock("@/lib/api/users");
jest.mock("@/lib/auth-context");

beforeEach(() => {
  jest.mocked(useAuth).mockReturnValue({ user: null } as unknown as ReturnType<typeof useAuth>);
});

function show(path: string) {
  renderWithProviders(
    <Routes>
      <Route path="/auth/confirm-verification/:token" element={<ConfirmVerificationPage />} />
      <Route path="/auth/confirm-password-reset/:token" element={<ResetPasswordPage />} />
      <Route path="/auth/confirm-email-change/:token" element={<ConfirmEmailChangePage />} />
    </Routes>,
    { route: path },
  );
}

describe("ConfirmVerificationPage", () => {
  it("redeems the token once and offers the login", async () => {
    jest.mocked(confirmVerification).mockResolvedValue();
    show("/auth/confirm-verification/tok-1");
    expect(await screen.findByText("Your email address is confirmed.")).toBeInTheDocument();
    expect(confirmVerification).toHaveBeenCalledTimes(1);
    expect(confirmVerification).toHaveBeenCalledWith("tok-1");
    expect(screen.getByRole("link", { name: "Go to login" })).toHaveAttribute("href", "/login");
  });

  it("explains an expired link", async () => {
    jest.mocked(confirmVerification).mockRejectedValue(new Error("invalid token"));
    show("/auth/confirm-verification/old");
    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid or has expired/);
  });
});

describe("ResetPasswordPage", () => {
  it("sets the new password with the token", async () => {
    jest.mocked(confirmPasswordReset).mockResolvedValue();
    show("/auth/confirm-password-reset/tok-2");
    await userEvent.type(screen.getByLabelText("New password"), "new-password-5678");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "new-password-5678");
    await userEvent.click(screen.getByRole("button", { name: "Save password" }));
    expect(await screen.findByText(/password has been changed/)).toBeInTheDocument();
    expect(confirmPasswordReset).toHaveBeenCalledWith("tok-2", "new-password-5678");
  });

  it("refuses two different passwords before asking the server", async () => {
    show("/auth/confirm-password-reset/tok-3");
    await userEvent.type(screen.getByLabelText("New password"), "new-password-5678");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "new-password-0000");
    await userEvent.click(screen.getByRole("button", { name: "Save password" }));
    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(confirmPasswordReset).not.toHaveBeenCalled();
  });

  it("explains an expired link", async () => {
    jest.mocked(confirmPasswordReset).mockRejectedValue(new Error("invalid token"));
    show("/auth/confirm-password-reset/old");
    await userEvent.type(screen.getByLabelText("New password"), "new-password-5678");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "new-password-5678");
    await userEvent.click(screen.getByRole("button", { name: "Save password" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/invalid or has expired/),
    );
  });
});

describe("ConfirmEmailChangePage", () => {
  it("confirms the new address with the password", async () => {
    jest.mocked(confirmEmailChange).mockResolvedValue();
    show("/auth/confirm-email-change/tok-4");
    await userEvent.type(screen.getByLabelText("Current password"), "password1234");
    await userEvent.click(screen.getByRole("button", { name: "Confirm email" }));
    expect(await screen.findByText(/email address has been changed/)).toBeInTheDocument();
    expect(confirmEmailChange).toHaveBeenCalledWith("tok-4", "password1234");
  });

  it("says so when the password or the link is wrong", async () => {
    jest.mocked(confirmEmailChange).mockRejectedValue(new Error("400"));
    show("/auth/confirm-email-change/tok-5");
    await userEvent.type(screen.getByLabelText("Current password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Confirm email" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Wrong password/);
  });
});
