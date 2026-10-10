import { memo, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp } from "lucide-react";
import { clsx } from "clsx";
import { Flag } from "@/components/ui/Flag";
import { OsLogo } from "@/components/ui/OsLogo";
import { VendorLogo } from "@/components/ui/VendorLogo";
import { useNodeCardModel } from "@/hooks/useNodeCardModel";
import { useVendorInfo } from "@/hooks/useVendorInfo";
import { speedRateColor } from "@/utils/metricTone";
import { formatListPingStatus, resolveListPingState } from "./NodeListView";

function percent(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0;
}

function compactRateUnit(unit: string): string {
  return unit === "B/s" ? unit : unit.replace("B/s", "/s");
}

function MetricCell({ label, value, fraction, color, offline }: {
  label: string;
  value: string;
  fraction: number;
  color: string;
  offline: boolean;
}) {
  const fill = Number.isFinite(fraction) ? Math.max(0, Math.min(100, fraction * 100)) : 0;
  return (
    <span className="mobile-node-list-cell" title={`${label} ${offline ? "离线" : value}`}>
      <span className="mobile-node-list-label">{label}</span>
      <strong className="mobile-node-list-value">{offline ? "—" : value}</strong>
      <span
        className="mobile-node-list-track"
        style={{ "--mobile-meter-fill": offline ? "0%" : `${fill}%`, "--mobile-meter-color": color } as CSSProperties}
        aria-hidden
      />
    </span>
  );
}

const MobileNodeRow = memo(function MobileNodeRow({ uuid }: { uuid: string }) {
  const model = useNodeCardModel(uuid, { pingBucketCount: 1 });
  const vendor = useVendorInfo(model.node);
  if (!model.node) return <div className="mobile-node-list-row is-loading" aria-busy />;

  const { node, ping, hasRealHomepagePingBinding, upRate, downRate, loadFraction, isOffline, osName } = model;
  const pingState = resolveListPingState(ping.loadState, hasRealHomepagePingBinding, ping.isAssigned);
  const pingStatus = formatListPingStatus(ping.lastValue, pingState);
  const pingLabel = isOffline ? "离线" : ping.lastValue == null ? pingStatus.visibleText : `${pingStatus.visibleText} ms`;
  const load = isOffline ? "—" : node.load1.toFixed(2);
  const up = isOffline ? "—" : upRate.value;
  const down = isOffline ? "—" : downRate.value;
  const upUnit = isOffline ? "" : compactRateUnit(upRate.unit);
  const downUnit = isOffline ? "" : compactRateUnit(downRate.unit);
  const statusText = node.online === true ? "在线" : node.online === false ? "离线" : "状态未知";
  const metricsLabel = isOffline
    ? "实时指标暂不可用"
    : `CPU ${percent(node.cpuPct)}%，内存 ${percent(node.ramPct)}%，存储 ${percent(node.diskPct)}%，负载 ${load}，上传 ${up} ${upRate.unit}，下载 ${down} ${downRate.unit}，延迟 ${pingStatus.ariaText}`;
  const vendorLabel = vendor ? `，厂商 ${vendor.name}` : "";

  return (
    <Link
      to={`/instance/${encodeURIComponent(uuid)}`}
      className={clsx("mobile-node-list-row", isOffline && "is-offline")}
      aria-label={`${node.name}${vendorLabel}，系统 ${osName}，${statusText}，${metricsLabel}，查看详情`}
    >
      <span className="mobile-node-list-head">
        <Flag region={node.region} size={14} />
        {vendor && <VendorLogo vendor={vendor} size={14} />}
        <span className="mobile-node-list-name" title={node.name}>{node.name}</span>
        <span className="mobile-node-list-ping" title={pingStatus.title} style={isOffline ? undefined : { color: model.latencyColor }}>{pingLabel}</span>
        <OsLogo value={node.os} size={15} />
      </span>
      <span className="mobile-node-list-metrics">
        <MetricCell label="CPU" value={`${percent(node.cpuPct)}%`} fraction={node.cpuPct / 100} color="var(--progress-cpu)" offline={isOffline} />
        <MetricCell label="内存" value={`${percent(node.ramPct)}%`} fraction={node.ramPct / 100} color="var(--progress-memory)" offline={isOffline} />
        <MetricCell label="磁盘" value={`${percent(node.diskPct)}%`} fraction={node.diskPct / 100} color="var(--progress-disk)" offline={isOffline} />
        <MetricCell label="负载" value={load} fraction={loadFraction} color="var(--progress-load)" offline={isOffline} />
        <span className="mobile-node-list-cell" title={isOffline ? "离线" : `上传 ${upRate.value} ${upRate.unit}`}>
          <span className="mobile-node-list-label"><ArrowUp size={9} strokeWidth={2.4} aria-hidden />上传</span>
          <strong className="mobile-node-list-value" style={isOffline ? undefined : { color: speedRateColor(upRate.unit) }}>{up}<small>{upUnit}</small></strong>
        </span>
        <span className="mobile-node-list-cell" title={isOffline ? "离线" : `下载 ${downRate.value} ${downRate.unit}`}>
          <span className="mobile-node-list-label"><ArrowDown size={9} strokeWidth={2.4} aria-hidden />下载</span>
          <strong className="mobile-node-list-value" style={isOffline ? undefined : { color: speedRateColor(downRate.unit) }}>{down}<small>{downUnit}</small></strong>
        </span>
      </span>
    </Link>
  );
});

export function MobileNodeListView({ uuids }: { uuids: string[] }) {
  return (
    <div className="mobile-node-list" aria-label="节点列表">
      {uuids.map((uuid) => <MobileNodeRow key={uuid} uuid={uuid} />)}
    </div>
  );
}
