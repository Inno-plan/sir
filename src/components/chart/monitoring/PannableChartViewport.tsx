'use client';

import {
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { MoveHorizontal } from 'lucide-react';
import { shortDate } from './shared';

export interface ChartViewportControlProps {
  enabled: boolean;
  offset: number;
  maxOffset: number;
  visiblePointCount: number;
  onOffsetChange: (offset: number) => void;
}

interface Props extends ChartViewportControlProps {
  children: ReactNode;
  startDate?: string;
  endDate?: string;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  startOffset: number;
  width: number;
  horizontal: boolean;
}

const DRAG_THRESHOLD_PX = 5;

/** 차트 클릭은 유지하면서 수평 드래그로 장기 구간을 이동하는 공통 viewport. */
export function PannableChartViewport({
  children,
  enabled,
  offset,
  maxOffset,
  visiblePointCount,
  startDate,
  endDate,
  onOffsetChange,
}: Props) {
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);

  const clampOffset = (next: number) => Math.min(maxOffset, Math.max(0, Math.round(next)));

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!enabled || !event.isPrimary || event.button !== 0) return;
    suppressClickRef.current = false;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffset: offset,
      width: event.currentTarget.getBoundingClientRect().width,
      horizontal: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.horizontal) {
      if (Math.abs(deltaX) < DRAG_THRESHOLD_PX) return;
      if (Math.abs(deltaY) > Math.abs(deltaX)) return;
      drag.horizontal = true;
      suppressClickRef.current = true;
    }

    event.preventDefault();
    const pixelsPerPoint = Math.max(1, drag.width / visiblePointCount);
    onOffsetChange(clampOffset(drag.startOffset + deltaX / pixelsPerPoint));
  };

  const finishDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  };

  const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!enabled || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
    event.preventDefault();
    const step = Math.max(1, Math.round(visiblePointCount / 5));
    onOffsetChange(clampOffset(offset + (event.key === 'ArrowLeft' ? step : -step)));
  };

  return (
    <div className="flex flex-col gap-2">
      {enabled && (
        <div className="flex items-center justify-between gap-3 px-1 text-[11px] text-slate-400">
          <span className="tabular-nums font-medium text-slate-500">
            {startDate && endDate ? `${shortDate(startDate)} - ${shortDate(endDate)}` : ''}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MoveHorizontal size={14} aria-hidden="true" />
            좌우로 드래그해 기간 이동
          </span>
        </div>
      )}
      <div
        className={`h-[300px] select-none ${enabled ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={enabled ? { touchAction: 'pan-y' } : undefined}
        tabIndex={enabled ? 0 : undefined}
        role={enabled ? 'group' : undefined}
        aria-label={
          enabled ? '차트 표시 기간 이동. 좌우로 드래그하거나 방향키를 사용하세요.' : undefined
        }
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onClickCapture={handleClickCapture}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </div>
  );
}
