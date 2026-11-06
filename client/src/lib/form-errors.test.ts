import { ClientResponseError } from "pocketbase";
import { applyServerErrors } from "./form-errors";

function pbError(data: Record<string, unknown>, message = "Failed to create record.") {
  return new ClientResponseError({ status: 400, response: { code: 400, message, data } });
}

describe("applyServerErrors", () => {
  it("attaches field errors and returns null", () => {
    const setError = jest.fn();
    const rest = applyServerErrors(
      pbError({ email: { code: "validation_invalid_email", message: "Invalid email." } }),
      setError,
    );
    expect(setError).toHaveBeenCalledWith("email", { type: "server", message: "Invalid email." });
    expect(rest).toBeNull();
  });

  it("ignores fields the form does not have", () => {
    const setError = jest.fn();
    const rest = applyServerErrors(pbError({ slug: { message: "taken" } }), setError, ["title"]);
    expect(setError).not.toHaveBeenCalled();
    expect(rest).toBe("Failed to create record.");
  });

  it("falls back to the message for non-PocketBase errors", () => {
    const setError = jest.fn();
    expect(applyServerErrors(new Error("boom"), setError)).toBe("boom");
    expect(applyServerErrors("weird", setError)).toBe("Something went wrong");
  });
});
