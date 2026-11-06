import userEvent from "@testing-library/user-event";
import { ClientResponseError } from "pocketbase";
import { TwoFactorChallenge } from "./two-factor-challenge";
import { useChallenge } from "@/hooks/use-two-factor";
import { verifyAppCode, verifyEmailCode } from "@/lib/api/two-factor";
import { renderWithProviders, screen, waitFor } from "@/test/test-utils";

jest.mock("@/hooks/use-two-factor");
jest.mock("@/lib/api/two-factor", () => ({
  ...jest.requireActual("@/lib/api/two-factor"),
  verifyAppCode: jest.fn(),
  verifyEmailCode: jest.fn(),
}));

const withChallenge = (state: object) =>
  jest.mocked(useChallenge).mockReturnValue({ refetch: jest.fn(), ...state } as never);
const wrongCode = new ClientResponseError({
  status: 400,
  response: { data: { code: { message: "Invalid code." } } },
});

describe("TwoFactorChallenge", () => {
  it("has loading and error states; the error leads back to sign in", async () => {
    withChallenge({ isLoading: true });
    const { unmount } = renderWithProviders(<TwoFactorChallenge mfaId="m1" onCancel={jest.fn()} />);
    expect(screen.getByTestId("two-factor-challenge-loading")).toHaveAttribute("aria-busy", "true");
    unmount();

    const onCancel = jest.fn();
    withChallenge({
      isError: true,
      error: new ClientResponseError({ status: 400, response: { data: { mfaId: {} } } }),
    });
    renderWithProviders(<TwoFactorChallenge mfaId="m1" onCancel={onCancel} />);
    expect(screen.getByTestId("two-factor-challenge-error")).toHaveTextContent(
      "This sign-in has expired",
    );
    await userEvent.click(screen.getByTestId("two-factor-challenge-error-retry"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("checks an app code, and a recovery code instead", async () => {
    withChallenge({ data: { method: "app" } });
    jest.mocked(verifyAppCode).mockRejectedValueOnce(wrongCode).mockResolvedValue(undefined);
    renderWithProviders(<TwoFactorChallenge mfaId="m1" onCancel={jest.fn()} />);
    expect(screen.getByText(/authenticator app/)).toBeVisible();

    await userEvent.type(screen.getByLabelText("Code"), "123456");
    await userEvent.click(screen.getByRole("button", { name: "Verify" }));
    expect(
      await screen.findByText("That code is not right. Check it and try again."),
    ).toBeVisible();

    await userEvent.click(screen.getByTestId("two-factor-use-recovery"));
    await userEvent.type(screen.getByLabelText("Recovery code"), "abcde-fghjk");
    await userEvent.click(screen.getByRole("button", { name: "Verify" }));
    await waitFor(() => expect(verifyAppCode).toHaveBeenLastCalledWith("m1", "abcde-fghjk"));
  });

  it("checks an emailed code against the challenge's otpId", async () => {
    withChallenge({ data: { method: "email", otpId: "o1" } });
    jest.mocked(verifyEmailCode).mockResolvedValue(undefined);
    renderWithProviders(<TwoFactorChallenge mfaId="m1" onCancel={jest.fn()} />);
    expect(screen.getByText(/emailed you/)).toBeVisible();
    await userEvent.type(screen.getByLabelText("Code"), "654321");
    await userEvent.click(screen.getByRole("button", { name: "Verify" }));
    await waitFor(() => expect(verifyEmailCode).toHaveBeenCalledWith("m1", "o1", "654321"));
  });
});
