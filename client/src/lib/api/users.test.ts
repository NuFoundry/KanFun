import { changePassword, fullName, nameParts, updateProfile } from "./users";

const update = jest.fn();
const authWithPassword = jest.fn();
jest.mock("@/lib/pocketbase", () => ({
  pb: { collection: () => ({ update, authWithPassword }) },
}));

describe("users api", () => {
  beforeEach(() => {
    update.mockReset();
    authWithPassword.mockReset();
  });

  it("derives the display name from the parts", () => {
    expect(fullName({ firstName: " Alice ", lastName: "Example" })).toBe("Alice Example");
    expect(fullName({ firstName: "Solo", lastName: "" })).toBe("Solo");
  });

  it("splits an old display name into parts until the parts are stored", () => {
    expect(nameParts({ name: "Bob The Builder" })).toEqual({
      firstName: "Bob",
      lastName: "The Builder",
    });
    expect(nameParts({ firstName: "Ann", lastName: "", name: "Ann Lee" })).toEqual({
      firstName: "Ann",
      lastName: "",
    });
    expect(nameParts({})).toEqual({ firstName: "", lastName: "" });
  });

  it("stores the parts and the display name together", async () => {
    update.mockResolvedValue({ id: "u1" });
    await updateProfile("u1", { firstName: "Alice", lastName: "Example" });
    expect(update).toHaveBeenCalledWith("u1", {
      firstName: "Alice",
      lastName: "Example",
      name: "Alice Example",
    });
  });

  it("changes the password, then renews the session with it", async () => {
    update.mockResolvedValue({});
    const input = {
      oldPassword: "old-pass-123",
      password: "new-pass-456",
      passwordConfirm: "new-pass-456",
    };
    await changePassword("u1", "a@x.test", input);
    expect(update).toHaveBeenCalledWith("u1", input);
    expect(authWithPassword).toHaveBeenCalledWith("a@x.test", "new-pass-456");
  });
});
