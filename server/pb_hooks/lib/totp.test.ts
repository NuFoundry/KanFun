// eslint-disable-next-line @typescript-eslint/no-require-imports
const totp = require("./totp.js") as {
  BASE32: string;
  sha1: (bytes: number[]) => number[];
  base32Decode: (text: string) => number[];
  codeAt: (secret: string, step: number, digits?: number) => string;
  stepAt: (nowMs: number) => number;
  verify: (secret: string, code: string, nowMs: number, lastStep: number) => number;
  otpauthUri: (issuer: string, account: string, secret: string) => string;
  normalizeRecoveryCode: (code: string) => string;
};

const hex = (bytes: number[]) => bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
const ascii = (text: string) => Array.from(Buffer.from(text));

/** The RFC 6238 test secret, "12345678901234567890", in base32. */
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("totp", () => {
  it("hashes like SHA-1", () => {
    expect(hex(totp.sha1([]))).toBe("da39a3ee5e6b4b0d3255bfef95601890afd80709");
    expect(hex(totp.sha1(ascii("abc")))).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
    const long = ascii("a".repeat(1000));
    expect(hex(totp.sha1(long))).toBe(
      require("node:crypto").createHash("sha1").update("a".repeat(1000)).digest("hex"),
    );
  });

  it("decodes base32 the way the apps do", () => {
    expect(totp.base32Decode(RFC_SECRET)).toEqual(ascii("12345678901234567890"));
    expect(totp.base32Decode("gezd gnbv-gy3t qojq gezd gnbv gy3t qojq")).toEqual(
      ascii("12345678901234567890"),
    );
    expect(() => totp.base32Decode("not base32!")).toThrow();
  });

  it.each([
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ])("matches the RFC 6238 vector at %i s", (seconds, code) => {
    expect(totp.codeAt(RFC_SECRET, totp.stepAt(seconds * 1000), 8)).toBe(code);
  });

  it("accepts the current code and one step of drift, each once", () => {
    const now = 1_800_000_000_000;
    const step = totp.stepAt(now);
    expect(totp.verify(RFC_SECRET, totp.codeAt(RFC_SECRET, step), now, 0)).toBe(step);
    expect(totp.verify(RFC_SECRET, totp.codeAt(RFC_SECRET, step - 1), now, 0)).toBe(step - 1);
    expect(totp.verify(RFC_SECRET, totp.codeAt(RFC_SECRET, step + 1), now, 0)).toBe(step + 1);
    expect(totp.verify(RFC_SECRET, totp.codeAt(RFC_SECRET, step - 2), now, 0)).toBe(-1);
    // Used already: the same step, or an older one.
    expect(totp.verify(RFC_SECRET, totp.codeAt(RFC_SECRET, step), now, step)).toBe(-1);
    expect(totp.verify(RFC_SECRET, totp.codeAt(RFC_SECRET, step - 1), now, step)).toBe(-1);
  });

  it("refuses anything that is not six digits", () => {
    const now = 1_800_000_000_000;
    const code = totp.codeAt(RFC_SECRET, totp.stepAt(now));
    expect(totp.verify(RFC_SECRET, `${code.slice(0, 3)} ${code.slice(3)}`, now, 0)).toBe(
      totp.stepAt(now),
    );
    expect(totp.verify(RFC_SECRET, "", now, 0)).toBe(-1);
    expect(totp.verify(RFC_SECRET, "12345", now, 0)).toBe(-1);
    expect(totp.verify(RFC_SECRET, "abcdef", now, 0)).toBe(-1);
  });

  it("builds the otpauth link authenticator apps read", () => {
    expect(totp.otpauthUri("My App", "a@b.c", "ABC")).toBe(
      "otpauth://totp/My%20App:a%40b.c?secret=ABC&issuer=My%20App&algorithm=SHA1&digits=6&period=30",
    );
  });

  it("compares recovery codes without case or separators", () => {
    expect(totp.normalizeRecoveryCode(" AbCd5-Efgh7 ")).toBe("abcd5efgh7");
  });
});
