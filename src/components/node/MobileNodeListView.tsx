import { memo } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { clsx } from "clsx";
import { Flag } from "@/components/ui/Flag";
import { useNodeCardModel } from "@/hooks/useNodeCardModel";
import { formatListPingStatus, resolveListPingState } from "./NodeListView";

function percent(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0;
}

function compactRateUnit(unit: string): string {
  return unit === "B/s" ? unit : unit.replace("B/s", "/s");
}

function UsageCell({ label, value, offline }: { label: string; value: number; offline: boolean }) {
  const amount = percent(value);
  return (
    <span className="mobile-node-list-cell" title={`${label} ${offline ? "离线" : `${amount}%`}`}>
      <span className="mobile-node-list-label">{label}</span>
      <strong className="mobile-node-list-value">{offline ? "—" : `${amount}%`}</strong>
      <span className="mobile-node-list-track" aria-hidden>
        {!offline && (
          <span
            className={clsx("mobile-node-list-fill", amount >= 90 ? "is-critical" : amount >= 75 && "is-warning")}
            style={{ width: `${amount}%` }}
          />
        )}
      </span>
    </span>
  );
}

const MobileNodeRow = memo(function MobileNodeRow({ uuid }: { uuid: string }) {
  const model = useNodeCardModel(uuid, { pingBucketCount: 1 });
  if (!model.node) return <div className="mobile-node-list-row is-loading" aria-busy />;

  const { node, ping, hasRealHomepagePingBinding, upRate, downRate, isOffline } = model;
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

  return (
    <Link
      to={`/instance/${encodeURIComponent(uuid)}`}
      className={clsx("mobile-node-list-row", isOffline && "is-offline")}
      aria-label={`${node.name}，${statusText}，${metricsLabel}，查看详情`}
    >
      <span className="mobile-node-list-head">
        <span className="mobile-node-list-status" aria-hidden />
        <Flag region={node.region} size={13} />
        <span className="mobile-node-list-name" title={node.name}>{node.name}</span>
        <span className="mobile-node-list-ping" title={pingStatus.title}>{pingLabel}</span>
        <ChevronRight size={14} className="mobile-node-list-chevron" aria-hidden />
      </span>
      <span className="mobile-node-list-metrics">
        <UsageCell label="CPU" value={node.cpuPct} offline={isOffline} />
        <UsageCell label="内存" value={node.ramPct} offline={isOffline} />
        <UsageCell label="存储" value={node.diskPct} offline={isOffline} />
        <span className="mobile-node-list-cell">
          <span className="mobile-node-list-label">负载</span>
          <strong className="mobile-node-list-value">{load}</strong>
        </span>
        <span className="mobile-node-list-cell" title={isOffline ? "离线" : `上传 ${upRate.value} ${upRate.unit}`}>
          <span className="mobile-node-list-label">↑ 上传</span>
          <strong className="mobile-node-list-value is-up">{up}<small>{upUnit}</small></strong>
        </span>
        <span className="mobile-node-list-cell" title={isOffline ? "离线" : `下载 ${downRate.value} ${downRate.unit}`}>
          <span className="mobile-node-list-label">↓ 下载</span>
          <strong className="mobile-node-list-value is-down">{down}<small>{downUnit}</small></strong>
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
