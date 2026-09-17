import { useEffect, useMemo, useState } from "react";
import { useThemeSettings } from "@/hooks/useThemeSettings";
import { lookupIpNetwork } from "@/utils/vendorGeo";
import {
  formatAsnLabel,
  resolveVendorByAsn,
  resolveVendorInfo,
  type VendorInfo,
} from "@/utils/vendors";
import type { NodeInfo } from "@/types/komari";

type VendorSource = Partial<
  Pick<NodeInfo, "name" | "group" | "public_remark" | "tags" | "ipv4" | "ipv6">
>;

/**
 * 厂商识别:本地关键词命中优先;未命中且开启「在线识别」时,
 * 用节点 IP 查询 ASN/组织名补全(缓存与请求控制见 vendorGeo)。
 * 两条通道都附带溯源(trace),供 tooltip 说明判定依据。
 * 展示开关关闭时不做任何识别,返回 null。
 */
export function useVendorInfo(meta: VendorSource | null | undefined): VendorInfo | null {
  const { showProviderLogo, providerOnlineLookup } = useThemeSettings();

  const local = useMemo(() => {
    if (!showProviderLogo || !meta) return null;
    return resolveVendorInfo([
      { label: "节点名称", value: meta.name },
      { label: "分组", value: meta.group },
      { label: "备注", value: meta.public_remark },
      { label: "标签", value: meta.tags },
    ]);
  }, [meta, showProviderLogo]);

  const [online, setOnline] = useState<VendorInfo | null>(null);
  const ip = meta?.ipv4 || meta?.ipv6 || "";

  useEffect(() => {
    // 本地已识别/功能未开启/无可用 IP 时不查询;依赖变化时清掉上一轮在线结果。
    setOnline(null);
    if (local || !showProviderLogo || !providerOnlineLookup || !ip) return;
    let cancelled = false;
    lookupIpNetwork(ip).then((network) => {
      if (cancelled || !network) return;
      const vendor = resolveVendorByAsn(network.asn, network.organization);
      if (!vendor) return;
      // ASN/组织名在这里统一格式化后写入溯源,展示层直接消费。
      setOnline({
        ...vendor,
        trace: {
          asn: formatAsnLabel(network.asn) ?? undefined,
          org: network.organization?.trim() || undefined,
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [ip, local, providerOnlineLookup, showProviderLogo]);

  return local ?? online;
}
