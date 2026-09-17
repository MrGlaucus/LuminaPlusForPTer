/**
 * 节点厂商(商家)识别库。
 *
 * 两条识别通道:
 * 1. 本地:resolveVendorInfo 逐字段(名称/分组/备注/标签)做关键词匹配,零请求;
 * 2. 在线:resolveVendorByAsn 用 IP 查询到的 ASN/组织名反查(查询与缓存见 useVendorInfo)。
 * 本地命中优先,在线只负责补全本地识别不出的节点。
 *
 * 识别结果可携带溯源(VendorTrace):命中的关键词/字段、ASN、组织名;
 * 展示层用 formatVendorTraceLines 生成 tooltip 行,说明"为什么判定是这家厂商"。
 *
 * 显示资源两级:优先官方图形 logo(public/assets/vendors/<logoFile>),
 * 缺失或加载失败时回退字母徽标(品牌色底 + badge 文字),保证永远有可显示内容。
 */

/** 识别溯源:展示层据此生成 tooltip(命中字段/关键词、ASN、组织名)。 */
export interface VendorTrace {
  /** 本地通道:命中关键词的字段名列表(如「备注」「标签」)。 */
  fields?: readonly string[];
  /** 本地通道:命中的原始关键词。 */
  keyword?: string;
  /** 在线通道:已规范为 "AS16276" 形式的 ASN。 */
  asn?: string;
  /** 在线通道:组织名。 */
  org?: string;
}

/** 参与本地匹配的节点字段(带展示名,命中后写入溯源)。 */
export interface VendorField {
  label: string;
  value: string | null | undefined;
}

export interface VendorInfo {
  id: string;
  name: string;
  /** 官方图形 logo 的公开路径;无官方图形的厂商为 null。 */
  logo: string | null;
  /** 字母徽标文字(1-3 字符)。 */
  badge: string;
  /** 品牌色:字母徽标底色,同时用于生成 logo 着色。 */
  color: string;
  /** 识别来源,用于 tooltip 说明与调试。 */
  source: "metadata" | "asn";
  /** 识别溯源(本地:命中字段/关键词;在线:ASN/组织名)。 */
  trace?: VendorTrace;
}

interface VendorDefinition {
  id: string;
  name: string;
  /** 匹配关键词(小写/中文均可,匹配前会归一化)。 */
  keywords: readonly string[];
  /** 高置信 ASN 映射;无法确认的厂商留空,只走关键词通道。 */
  asn?: readonly number[];
  /** public/assets/vendors/ 下的官方图形文件名;无官方图形时省略。 */
  logoFile?: string;
  /** 字母徽标文字(1-3 字符)。 */
  badge: string;
  /** 品牌色(字母徽标底色 / logo 着色)。 */
  color: string;
}

