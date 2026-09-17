/**
 * IP → ASN/组织名 在线查询层(厂商识别的在线通道数据源)。
 *
 * 免费公共 API 池轮询容错:单个 API 失败自动换下一个,全部失败静默放弃。
 * localStorage 持久缓存(正结果 30 天 / 负结果 6 小时),跨会话复用;
 * inflight 去重 + 并发上限 + 全失败冷却,避免首屏大量节点同时查询把请求放大。
 * 查询只针对公网地址,私有段/回环/链路本地一律跳过。
 */

import { fetchWithTimeout } from "@/utils/abort";

export interface IpNetworkInfo {
  asn: string | null;
  organization: string | null;
}

export const NETWORK_CACHE_PREFIX = "komari:lumina-plus:vendor-geo:v1:";
export const NETWORK_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const NETWORK_NEGATIVE_TTL_MS = 6 * 60 * 60 * 1000;

const LOOKUP_TIMEOUT_MS = 8_000;
const MAX_CONCURRENT_LOOKUPS = 3;
// 一次查询里所有 API 都失败后短暂冷却,避免断网时每个节点都完整轮询一遍。
const FAILURE_COOLDOWN_MS = 60_000;

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV6_RE = /^[0-9a-fA-F:]{2,45}$/;

/** 只接受可公开查询的 IPv4/IPv6;内网/回环/链路本地地址发了也没意义,直接跳过。 */
export function isLookupableIp(value: string | null | undefined): boolean {
  if (typeof value !== "string") return false;
  const ip = value.trim();
  const v4 = IPV4_RE.exec(ip);
  if (v4) {
    const [a, b, c, d] = v4.slice(1).map(Number);
    if ([a, b, c, d].some((part) => part > 255)) return false;
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 169 && b === 254) return false;
    if (a === 192 && b === 168) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    return true;
  }
  if (!ip.includes(":") || !IPV6_RE.test(ip)) return false;
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return false;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return false;
  if (lower.startsWith("fe80")) return false;
  return true;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pickString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asnFrom(value: unknown): string | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0 ? String(value) : null;
  }
  return pickString(value);
}

export function parseIpSbPayload(payload: unknown): IpNetworkInfo | null {
  const record = asRecord(payload);
  if (!record) return null;
  const asn = asnFrom(record.asn);
  const organization = pickString(record.asn_organization) ?? pickString(record.organization);
  return asn || organization ? { asn, organization } : null;
}

export function parseIpinfoPayload(payload: unknown): IpNetworkInfo | null {
  const record = asRecord(payload);
  if (!record) return null;
  const org = pickString(record.org);
  if (!org) return null;
  // ipinfo 的 org 形如 "AS13335 Cloudflare, Inc."。
  const match = /^AS(\d+)\s+(.+)$/i.exec(org);
  if (match) return { asn: `AS${match[1]}`, organization: match[2].trim() };
  return { asn: null, organization: org };
}

export function parseIpwhoPayload(payload: unknown): IpNetworkInfo | null {
  const record = asRecord(payload);
  if (!record || record.success === false) return null;
  const connection = asRecord(record.connection);
  if (!connection) return null;
  const asn = asnFrom(connection.asn);
  const organization = pickString(connection.org) ?? pickString(connection.isp);
  return asn || organization ? { asn, organization } : null;
}

export function parseIpapiPayload(payload: unknown): IpNetworkInfo | null {
  const record = asRecord(payload);
  if (!record || record.error === true) return null;
  const asn = asnFrom(record.asn);
  const organization = pickString(record.org);
  return asn || organization ? { asn, organization } : null;
}

interface GeoApi {
  id: string;
  url: (address: string) => string;
  parse: (payload: unknown) => IpNetworkInfo | null;
}

const GEO_APIS: readonly GeoApi[] = [
  { id: "ip.sb", url: (address) => `https://api.ip.sb/geoip/${address}`, parse: parseIpSbPayload },
  { id: "ipinfo.io", url: (address) => `https://ipinfo.io/${address}/json`, parse: parseIpinfoPayload },
  { id: "ipwho.is", url: (address) => `https://ipwho.is/${address}`, parse: parseIpwhoPayload },
  { id: "ipapi.co", url: (address) => `https://ipapi.co/${address}/json/`, parse: parseIpapiPayload },
];

