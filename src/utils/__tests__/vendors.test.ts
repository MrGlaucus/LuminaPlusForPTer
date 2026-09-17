import { describe, expect, it } from "vitest";
import {
  VENDOR_DB,
  formatAsnLabel,
  formatVendorTraceLines,
  normalizeAsn,
  normalizeVendorText,
  resolveVendorByAsn,
  resolveVendorInfo,
  type VendorField,
  type VendorInfo,
} from "@/utils/vendors";

/** 把裸字段值包成带展示名的字段对象:label 只影响溯源记录,不影响匹配。 */
function fields(...values: (string | null | undefined)[]): VendorField[] {
  return values.map((value, index) => ({ label: `字段${index + 1}`, value }));
}

describe("normalizeVendorText", () => {
  it("folds case, full-width characters and punctuation", () => {
    expect(normalizeVendorText("ＤＭＩＴ－HK")).toBe("dmit hk");
    expect(normalizeVendorText("OVH.com / Canada")).toBe("ovh com canada");
  });

  it("returns empty for blank input", () => {
    expect(normalizeVendorText("")).toBe("");
    expect(normalizeVendorText(null)).toBe("");
    expect(normalizeVendorText(undefined)).toBe("");
  });
});

describe("resolveVendorInfo", () => {
  it("matches vendor keywords in node metadata", () => {
    expect(resolveVendorInfo(fields("DMIT-HK CMI", "", null))?.id).toBe("dmit");
    expect(resolveVendorInfo(fields("HK-01", "搬瓦工", ""))?.id).toBe("bandwagonhost");
    expect(resolveVendorInfo(fields("", "Vultr 东京", undefined))?.id).toBe("vultr");
  });

  it("matches CJK keywords even when glued to other text", () => {
    expect(resolveVendorInfo(fields("搬瓦工洛杉矶"))?.id).toBe("bandwagonhost");
    expect(resolveVendorInfo(fields("阿里云香港"))?.id).toBe("alibabacloud");
  });

  it("does not let short keywords match inside longer words", () => {
    expect(resolveVendorInfo(fields("xovhx"))?.id).not.toBe("ovh");
    expect(resolveVendorInfo(fields("abwhc"))?.id).not.toBe("bandwagonhost");
  });

  it("still matches short keywords as standalone tokens", () => {
    expect(resolveVendorInfo(fields("bwh 香港"))?.id).toBe("bandwagonhost");
    expect(resolveVendorInfo(fields("OVH 独服"))?.id).toBe("ovh");
    expect(resolveVendorInfo(fields("aws 新加坡"))?.id).toBe("aws");
  });

  it("allows long keywords to match glued forms", () => {
    expect(resolveVendorInfo(fields("racknerd1"))?.id).toBe("racknerd");
    expect(resolveVendorInfo(fields("vultrcloud"))?.id).toBe("vultr");
  });

  it("does not cross-match similar vendor names", () => {
    expect(resolveVendorInfo(fields("greencloud hk"))?.id).toBe("greencloud");
    expect(resolveVendorInfo(fields("cloudcone 1c1g"))?.id).toBe("cloudcone");
    expect(resolveVendorInfo(fields("hosthatch storage"))?.id).toBe("hosthatch");
  });

  it("returns null when nothing matches", () => {
    expect(resolveVendorInfo([])).toBeNull();
    expect(resolveVendorInfo(fields("hk-01", "亚洲优化"))).toBeNull();
  });

  it("records the matched keyword and source fields as trace", () => {
    const vendor = resolveVendorInfo([
      { label: "节点名称", value: "tokyo-edge-01" },
      { label: "备注", value: "Vultr 东京" },
      { label: "标签", value: "vultr, 高带宽" },
    ]);
    expect(vendor?.id).toBe("vultr");
    expect(vendor?.trace?.keyword).toBe("vultr");
    expect(vendor?.trace?.fields).toEqual(["备注", "标签"]);
  });

  it("keeps trace fields in scan order", () => {
    const vendor = resolveVendorInfo([
      { label: "节点名称", value: "ovh-01" },
      { label: "备注", value: "OVH 独服" },
    ]);
    expect(vendor?.trace?.keyword).toBe("ovh");
    expect(vendor?.trace?.fields).toEqual(["节点名称", "备注"]);
  });
});

