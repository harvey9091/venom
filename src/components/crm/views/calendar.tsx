'use client'

/**
 * Pulse CRM — CalendarView
 *
 * Layout:
 *   ┌─ Header ──────────────────────────────────────────────────────┐
 *   │  Title │ < Today > │ Day | Week | Month | Agenda │ + New event │
 *   ├─ Main grid ────────────────────────────────────────────────────┤
 *   │  ┌─ Mini calendar (side, hidden on mobile) ┐ ┌─ Active view ┐  │
 *   │  │  small month grid w/ dots on event days  │ │  Week/Day/   │  │
 *   │  └──────────────────────────────────────────┘ │  Month/Agenda│  │
 *   └───────────────────────────────────────────────────────────────┘
 *
 * Premium details:
 *  • Default Week view — 7 columns × 24 hours, today's column tinted,
 *    red "now" indicator line on today's column.
 *  • Events rendered as absolutely-positioned blocks colored by type
 *    (var(--chart-1..5)). Rounded-lg, drop shadow, hover scale.
 *  • Drag-to-create: mouse-down on empty space, drag, release → opens
 *    quick-create popover (title + type + Save → create.mutate).
 *  • Drag-to-move: HTML5 drag events. Drop on a new time slot updates
 *    startAt/endAt (preserving duration).
 *  • Click event → popover with full details + Edit + Delete.
 *  • Framer Motion view transitions.
 */

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCalendar, useCalendarMutations } from '@/lib/hooks'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Calendar as MiniCalendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { format, addDays, addMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, differenceInMinutes, setHours, setMinutes, getMinutes, getHours, isToday, parseISO } from 'date-fns'
import type { CalendarEvent } from '@/lib/types'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Video,
  Trash2,
  Pencil,
  X,
  Loader2,
} from 'lucide-react'

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

type ViewMode = 'day' | 'week' | 'month' | 'agenda'
type EventType = CalendarEvent['type']

const HOUR_HEIGHT = 56 // px per hour
const HOURS = Array.from({ length: 24 }, (_, i) => i)

const EVENT_COLORS: Record<EventType, { bg: string; border: string; text: string; dot: string }> = {
  meeting:       { bg: 'var(--chart-1)', border: 'var(--chart-1)', text: '#fff', dot: 'var(--chart-1)' },
  call:          { bg: 'var(--chart-2)', border: 'var(--chart-2)', text: '#fff', dot: 'var(--chart-2)' },
  task:          { bg: 'var(--chart-3)', border: 'var(--chart-3)', text: '#fff', dot: 'var(--chart-3)' },
  reminder:      { bg: 'var(--chart-4)', border: 'var(--chart-4)', text: '#fff', dot: 'var(--chart-4)' },
  'out-of-office': { bg: 'var(--chart-5)', border: 'var(--chart-5)', text: '#fff', dot: 'var(--chart-5)' },
}

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'meeting', label: 'Meeting' },
  { value: 'call', label: 'Call' },
  { value: 'task', label: 'Task' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'out-of-office', label: 'Out of office' },
]

const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'agenda', label: 'Agenda' },
]

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

/** Clamp value between min and max. */
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

/** Round a Date to the nearest `step` minutes. */
function roundToQuarterHour(date: Date): Date {
  const m = getMinutes(date)
  const rounded = Math.round(m / 15) * 15
  const d = setMinutes(date, rounded % 60)
  if (rounded >= 60) {
    return setHours(d, (getHours(d) + Math.floor(rounded / 60)) % 24)
  }
  return d
}

/** Y-offset (px) for a given Date inside the 24-hour column. */
function timeToY(date: Date): number {
  return (getHours(date) * 60 + getMinutes(date)) * (HOUR_HEIGHT / 60)
}

/** Height (px) between two dates. */
function durationToHeight(start: Date, end: Date): number {
  const minutes = Math.max(15, differenceInMinutes(end, start))
  return (minutes * HOUR_HEIGHT) / 60
}

/** Get the Sunday-start week containing `date`. */
function getWeekDays(date: Date): Date[] {
  const start = startOfWeek(date, { weekStartsOn: 0 })
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

/** Format an hour as "12am", "1am", "12pm", etc. */
function formatHour(h: number): string {
  if (h === 0) return '12am'
  if (h < 12) return `${h}am`
  if (h === 12) return '12pm'
  return `${h - 12}pm`
}

/** True if event intersects the given day. */
function eventOnDay(e: CalendarEvent, day: Date): boolean {
  const s = parseISO(e.startAt)
  const en = parseISO(e.endAt)
  // Check if [s, en] overlaps [day-start, day-end]
  const dayStart = setHours(setMinutes(day, 0), 0)
  const dayEnd = setHours(setMinutes(day, 59), 23)
  return s <= dayEnd && en >= dayStart
}

/** Get events that fall on a specific day, sorted by start time. */
function eventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events
    .filter((e) => eventOnDay(e, day))
    .sort((a, b) => parseISO(a.startAt).getTime() - parseISO(b.startAt).getTime())
}

