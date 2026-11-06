import { cn } from "./utils";

describe("cn", () => {
  it("merges conditional classes", () => {
    const hidden = false as boolean;
    expect(cn("a", hidden && "b", "c")).toBe("a c");
  });
  it("lets later tailwind classes win", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});
