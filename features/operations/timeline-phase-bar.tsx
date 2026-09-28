'use client';

import { useRef, useState, type PointerEvent, type KeyboardEvent } from 'react';
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import type { ProjectPhase } from './types';

type Mode = 'move' | 'start' | 'end';
type Dates = { startDate: string; endDate: string };
export function shiftPhaseDates(dates: Dates, mode: Mode, days: number): Dates {
  const start = parseISO(dates.startDate);
  const end = parseISO(dates.endDate);
  if (mode === 'move')
    return {
      startDate: format(addDays(start, days), 'yyyy-MM-dd'),
      endDate: format(addDays(end, days), 'yyyy-MM-dd'),
    };
  if (mode === 'start')
    return {
      ...dates,
      startDate: format(
        addDays(start, Math.min(days, differenceInCalendarDays(end, start))),
        'yyyy-MM-dd',
      ),
    };
  return {
    ...dates,
    endDate: format(
      addDays(end, Math.max(days, -differenceInCalendarDays(end, start))),
      'yyyy-MM-dd',
    ),
  };
}

export function TimelinePhaseBar({
  phase,
  startDate,
  endDate,
  rangeStart,
  dayWidth,
  canvasWidth,
  top,
  color,
  canManage,
  onEdit,
  onChange,
}: {
  phase: ProjectPhase;
  startDate: string;
  endDate: string;
  rangeStart: Date;
  dayWidth: number;
  canvasWidth: number;
  top: number;
  color: string;
  canManage: boolean;
  onEdit?: (phase: ProjectPhase) => void;
  onChange?: (
    phase: ProjectPhase,
    startDate: string,
    endDate: string,
  ) => Promise<void>;
}) {
  const [preview, setPreview] = useState<Dates | null>(null);
  const [pending, setPending] = useState(false);
  const drag = useRef<{
    id: number;
    x: number;
    mode: Mode;
    dates: Dates;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const busy = useRef(false);
  const dates = preview ?? { startDate, endDate };
  const rawLeft =
    differenceInCalendarDays(parseISO(dates.startDate), rangeStart) * dayWidth;
  const rawRight =
    (differenceInCalendarDays(parseISO(dates.endDate), rangeStart) + 1) *
    dayWidth;
  const left = Math.max(2, rawLeft);
  const right = Math.min(canvasWidth - 2, rawRight);
  const editable = canManage && Boolean(onChange) && !pending;
  async function commit(next: Dates) {
    if (
      !onChange ||
      busy.current ||
      (next.startDate === startDate && next.endDate === endDate)
    ) {
      setPreview(null);
      return;
    }
    busy.current = true;
    setPending(true);
    setPreview(next);
    try {
      await onChange(phase, next.startDate, next.endDate);
    } catch {
      /* The owner reports RPC errors and refreshes the authoritative version. */
    } finally {
      busy.current = false;
      setPending(false);
      setPreview(null);
    }
  }
  function down(event: PointerEvent<HTMLElement>, mode: Mode) {
    if (!editable || event.button !== 0) return;
    event.stopPropagation();
    suppressClick.current = false;
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      mode,
      dates: { startDate, endDate },
      moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  function move(event: PointerEvent<HTMLElement>) {
    const active = drag.current;
    if (!active || active.id !== event.pointerId) return;
    if (Math.abs(event.clientX - active.x) < 4 && !active.moved) return;
    active.moved = true;
    setPreview(
      shiftPhaseDates(
        active.dates,
        active.mode,
        Math.round((event.clientX - active.x) / dayWidth),
      ),
    );
  }
  function up(event: PointerEvent<HTMLElement>) {
    const active = drag.current;
    if (!active || active.id !== event.pointerId) return;
    drag.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    suppressClick.current = active.moved;
    if (active.moved)
      void commit(
        shiftPhaseDates(
          active.dates,
          active.mode,
          Math.round((event.clientX - active.x) / dayWidth),
        ),
      );
  }
  function cancel() {
    drag.current = null;
    suppressClick.current = true;
    setPreview(null);
  }
  function key(event: KeyboardEvent<HTMLElement>, mode: Mode) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      cancel();
      return;
    }
    if (!editable || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    void commit(
      shiftPhaseDates(
        { startDate, endDate },
        mode,
        (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 7 : 1),
      ),
    );
  }
  if (right <= 0 || left >= canvasWidth || right <= left) return null;
  return (
    <div
      className="group/phase absolute z-[6] h-8 rounded-lg border text-xs font-semibold shadow-sm focus-within:ring-2 focus-within:ring-ring"
      style={{
        top,
        left,
        width: Math.max(dayWidth, right - left),
        borderColor: `${color}cc`,
        background: `linear-gradient(90deg, ${color}52, ${color}24)`,
        color,
      }}
      aria-busy={pending}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={cancel}
      onLostPointerCapture={() => {
        if (drag.current) cancel();
      }}
    >
      <button
        type="button"
        className="flex h-full w-full touch-none items-center gap-2 overflow-hidden rounded-lg px-4 text-left focus-visible:outline-none disabled:cursor-default enabled:cursor-grab active:cursor-grabbing"
        disabled={!canManage || pending}
        onPointerDown={(event) => down(event, 'move')}
        onKeyDown={(event) => key(event, 'move')}
        onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          onEdit?.(phase);
        }}
        aria-label={`Editar fase ${phase.name}, de ${dates.startDate} até ${dates.endDate}.`}
        title="Arraste para mover o período. Use as bordas para alterar início ou fim. Setas movem um dia; Shift + setas, uma semana."
      >
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        <span className="truncate">{phase.name}</span>
      </button>
      {canManage && onChange ? (
        <>
          <button
            type="button"
            disabled={pending}
            className="absolute inset-y-0 left-0 z-10 w-3 touch-none cursor-ew-resize rounded border-l-2 border-current bg-current/10 opacity-60 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Alterar início da fase ${phase.name}`}
            title={`Arraste para alterar início, ou use as setas.`}
            onPointerDown={(event) => down(event, 'start')}
            onKeyDown={(event) => key(event, 'start')}
            onClick={(event) => event.stopPropagation()}
          />
          <button
            type="button"
            disabled={pending}
            className="absolute inset-y-0 right-0 z-10 w-3 touch-none cursor-ew-resize rounded border-r-2 border-current bg-current/10 opacity-60 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Alterar fim da fase ${phase.name}`}
            title={`Arraste para alterar fim, ou use as setas.`}
            onPointerDown={(event) => down(event, 'end')}
            onKeyDown={(event) => key(event, 'end')}
            onClick={(event) => event.stopPropagation()}
          />
        </>
      ) : null}
      {preview ? (
        <span
          role="status"
          className="pointer-events-none absolute -top-7 left-0 whitespace-nowrap rounded bg-popover px-2 py-1 text-xs text-popover-foreground shadow"
        >
          {format(parseISO(dates.startDate), 'dd/MM')} —{' '}
          {format(parseISO(dates.endDate), 'dd/MM')}
          {pending ? ' · Salvando…' : ''}
        </span>
      ) : null}
    </div>
  );
}
