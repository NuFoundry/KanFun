import { fetchPublicJson, FetchRefusedError, isPublicAddress } from "./safe-fetch";

describe("isPublicAddress", () => {
  it("refuses loopback, private, link-local, carrier NAT and IPv6 wrappers of them", () => {
    for (const address of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "224.0.0.1",
      "::1",
      "::",
      "fd00::1",
      "fe80::1",
      "::ffff:127.0.0.1",
      "::ffff:10.0.0.1",
      "64:ff9b::a00:1",
      "2002:a00:1::1",
      "not an ip",
    ]) {
      expect([address, isPublicAddress(address)]).toEqual([address, false]);
    }
  });

  it("allows public addresses", () => {
    for (const address of ["1.1.1.1", "93.184.216.34", "2606:4700:4700::1111"]) {
      expect(isPublicAddress(address)).toBe(true);
    }
  });
});

describe("fetchPublicJson", () => {
  it("refuses anything but https before connecting", async () => {
    await expect(fetchPublicJson("http://agent.dev/c.json")).rejects.toThrow(FetchRefusedError);
    await expect(fetchPublicJson("nope")).rejects.toThrow(FetchRefusedError);
  });

  it("refuses private addresses, written out or behind a name", async () => {
    await expect(fetchPublicJson("https://127.0.0.1/c.json")).rejects.toThrow("Private address");
    await expect(fetchPublicJson("https://[::1]/c.json")).rejects.toThrow("Private address");
    await expect(fetchPublicJson("https://localhost/c.json")).rejects.toThrow(/private address/);
  });
});
