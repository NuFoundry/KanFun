import userEvent from "@testing-library/user-event";
import { ClientResponseError } from "pocketbase";
import { SettingsPage } from "./settings";
import { useChangePassword, useUpdateProfile } from "@/hooks/use-profile";
import { useAuth } from "@/lib/auth-context";
import { renderWithProviders, screen, waitFor, within } from "@/test/test-utils";

jest.mock("@/hooks/use-profile");
// Covered by its own test (components/two-factor-settings.test.tsx).
jest.mock("@/components/two-factor-settings", () => ({ TwoFactorSettings: () => null }));
jest.mock("@/lib/auth-context");

const updateProfile = jest.fn();
const changePassword = jest.fn();

beforeEach(() => {
  updateProfile.mockReset();
  changePassword.mockReset();
  jest.mocked(useAuth).mockReturnValue({
    user: { id: "u1", email: "alice@example.com", name: "Alice Example" },
  } as unknown as ReturnType<typeof useAuth>);
  jest.mocked(useUpdateProfile).mockReturnValue({
    mutateAsync: updateProfile,
    isPending: false,
  } as unknown as ReturnType<typeof useUpdateProfile>);
  jest.mocked(useChangePassword).mockReturnValue({
    mutateAsync: changePassword,
    isPending: false,
  } as unknown as ReturnType<typeof useChangePassword>);
});

/** Pastes instead of typing key by key: each key re-renders the whole page. */
async function fill(field: HTMLElement, value: string) {
  await userEvent.click(field);
  await userEvent.paste(value);
}

describe("SettingsPage", () => {
  it("prefills the name parts from the display name and saves them", async () => {
    updateProfile.mockResolvedValue({});
    renderWithProviders(<SettingsPage />);
    const form = within(screen.getByTestId("profile-form"));
    expect(form.getByLabelText("First name")).toHaveValue("Alice");
    expect(form.getByLabelText("Last name")).toHaveValue("Example");
    await userEvent.clear(form.getByLabelText("Last name"));
    await userEvent.type(form.getByLabelText("Last name"), "Wonder");
    await userEvent.click(form.getByRole("button", { name: "Save profile" }));
    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith({ firstName: "Alice", lastName: "Wonder" }),
    );
  });

  it("validates the password form before sending", async () => {
    renderWithProviders(<SettingsPage />);
    const form = within(screen.getByTestId("password-form"));
    await userEvent.type(form.getByLabelText("Current password"), "old-pass-123");
    await userEvent.type(form.getByLabelText("New password", { exact: true }), "new-pass-456");
    await userEvent.type(form.getByLabelText("Confirm new password"), "different");
    await userEvent.click(form.getByRole("button", { name: "Change password" }));
    expect(await form.findByText("Passwords do not match")).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("changes the password and shows server errors inline", async () => {
    changePassword.mockResolvedValueOnce(undefined);
    renderWithProviders(<SettingsPage />);
    const form = within(screen.getByTestId("password-form"));
    await fill(form.getByLabelText("Current password"), "old-pass-123");
    await fill(form.getByLabelText("New password", { exact: true }), "new-pass-456");
    await fill(form.getByLabelText("Confirm new password"), "new-pass-456");
    await userEvent.click(form.getByRole("button", { name: "Change password" }));
    await waitFor(() =>
      expect(changePassword).toHaveBeenCalledWith({
        oldPassword: "old-pass-123",
        password: "new-pass-456",
        passwordConfirm: "new-pass-456",
      }),
    );
    expect(form.getByLabelText("Current password")).toHaveValue("");

    changePassword.mockRejectedValueOnce(
      new ClientResponseError({
        status: 400,
        response: { data: { oldPassword: { code: "x", message: "Wrong password" } } },
      }),
    );
    await fill(form.getByLabelText("Current password"), "nope-nope-1");
    await fill(form.getByLabelText("New password", { exact: true }), "new-pass-456");
    await fill(form.getByLabelText("Confirm new password"), "new-pass-456");
    await userEvent.click(form.getByRole("button", { name: "Change password" }));
    expect(await form.findByText("Wrong password")).toBeInTheDocument();
  });
});
