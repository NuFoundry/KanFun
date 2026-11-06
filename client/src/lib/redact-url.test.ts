import { redactUrl } from "./redact-url";

describe("redactUrl", () => {
  it("drops the query and the hash", () => {
    expect(redactUrl("https://app.example.com/dashboard?q=Smith&page=2#top")).toBe(
      "https://app.example.com/dashboard",
    );
    expect(redactUrl("/dashboard?q=Smith")).toBe("/dashboard");
  });

  it("replaces record ids and tokens, keeps readable segments", () => {
    expect(redactUrl("/assistant/abc123def456ghi")).toBe("/assistant/:id");
    expect(redactUrl("/posts/how-the-stack-fits-together")).toBe(
      "/posts/how-the-stack-fits-together",
    );
    expect(redactUrl("/invite/Xk2_9aLqPz7RtVb3Hn8MwCe4")).toBe("/invite/:token");
    expect(redactUrl("/auth/confirm-password-reset/eyJhbGc.eyJpZCI6IjEifQ.c2ln")).toBe(
      "/auth/confirm-password-reset/:token",
    );
    expect(
      redactUrl("http://localhost:5173/api/collections/posts/records?filter=(title~'Smith')"),
    ).toBe("http://localhost:5173/api/collections/posts/records");
  });

  it("keeps empty input empty", () => {
    expect(redactUrl("")).toBe("");
  });
});