// 顺序即优先级:先命中先返回。大厂在前,中小 IDC 在后。
export const VENDOR_DB: readonly VendorDefinition[] = [
  {
    id: "ovh",
    name: "OVHcloud",
    keywords: ["ovh", "ovhcloud", "kimsufi", "so you start"],
    asn: [16276],
    logoFile: "ovh.svg",
    badge: "OVH",
    color: "#123f6d",
  },
  {
    id: "vultr",
    name: "Vultr",
    keywords: ["vultr"],
    asn: [20473],
    logoFile: "vultr.svg",
    badge: "VL",
    color: "#007bfc",
  },
  {
    id: "digitalocean",
    name: "DigitalOcean",
    keywords: ["digitalocean", "digital ocean"],
    asn: [14061],
    logoFile: "digitalocean.svg",
    badge: "DO",
    color: "#0080ff",
  },
  {
    id: "linode",
    name: "Linode",
    keywords: ["linode"],
    asn: [63949],
    logoFile: "linode.svg",
    badge: "LN",
    color: "#00a95c",
  },
  {
    id: "hetzner",
    name: "Hetzner",
    keywords: ["hetzner"],
    asn: [24940],
    logoFile: "hetzner.svg",
    badge: "HZ",
    color: "#d50c2d",
  },
  {
    id: "contabo",
    name: "Contabo",
    keywords: ["contabo"],
    asn: [51167],
    logoFile: "contabo.svg",
    badge: "CO",
    color: "#e8a33d",
  },
  {
    id: "netcup",
    name: "netcup",
    keywords: ["netcup"],
    asn: [197540],
    logoFile: "netcup.svg",
    badge: "NC",
    color: "#056473",
  },
  {
    id: "oracle",
    name: "Oracle Cloud",
    keywords: ["oracle", "甲骨文"],
    asn: [31898],
    logoFile: "oracle.svg",
    badge: "OR",
    color: "#c74634",
  },
  {
    id: "aws",
    name: "Amazon Web Services",
    keywords: ["amazonaws", "amazon web services", "aws", "亚马逊云"],
    asn: [16509],
    logoFile: "amazonaws.svg",
    badge: "AWS",
    color: "#ff9900",
  },
  {
    id: "azure",
    name: "Microsoft Azure",
    keywords: ["azure", "microsoft azure", "微软云"],
    asn: [8075],
    logoFile: "microsoftazure.svg",
    badge: "AZ",
    color: "#0078d4",
  },
  {
    id: "googlecloud",
    name: "Google Cloud",
    keywords: ["googlecloud", "google cloud", "gcp"],
    asn: [396982],
    logoFile: "googlecloud.svg",
    badge: "GC",
    color: "#4285f4",
  },
  {
    id: "alibabacloud",
    name: "阿里云",
    keywords: ["alibabacloud", "alibaba cloud", "aliyun", "阿里云"],
    asn: [45102, 37963],
    logoFile: "alibabacloud.svg",
    badge: "AL",
    color: "#ff6a00",
  },
  {
    id: "tencentcloud",
    name: "腾讯云",
    keywords: ["tencentcloud", "tencent cloud", "tencent", "腾讯云"],
    asn: [132203],
    badge: "TX",
    color: "#0052d9",
  },
  {
    id: "huaweicloud",
    name: "华为云",
    keywords: ["huaweicloud", "huawei cloud", "huawei", "华为云"],
    asn: [136907],
    logoFile: "huawei.svg",
    badge: "HW",
    color: "#c7000b",
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    keywords: ["cloudflare"],
    asn: [13335],
    logoFile: "cloudflare.svg",
    badge: "CF",
    color: "#f38020",
  },
  {
    id: "namecheap",
    name: "Namecheap",
    keywords: ["namecheap"],
    asn: [22612],
    logoFile: "namecheap.svg",
    badge: "NC",
    color: "#de3723",
  },
  {
    id: "hostinger",
    name: "Hostinger",
    keywords: ["hostinger"],
    asn: [47583],
    logoFile: "hostinger.svg",
    badge: "HG",
    color: "#673de6",
  },
  {
    id: "upcloud",
    name: "UpCloud",
    keywords: ["upcloud"],
    asn: [202053],
    logoFile: "upcloud.svg",
    badge: "UC",
    color: "#7b2eda",
  },
  {
    id: "ionos",
    name: "IONOS",
    keywords: ["ionos"],
    asn: [8560],
    logoFile: "ionos.svg",
    badge: "IO",
    color: "#003d8f",
  },
  {
    id: "scaleway",
    name: "Scaleway",
    keywords: ["scaleway", "online.net", "online net"],
    asn: [12876],
    logoFile: "scaleway.svg",
    badge: "SW",
    color: "#4f0599",
  },
  {
    id: "godaddy",
    name: "GoDaddy",
    keywords: ["godaddy"],
    asn: [26496],
    logoFile: "godaddy.svg",
    badge: "GD",
    color: "#1bdbdb",
  },
  {
    id: "rackspace",
    name: "Rackspace",
    keywords: ["rackspace"],
    asn: [33070],
    badge: "RS",
    color: "#c40022",
  },
  {
    id: "akamai",
    name: "Akamai",
    keywords: ["akamai"],
    asn: [20940],
    logoFile: "akamai.svg",
    badge: "AK",
    color: "#009cdf",
  },
  {
    id: "leaseweb",
    name: "LeaseWeb",
    keywords: ["leaseweb"],
    asn: [28753],
    logoFile: "leaseweb.svg",
    badge: "LW",
    color: "#1E314D",
  },
  {
    id: "colocrossing",
    name: "ColoCrossing",
    keywords: ["colocrossing", "colo crossing"],
    asn: [36352],
    badge: "CL",
    color: "#1b5e8c",
  },
  {
    id: "bandwagonhost",
    name: "搬瓦工",
    keywords: ["bandwagonhost", "bwh", "搬瓦工"],
    badge: "BW",
    color: "#2b9fd8",
  },
  {
    id: "dmit",
    name: "DMIT",
    keywords: ["dmit"],
    badge: "DM",
    color: "#4a5bd8",
  },
  {
    id: "racknerd",
    name: "RackNerd",
    keywords: ["racknerd"],
    badge: "RN",
    color: "#2e6db4",
  },
  {
    id: "cloudcone",
    name: "CloudCone",
    keywords: ["cloudcone", "cloud cone"],
    badge: "CC",
    color: "#f26b3a",
  },
  {
    id: "hosthatch",
    name: "HostHatch",
    keywords: ["hosthatch", "host hatch"],
    badge: "HH",
    color: "#17a398",
  },
  {
    id: "akilecloud",
    name: "AkileCloud",
    keywords: ["akilecloud", "akile"],
    badge: "AK",
    color: "#3b82f6",
  },
  {
    id: "greencloud",
    name: "GreenCloud",
    keywords: ["greencloud", "green cloud"],
    badge: "GC",
    color: "#34a853",
  },
  {
    id: "virmach",
    name: "VirMach",
    keywords: ["virmach"],
    badge: "VM",
    color: "#7c5cbf",
  },
  {
    id: "buyvm",
    name: "BuyVM",
    keywords: ["buyvm", "buy vm", "frantech"],
    asn: [53667],
    badge: "BV",
    color: "#1d7fe0",
  },
  {
    id: "hostdare",
    name: "HostDare",
    keywords: ["hostdare", "host dare"],
    badge: "HD",
    color: "#0e7490",
  },
  {
    id: "hostwinds",
    name: "Hostwinds",
    keywords: ["hostwinds"],
    badge: "HW",
    color: "#1793d1",
  },
];

