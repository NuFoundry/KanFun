import { fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClientResponseError } from "pocketbase";
import { TwoFactorSettings } from "./two-factor-settings";
import {
  useDisableTwoFactor,
  useEnableApp,
  useEnableEmail,
  useNewRecoveryCodes,
  useStartAppSetup,
  useStartEmailSetup,
  useTwoFactor,
} from "@/hooks/use-two-factor";
import { useAuth } from "@/lib/auth-context";
import { renderWithProviders, screen, waitFor, within } from "@/test/test-utils";

jest.mock("@/hooks/use-two-factor");
jest.mock("@/lib/auth-context");

const startApp = jest.fn();
const enableApp = jest.fn();
const startEmail = jest.fn();
const enableEmail = jest.fn();
const disable = jest.fn();
const renew = jest.fn();
const fieldError = (field: string) =>
  new ClientResponseError({ status: 400, response: { data: { [field]: { message: "x" } } } });

beforeEach(() => {
  jest.mocked(useAuth).mockReturnValue({
    user: { id: "u1", email: "alice@example.com" },
  } as unknown as ReturnType<typeof useAuth>);
  jest.mocked(useStartAppSetup).mockReturnValue({
    mutate: startApp,
    data: { secret: "ABCDEFGHIJKLMNOP", uri: "otpauth://totp/App:a?secret=ABCDEFGHIJKLMNOP" },
  } as never);
  jest.mocked(useEnableApp).mockReturnValue({ mutateAsync: enableApp, isPending: false } as never);
  jest.mocked(useStartEmailSetup).mockReturnValue({ mutate: startEmail, data: "otp1" } as never);
  jest.mocked(useEnableEmail).mockReturnValue({ mutateAsync: enableEmail } as never);
  jest.mocked(useDisableTwoFactor).mockReturnValue({ mutateAsync: disable } as never);
  jest.mocked(useNewRecoveryCodes).mockReturnValue({ mutateAsync: renew } as never);
});

const withStatus = (state: object) => jest.mocked(useTwoFactor).mockReturnValue(state as never);

describe("TwoFactorSettings", () => {
  it("has loading and error states", () => {
    withStatus({ isLoading: true });
    const { unmount } = renderWithProviders(<TwoFactorSettings />);
    expect(screen.getByTestId("two-factor-loading")).toHaveAttribute("aria-busy", "true");
    unmount();

    const refetch = jest.fn();
    withStatus({ isError: true, error: new Error("boom"), refetch });
    renderWithProviders(<TwoFactorSettings />);
    fireEvent.click(screen.getByTestId("two-factor-error-retry"));
    expect(refetch).toHaveBeenCalled();
  });

  it("sets up an authenticator app and shows the recovery codes once", async () => {
    withStatus({ data: { method: "", recoveryCodes: 0 } });
    enableApp
      .mockRejectedValueOnce(fieldError("code"))
      .mockResolvedValueOnce(["aaaaa-bbbbb", "ccccc-ddddd"]);
    renderWithProviders(<TwoFactorSettings />);
    expect(screen.getByTestId("two-factor-off")).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("two-factor-setup-app"));
    expect(startApp).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("img", { name: "QR code for your authenticator app" })).toBeVisible();
    expect(screen.getByTestId("two-factor-secret")).toHaveTextContent("ABCD EFGH IJKL MNOP");

    const form = within(screen.getByTestId("two-factor-app-form"));
    await userEvent.type(form.getByLabelText("Code"), "123456");
    await userEvent.type(form.getByLabelText("Current password"), "password1234");
    await userEvent.click(form.getByRole("button", { name: "Confirm" }));
    expect(await form.findByText("That code is not right. Check it and try again.")).toBeVisible();

    await userEvent.click(form.getByRole("button", { name: "Confirm" }));
    expect(enableApp).toHaveBeenLastCalledWith({ code: "123456", password: "password1234" });
    expect(await screen.findByTestId("two-factor-codes")).toHaveTextContent("aaaaa-bbbbb");
  });

  it("turns on email codes with the code from the inbox", async () => {
    withStatus({ data: { method: "", recoveryCodes: 0 } });
    enableEmail.mockResolvedValue(undefined);
    renderWithProviders(<TwoFactorSettings />);
    await userEvent.click(screen.getByTestId("two-factor-setup-email"));
    expect(startEmail).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/alice@example.com/)).toBeVisible();
    const form = within(screen.getByTestId("two-factor-email-form"));
    await userEvent.type(form.getByLabelText("Code"), "654321");
    await userEvent.type(form.getByLabelText("Current password"), "password1234");
    await userEvent.click(form.getByRole("button", { name: "Confirm" }));
    await waitFor(() =>
      expect(enableEmail).toHaveBeenCalledWith({
        code: "654321",
        password: "password1234",
        otpId: "otp1",
      }),
    );
  });

  it("shows the method, renews recovery codes and turns off with the password", async () => {
    withStatus({ data: { method: "app", recoveryCodes: 1 } });
    disable.mockRejectedValueOnce(fieldError("password")).mockResolvedValueOnce(undefined);
    renew.mockResolvedValue(["eeeee-fffff"]);
    renderWithProviders(<TwoFactorSettings />);
    expect(screen.getByTestId("two-factor-method")).toHaveTextContent("Authenticator app");
    expect(screen.getByTestId("two-factor-recovery-left")).toHaveTextContent(
      "1 recovery code left",
    );

    await userEvent.click(screen.getByTestId("two-factor-new-codes"));
    const codes = within(screen.getByTestId("two-factor-codes-form"));
    await userEvent.type(codes.getByLabelText("Current password"), "password1234");
    await userEvent.click(codes.getByRole("button", { name: "Confirm" }));
    expect(await screen.findByTestId("two-factor-codes")).toHaveTextContent("eeeee-fffff");
    await userEvent.click(screen.getByTestId("two-factor-codes-done"));

    await userEvent.click(screen.getByTestId("two-factor-disable"));
    const off = within(screen.getByTestId("two-factor-disable-form"));
    await userEvent.type(off.getByLabelText("Current password"), "wrong");
    await userEvent.click(off.getByRole("button", { name: "Confirm" }));
    expect(await off.findByText("Wrong password")).toBeVisible();
    await userEvent.click(off.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(disable).toHaveBeenLastCalledWith("wrong"));
    await waitFor(() => expect(screen.queryByTestId("two-factor-disable-form")).toBeNull());
  });
});