// ----------------------------------------------------------------
// Event block (renders inside day column)
// ----------------------------------------------------------------

interface EventBlockProps {
  event: CalendarEvent
  day: Date
  onClick?: (e: React.MouseEvent) => void
  onDragStart?: (e: React.DragEvent) => void
  compact?: boolean
}

function EventBlock({ event, day, onClick, onDragStart, compact }: EventBlockProps) {
  const start = parseISO(event.startAt)
  const end = parseISO(event.endAt)
  // Clamp the visual range to the day's 0-24h window.
  const dayStart = setHours(setMinutes(day, 0), 0)
  const dayEnd = setHours(setMinutes(day, 0), 23)
  dayEnd.setMinutes(59)
  const visStart = start < dayStart ? dayStart : start
  const visEnd = end > dayEnd ? dayEnd : end
  const top = timeToY(visStart)
  const height = Math.max(20, durationToHeight(visStart, visEnd))
  const colors = EVENT_COLORS[event.type] || EVENT_COLORS.meeting

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.({} as React.MouseEvent)
        }
      }}
      className={cn(
        'absolute left-1 right-1 rounded-lg shadow-soft cursor-pointer overflow-hidden',
        'transition-transform hover:scale-[1.02] hover:shadow-premium',
        'flex flex-col text-white text-[11px] leading-tight z-10',
        compact ? 'px-1.5 py-0.5' : 'px-2 py-1'
      )}
      style={{
        top,
        height,
        background: colors.bg,
        borderLeft: `3px solid ${colors.border}`,
      }}
      aria-label={`${event.title}, ${format(start, 'h:mm a')} to ${format(end, 'h:mm a')}`}
    >
      <div className="font-medium truncate">{event.title}</div>
      {!compact && height > 36 && (
        <div className="opacity-90 text-[10px] truncate">
          {format(start, 'h:mm a')} – {format(end, 'h:mm a')}
        </div>
      )}
      {!compact && height > 56 && (event.location || event.meetingLink) && (
        <div className="opacity-90 text-[10px] truncate inline-flex items-center gap-1 mt-0.5">
          {event.meetingLink ? <Video className="size-2.5" /> : <MapPin className="size-2.5" />}
          <span className="truncate">{event.meetingLink || event.location}</span>
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------
// Now indicator (red line on today's column)
// ----------------------------------------------------------------

function NowIndicator() {
  const [now, setNow] = React.useState(new Date())
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])
  const top = timeToY(now)
  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none"
      style={{ top }}
      aria-hidden
    >
      <div className="flex items-center">
        <div className="size-2 rounded-full bg-rose-500 -ml-1" />
        <div className="h-px flex-1 bg-rose-500/80" />
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Drag-to-create preview overlay (per column)
// ----------------------------------------------------------------

// (Drag-to-create preview state is local to DayColumn)

// ----------------------------------------------------------------
// Day column (used by Week & Day views)
// ----------------------------------------------------------------

interface DayColumnProps {
  day: Date
  events: CalendarEvent[]
  isToday: boolean
  onEventClick: (e: CalendarEvent, ev: React.MouseEvent) => void
  onEventDragStart: (e: CalendarEvent, ev: React.DragEvent) => void
  onEventDrop: (day: Date, y: number, ev: React.DragEvent) => void
  onCreateDragEnd: (day: Date, start: Date, end: Date) => void
  isFullWidth?: boolean
}

function DayColumn({
  day,
  events,
  isToday,
  onEventClick,
  onEventDragStart,
  onEventDrop,
  onCreateDragEnd,
  isFullWidth,
}: DayColumnProps) {
  const colRef = React.useRef<HTMLDivElement>(null)
  const [drag, setDrag] = React.useState<{ startY: number; currentY: number } | null>(null)

  // Mouse-down on empty area → start drag-to-create
  const handleMouseDown = (e: React.MouseEvent) => {
    // Ignore clicks on existing events (they have their own onClick)
    if ((e.target as HTMLElement).closest('[role="button"]')) return
    if (e.button !== 0) return
    const rect = colRef.current?.getBoundingClientRect()
    if (!rect) return
    const startY = clamp(e.clientY - rect.top, 0, HOUR_HEIGHT * 24)
    setDrag({ startY, currentY: startY })

    const handleMove = (ev: MouseEvent) => {
      if (!rect) return
      const y = clamp(ev.clientY - rect.top, 0, HOUR_HEIGHT * 24)
      setDrag((d) => (d ? { ...d, currentY: y } : null))
    }
    const handleUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      const rect2 = colRef.current?.getBoundingClientRect()
      if (!rect2) {
        setDrag(null)
        return
      }
      const endY = clamp(ev.clientY - rect2.top, 0, HOUR_HEIGHT * 24)
      const y1 = Math.min(startY, endY)
      const y2 = Math.max(startY, endY)
      // Require at least 15 minutes of drag distance to create
      if (y2 - y1 < HOUR_HEIGHT / 4) {
        // Treat as a click — create a default 1-hour event starting at the click
        const startMin = (y1 / HOUR_HEIGHT) * 60
        const startDate = roundToQuarterHour(
          setHours(setMinutes(day, Math.floor(startMin % 60)), Math.floor(startMin / 60))
        )
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000)
        onCreateDragEnd(day, startDate, endDate)
      } else {
        const startMin = (y1 / HOUR_HEIGHT) * 60
        const endMin = (y2 / HOUR_HEIGHT) * 60
        const startDate = roundToQuarterHour(
          setHours(setMinutes(day, Math.floor(startMin % 60)), Math.floor(startMin / 60))
        )
        const endDate = roundToQuarterHour(
          setHours(setMinutes(day, Math.floor(endMin % 60)), Math.floor(endMin / 60))
        )
        if (endDate > startDate) {
          onCreateDragEnd(day, startDate, endDate)
        }
      }
      setDrag(null)
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const rect = colRef.current?.getBoundingClientRect()
    if (!rect) return
    const y = clamp(e.clientY - rect.top, 0, HOUR_HEIGHT * 24 - 1)
    onEventDrop(day, y, e)
  }

  return (
    <div
      className={cn(
        'relative flex flex-col border-r border-border/40 last:border-r-0',
        isFullWidth && 'border-r-0'
      )}
    >
      {/* Hour grid lines */}
      <div
        ref={colRef}
        className="relative"
        style={{ height: HOUR_HEIGHT * 24 }}
        onMouseDown={handleMouseDown}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        {HOURS.map((h) => (
          <div
            key={h}
            className="absolute left-0 right-0 border-t border-border/30"
            style={{ top: h * HOUR_HEIGHT }}
          />
        ))}
        {/* Events */}
        {events.map((ev) => (
          <EventBlock
            key={ev.id}
            event={ev}
            day={day}
            onClick={(e) => {
              e.stopPropagation()
              onEventClick(ev, e)
            }}
            onDragStart={(e) => {
              e.stopPropagation()
              onEventDragStart(ev, e)
            }}
          />
        ))}
        {/* Now indicator on today's column */}
        {isToday && <NowIndicator />}
        {/* Drag-to-create preview */}
        {drag && (
          <div
            className="absolute left-1 right-1 rounded-lg border-2 border-dashed border-primary/60 bg-primary/10 pointer-events-none z-30"
            style={{
              top: Math.min(drag.startY, drag.currentY),
              height: Math.abs(drag.currentY - drag.startY),
            }}
          />
        )}
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Week view
// ----------------------------------------------------------------

function WeekView({
  currentDate,
  events,
  onEventClick,
  onEventDragStart,
  onEventDrop,
  onCreateDragEnd,
}: {
  currentDate: Date
  events: CalendarEvent[]
  onEventClick: (e: CalendarEvent, ev: React.MouseEvent) => void
  onEventDragStart: (e: CalendarEvent, ev: React.DragEvent) => void
  onEventDrop: (day: Date, y: number, ev: React.DragEvent) => void
  onCreateDragEnd: (day: Date, start: Date, end: Date) => void
}) {
  const days = getWeekDays(currentDate)
  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-soft overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border/60 bg-muted/30">
        <div />
        {days.map((d) => {
          const today = isToday(d)
          return (
            <div
              key={d.toISOString()}
              className={cn(
                'px-2 py-2 text-center border-l border-border/40 first:border-l-0',
                today && 'bg-primary/5'
              )}
            >
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {format(d, 'EEE')}
              </div>
              <div
                className={cn(
                  'inline-flex items-center justify-center size-7 rounded-full text-[13px] font-medium tabular-nums mt-0.5',
                  today ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                )}
              >
                {format(d, 'd')}
              </div>
            </div>
          )
        })}
      </div>
      {/* Time grid + day columns */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] max-h-[calc(100vh-260px)] overflow-y-auto scroll-area">
        {/* Hour labels */}
        <div className="relative" style={{ height: HOUR_HEIGHT * 24 }}>
          {HOURS.map((h) => (
            <div
              key={h}
              className="absolute right-2 text-[10px] text-muted-foreground tabular-nums -translate-y-1/2"
              style={{ top: h * HOUR_HEIGHT }}
            >
              {formatHour(h)}
            </div>
          ))}
        </div>
        {/* Day columns */}
        {days.map((d) => (
          <div
            key={d.toISOString()}
            className={cn('border-l border-border/40 first:border-l-0', isToday(d) && 'bg-primary/5')}
          >
            <DayColumn
              day={d}
              events={eventsForDay(events, d)}
              isToday={isToday(d)}
              onEventClick={onEventClick}
              onEventDragStart={onEventDragStart}
              onEventDrop={onEventDrop}
              onCreateDragEnd={onCreateDragEnd}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Day view
// ----------------------------------------------------------------

function DayView({
  currentDate,
  events,
  onEventClick,
  onEventDragStart,
  onEventDrop,
  onCreateDragEnd,
}: {
  currentDate: Date
  events: CalendarEvent[]
  onEventClick: (e: CalendarEvent, ev: React.MouseEvent) => void
  onEventDragStart: (e: CalendarEvent, ev: React.DragEvent) => void
  onEventDrop: (day: Date, y: number, ev: React.DragEvent) => void
  onCreateDragEnd: (day: Date, start: Date, end: Date) => void
}) {
  const today = isToday(currentDate)
  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-soft overflow-hidden">
      <div className="px-4 py-3 border-b border-border/60 bg-muted/30 flex items-center gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {format(currentDate, 'EEEE')}
          </div>
          <div className="text-[16px] font-semibold">
            {format(currentDate, 'MMMM d, yyyy')}
          </div>
        </div>
        {today && (
          <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">
            Today
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-[60px_1fr] max-h-[calc(100vh-260px)] overflow-y-auto scroll-area">
        <div className="relative" style={{ height: HOUR_HEIGHT * 24 }}>
          {HOURS.map((h) => (
            <div
              key={h}
              className="absolute right-2 text-[10px] text-muted-foreground tabular-nums -translate-y-1/2"
              style={{ top: h * HOUR_HEIGHT }}
            >
              {formatHour(h)}
            </div>
          ))}
        </div>
        <div className={cn('border-l border-border/40', today && 'bg-primary/5')}>
          <DayColumn
            day={currentDate}
            events={eventsForDay(events, currentDate)}
            isToday={today}
            onEventClick={onEventClick}
            onEventDragStart={onEventDragStart}
            onEventDrop={onEventDrop}
            onCreateDragEnd={onCreateDragEnd}
            isFullWidth
          />
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Month view
// ----------------------------------------------------------------

function MonthView({
  currentDate,
  events,
  onSelectDay,
}: {
  currentDate: Date
  events: CalendarEvent[]
  onSelectDay: (day: Date) => void
}) {
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-soft overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border/60 bg-muted/30">
        {weekDays.map((d) => (
          <div
            key={d}
            className="px-2 py-2 text-center text-[10px] uppercase tracking-wide text-muted-foreground border-l border-border/40 first:border-l-0"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const inMonth = isSameMonth(d, currentDate)
          const today = isToday(d)
          const dayEvents = eventsForDay(events, d)
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => onSelectDay(d)}
              className={cn(
                'min-h-[110px] border-l border-t border-border/40 p-1.5 text-left align-top flex flex-col gap-1',
                'hover:bg-muted/40 transition-colors',
                !inMonth && 'bg-muted/20 text-muted-foreground',
                today && 'bg-primary/5'
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    'inline-flex items-center justify-center size-6 rounded-full text-[11px] font-medium tabular-nums',
                    today ? 'bg-primary text-primary-foreground' : ''
                  )}
                >
                  {format(d, 'd')}
                </span>
                {dayEvents.length > 0 && (
                  <span className="text-[9px] text-muted-foreground tabular-nums">
                    {dayEvents.length}
                  </span>
                )}
              </div>
              {dayEvents.slice(0, 3).map((ev) => {
                const colors = EVENT_COLORS[ev.type] || EVENT_COLORS.meeting
                return (
                  <div
                    key={ev.id}
                    className="text-[10px] truncate px-1 py-0.5 rounded text-white"
                    style={{ background: colors.bg }}
                  >
                    {ev.title}
                  </div>
                )
              })}
              {dayEvents.length > 3 && (
                <div className="text-[10px] text-muted-foreground px-1">
                  +{dayEvents.length - 3} more
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Agenda view
// ----------------------------------------------------------------

function AgendaView({
  currentDate,
  events,
  onEventClick,
}: {
  currentDate: Date
  events: CalendarEvent[]
  onEventClick: (e: CalendarEvent, ev: React.MouseEvent) => void
}) {
  // Show next 30 days from current date
  const days = Array.from({ length: 30 }, (_, i) => addDays(currentDate, i))
  const withEvents = days
    .map((d) => ({ day: d, events: eventsForDay(events, d) }))
    .filter((x) => x.events.length > 0)

  if (withEvents.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-card shadow-soft p-12 text-center">
        <CalendarIcon className="size-6 text-muted-foreground mx-auto mb-2" />
        <div className="text-[13px] font-medium">No upcoming events</div>
        <div className="text-[11px] text-muted-foreground mt-1">
          Your schedule is clear for the next 30 days.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {withEvents.map(({ day, events }) => (
        <div key={day.toISOString()} className="rounded-xl border border-border/60 bg-card shadow-soft overflow-hidden">
          <div className="px-4 py-2 border-b border-border/60 bg-muted/30 flex items-center gap-2">
            <div className={cn('size-8 rounded-full grid place-items-center text-[12px] font-semibold tabular-nums', isToday(day) ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
              {format(day, 'd')}
            </div>
            <div>
              <div className="text-[12px] font-medium">{format(day, 'EEEE, MMMM d')}</div>
              {isToday(day) && (
                <div className="text-[10px] text-primary">Today</div>
              )}
            </div>
            <div className="ml-auto text-[10px] text-muted-foreground tabular-nums">
              {events.length} event{events.length !== 1 ? 's' : ''}
            </div>
          </div>
          <ul className="divide-y divide-border/40">
            {events.map((ev) => {
              const colors = EVENT_COLORS[ev.type] || EVENT_COLORS.meeting
              const start = parseISO(ev.startAt)
              const end = parseISO(ev.endAt)
              return (
                <li
                  key={ev.id}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => onEventClick(ev, e)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onEventClick(ev, e as unknown as React.MouseEvent)
                  }}
                  className="px-4 py-2.5 flex items-center gap-3 hover:bg-muted/40 cursor-pointer transition-colors"
                >
                  <div className="size-2.5 rounded-full shrink-0" style={{ background: colors.dot }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium truncate">{ev.title}</div>
                    <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                      <Clock className="size-3" />
                      {format(start, 'h:mm a')} – {format(end, 'h:mm a')}
                    </div>
                  </div>
                  {(ev.location || ev.meetingLink) && (
                    <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1 truncate max-w-[160px]">
                      {ev.meetingLink ? <Video className="size-3" /> : <MapPin className="size-3" />}
                      <span className="truncate">{ev.meetingLink || ev.location}</span>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

// ----------------------------------------------------------------
// Quick-create popover (from drag-to-create)
// ----------------------------------------------------------------

function QuickCreatePopover({
  open,
  onClose,
  onCreate,
  defaultStart,
  defaultEnd,
  anchorEl,
}: {
  open: boolean
  onClose: () => void
  onCreate: (title: string, type: EventType) => void
  defaultStart: Date
  defaultEnd: Date
  anchorEl: HTMLElement | null
}) {
  const [title, setTitle] = React.useState('')
  const [type, setType] = React.useState<EventType>('meeting')

  React.useEffect(() => {
    if (open) {
      setTitle('')
      setType('meeting')
    }
  }, [open])

  if (!open) return null

  const handleSave = () => {
    if (!title.trim()) {
      toast.error('Title is required')
      return
    }
    onCreate(title.trim(), type)
  }

  return (
    <Popover open={open} onOpenChange={(o) => !o && onClose()}>
      <PopoverTrigger asChild>
        <div
          style={{
            position: 'fixed',
            left: anchorEl?.getBoundingClientRect().left || 0,
            top: anchorEl?.getBoundingClientRect().bottom || 0,
            width: 0,
            height: 0,
          }}
        />
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-3 space-y-3"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center justify-between">
          <div className="text-[12px] font-semibold">New event</div>
          <Button variant="ghost" size="icon" className="size-6" onClick={onClose} aria-label="Close">
            <X className="size-3.5" />
          </Button>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">When</Label>
          <div className="text-[11px] text-muted-foreground">
            {format(defaultStart, 'EEE MMM d')} · {format(defaultStart, 'h:mm a')} – {format(defaultEnd, 'h:mm a')}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ev-title" className="text-[11px] text-muted-foreground">Title</Label>
          <Input
            id="ev-title"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') onClose()
            }}
            placeholder="e.g. Sync with Acme"
            className="h-8 text-[12px]"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as EventType)}>
            <SelectTrigger className="h-8 text-[12px] w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" className="h-7 text-[11px]" onClick={handleSave}>
            Create event
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ----------------------------------------------------------------
// Event details popover (on event click)
// ----------------------------------------------------------------

function EventDetailsPopover({
  event,
  open,
  onClose,
  onEdit,
  onDelete,
  anchorEl,
}: {
  event: CalendarEvent | null
  open: boolean
  onClose: () => void
  onEdit: (e: CalendarEvent) => void
  onDelete: (e: CalendarEvent) => void
  anchorEl: HTMLElement | null
}) {
  if (!event) return null
  const start = parseISO(event.startAt)
  const end = parseISO(event.endAt)
  const colors = EVENT_COLORS[event.type] || EVENT_COLORS.meeting

  return (
    <Popover open={open} onOpenChange={(o) => !o && onClose()}>
      <PopoverTrigger asChild>
        <div
          style={{
            position: 'fixed',
            left: anchorEl?.getBoundingClientRect().left || 0,
            top: anchorEl?.getBoundingClientRect().bottom || 0,
            width: 0,
            height: 0,
          }}
        />
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3 space-y-3" align="start">
        <div className="flex items-start gap-2">
          <div className="size-3 rounded-full mt-1 shrink-0" style={{ background: colors.dot }} />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold truncate">{event.title}</div>
            <div className="text-[11px] text-muted-foreground capitalize">{event.type.replace('-', ' ')}</div>
          </div>
          <Button variant="ghost" size="icon" className="size-6" onClick={onClose} aria-label="Close">
            <X className="size-3.5" />
          </Button>
        </div>
        <div className="space-y-1.5 text-[12px]">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="size-3.5" />
            <span>
              {format(start, 'EEE MMM d')} · {format(start, 'h:mm a')} – {format(end, 'h:mm a')}
            </span>
          </div>
          {event.location && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="size-3.5" />
              <span className="truncate">{event.location}</span>
            </div>
          )}
          {event.meetingLink && (
            <a
              href={event.meetingLink}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-primary hover:underline"
            >
              <Video className="size-3.5" />
              <span className="truncate">Join meeting</span>
            </a>
          )}
          {event.description && (
            <div className="text-foreground/80 whitespace-pre-wrap pt-1 border-t border-border/60 mt-2 pt-2">
              {event.description}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-1 border-t border-border/60">
          <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => onEdit(event)}>
            <Pencil className="size-3" /> Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => onDelete(event)}
          >
            <Trash2 className="size-3" /> Delete
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ----------------------------------------------------------------
// Edit dialog (simple inline form for editing title / type / times)
// ----------------------------------------------------------------

function EditEventDialog({
  event,
  open,
  onClose,
  onSave,
}: {
  event: CalendarEvent | null
  open: boolean
  onClose: () => void
  onSave: (patch: Partial<CalendarEvent>) => void
}) {
  const [title, setTitle] = React.useState('')
  const [type, setType] = React.useState<EventType>('meeting')
  const [startAt, setStartAt] = React.useState('')
  const [endAt, setEndAt] = React.useState('')

  React.useEffect(() => {
    if (event && open) {
      setTitle(event.title)
      setType(event.type)
      setStartAt(toLocalInput(parseISO(event.startAt)))
      setEndAt(toLocalInput(parseISO(event.endAt)))
    }
  }, [event, open])

  if (!event || !open) return null

  const handleSave = () => {
    if (!title.trim()) {
      toast.error('Title is required')
      return
    }
    const start = new Date(startAt)
    const end = new Date(endAt)
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      toast.error('Invalid date/time')
      return
    }
    if (end <= start) {
      toast.error('End time must be after start time')
      return
    }
    onSave({
      id: event.id,
      title: title.trim(),
      type,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
    })
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-border/60 bg-card shadow-premium p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="text-[14px] font-semibold">Edit event</div>
          <Button variant="ghost" size="icon" className="size-7" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-title" className="text-[12px]">Title</Label>
          <Input
            id="edit-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-9 text-[13px]"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[12px]">Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as EventType)}>
            <SelectTrigger className="h-9 text-[12px] w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-start" className="text-[12px]">Starts</Label>
            <Input
              id="edit-start"
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="h-9 text-[12px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-end" className="text-[12px]">Ends</Label>
            <Input
              id="edit-end"
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              className="h-9 text-[12px]"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave}>Save changes</Button>
        </div>
      </div>
    </div>
  )
}

function toLocalInput(d: Date): string {
  // Format as yyyy-MM-ddTHH:mm in local time for <input type="datetime-local">
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ----------------------------------------------------------------
// Mini calendar (side panel)
// ----------------------------------------------------------------

function MiniCalendarPanel({
  currentDate,
  events,
  onSelectDate,
}: {
  currentDate: Date
  events: CalendarEvent[]
  onSelectDate: (d: Date) => void
}) {
  // Days that have events (for the dot indicator)
  const eventDays = new Set(
    events.map((e) => format(parseISO(e.startAt), 'yyyy-MM-dd'))
  )

  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-soft p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {format(currentDate, 'MMMM yyyy')}
      </div>
      <MiniCalendar
        mode="single"
        selected={currentDate}
        onSelect={(d) => d && onSelectDate(d)}
        showOutsideDays
        className="p-0"
        modifiers={{ hasEvents: (d) => eventDays.has(format(d, 'yyyy-MM-dd')) }}
        modifiersClassNames={{
          hasEvents: 'relative after:absolute after:bottom-0.5 after:left-1/2 after:-translate-x-1/2 after:size-1 after:rounded-full after:bg-primary',
        }}
      />
    </div>
  )
}

// ----------------------------------------------------------------
// Main view
// ----------------------------------------------------------------

export function CalendarView() {
  const { data: events = [], isLoading } = useCalendar()
  const { create, update, remove } = useCalendarMutations()
  const workspace = useAppStore((s) => s.workspace)

  const [view, setView] = React.useState<ViewMode>('week')
  const [currentDate, setCurrentDate] = React.useState(new Date())

  // Drag-to-create state
  const [quickCreate, setQuickCreate] = React.useState<{
    open: boolean
    day: Date
    start: Date
    end: Date
    anchor: HTMLElement | null
  }>({ open: false, day: new Date(), start: new Date(), end: new Date(), anchor: null })

  // Event details popover state
  const [details, setDetails] = React.useState<{
    open: boolean
    event: CalendarEvent | null
    anchor: HTMLElement | null
  }>({ open: false, event: null, anchor: null })

  // Edit dialog state
  const [editing, setEditing] = React.useState<CalendarEvent | null>(null)

  // Drag-to-move handler
  const handleEventDragStart = (event: CalendarEvent, ev: React.DragEvent) => {
    ev.dataTransfer.setData('text/plain', event.id)
    ev.dataTransfer.effectAllowed = 'move'
  }

  const handleEventDrop = (day: Date, y: number, ev: React.DragEvent) => {
    const eventId = ev.dataTransfer.getData('text/plain')
    if (!eventId) return
    const event = events.find((e) => e.id === eventId)
    if (!event) return
    const oldStart = parseISO(event.startAt)
    const oldEnd = parseISO(event.endAt)
    const duration = oldEnd.getTime() - oldStart.getTime()
    // New start: from y position on the target day
    const minutesFromY = (y / HOUR_HEIGHT) * 60
    const newStart = roundToQuarterHour(
      setHours(setMinutes(day, Math.floor(minutesFromY % 60)), Math.floor(minutesFromY / 60))
    )
    const newEnd = new Date(newStart.getTime() + duration)
    update.mutate(
      { id: event.id, startAt: newStart.toISOString(), endAt: newEnd.toISOString() },
      {
        onSuccess: () => toast.success('Event moved'),
        onError: () => toast.error('Could not move event'),
      }
    )
  }

  const handleCreateDragEnd = (day: Date, start: Date, end: Date, anchor?: HTMLElement) => {
    setQuickCreate({ open: true, day, start, end, anchor: anchor || null })
  }

  const handleQuickCreate = (title: string, type: EventType) => {
    create.mutate(
      {
        workspaceId: workspace?.id,
        title,
        type,
        startAt: quickCreate.start.toISOString(),
        endAt: quickCreate.end.toISOString(),
        allDay: false,
      } as any,
      {
        onSuccess: () => {
          toast.success('Event created')
          setQuickCreate((s) => ({ ...s, open: false }))
        },
        onError: () => toast.error('Could not create event'),
      }
    )
  }

  const handleEventClick = (event: CalendarEvent, ev: React.MouseEvent) => {
    setDetails({ open: true, event, anchor: ev.currentTarget as HTMLElement })
  }

  const handleEdit = (event: CalendarEvent) => {
    setDetails({ open: false, event: null, anchor: null })
    setEditing(event)
  }

  const handleEditSave = (patch: Partial<CalendarEvent>) => {
    update.mutate(patch as any, {
      onSuccess: () => {
        toast.success('Event updated')
        setEditing(null)
      },
      onError: () => toast.error('Could not update event'),
    })
  }

  const handleDelete = (event: CalendarEvent) => {
    remove.mutate(event.id, {
      onSuccess: () => {
        toast.success('Event deleted')
        setDetails({ open: false, event: null, anchor: null })
      },
    })
  }

  // Navigation
  const goPrev = () => {
    if (view === 'day') setCurrentDate((d) => addDays(d, -1))
    else if (view === 'week') setCurrentDate((d) => addDays(d, -7))
    else if (view === 'month') setCurrentDate((d) => addMonths(d, -1))
    else setCurrentDate((d) => addDays(d, -7)) // agenda
  }
  const goNext = () => {
    if (view === 'day') setCurrentDate((d) => addDays(d, 1))
    else if (view === 'week') setCurrentDate((d) => addDays(d, 7))
    else if (view === 'month') setCurrentDate((d) => addMonths(d, 1))
    else setCurrentDate((d) => addDays(d, 7))
  }
  const goToday = () => setCurrentDate(new Date())

  const headerLabel = React.useMemo(() => {
    if (view === 'day') return format(currentDate, 'EEEE, MMMM d, yyyy')
    if (view === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 })
      const end = endOfWeek(currentDate, { weekStartsOn: 0 })
      if (isSameMonth(start, end)) return `${format(start, 'MMM d')} – ${format(end, 'd, yyyy')}`
      return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
    }
    if (view === 'month') return format(currentDate, 'MMMM yyyy')
    return 'Upcoming events'
  }, [view, currentDate])

  return (
    <div className="p-4 md:p-6 view-enter">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-[18px] font-semibold tracking-tight">Calendar</h1>
          {isToday(currentDate) && view !== 'agenda' && (
            <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">
              <span className="size-1.5 rounded-full bg-primary mr-1" />
              Today
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Navigation */}
          <div className="inline-flex items-center rounded-lg border border-border/60 bg-card overflow-hidden">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-r-none" onClick={goPrev} aria-label="Previous">
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="ghost" className="h-9 rounded-none text-[12px] px-3" onClick={goToday}>
              Today
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-l-none" onClick={goNext} aria-label="Next">
              <ChevronRight className="size-4" />
            </Button>
          </div>
          {/* View switcher */}
          <div className="inline-flex items-center rounded-lg border border-border/60 bg-card p-0.5 gap-0.5">
            {VIEW_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setView(opt.value)}
                className={cn(
                  'px-2.5 py-1.5 text-[12px] rounded-md transition-colors',
                  view === opt.value
                    ? 'bg-primary text-primary-foreground shadow-soft'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sub-header: current range label */}
      <div className="mb-3 text-[13px] font-medium text-muted-foreground">
        {headerLabel}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
        {/* Side panel: mini calendar */}
        <div className="hidden lg:block">
          <MiniCalendarPanel
            currentDate={currentDate}
            events={events}
            onSelectDate={(d) => {
              setCurrentDate(d)
              if (view === 'month') setView('day')
            }}
          />
          {/* Legend */}
          <div className="mt-3 rounded-xl border border-border/60 bg-card shadow-soft p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Event types
            </div>
            <ul className="space-y-1.5">
              {EVENT_TYPES.map((t) => {
                const c = EVENT_COLORS[t.value]
                return (
                  <li key={t.value} className="flex items-center gap-2 text-[11px]">
                    <span className="size-2.5 rounded-full" style={{ background: c.dot }} />
                    <span className="text-muted-foreground">{t.label}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        {/* Main calendar grid */}
        <div>
          {isLoading ? (
            <Skeleton className="h-[600px] w-full rounded-xl" />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={view + currentDate.toISOString()}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                {view === 'week' && (
                  <WeekView
                    currentDate={currentDate}
                    events={events}
                    onEventClick={handleEventClick}
                    onEventDragStart={handleEventDragStart}
                    onEventDrop={handleEventDrop}
                    onCreateDragEnd={handleCreateDragEnd}
                  />
                )}
                {view === 'day' && (
                  <DayView
                    currentDate={currentDate}
                    events={events}
                    onEventClick={handleEventClick}
                    onEventDragStart={handleEventDragStart}
                    onEventDrop={handleEventDrop}
                    onCreateDragEnd={handleCreateDragEnd}
                  />
                )}
                {view === 'month' && (
                  <MonthView
                    currentDate={currentDate}
                    events={events}
                    onSelectDay={(d) => {
                      setCurrentDate(d)
                      setView('day')
                    }}
                  />
                )}
                {view === 'agenda' && (
                  <AgendaView
                    currentDate={currentDate}
                    events={events}
                    onEventClick={handleEventClick}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Quick-create popover (from drag-to-create) */}
      <QuickCreatePopover
        open={quickCreate.open}
        onClose={() => setQuickCreate((s) => ({ ...s, open: false }))}
        onCreate={handleQuickCreate}
        defaultStart={quickCreate.start}
        defaultEnd={quickCreate.end}
        anchorEl={quickCreate.anchor}
      />

      {/* Event details popover */}
      <EventDetailsPopover
        event={details.event}
        open={details.open}
        onClose={() => setDetails({ open: false, event: null, anchor: null })}
        onEdit={handleEdit}
        onDelete={handleDelete}
        anchorEl={details.anchor}
      />

      {/* Edit dialog */}
      <EditEventDialog
        event={editing}
        open={!!editing}
        onClose={() => setEditing(null)}
        onSave={handleEditSave}
      />
    </div>
  )
}
