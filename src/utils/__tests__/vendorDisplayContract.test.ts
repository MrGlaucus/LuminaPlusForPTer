import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { VENDOR_DB } from "@/utils/vendors";

// 四视图源码契约:厂商 LOGO 必须渲染在「地区旗 → 名称」之间,
// 尺寸与所在卡片一致(大卡/紧凑卡 15px,迷你卡/列表 14px)。
const nodeCardSource = readFileSync(
  new URL("../../components/node/NodeCard.tsx", import.meta.url),
  "utf8",
);
const compactSource = readFileSync(
  new URL("../../components/node/CompactNodeCard.tsx", import.meta.url),
  "utf8",
);
const miniSource = readFileSync(
  new URL("../../components/node/MiniNodeCard.tsx", import.meta.url),
  "utf8",
);
const listSource = readFileSync(
  new URL("../../components/node/NodeListView.tsx", import.meta.url),
  "utf8",
);
const vendorLogoSource = readFileSync(
  new URL("../../components/ui/VendorLogo.tsx", import.meta.url),
  "utf8",
);
const instanceDetailsSource = readFileSync(
  new URL("../../components/instance/InstanceDetails.tsx", import.meta.url),
  "utf8",
);
const hookSource = readFileSync(
  new URL("../../hooks/useVendorInfo.ts", import.meta.url),
  "utf8",
);
const themeSettingsSource = readFileSync(
  new URL("../themeSettings.ts", import.meta.url),
  "utf8",
);
const themeManageSource = readFileSync(
  new URL("../../pages/ThemeManage.tsx", import.meta.url),
  "utf8",
);
const vendorCss = readFileSync(new URL("../../styles/vendor-logo.css", import.meta.url), "utf8");
const indexCss = readFileSync(new URL("../../styles/index.css", import.meta.url), "utf8");

const VIEWS = [
  { label: "大卡", source: nodeCardSource, size: 15 },
  { label: "紧凑卡", source: compactSource, size: 15 },
  { label: "迷你卡", source: miniSource, size: 14 },
  { label: "列表", source: listSource, size: 14 },
] as const;

describe("厂商 LOGO 四视图摆放契约", () => {
  it.each(VIEWS)("$label:地区旗之后、名称之前条件渲染,且尺寸为 $size px", (view) => {
    expect(view.source).toContain('import { VendorLogo } from "@/components/ui/VendorLogo"');
    expect(view.source).toContain("{vendor && <VendorLogo vendor={vendor} size={");
    // 位置:地区旗在前,厂商 LOGO 在后(两者都在标题行内)。
    const flagIndex = view.source.indexOf("<Flag region=");
    const logoIndex = view.source.indexOf("<VendorLogo vendor=");
    expect(flagIndex).toBeGreaterThanOrEqual(0);
    expect(logoIndex).toBeGreaterThan(flagIndex);
    // 尺寸与卡片档位一致。
    expect(view.source).toContain(`<VendorLogo vendor={vendor} size={${view.size}} />`);
  });

  it("列表行:vendor hook 在加载早退分支之前调用,并把厂商拼进 aria label", () => {
    expect(listSource.indexOf("useVendorInfo(model.node)")).toBeLessThan(
      listSource.indexOf("if (!model.node)"),
    );
    expect(listSource).toMatch(/vendor && `厂商 \$\{vendor\.name\}`/);
  });

  it.each(VIEWS)("$label:使用 useVendorInfo 做识别", (view) => {
    expect(view.source).toContain("useVendorInfo(");
  });
});

describe("厂商展示开关契约", () => {
  it("识别逻辑被展示开关门控,在线通道另有独立开关", () => {
    expect(hookSource).toContain("if (!showProviderLogo || !meta) return null");
    expect(hookSource).toContain("!providerOnlineLookup");
    expect(hookSource).toContain("local ?? online");
  });

  it("设置从类型到管理页全链路可开关", () => {
    expect(themeSettingsSource).toContain("showProviderLogo");
    expect(themeSettingsSource).toContain("providerOnlineLookup");
    expect(themeManageSource).toContain("showProviderLogo: settings.showProviderLogo");
    expect(themeManageSource).toContain("providerOnlineLookup: settings.providerOnlineLookup");
    expect(themeManageSource).toContain('field="showProviderLogo"');
    expect(themeManageSource).toContain('field="providerOnlineLookup"');
  });
});

