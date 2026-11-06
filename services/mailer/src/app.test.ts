import { createApp, sameToken } from "./app";
import { isReservedAddress, type MailMessage, type MailProvider } from "./lib/types";
import { Outbox } from "./lib/outbox";
import { createOutboxProvider } from "./lib/providers";

function build(devTools = true, provider?: MailProvider) {
  const outbox = new Outbox();
  const app = createApp({
    provider: provider ?? createOutboxProvider(outbox),
    outbox,
    internalToken: "secret",
    from: "KanFun <no-reply@example.com>",
    appName: "KanFun",
    appUrl: "http://localhost:5173",
    devTools,
  });
  const send = (body: unknown, token: string | null = "secret") =>
    app.request("/mail/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  return { app, outbox, send };
}

describe("mailer app", () => {
  it("reports health", async () => {
    const { app } = build();
    const res = await app.request("/mail/health");
    expect(await res.json()).toEqual({ ok: true, provider: "outbox", devTools: true });
  });

  it("compares tokens in constant time and refuses oversized bodies", async () => {
    expect(sameToken("abc", "abc")).toBe(true);
    expect(sameToken("abc", "abd")).toBe(false);
    expect(sameToken("abc", "abcd")).toBe(false);
    const { app } = build();
    const res = await app.request("/mail/send", {
      method: "POST",
      headers: {
        Authorization: "Bearer secret",
        "Content-Type": "application/json",
        "Content-Length": String(5 * 1024 * 1024),
      },
      body: "{}",
    });
    expect(res.status).toBe(413);
  });

  it("requires the internal token", async () => {
    const { send } = build();
    expect((await send({ to: "a@x.test", subject: "s", text: "t" }, null)).status).toBe(401);
    expect((await send({ to: "a@x.test", subject: "s", text: "t" }, "wrong")).status).toBe(401);
  });

  it("validates the body", async () => {
    const { send } = build();
    expect((await send({ to: "not-an-email", subject: "s", text: "t" })).status).toBe(400);
    expect((await send({ to: "a@x.test" })).status).toBe(400);
    expect((await send({ to: "a@x.test", template: "nope" })).status).toBe(400);
    expect((await send({ to: "a@x.test", template: "notification", data: {} })).status).toBe(400);
  });

  it("sends a raw message", async () => {
    const { send, outbox } = build();
    const res = await send({ to: ["a@x.test", "b@x.test"], subject: "Hi", text: "Body" });
    expect(res.status).toBe(200);
    const { id } = (await res.json()) as { id: string };
    expect(outbox.get(id)?.to).toEqual(["a@x.test", "b@x.test"]);
    expect(outbox.get(id)?.from).toBe("KanFun <no-reply@example.com>");
  });

  it("accepts HTML-only messages (PocketBase auth mails) and keeps their origin", async () => {
    const { send, outbox } = build();
    const res = await send({
      to: "a@x.test",
      subject: "Verify",
      html: '<p>Click <a href="http://x/confirm/t0k">here</a></p>',
      origin: "pocketbase",
    });
    expect(res.status).toBe(200);
    const mail = outbox.list()[0]!;
    expect(mail.source).toBe("pocketbase");
    expect(mail.text).toBe("Click here (http://x/confirm/t0k)");
  });

  it("renders a template", async () => {
    const { send, outbox } = build();
    const res = await send({ to: "a@x.test", template: "welcome", data: { name: "Ann" } });
    expect(res.status).toBe(200);
    const mail = outbox.list()[0]!;
    expect(mail.source).toBe("welcome");
    expect(mail.subject).toBe("Welcome to KanFun");
    expect(mail.text).toContain("Hi Ann,");
    expect(mail.html).toContain("http://localhost:5173");
  });

  it("exposes and clears the outbox in dev only", async () => {
    const { app, send } = build();
    await send({ to: "a@x.test", subject: "One", text: "t" });
    const list = (await (await app.request("/mail/outbox?to=a@x")).json()) as unknown[];
    expect(list).toHaveLength(1);
    expect((await app.request("/mail/outbox", { method: "DELETE" })).status).toBe(204);
    expect((await (await app.request("/mail/outbox")).json()) as unknown[]).toHaveLength(0);

    const prod = build(false);
    expect((await prod.app.request("/mail/outbox")).status).toBe(404);
  });

  it("never hands reserved addresses to a real provider", async () => {
    const sent: MailMessage[] = [];
    const real: MailProvider = {
      name: "lettermint",
      send: async (message) => (sent.push(message), { id: "lm-1" }),
    };
    const { send } = build(true, real);

    const all = await send({ to: ["alice@example.com", "x@demo.test"], subject: "s", text: "t" });
    expect(await all.json()).toEqual({ id: "", provider: "lettermint", skipped: true });
    expect(sent).toHaveLength(0);

    const mixed = await send({
      to: ["alice@example.com", "jane@acme.com"],
      subject: "s",
      text: "t",
    });
    expect(await mixed.json()).toEqual({ id: "lm-1", provider: "lettermint" });
    expect(sent[0]?.to).toEqual(["jane@acme.com"]);
  });

  it("keeps reserved addresses in the outbox", async () => {
    const { send, outbox } = build();
    const { id } = (await (
      await send({ to: "alice@example.com", subject: "s", text: "t" })
    ).json()) as { id: string };
    expect(outbox.get(id)?.to).toEqual(["alice@example.com"]);
  });
});

describe("isReservedAddress", () => {
  it.each([
    "a@example.com",
    "a@mail.example.org",
    "a@example.net",
    "a@shop.example",
    "a@x.test",
    "a@x.invalid",
    "a@localhost",
    "A@EXAMPLE.COM",
  ])("matches %s", (address) => expect(isReservedAddress(address)).toBe(true));

  it.each(["a@example.co", "a@myexample.com", "a@testing.de", "a@test.com"])(
    "lets %s through",
    (address) => expect(isReservedAddress(address)).toBe(false),
  );
});