describe("normalizeAsn", () => {
  it("parses common ASN formats", () => {
    expect(normalizeAsn("AS16276")).toBe(16276);
    expect(normalizeAsn("as 16276")).toBe(16276);
    expect(normalizeAsn("16276")).toBe(16276);
    expect(normalizeAsn(20473)).toBe(20473);
  });

  it("rejects invalid values", () => {
    expect(normalizeAsn("AS-")).toBeNull();
    expect(normalizeAsn("")).toBeNull();
    expect(normalizeAsn(-1)).toBeNull();
    expect(normalizeAsn(null)).toBeNull();
  });
});

describe("resolveVendorByAsn", () => {
  it("maps known ASNs to vendors with asn source", () => {
    const ovh = resolveVendorByAsn("AS16276");
    expect(ovh?.id).toBe("ovh");
    expect(ovh?.source).toBe("asn");
    expect(resolveVendorByAsn(20473)?.id).toBe("vultr");
  });

  it("falls back to organization keywords", () => {
    expect(resolveVendorByAsn(null, "Vultr Holdings, LLC")?.id).toBe("vultr");
    expect(resolveVendorByAsn("AS16276", "")?.id).toBe("ovh");
  });

  it("returns null for unknown ASN and organization", () => {
    expect(resolveVendorByAsn("AS999999", "Unknown Hosting Ltd")).toBeNull();
    expect(resolveVendorByAsn(null, null)).toBeNull();
  });
});

describe("VENDOR_DB", () => {
  it("provides display resources for every vendor", () => {
    for (const vendor of VENDOR_DB) {
      expect(vendor.badge.length).toBeGreaterThan(0);
      expect(vendor.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(vendor.keywords.length).toBeGreaterThan(0);
    }
  });

  it("keeps vendor ids unique", () => {
    const ids = VENDOR_DB.map((vendor) => vendor.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("formatAsnLabel", () => {
  it("normalizes common formats to the AS prefix form", () => {
    expect(formatAsnLabel("20473")).toBe("AS20473");
    expect(formatAsnLabel("AS16276")).toBe("AS16276");
    expect(formatAsnLabel(" as 16276 ")).toBe("AS16276");
  });

  it("returns null for values that cannot be parsed", () => {
    expect(formatAsnLabel("AS-")).toBeNull();
    expect(formatAsnLabel("")).toBeNull();
    expect(formatAsnLabel(null)).toBeNull();
    expect(formatAsnLabel(undefined)).toBeNull();
  });
});

describe("formatVendorTraceLines", () => {
  it("describes local keyword evidence", () => {
    const vendor: VendorInfo = {
      id: "vultr",
      name: "Vultr",
      logo: null,
      badge: "VL",
      color: "#007bfc",
      source: "metadata",
      trace: { keyword: "vultr", fields: ["备注", "标签"] },
    };
    expect(formatVendorTraceLines(vendor)).toEqual([
      "厂商：Vultr",
      "来源：备注 / 标签（vultr）",
    ]);
  });

  it("describes online ASN evidence", () => {
    const vendor: VendorInfo = {
      id: "vultr",
      name: "Vultr",
      logo: null,
      badge: "VL",
      color: "#007bfc",
      source: "asn",
      trace: { asn: "AS20473", org: "The Constant Company, LLC" },
    };
    expect(formatVendorTraceLines(vendor)).toEqual([
      "厂商：Vultr",
      "来源：IP 归属查询",
      "ASN：AS20473",
      "Org：The Constant Company, LLC",
    ]);
  });

  it("omits evidence lines that are unknown", () => {
    const vendor: VendorInfo = {
      id: "custom",
      name: "Custom",
      logo: null,
      badge: "CU",
      color: "#336699",
      source: "metadata",
    };
    expect(formatVendorTraceLines(vendor)).toEqual(["厂商：Custom"]);
  });
});