describe("厂商 LOGO 资源与样式契约", () => {
  it("声明的每个官方图形都真实存在于 public/assets/vendors", () => {
    let checked = 0;
    for (const vendor of VENDOR_DB) {
      if (!vendor.logoFile) continue;
      checked += 1;
      const svg = readFileSync(
        new URL(`../../../public/assets/vendors/${vendor.logoFile}`, import.meta.url),
        "utf8",
      );
      expect(svg, vendor.id).toContain("<svg");
    }
    // 防止契约退化:当前至少有 20 家厂商带官方图形。
    expect(checked).toBeGreaterThanOrEqual(20);
  });

  it("字母徽标兜底数据合法:1-3 字符 + 六位品牌色", () => {
    for (const vendor of VENDOR_DB) {
      expect(vendor.badge.length, vendor.id).toBeGreaterThan(0);
      expect(vendor.badge.length, vendor.id).toBeLessThanOrEqual(3);
      expect(vendor.color, vendor.id).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("图形文件名唯一,避免路径冲突", () => {
    const files = VENDOR_DB.flatMap((vendor) => (vendor.logoFile ? [vendor.logoFile] : []));
    expect(new Set(files).size).toBe(files.length);
  });

  it("组件保留加载失败回退,样式走单一尺寸变量且已全局引入", () => {
    expect(vendorLogoSource).toContain("onError");
    expect(vendorLogoSource).toContain("vendor.badge");
    expect(vendorLogoSource).toContain("--vendor-logo-size");
    expect(vendorCss).toContain(".vendor-logo {");
    expect(vendorCss).toContain(".vendor-logo-badge");
    expect(vendorCss).toContain("--vendor-logo-size");
    expect(vendorCss).toContain("--vendor-logo-color");
    expect(indexCss).toContain('@import "./vendor-logo.css";');
  });
});

describe("厂商溯源展示契约", () => {
  it("详情页在系统分组展示厂商行,hook 调用早于加载早退分支", () => {
    expect(instanceDetailsSource).toContain("useVendorInfo(meta)");
    expect(instanceDetailsSource.indexOf("useVendorInfo(meta)")).toBeLessThan(
      instanceDetailsSource.indexOf("if (!meta || !metrics)"),
    );
    expect(instanceDetailsSource).toContain('label="厂商"');
    expect(instanceDetailsSource).toContain('className="is-vendor"');
    expect(instanceDetailsSource).toContain("<VendorLogo vendor={vendor} size={18} showTrace />");
  });

  it("VendorLogo 多行 title 与 showTrace 深色 tooltip 并存", () => {
    expect(vendorLogoSource).toContain("formatVendorTraceLines");
    expect(vendorLogoSource).toContain('join("\\n")');
    expect(vendorLogoSource).toContain("showTrace");
    expect(vendorLogoSource).toContain("vendor-logo-tooltip");
  });

  it("tooltip 样式含整行 hover 触发与右对齐防溢出", () => {
    expect(vendorCss).toContain(".vendor-logo-tooltip");
    expect(vendorCss).toContain(".vendor-logo-tooltip-body");
    expect(vendorCss).toContain(".instance-vendor:hover .vendor-logo-tooltip");
    expect(vendorCss).toContain(".instance-info-item.is-vendor");
  });

  it("识别层记录命中关键词与字段,供溯源行生成", () => {
    const vendorsSource = readFileSync(new URL("../vendors.ts", import.meta.url), "utf8");
    expect(vendorsSource).toContain("export interface VendorTrace");
    expect(vendorsSource).toContain("trace: { keyword, fields: hitFields }");
    expect(vendorsSource).toContain("formatVendorTraceLines");
  });
});
