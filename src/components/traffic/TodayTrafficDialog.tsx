import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TodayTrafficStatsContent } from "./TodayTrafficStats";

const VIEWPORT_MARGIN = 8;
const ANCHOR_GAP = 8;

export interface TodayTrafficDialogProps {
  open: boolean;
  onClose: () => void;
  /**
   * 触发入口(今日流量卡片图标 / 节点小弹窗「明细」)的边界快照。弹窗锚定在其下方
   * 右对齐,空间不足时翻到上方;为空(其他入口)时在视口居中。
   */
  anchorRect?: DOMRect | null;
}

/**
 * 首页「今日流量」详情弹窗:内容与 /traffic 统计页一致(共享 TodayTrafficStatsContent),
 * 以浮层形式锚定在触发入口旁(类似资产概览的续费提醒弹层),不遮满全屏——移动端同样
 * 保持浮层,宽度自适应视口。查询在弹窗挂载时发起,命中首页卡片预取缓存时秒开。
 */
export function TodayTrafficDialog({
  open,
  onClose,
  anchorRect = null,
}: TodayTrafficDialogProps) {
  const panelRef = useRef<HTMLElement | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  // 打开时按锚点快照计算浮层位置:默认出现在入口下方、右缘对齐,放不下翻到上方,
  // 左右收敛在视口内;无锚点时居中。面板尺寸由 CSS 决定,这里只读实际渲染后的结果。
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const update = () => {
      const panel = panelRef.current;
      if (!panel) return;
      const { innerWidth: viewportWidth, innerHeight: viewportHeight } = window;
      const width = panel.offsetWidth;
      const height = panel.offsetHeight;
      if (anchorRect) {
        let top = anchorRect.bottom + ANCHOR_GAP;
        if (top + height > viewportHeight - VIEWPORT_MARGIN) {
          top = Math.max(VIEWPORT_MARGIN, anchorRect.top - height - ANCHOR_GAP);
        }
        let left = anchorRect.right - width;
        left = Math.min(
          Math.max(VIEWPORT_MARGIN, left),
          Math.max(VIEWPORT_MARGIN, viewportWidth - width - VIEWPORT_MARGIN),
        );
        setPosition({ top, left });
      } else {
        setPosition({
          top: (viewportHeight - height) / 2,
          left: (viewportWidth - width) / 2,
        });
      }
    };
    update();
    const frame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(frame);
  }, [anchorRect, open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    // 浮层不遮全屏,点击面板外与滚动(锚点位置过期)时关闭。
    const handlePointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("scroll", onClose, { capture: true, passive: true });
    window.addEventListener("resize", onClose);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("scroll", onClose, { capture: true });
      window.removeEventListener("resize", onClose);
    };
  }, [onClose, open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <section
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="today-traffic-dialog-title"
      className="traffic-dialog-panel"
      style={
        position
          ? { top: position.top, left: position.left }
          : { top: 0, left: 0, visibility: "hidden" }
      }
    >
      <TodayTrafficStatsContent headerMode="dialog" onClose={onClose} />
    </section>,
    document.body,
  );
}