async function queryIpNetwork(address: string): Promise<IpNetworkInfo | null> {
  for (const api of GEO_APIS) {
    try {
      const response = await fetchWithTimeout(
        api.url(address),
        { headers: { Accept: "application/json" }, referrerPolicy: "no-referrer" },
        LOOKUP_TIMEOUT_MS,
      );
      if (!response.ok) continue;
      const info = api.parse(await response.json());
      if (info && (info.asn || info.organization)) return info;
    } catch {
      // 单个 API 失败(超时/CORS/网络错误)换下一个。
    }
  }
  return null;
}

let activeLookups = 0;
const lookupQueue: Array<() => void> = [];
const inflight = new Map<string, Promise<IpNetworkInfo | null>>();
let failureCooldownUntil = 0;

function scheduleLookup<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      activeLookups += 1;
      task()
        .then(resolve, reject)
        .finally(() => {
          activeLookups -= 1;
          lookupQueue.shift()?.();
        });
    };
    if (activeLookups < MAX_CONCURRENT_LOOKUPS) run();
    else lookupQueue.push(run);
  });
}

function cacheKey(address: string) {
  return `${NETWORK_CACHE_PREFIX}${address}`;
}

/** 命中返回结果(负缓存时为 { result: null }),未命中/过期返回 null。 */
function readNetworkCache(address: string): { result: IpNetworkInfo | null } | null {
  try {
    const raw = localStorage.getItem(cacheKey(address));
    if (!raw) return null;
    const record = asRecord(JSON.parse(raw) as unknown);
    if (!record) return null;
    const savedAt = typeof record.savedAt === "number" ? record.savedAt : Number.NaN;
    if (!Number.isFinite(savedAt)) return null;
    const age = Date.now() - savedAt;
    if (age < 0) return null;
    if (record.result === null) {
      return age >= NETWORK_NEGATIVE_TTL_MS ? null : { result: null };
    }
    const resultRecord = asRecord(record.result);
    if (!resultRecord || age >= NETWORK_CACHE_TTL_MS) return null;
    const asn = pickString(resultRecord.asn);
    const organization = pickString(resultRecord.organization);
    return asn || organization ? { result: { asn, organization } } : null;
  } catch {
    return null;
  }
}

function writeNetworkCache(address: string, result: IpNetworkInfo | null) {
  try {
    localStorage.setItem(cacheKey(address), JSON.stringify({ savedAt: Date.now(), result }));
  } catch {
    // 存储不可用(隐私模式/超限)时退化为仅当前会话内存行为。
  }
}

/**
 * 查询某个 IP 的 ASN/组织名。缓存命中(含负缓存)零请求;
 * 同一 IP 并发调用复用同一个请求;全部 API 失败返回 null 并进入短暂冷却。
 */
export async function lookupIpNetwork(ip: string): Promise<IpNetworkInfo | null> {
  const address = ip.trim();
  if (!isLookupableIp(address)) return null;

  const cached = readNetworkCache(address);
  if (cached) return cached.result;

  if (Date.now() < failureCooldownUntil) return null;

  const existing = inflight.get(address);
  if (existing) return existing;

  const task = scheduleLookup(() => queryIpNetwork(address))
    .then((result) => {
      writeNetworkCache(address, result);
      if (!result) failureCooldownUntil = Date.now() + FAILURE_COOLDOWN_MS;
      return result;
    })
    .catch(() => null)
    .finally(() => {
      inflight.delete(address);
    });

  inflight.set(address, task);
  return task;
}

/** 仅供测试:清空模块级运行时状态(缓存本体在 localStorage 里)。 */
export function resetVendorGeoStateForTests() {
  inflight.clear();
  lookupQueue.length = 0;
  activeLookups = 0;
  failureCooldownUntil = 0;
}
