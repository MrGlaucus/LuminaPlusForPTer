import { memo, useState } from "react";
import { formatVendorTraceLines, type VendorInfo } from "@/utils/vendors";

/**
 * 厂商 LOGO:优先官方图形(品牌色 SVG),加载失败或无官方图形时回退字母徽标。
 * 尺寸经 --vendor-logo-size 内联变量控制,与同行的地区旗/系统图标对齐。
 *
 * 溯源分两档呈现:
 * - 默认(卡片/列表):仅多行原生 title,避免自定义浮层被卡片 overflow 裁剪;
 * - showTrace(详情页厂商行):额外渲染深色 tooltip,由 .instance-vendor 整行 hover 触发。
 */
export const VendorLogo = memo(function VendorLogo({
  vendor,
  size = 15,
  showTrace = false,
}: {
  vendor: VendorInfo;
  size?: number;
  showTrace?: boolean;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = vendor.logo;
  const showImage = src != null && failedSrc !== src;
  const traceLines = formatVendorTraceLines(vendor);

  return (
    <span
      className="vendor-logo-wrap"
      title={showTrace ? undefined : traceLines.join("\n")}
      style={{ "--vendor-logo-size": `${size}px` } as React.CSSProperties}
    >
      {showImage ? (
        <img
          className="vendor-logo"
          src={src}
          alt={vendor.name}
          width={size}
          height={size}
          loading="lazy"
          draggable={false}
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <span
          className="vendor-logo vendor-logo-badge"
          aria-label={`厂商：${vendor.name}`}
          style={{ "--vendor-logo-color": vendor.color } as React.CSSProperties}
        >
          {vendor.badge}
        </span>
      )}
      {showTrace && (
        <span className="vendor-logo-tooltip" role="tooltip">
          <span className="vendor-logo-tooltip-body">
            {traceLines.map((line, index) => (
              <span
                key={line}
                className={
                  index === 0
                    ? "vendor-logo-tooltip-line is-title"
                    : "vendor-logo-tooltip-line"
                }
              >
                {line}
              </span>
            ))}
          </span>
        </span>
      )}
    </span>
  );
});
