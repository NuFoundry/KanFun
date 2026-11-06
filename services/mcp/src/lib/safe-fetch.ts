import dns from "node:dns";
import https from "node:https";
import net from "node:net";

/**
 * Addresses a document fetch must never reach: loopback, private networks, link-local (cloud
 * metadata at 169.254.169.254), carrier NAT, multicast and the IPv6 forms that wrap IPv4 (NAT64,
 * 6to4), which could smuggle a private IPv4 address past the list. IPv4-mapped IPv6 addresses
 * (::ffff:10.0.0.1) are checked against the IPv4 rules by BlockList itself.
 */
const BLOCKED = new net.BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 3],
] as const) {
  BLOCKED.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 127],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  BLOCKED.addSubnet(network, prefix, "ipv6");
}

export function isPublicAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 0) return false;
  return !BLOCKED.check(address, family === 4 ? "ipv4" : "ipv6");
}

/**
 * Resolves like the system does, but fails when any address is not public. Runs when the socket
 * connects, so the address that is checked is the address that is used (no DNS rebinding).
 */
const publicOnlyLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, "", 0);
    const list = addresses as dns.LookupAddress[];
    if (list.length === 0 || list.some((a) => !isPublicAddress(a.address))) {
      return callback(new Error(`${hostname} resolves to a private address`), "", 0);
    }
    if (options.all)
      return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    callback(null, list[0]!.address, list[0]!.family);
  });
};

export class FetchRefusedError extends Error {
  override name = "FetchRefusedError";
}

/**
 * GETs a small JSON document from the public internet: https only, no redirects, public addresses
 * only, at most `maxBytes`, within `timeoutMs`. Used for OAuth client metadata documents, whose
 * URL anyone can choose, so it must not become a way into the server's own network.
 */
export function fetchPublicJson(
  url: string,
  { maxBytes = 10 * 1024, timeoutMs = 5_000 }: { maxBytes?: number; timeoutMs?: number } = {},
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let target: URL;
    try {
      target = new URL(url);
    } catch {
      return reject(new FetchRefusedError("Not a URL"));
    }
    if (target.protocol !== "https:") return reject(new FetchRefusedError("Only https"));
    // An IP address in the URL skips the lookup, so it is checked here.
    const host = target.hostname.replace(/^\[|\]$/g, "");
    if (net.isIP(host) && !isPublicAddress(host)) {
      return reject(new FetchRefusedError("Private address"));
    }

    const request = https.get(
      target,
      {
        lookup: publicOnlyLookup,
        timeout: timeoutMs,
        headers: { Accept: "application/json" },
      },
      (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          return reject(new FetchRefusedError(`Status ${response.statusCode}`));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            request.destroy(new FetchRefusedError("Too large"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch {
            reject(new FetchRefusedError("Not JSON"));
          }
        });
        response.on("error", reject);
      },
    );
    request.on("timeout", () => request.destroy(new FetchRefusedError("Timeout")));
    request.on("error", reject);
  });
}
