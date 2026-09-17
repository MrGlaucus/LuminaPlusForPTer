import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NETWORK_CACHE_PREFIX,
  NETWORK_CACHE_TTL_MS,
  isLookupableIp,
  lookupIpNetwork,
  parseIpapiPayload,
  parseIpinfoPayload,
  parseIpSbPayload,
  parseIpwhoPayload,
  resetVendorGeoStateForTests,
} from "@/utils/vendorGeo";

function createStorageStub() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  resetVendorGeoStateForTests();
  vi.stubGlobal("localStorage", createStorageStub());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parse payloads", () => {
  it("parses each API format into asn and organization", () => {
    expect(parseIpSbPayload({ asn: 16276, asn_organization: "OVH SAS" })).toEqual({
      asn: "16276",
      organization: "OVH SAS",
    });
    expect(parseIpinfoPayload({ org: "AS16276 OVH SAS" })).toEqual({
      asn: "AS16276",
      organization: "OVH SAS",
    });
    expect(parseIpwhoPayload({ success: true, connection: { asn: 16276, org: "OVH SAS" } })).toEqual({
      asn: "16276",
      organization: "OVH SAS",
    });
    expect(parseIpapiPayload({ asn: "AS16276", org: "OVH SAS" })).toEqual({
      asn: "AS16276",
      organization: "OVH SAS",
    });
  });

  it("returns null for empty or failed payloads", () => {
    expect(parseIpSbPayload({})).toBeNull();
    expect(parseIpSbPayload(null)).toBeNull();
    expect(parseIpinfoPayload({})).toBeNull();
    expect(parseIpwhoPayload({ success: false, connection: { asn: 1 } })).toBeNull();
    expect(parseIpapiPayload({ error: true })).toBeNull();
  });
});

describe("isLookupableIp", () => {
  it("accepts public addresses", () => {
    expect(isLookupableIp("1.1.1.1")).toBe(true);
    expect(isLookupableIp("2606:4700:4700::1111")).toBe(true);
  });

  it("rejects private, loopback and malformed values", () => {
    expect(isLookupableIp("10.0.0.1")).toBe(false);
    expect(isLookupableIp("192.168.1.1")).toBe(false);
    expect(isLookupableIp("172.16.5.4")).toBe(false);
    expect(isLookupableIp("127.0.0.1")).toBe(false);
    expect(isLookupableIp("fd00::1")).toBe(false);
    expect(isLookupableIp("::1")).toBe(false);
    expect(isLookupableIp("DMIT 官网")).toBe(false);
    expect(isLookupableIp("")).toBe(false);
    expect(isLookupableIp(null)).toBe(false);
  });
});

describe("lookupIpNetwork", () => {
  it("resolves through ip.sb and serves the positive cache afterwards", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ asn: 16276, asn_organization: "OVH SAS" }));
    vi.stubGlobal("fetch", fetchMock);

    const first = await lookupIpNetwork("1.1.1.1");
    expect(first).toEqual({ asn: "16276", organization: "OVH SAS" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = await lookupIpNetwork("1.1.1.1");
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to the next API when one fails", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValueOnce(jsonResponse({ org: "AS20473 The Constant Company, LLC" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupIpNetwork("203.0.113.10");
    expect(result).toEqual({ asn: "AS20473", organization: "The Constant Company, LLC" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns null after all APIs fail and negative-caches the result", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, 502));
    vi.stubGlobal("fetch", fetchMock);

    expect(await lookupIpNetwork("198.51.100.7")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(4);

    // 负缓存:6 小时内同一 IP 不再触发请求。
    expect(await lookupIpNetwork("198.51.100.7")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("enters a short cooldown after a total failure", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, 502));
    vi.stubGlobal("fetch", fetchMock);

    expect(await lookupIpNetwork("198.51.100.8")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(4);

    // 冷却期内其他 IP 也不再轮询。
    expect(await lookupIpNetwork("192.0.2.9")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("deduplicates concurrent lookups for the same IP", async () => {
    let resolveFetch: (response: Response) => void = () => {};
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const first = lookupIpNetwork("9.9.9.9");
    const second = lookupIpNetwork("9.9.9.9");
    resolveFetch(jsonResponse({ asn: 19281, organization: "Quad9" }));

    const [a, b] = await Promise.all([first, second]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual({ asn: "19281", organization: "Quad9" });
    expect(b).toEqual(a);
  });

  it("refreshes expired positive cache entries", async () => {
    localStorage.setItem(
      `${NETWORK_CACHE_PREFIX}8.8.8.8`,
      JSON.stringify({
        savedAt: Date.now() - NETWORK_CACHE_TTL_MS - 1,
        result: { asn: "AS15169", organization: "Old Name" },
      }),
    );
    const fetchMock = vi.fn(async () => jsonResponse({ asn: 15169, asn_organization: "Google LLC" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await lookupIpNetwork("8.8.8.8");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ asn: "15169", organization: "Google LLC" });
  });

  it("skips lookups for non-public addresses", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ asn: 1, asn_organization: "X" }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await lookupIpNetwork("192.168.1.1")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