const CJK_RE = /[\u3400-\u9fff]/;
const NON_WORD_RE = /[^a-z0-9\u3400-\u9fff]+/g;

/** NFKC 折叠全角、转小写,非字母数字(保留中文)折成空格,便于词匹配。 */
export function normalizeVendorText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(NON_WORD_RE, " ")
    .trim();
}

/**
 * 防误报三档:
 * - 中文关键词允许粘连匹配("搬瓦工洛杉矶"里也有"搬瓦工");
 * - 短拉丁词(≤3 字符,如 ovh/bwh)必须作为独立词出现,不匹配长词内部;
 * - 长拉丁词允许粘连匹配("racknerd1"/"vultrcloud")。
 */
function matchesKeyword(text: string, keyword: string): boolean {
  if (CJK_RE.test(keyword)) return text.includes(keyword);
  if (keyword.length <= 3) return ` ${text} `.includes(` ${keyword} `);
  return text.includes(keyword);
}

function matchVendorByText(text: string): VendorDefinition | null {
  if (!text) return null;
  for (const vendor of VENDOR_DB) {
    for (const keyword of vendor.keywords) {
      const normalized = normalizeVendorText(keyword);
      if (normalized && matchesKeyword(text, normalized)) return vendor;
    }
  }
  return null;
}

function toVendorInfo(vendor: VendorDefinition, source: VendorInfo["source"]): VendorInfo {
  return {
    id: vendor.id,
    name: vendor.name,
    logo: vendor.logoFile ? `/assets/vendors/${vendor.logoFile}` : null,
    badge: vendor.badge,
    color: vendor.color,
    source,
  };
}

/**
 * 本地通道:对节点名称/分组/备注/标签等字段逐字段做关键词匹配。
 * 逐字段(而非拼接整段)是为了让溯源精确指出"哪个字段里出现了关键词"。
 */
export function resolveVendorInfo(fields: readonly VendorField[]): VendorInfo | null {
  const prepared = fields
    .map((field) => ({ label: field.label, text: normalizeVendorText(field.value) }))
    .filter((field) => field.text.length > 0);
  if (prepared.length === 0) return null;
  for (const vendor of VENDOR_DB) {
    let keyword: string | null = null;
    const hitFields: string[] = [];
    for (const raw of vendor.keywords) {
      const normalized = normalizeVendorText(raw);
      if (!normalized) continue;
      for (const field of prepared) {
        if (!matchesKeyword(field.text, normalized)) continue;
        keyword ??= raw.trim();
        if (!hitFields.includes(field.label)) hitFields.push(field.label);
      }
    }
    if (keyword != null) {
      return { ...toVendorInfo(vendor, "metadata"), trace: { keyword, fields: hitFields } };
    }
  }
  return null;
}

/** 解析 "AS16276" / "16276" / 16276 等写法。 */
export function normalizeAsn(value: string | number | null | undefined): number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }
  if (typeof value !== "string") return null;
  const match = /^\s*(?:as)?[-\s]*(\d{1,10})\s*$/i.exec(value);
  if (!match) return null;
  const asn = Number.parseInt(match[1], 10);
  return Number.isSafeInteger(asn) && asn > 0 ? asn : null;
}

/** 在线通道:先按 ASN 精确映射,再按组织名关键词匹配，都未命中返回 null。 */
export function resolveVendorByAsn(
  asn: string | number | null | undefined,
  organization?: string | null,
): VendorInfo | null {
  const parsed = normalizeAsn(asn);
  if (parsed != null) {
    const byAsn = VENDOR_DB.find((vendor) => vendor.asn?.includes(parsed));
    if (byAsn) return toVendorInfo(byAsn, "asn");
  }
  const vendor = matchVendorByText(normalizeVendorText(organization));
  return vendor ? toVendorInfo(vendor, "asn") : null;
}

/**
 * ASN 展示规范化:各查询 API 返回格式不一("16509" / "AS13335"),
 * 统一为 "AS16276" 形式;解析失败返回 null(展示层据此省略该行)。
 */
export function formatAsnLabel(value: string | number | null | undefined): string | null {
  const parsed = normalizeAsn(value);
  return parsed != null ? `AS${parsed}` : null;
}

/**
 * 生成溯源 tooltip 行,说明厂商判定依据:
 * 本地命中给出「厂商 + 来源字段(命中关键词)」;在线命中给出「厂商 + ASN/组织名」。
 */
export function formatVendorTraceLines(vendor: VendorInfo): string[] {
  const lines = [`厂商：${vendor.name}`];
  const { trace } = vendor;
  if (trace?.keyword && trace.fields?.length) {
    lines.push(`来源：${trace.fields.join(" / ")}（${trace.keyword}）`);
  } else if (vendor.source === "asn") {
    lines.push("来源：IP 归属查询");
  }
  if (trace?.asn) lines.push(`ASN：${trace.asn}`);
  if (trace?.org) lines.push(`Org：${trace.org}`);
  return lines;
}
