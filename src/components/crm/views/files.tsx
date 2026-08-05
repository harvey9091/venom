'use client'

/**
 * Pulse CRM — Files view
 *
 * Layout (Linear/Dropbox-inspired):
 *   ┌─ Header strip ──────────────────────────────────────┐
 *   │  Title + count │ search │ view toggle (Grid/List) │ Upload │
 *   ├─ Drop zone (dashed) ──────────────────────────────────┤
 *   │  Drag files here or click to upload                    │
 *   ├─ View ────────────────────────────────────────────────┤
 *   │  Grid: 2/3/4-col cards w/ file icons by mime           │
 *   │  List: TanStack Table                                  │
 *   └────────────────────────────────────────────────────────┘
 *
 * Upload is mocked — no real storage. We create a CRMFile record
 * with a fake URL after a 1.5s progress animation.
 */

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table'
import { useFiles, useFileMutations } from '@/lib/hooks'
import { useAppStore } from '@/lib/store'
import { Avatar, relTime, EmptyState } from '@/components/crm/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ThinkingState } from '@/components/crm/thinking'
import { simulateAIThinking } from '@/lib/ai-sim'
import type { CRMFile } from '@/lib/types'
import {
  Upload,
  Search,
  LayoutGrid,
  List as ListIcon,
  Paperclip,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  File as FileIcon,
  FileSpreadsheet,
  Presentation,
  Download,
  Trash2,
  Eye,
  MoreHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CloudUpload,
} from 'lucide-react'

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function formatSize(bytes: number): string {
  if (!bytes || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

interface FileIconInfo {
  Icon: React.ComponentType<{ className?: string }>
  bg: string
  fg: string
  label: string
}

function fileIconFor(mime: string): FileIconInfo {
  const m = (mime || '').toLowerCase()
  if (m.startsWith('image/')) {
    return { Icon: ImageIcon, bg: 'bg-purple-500/15', fg: 'text-purple-600 dark:text-purple-300', label: 'Image' }
  }
  if (m.startsWith('video/')) {
    return { Icon: Film, bg: 'bg-rose-500/15', fg: 'text-rose-600 dark:text-rose-300', label: 'Video' }
  }
  if (m.startsWith('audio/')) {
    return { Icon: Music, bg: 'bg-pink-500/15', fg: 'text-pink-600 dark:text-pink-300', label: 'Audio' }
  }
  if (m === 'application/pdf' || m.endsWith('pdf')) {
    return { Icon: FileText, bg: 'bg-red-500/15', fg: 'text-red-600 dark:text-red-300', label: 'PDF' }
  }
  if (m.includes('spreadsheet') || m.includes('excel') || m.includes('csv') || m.endsWith('.csv')) {
    return { Icon: FileSpreadsheet, bg: 'bg-emerald-500/15', fg: 'text-emerald-600 dark:text-emerald-300', label: 'Sheet' }
  }
  if (m.includes('presentation') || m.includes('powerpoint')) {
    return { Icon: Presentation, bg: 'bg-amber-500/15', fg: 'text-amber-600 dark:text-amber-300', label: 'Slides' }
  }
  if (m.includes('word') || m.includes('document') || m === 'application/msword' || m.endsWith('document')) {
    return { Icon: FileText, bg: 'bg-blue-500/15', fg: 'text-blue-600 dark:text-blue-300', label: 'Doc' }
  }
  if (m.startsWith('text/') || m === 'text/plain') {
    return { Icon: FileText, bg: 'bg-slate-500/15', fg: 'text-slate-600 dark:text-slate-300', label: 'Text' }
  }
  if (m.startsWith('application/zip') || m.includes('compressed') || m.includes('zip')) {
    return { Icon: FileText, bg: 'bg-orange-500/15', fg: 'text-orange-600 dark:text-orange-300', label: 'Archive' }
  }
  return { Icon: FileIcon, bg: 'bg-slate-500/15', fg: 'text-slate-600 dark:text-slate-300', label: 'File' }
}

function fileExt(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toUpperCase() : 'FILE'
}

// ----------------------------------------------------------------
// In-flight upload progress card
// ----------------------------------------------------------------

interface UploadingItem {
  uid: string
  name: string
  size: number
  progress: number
  phase: 'uploading' | 'scanning' | 'generating'
  label?: string
  fileId?: string
}

function UploadingCard({ item }: { item: UploadingItem }) {
  const { Icon, bg, fg } = fileIconFor('')
  if (item.phase === 'scanning') {
    return (
      <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 shadow-soft">
        <div className="flex items-center gap-3">
          <div className={cn('size-10 rounded-lg grid place-items-center shrink-0', bg, fg)}>
            <Icon className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-medium truncate">{item.name}</div>
            <div className="mt-1">
              <ThinkingState compact size="xs" label={item.label || 'Scanning file…'} variant="pulse" />
            </div>
          </div>
        </div>
      </div>
    )
  }
  if (item.phase === 'generating') {
    return (
      <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 shadow-soft">
        <div className="flex items-center gap-3">
          <div className={cn('size-10 rounded-lg grid place-items-center shrink-0', bg, fg)}>
            <Icon className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-medium truncate">{item.name}</div>
            <div className="mt-1">
              <ThinkingState compact size="xs" label="Generating preview…" variant="pulse" />
            </div>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 shadow-soft">
      <div className="flex items-center gap-3">
        <div className={cn('size-10 rounded-lg grid place-items-center shrink-0', bg, fg)}>
          <Icon className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-medium truncate">{item.name}</div>
          <div className="text-[11px] text-muted-foreground">{formatSize(item.size)} · uploading…</div>
          <Progress value={item.progress} className="mt-1.5 h-1" />
          <div className="mt-1.5">
            <ThinkingState compact size="xs" label="Uploading…" variant="trio" theme="primary" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Grid card
// ----------------------------------------------------------------

function FileCard({ file, index }: { file: CRMFile; index: number }) {
  const openDrawer = useAppStore((s) => s.openDrawer)
  const { remove } = useFileMutations()
  const { Icon, bg, fg, label } = fileIconFor(file.mimeType)
  const isImage = file.mimeType.startsWith('image/')

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: Math.min(index * 0.03, 0.3) }}
      className="card-premium bg-card border border-border/60 rounded-xl shadow-soft hover:-translate-y-0.5 hover:shadow-glow transition-all group"
    >
      <button
        onClick={() => openDrawer('file', file.id)}
        className="block w-full text-left"
      >
        {/* Preview / icon area */}
        <div className="relative h-28 rounded-t-xl overflow-hidden bg-muted/40 grid place-items-center">
          {isImage ? (
            <img
              src={file.url}
              alt={file.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                ;(e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          ) : (
            <div className={cn('size-12 rounded-xl grid place-items-center', bg, fg)}>
              <Icon className="size-6" />
            </div>
          )}
          {/* Type badge */}
          <span className="absolute top-2 left-2 inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide rounded bg-background/90 text-muted-foreground border border-border/60">
            {label}
          </span>
          {/* Version badge */}
          {file.version > 1 && (
            <span className="absolute top-2 right-2 inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold rounded bg-primary/15 text-primary">
              v{file.version}
            </span>
          )}
          {/* Hover actions */}
          <div className="absolute inset-0 bg-background/0 group-hover:bg-background/40 transition-colors flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
            <button
              onClick={(e) => {
                e.stopPropagation()
                openDrawer('file', file.id)
              }}
              className="size-7 rounded-md bg-background border border-border/60 grid place-items-center text-foreground hover:bg-muted transition-colors"
              aria-label="Preview"
            >
              <Eye className="size-3.5" />
            </button>
            <a
              href={file.url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="size-7 rounded-md bg-background border border-border/60 grid place-items-center text-foreground hover:bg-muted transition-colors"
              aria-label="Download"
            >
              <Download className="size-3.5" />
            </a>
            <button
              onClick={(e) => {
                e.stopPropagation()
                remove.mutate(file.id, {
                  onSuccess: () => toast.success('File deleted'),
                  onError: () => toast.error('Could not delete file'),
                })
              }}
              className="size-7 rounded-md bg-background border border-border/60 grid place-items-center text-destructive hover:bg-destructive/10 transition-colors"
              aria-label="Delete"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
        {/* Meta */}
        <div className="p-3">
          <div className="text-[12px] font-medium truncate" title={file.name}>
            {file.name}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>{formatSize(file.size)}</span>
            <span>·</span>
            <span>{fileExt(file.name)}</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            {file.uploader ? (
              <Avatar name={file.uploader.name} url={file.uploader.avatarUrl} size={16} />
            ) : (
              <span className="size-4 rounded-full bg-muted" />
            )}
            <span className="text-[10px] text-muted-foreground truncate">
              {file.uploader?.name || 'Unknown'} · {relTime(file.createdAt)}
            </span>
          </div>
        </div>
      </button>
    </motion.div>
  )
}

// ----------------------------------------------------------------
// Grid view
// ----------------------------------------------------------------

function FilesGrid({ files, uploading }: { files: CRMFile[]; uploading: UploadingItem[] }) {
  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
      {uploading.map((u) => (
        <UploadingCard key={u.uid} item={u} />
      ))}
      {files.map((f, i) => (
        <FileCard key={f.id} file={f} index={i} />
      ))}
    </div>
  )
}

// ----------------------------------------------------------------
// List view (TanStack Table)
// ----------------------------------------------------------------

function SortableHeader({ column, children }: { column: any; children: React.ReactNode }) {
  const sorted = column.getIsSorted()
  const Icon = sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ArrowUpDown
  return (
    <button
      className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors text-muted-foreground"
      onClick={() => column.toggleSorting(sorted === 'asc')}
    >
      <span>{children}</span>
      <Icon className={cn('size-3', sorted ? 'text-foreground' : 'opacity-50')} />
    </button>
  )
}

function ActionsCell({ file }: { file: CRMFile }) {
  const openDrawer = useAppStore((s) => s.openDrawer)
  const { remove } = useFileMutations()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7 -mr-1" onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={() => openDrawer('file', file.id)}>
          <Eye className="size-3.5" /> Preview
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={file.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2">
            <Download className="size-3.5" /> Download
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() =>
            remove.mutate(file.id, {
              onSuccess: () => toast.success('File deleted'),
              onError: () => toast.error('Could not delete file'),
            })
          }
        >
          <Trash2 className="size-3.5" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const columns: ColumnDef<CRMFile>[] = [
  {
    accessorKey: 'name',
    header: ({ column }: any) => <SortableHeader column={column}>Name</SortableHeader>,
    cell: ({ row }: any) => {
      const f = row.original as CRMFile
      const { Icon, bg, fg } = fileIconFor(f.mimeType)
      return (
        <div className="flex items-center gap-2.5">
          <div className={cn('size-8 rounded-md grid place-items-center shrink-0', bg, fg)}>
            <Icon className="size-4" />
          </div>
          <span className="text-[12px] font-medium truncate max-w-[260px]">{f.name}</span>
        </div>
      )
    },
  },
  {
    accessorKey: 'size',
    header: ({ column }: any) => <SortableHeader column={column}>Size</SortableHeader>,
    cell: ({ row }: any) => (
      <span className="text-[11px] text-muted-foreground tabular-nums">
        {formatSize((row.original as CRMFile).size)}
      </span>
    ),
  },
  {
    accessorKey: 'mimeType',
    header: 'Type',
    cell: ({ row }: any) => {
      const f = row.original as CRMFile
      const { label } = fileIconFor(f.mimeType)
      return (
        <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
          {label}
        </Badge>
      )
    },
  },
  {
    accessorKey: 'version',
    header: 'Version',
    cell: ({ row }: any) => {
      const v = (row.original as CRMFile).version
      return (
        <span className="text-[11px] tabular-nums">
          {v > 1 ? <Badge variant="outline" className="text-[10px]">v{v}</Badge> : 'v1'}
        </span>
      )
    },
  },
  {
    id: 'uploader',
    accessorFn: (r: CRMFile) => r.uploader?.name || '',
    header: 'Uploader',
    cell: ({ row }: any) => {
      const f = row.original as CRMFile
      return (
        <div className="flex items-center gap-1.5">
          {f.uploader ? (
            <Avatar name={f.uploader.name} url={f.uploader.avatarUrl} size={20} />
          ) : (
            <span className="size-5 rounded-full bg-muted" />
          )}
          <span className="text-[11px] truncate">{f.uploader?.name || '—'}</span>
        </div>
      )
    },
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }: any) => <SortableHeader column={column}>Uploaded</SortableHeader>,
    cell: ({ row }: any) => (
      <span className="text-[11px] text-muted-foreground">
        {relTime((row.original as CRMFile).createdAt)}
      </span>
    ),
  },
  {
    id: 'actions',
    size: 48,
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }: any) => <ActionsCell file={row.original as CRMFile} />,
  },
]

function FilesTable({ files, uploading }: { files: CRMFile[]; uploading: UploadingItem[] }) {
  const openDrawer = useAppStore((s) => s.openDrawer)
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'createdAt', desc: true }])

  const table = useReactTable({
    data: files,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-soft">
      <div className="max-h-[calc(100vh-260px)] overflow-y-auto scroll-area">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent border-border/60">
                {hg.headers.map((h) => (
                  <TableHead
                    key={h.id}
                    style={{ width: h.getSize() !== 150 ? h.getSize() : undefined }}
                    className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground h-9 px-3"
                  >
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {/* In-flight uploads */}
            {uploading.length > 0 && (
              <>
                {uploading.map((u) => (
                  <TableRow key={u.uid} className="hover:bg-transparent border-dashed">
                    <TableCell colSpan={columns.length} className="py-2 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="size-8 rounded-md bg-primary/10 grid place-items-center text-primary shrink-0">
                          <CloudUpload className="size-4 animate-pulse" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-medium truncate">{u.name}</div>
                          {u.phase === 'uploading' && (
                            <Progress value={u.progress} className="mt-1 h-1 max-w-[260px]" />
                          )}
                        </div>
                        {u.phase === 'uploading' ? (
                          <ThinkingState compact size="xs" label="Uploading…" variant="trio" theme="primary" />
                        ) : (
                          <ThinkingState
                            compact
                            size="xs"
                            label={u.phase === 'scanning' ? (u.label || 'Scanning file…') : 'Generating preview…'}
                            variant="pulse"
                          />
                        )}
                        <span className="text-[11px] text-muted-foreground">{formatSize(u.size)}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </>
            )}
            {table.getRowModel().rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="h-32 text-center">
                  <EmptyState
                    icon={<Paperclip className="size-5" />}
                    title="No files match your search"
                    hint="Try a different search query."
                  />
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer border-border/40"
                  onClick={() => openDrawer('file', row.original.id)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-2.5 px-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Drop zone
// ----------------------------------------------------------------

function DropZone({
  hasFiles,
  onFiles,
  onPick,
}: {
  hasFiles: boolean
  onFiles: (files: FileList) => void
  onPick: () => void
}) {
  const [dragging, setDragging] = React.useState(false)

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files)
      }}
      onClick={onPick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onPick()
        }
      }}
      className={cn(
        'rounded-xl border-2 border-dashed p-4 text-center transition-all cursor-pointer',
        dragging
          ? 'border-primary bg-primary/10'
          : 'border-border/70 bg-card hover:border-primary/50 hover:bg-primary/5',
        hasFiles ? 'mb-4' : 'mb-4 py-8',
      )}
    >
      <div className={cn('inline-flex items-center justify-center size-10 rounded-xl mb-2 transition-colors',
        dragging ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>
        <CloudUpload className={cn('size-5', dragging && 'animate-pulse')} />
      </div>
      <div className="text-[13px] font-medium">
        {dragging ? 'Drop to upload' : 'Drag files here or click to upload'}
      </div>
      <div className="text-[11px] text-muted-foreground mt-0.5">
        Images, PDFs, documents, videos — anything up to a few MB.
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Loading skeleton
// ----------------------------------------------------------------

function FilesSkeleton({ view }: { view: 'grid' | 'list' }) {
  if (view === 'list') {
    return (
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-soft">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-3 border-b border-border/40">
            <Skeleton className="size-8 rounded-md" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-40 rounded" />
              <Skeleton className="h-2.5 w-24 rounded" />
            </div>
            <Skeleton className="h-3 w-12 rounded" />
            <Skeleton className="size-5 rounded-full" />
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="size-7 rounded" />
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-soft">
          <Skeleton className="h-28 w-full" />
          <div className="p-3 space-y-2">
            <Skeleton className="h-3 w-3/4 rounded" />
            <Skeleton className="h-2.5 w-1/2 rounded" />
            <div className="flex items-center gap-1.5 pt-1">
              <Skeleton className="size-4 rounded-full" />
              <Skeleton className="h-2 w-16 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ----------------------------------------------------------------
// Header strip
// ----------------------------------------------------------------

function HeaderStrip({
  count,
  q,
  setQ,
  view,
  setView,
  onPick,
}: {
  count: number
  q: string
  setQ: (v: string) => void
  view: 'grid' | 'list'
  setView: (v: 'grid' | 'list') => void
  onPick: () => void
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
      <div className="flex items-center gap-2">
        <h1 className="text-[18px] font-semibold tracking-tight">Files</h1>
        <Badge variant="secondary" className="tabular-nums text-[11px]">{count}</Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search files…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-8 h-9 w-full md:w-[220px] text-[13px]"
          />
        </div>
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => {
            if (v === 'grid' || v === 'list') setView(v)
          }}
          variant="outline"
          className="h-9"
        >
          <ToggleGroupItem value="grid" aria-label="Grid view" className="px-2.5">
            <LayoutGrid className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="List view" className="px-2.5">
            <ListIcon className="size-4" />
          </ToggleGroupItem>
        </ToggleGroup>
        <Button size="default" className="h-9" onClick={onPick}>
          <Upload className="size-4" /> Upload
        </Button>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Main view
// ----------------------------------------------------------------

export function FilesView() {
  const user = useAppStore((s) => s.user)
  const workspace = useAppStore((s) => s.workspace)
  const { data: files = [], isLoading } = useFiles()
  const { create } = useFileMutations()

  const [q, setQ] = React.useState('')
  const [view, setView] = React.useState<'grid' | 'list'>('grid')
  const [uploading, setUploading] = React.useState<UploadingItem[]>([])
  const inputRef = React.useRef<HTMLInputElement | null>(null)

  const debouncedQ = useDebounced(q, 300)

  // Hide files that are currently in the "generating preview" phase so the
  // thinking indicator shows in place of the card for ~500ms before the card appears.
  const hiddenFileIds = React.useMemo(
    () =>
      uploading
        .filter((u) => u.phase === 'generating' && u.fileId)
        .map((u) => u.fileId as string),
    [uploading],
  )

  const filtered = React.useMemo(() => {
    const base = hiddenFileIds.length
      ? files.filter((f) => !hiddenFileIds.includes(f.id))
      : files
    if (!debouncedQ.trim()) return base
    const needle = debouncedQ.toLowerCase()
    return base.filter(
      (f) =>
        f.name.toLowerCase().includes(needle) ||
        f.mimeType.toLowerCase().includes(needle),
    )
  }, [files, hiddenFileIds, debouncedQ])

  const startUpload = React.useCallback(
    (file: File) => {
      if (!workspace?.id || !user?.id) {
        toast.error('Workspace or user not available')
        return
      }
      const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const item: UploadingItem = {
        uid,
        name: file.name,
        size: file.size,
        progress: 0,
        phase: 'uploading',
      }
      setUploading((prev) => [...prev, item])

      // Mock progress animation: 0 → 100 over ~1.5s
      const start = Date.now()
      const duration = 1500
      const tick = () => {
        const elapsed = Date.now() - start
        const pct = Math.min(100, Math.round((elapsed / duration) * 100))
        setUploading((prev) =>
          prev.map((u) => (u.uid === uid ? { ...u, progress: pct } : u)),
        )
        if (pct < 100) {
          requestAnimationFrame(tick)
        } else {
          // Transition to scanning phase — brief AI thinking with rotating labels
          setUploading((prev) =>
            prev.map((u) =>
              u.uid === uid ? { ...u, phase: 'scanning', label: 'Scanning file…' } : u,
            ),
          )
          simulateAIThinking('upload', {
            duration: 400,
            onLabel: (l) => {
              setUploading((prev) =>
                prev.map((u) => (u.uid === uid ? { ...u, label: l } : u)),
              )
            },
          }).then(() => {
            // Create the file record
            create.mutate(
              {
                workspaceId: workspace.id,
                uploaderId: user.id,
                name: file.name,
                mimeType: file.type || 'application/octet-stream',
                size: file.size,
                url: `https://files.pulsecrm.app/${Date.now()}-${encodeURIComponent(file.name)}`,
                version: 1,
              } as Partial<CRMFile>,
              {
                onSuccess: (data) => {
                  const fileId = (data as { id?: string } | undefined)?.id
                  // Transition to generating-preview phase
                  setUploading((prev) =>
                    prev.map((u) =>
                      u.uid === uid
                        ? { ...u, phase: 'generating', label: 'Generating preview…', fileId }
                        : u,
                    ),
                  )
                  setTimeout(() => {
                    setUploading((prev) => prev.filter((u) => u.uid !== uid))
                    toast.success(`Uploaded ${file.name}`)
                  }, 500)
                },
                onError: () => {
                  setUploading((prev) => prev.filter((u) => u.uid !== uid))
                  toast.error(`Upload failed for ${file.name}`)
                },
              },
            )
          })
        }
      }
      requestAnimationFrame(tick)
    },
    [workspace, user, create],
  )

  const handleFiles = React.useCallback(
    (list: FileList) => {
      Array.from(list).forEach(startUpload)
    },
    [startUpload],
  )

  const handlePick = React.useCallback(() => {
    inputRef.current?.click()
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) handleFiles(e.target.files)
    e.target.value = ''
  }

  return (
    <div className="p-4 md:p-6 view-enter">
      <HeaderStrip
        count={filtered.length}
        q={q}
        setQ={setQ}
        view={view}
        setView={setView}
        onPick={handlePick}
      />

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleInputChange}
      />

      <DropZone
        hasFiles={files.length > 0 || uploading.length > 0}
        onFiles={handleFiles}
        onPick={handlePick}
      />

      {isLoading ? (
        <FilesSkeleton view={view} />
      ) : filtered.length === 0 && uploading.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card shadow-soft">
          <EmptyState
            icon={<Paperclip className="size-5" />}
            title={debouncedQ ? 'No files match your search' : 'No files yet'}
            hint={
              debouncedQ
                ? 'Try a different search query.'
                : 'Drag files into the drop zone above or click Upload to attach contracts, headshots, or any document.'
            }
            action={
              !debouncedQ ? (
                <Button onClick={handlePick}>
                  <Upload className="size-4" /> Upload your first file
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : view === 'grid' ? (
        <FilesGrid files={filtered} uploading={uploading} />
      ) : (
        <FilesTable files={filtered} uploading={uploading} />
      )}
    </div>
  )
}
