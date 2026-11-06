import { ClientResponseError } from "pocketbase";
import {
  enableApp,
  getTwoFactor,
  mfaIdFrom,
  startChallenge,
  twoFactorProblem,
  verifyAppCode,
  verifyEmailCode,
} from "./two-factor";

const send = jest.fn();
const save = jest.fn();
const authWithOTP = jest.fn();
jest.mock("@/lib/pocketbase", () => ({
  pb: {
    send: (...args: unknown[]) => send(...args),
    authStore: { save: (...args: unknown[]) => save(...args) },
    collection: () => ({ authWithOTP }),
  },
}));

const failure = (status: number, response: Record<string, unknown>) =>
  new ClientResponseError({ status, response });

describe("two-factor api", () => {
  beforeEach(() => {
    send.mockReset();
    save.mockReset();
    authWithOTP.mockReset();
  });

  it("reads the status and posts to the hook's routes", async () => {
    send.mockResolvedValueOnce({ method: "app", recoveryCodes: 9 });
    await expect(getTwoFactor()).resolves.toEqual({ method: "app", recoveryCodes: 9 });
    expect(send).toHaveBeenCalledWith("/api/two-factor", { method: "GET" });

    send.mockResolvedValueOnce({ recoveryCodes: ["a", "b"] });
    await expect(enableApp("pw", "123456")).resolves.toEqual(["a", "b"]);
    expect(send).toHaveBeenLastCalledWith("/api/two-factor/app/enable", {
      method: "POST",
      body: { password: "pw", code: "123456" },
    });
  });

  it("finds the mfaId of a sign-in that needs a second step", () => {
    expect(mfaIdFrom(failure(401, { mfaId: "m1" }))).toBe("m1");
    expect(mfaIdFrom(failure(400, { mfaId: "m1" }))).toBeNull();
    expect(mfaIdFrom(failure(401, {}))).toBeNull();
    expect(mfaIdFrom(new Error("offline"))).toBeNull();
  });

  it("starts the challenge and stores the session after an app code", async () => {
    send.mockResolvedValueOnce({ method: "email", otpId: "o1" });
    await expect(startChallenge("m1")).resolves.toEqual({ method: "email", otpId: "o1" });

    send.mockResolvedValueOnce({ token: "t", record: { id: "u1" } });
    await verifyAppCode("m1", "123456");
    expect(send).toHaveBeenLastCalledWith("/api/two-factor/verify", {
      method: "POST",
      body: { mfaId: "m1", code: "123456" },
    });
    expect(save).toHaveBeenCalledWith("t", { id: "u1" });
  });

  it("completes an email sign-in through PocketBase's OTP with the mfaId", async () => {
    await verifyEmailCode("m1", "o1", " 123456 ");
    expect(authWithOTP).toHaveBeenCalledWith("o1", "123456", { mfaId: "m1" });
  });

  it("tells which input was wrong", () => {
    const field = (name: string) => failure(400, { data: { [name]: { message: "x" } } });
    expect(twoFactorProblem(field("password"))).toBe("password");
    expect(twoFactorProblem(field("code"))).toBe("code");
    expect(twoFactorProblem(field("mfaId"))).toBe("signIn");
    expect(twoFactorProblem(failure(400, { message: "Invalid or expired OTP.", data: {} }))).toBe(
      "code",
    );
    expect(
      twoFactorProblem(failure(400, { message: "Invalid or expired MFA session.", data: {} })),
    ).toBe("signIn");
    expect(twoFactorProblem(failure(500, {}))).toBeNull();
  });
});
