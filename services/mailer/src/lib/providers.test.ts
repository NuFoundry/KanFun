import { Outbox } from "./outbox";
import { createOutboxProvider, createResendProvider } from "./providers";

describe("outbox provider", () => {
  it("stores the message instead of sending it", async () => {
    const outbox = new Outbox();
    const provider = createOutboxProvider(outbox);
    const { id } = await provider.send({ from: "a@x", to: "b@x", subject: "S", text: "T" });
    expect(outbox.get(id)?.source).toBe("api");
    expect(outbox.list({ to: "b@x" })).toHaveLength(1);
  });

  it("records who asked for the send", async () => {
    const outbox = new Outbox();
    const provider = createOutboxProvider(outbox);
    const { id } = await provider.send({
      from: "a@x",
      to: "b@x",
      subject: "S",
      text: "T",
      origin: "pocketbase",
    });
    expect(outbox.get(id)?.source).toBe("pocketbase");
  });
});

describe("resend provider", () => {
  it("posts to the Resend API with the bearer key", async () => {
    const fetchImpl = jest.fn(
      async () => new Response(JSON.stringify({ id: "re_1" }), { status: 200 }),
    );
    const provider = createResendProvider({ apiKey: "re_key", fetchImpl });
    const result = await provider.send({ from: "a@x", to: ["b@x"], subject: "S", text: "T" });
    expect(result).toEqual({ id: "re_1" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_key");
    expect(JSON.parse(init.body as string)).toMatchObject({ to: ["b@x"], subject: "S" });
  });

  it("surfaces API errors, with the answer (which can quote addresses) in the log only", async () => {
    const fetchImpl = jest.fn(async () => new Response("b@x is suppressed", { status: 422 }));
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    const provider = createResendProvider({ apiKey: "re_key", fetchImpl });
    const sent = provider.send({ from: "a@x", to: "b@x", subject: "S", text: "T" });
    await expect(sent).rejects.toThrow("Resend responded 422");
    await expect(sent).rejects.not.toThrow(/b@x/);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("b@x is suppressed"));
    log.mockRestore();
  });
});
