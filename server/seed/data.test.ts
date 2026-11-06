import { seedConversations, seedPosts, seedUsers, fullName } from "./data";

describe("seed data", () => {
  it("has unique user emails", () => {
    const emails = seedUsers.map((u) => u.email);
    expect(new Set(emails).size).toBe(emails.length);
  });

  it("gives every user a first and last name and a display name", () => {
    for (const user of seedUsers) {
      expect(user.firstName).not.toBe("");
      expect(user.lastName).not.toBe("");
    }
    expect(fullName({ firstName: "Alice", lastName: "Example" })).toBe("Alice Example");
    expect(fullName({ firstName: "Solo", lastName: "" })).toBe("Solo");
  });

  it("has unique, URL-safe post slugs", () => {
    const slugs = seedPosts.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it("only references seeded authors", () => {
    const emails = new Set(seedUsers.map((u) => u.email));
    for (const post of seedPosts) expect(emails.has(post.authorEmail)).toBe(true);
  });

  it("includes at least one published post for the public home page", () => {
    expect(seedPosts.some((p) => p.published)).toBe(true);
  });

  it("gives seeded users conversations that start with their question", () => {
    const emails = new Set(seedUsers.map((u) => u.email));
    expect(seedConversations.length).toBeGreaterThan(0);
    for (const conversation of seedConversations) {
      expect(emails.has(conversation.userEmail)).toBe(true);
      expect(conversation.title).not.toBe("");
      expect(conversation.messages[0]?.role).toBe("user");
    }
  });
});
