import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { TRAFFIC_MOBILE_QUERY, TodayTrafficStatsContent } from "./TodayTrafficStats";

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
 * 首页「今日流量」详情弹窗:内容与 /traffic 统计页一致(共享 TodayTrafficStatsContent)。
 * 桌面端以浮层形式锚定在触发入口旁,不遮满全屏;移动端与资产概览的续费提醒一致,
 * 从底部贴底弹出(宽度撑满、高度更高)。查询在弹窗挂载时发起,命中首页卡片预取缓存时秒开。
 */
export function TodayTrafficDialog({
  open,
  onClose,
  anchorRect = null,
}: TodayTrafficDialogProps) {
  const panelRef = useRef<HTMLElement | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const isMobileLayout = useMediaQuery(TRAFFIC_MOBILE_QUERY);

  // 桌面端按锚点快照计算浮层位置:默认出现在入口下方、右缘对齐,放不下翻到上方,
  // 左右收敛在视口内;无锚点时居中。移动端贴底弹层位置完全由 CSS 决定,无需计算。
  useLayoutEffect(() => {
    if (!open || isMobileLayout) {
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
  }, [anchorRect, isMobileLayout, open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    // 浮层不遮全屏,点击面板外关闭。面板内滚动走 .traffic-dialog-content 的
    // overflow 容器,不再监听 scroll(捕获监听会误捕内部滚动导致滑一下即关闭)。
    const handlePointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) onClose();
    };
    // 桌面锚定浮层在视口尺寸变化(旋转/缩放)后位置过期,一并关闭;
    // 移动端贴底位置由 CSS 决定,旋转后依然贴底,无需关闭(也避免键盘弹出误关)。
    const handleResize = () => {
      if (!isMobileLayout) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", handleResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", handleResize);
    };
  }, [isMobileLayout, onClose, open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <section
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="today-traffic-dialog-title"
      className={`traffic-dialog-panel${isMobileLayout ? " is-mobile" : ""}`}
      style={
        isMobileLayout
          ? undefined
          : position
            ? { top: position.top, left: position.left }
            : { top: 0, left: 0, visibility: "hidden" }
      }
    >
      <TodayTrafficStatsContent headerMode="dialog" onClose={onClose} />
    </section>,
    document.body,
  );
}
