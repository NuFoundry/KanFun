import { clearOutbox, linksIn, listOutbox } from "./mail";

describe("dev inbox api", () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it("lists the outbox, filtered by recipient", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [{ id: "m1" }] });
    await expect(listOutbox({ to: "a@x" })).resolves.toEqual([{ id: "m1" }]);
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8788/mail/outbox?to=a%40x");
  });

  it("clears the outbox and surfaces failures", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    await clearOutbox();
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8788/mail/outbox", {
      method: "DELETE",
    });
    fetchMock.mockResolvedValue({ ok: false, status: 404 });
    await expect(listOutbox()).rejects.toThrow("404");
  });

  it("extracts links from html and text without duplicates", () => {
    expect(
      linksIn({
        html: '<a href="http://x/confirm?a=1&amp;b=2">Go</a> <a href="http://x/other">o</a>',
        text: "Go http://x/confirm?a=1&b=2 or http://x/text.",
      }),
    ).toEqual(["http://x/confirm?a=1&b=2", "http://x/other", "http://x/text"]);
    expect(linksIn({ text: "no links" })).toEqual([]);
  });
});
