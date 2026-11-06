import { Hono } from "hono";
import type { AuthVariables } from "./auth";
import { rateLimit } from "./rate-limit";

function appWith(max: number, now: () => number) {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use(async (c, next) => {
    c.set("user", { id: c.req.header("x-user") ?? "u1", email: "u@example.com" });
    await next();
  });
  app.get("/", rateLimit({ max, windowMs: 60_000 }, now), (c) => c.text("ok"));
  return app;
}

describe("rateLimit", () => {
  it("allows max requests per user and window, then answers 429 with Retry-After", async () => {
    let t = 1_000_000;
    const app = appWith(2, () => t);
    const get = (user = "u1") => app.request("/", { headers: { "x-user": user } });
    expect((await get()).status).toBe(200);
    expect((await get()).status).toBe(200);
    t += 15_000;
    const limited = await get();
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("45");
    // Other users have their own budget, and the next window starts fresh.
    expect((await get("u2")).status).toBe(200);
    t += 45_000;
    expect((await get()).status).toBe(200);
  });
});
