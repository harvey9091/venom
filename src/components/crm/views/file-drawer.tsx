'use client'

/**
 * Pulse CRM — FileDrawer
 *
 * Rendered inside the global Sheet slide-over. Layout:
 *
 *   ┌─ Header ──────────────────────────────────────────────────┐
 *   │  File name (large) · type badge · close X                   │
 *   ├─ Body ──────────────────────────────────────────┬─ Sidebar ─┤
 *   │  Preview area (img / iframe / video / audio /     │ Metadata:  │
 *   │    large file icon + "Preview not available")     │ • name     │
 *   │                                                   │ • type     │
 *   │                                                   │ • size     │
 *   │                                                   │ • version  │
 *   │                                                   │ • uploader │
 *   │                                                   │ • uploaded │
 *   │                                                   │ • linked   │
 *   │                                                   │   lead     │
 *   │                                                   │ • URL      │
 *   │                                                   │            │
 *   │                                                   │ Version    │
 *   │                                                   │ history:   │
 *   │                                                   │  v1…vN     │
 *   ├─ Footer ──────────────────────────────────────────────────┤
 *   │  Download (ghost) · Delete (destructive)                     │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * Note: there is no `mode="create"` here — files are created via
 * upload from within the FilesView. The drawer is edit-only.
 */

import * as React from 'react'
import { motion } from 'framer-motion'
import { useFiles, useFileMutations, useLeads } from '@/lib/hooks'
import { useAppStore } from '@/lib/store'
import { Avatar, relTime } from '@/components/crm/shared'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { CRMFile } from '@/lib/types'
import {
  Trash2,
  Download,
  Copy,
  Check,
  History,
  Upload,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  File as FileIcon,
  FileSpreadsheet,
  Presentation,
  Paperclip,
  Link2,
  Eye,
} from 'lucide-react'

// ----------------------------------------------------------------
// Helpers (mirror of files.tsx — kept local to avoid cross-view deps)
// ----------------------------------------------------------------

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
  if (m.includes('word') || m.includes('document') || m === 'application/msword') {
    return { Icon: FileText, bg: 'bg-blue-500/15', fg: 'text-blue-600 dark:text-blue-300', label: 'Doc' }
  }
  if (m.startsWith('text/')) {
    return { Icon: FileText, bg: 'bg-slate-500/15', fg: 'text-slate-600 dark:text-slate-300', label: 'Text' }
  }
  return { Icon: FileIcon, bg: 'bg-slate-500/15', fg: 'text-slate-600 dark:text-slate-300', label: 'File' }
}

// ----------------------------------------------------------------
// Preview area
// ----------------------------------------------------------------

function FilePreview({ file }: { file: CRMFile }) {
  const mime = (file.mimeType || '').toLowerCase()
  const { Icon, bg, fg, label } = fileIconFor(file.mimeType)

  // Image
  if (mime.startsWith('image/')) {
    return (
      <div className="rounded-xl overflow-hidden border border-border/60 bg-muted/40 grid place-items-center p-2">
        <img
          src={file.url}
          alt={file.name}
          className="max-h-[420px] w-auto max-w-full object-contain rounded-lg"
          onError={(e) => {
            const t = e.target as HTMLImageElement
            t.style.display = 'none'
            const fallback = t.nextElementSibling as HTMLElement | null
            if (fallback) fallback.style.display = 'flex'
          }}
        />
        <div
          style={{ display: 'none' }}
          className="flex-col items-center justify-center gap-2 py-16 text-muted-foreground"
        >
          <div className={cn('size-14 rounded-xl grid place-items-center', bg, fg)}>
            <Icon className="size-7" />
          </div>
          <div className="text-[12px]">Preview not available</div>
        </div>
      </div>
    )
  }

  // PDF
  if (mime === 'application/pdf' || mime.endsWith('pdf')) {
    return (
      <div className="rounded-xl overflow-hidden border border-border/60 bg-muted/40">
        <iframe
          src={file.url}
          title={file.name}
          className="w-full h-[480px] bg-white"
          sandbox=""
        />
        <div className="px-3 py-2 text-[11px] text-muted-foreground flex items-center justify-between border-t border-border/60">
          <span className="inline-flex items-center gap-1.5">
            <FileText className="size-3.5" /> PDF preview
          </span>
          <a
            href={file.url}
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
          >
            Open in new tab
          </a>
        </div>
      </div>
    )
  }

  // Video
  if (mime.startsWith('video/')) {
    return (
      <div className="rounded-xl overflow-hidden border border-border/60 bg-black">
        <video controls className="w-full max-h-[480px]">
          <source src={file.url} type={file.mimeType} />
        </video>
      </div>
    )
  }

  // Audio
  if (mime.startsWith('audio/')) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-6 space-y-4">
        <div className={cn('size-16 mx-auto rounded-2xl grid place-items-center', bg, fg)}>
          <Music className="size-8" />
        </div>
        <div className="text-center text-[12px] font-medium truncate">{file.name}</div>
        <audio controls className="w-full">
          <source src={file.url} type={file.mimeType} />
        </audio>
      </div>
    )
  }

  // Other
  return (
    <div className="rounded-xl border border-border/60 bg-card p-8 flex flex-col items-center justify-center text-center gap-3">
      <div className={cn('size-20 rounded-2xl grid place-items-center', bg, fg)}>
        <Icon className="size-10" />
      </div>
      <div className="text-[14px] font-medium">{label} preview not available</div>
      <div className="text-[12px] text-muted-foreground max-w-sm">
        We can&apos;t render this file inline. Download it to view in its native application.
      </div>
      <a href={file.url} target="_blank" rel="noreferrer">
        <Button variant="outline" size="sm">
          <Download className="size-3.5" /> Download file
        </Button>
      </a>
    </div>
  )
}

// ----------------------------------------------------------------
// Metadata row
// ----------------------------------------------------------------

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-[11px] text-muted-foreground uppercase tracking-wide shrink-0 pt-0.5">
        {label}
      </span>
      <span className="text-[12px] font-medium text-right break-all min-w-0">{children}</span>
    </div>
  )
}

// ----------------------------------------------------------------
// Copyable URL field
// ----------------------------------------------------------------

function CopyableUrl({ url }: { url: string }) {
  const [copied, setCopied] = React.useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('URL copied')
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Could not copy URL')
    }
  }
  return (
    <div className="flex items-center gap-1 rounded-md border border-border/60 bg-background/60 px-2 py-1">
      <input
        readOnly
        value={url}
        className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[11px] text-muted-foreground truncate"
        onFocus={(e) => e.currentTarget.select()}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-6 shrink-0"
        onClick={handleCopy}
        aria-label="Copy URL"
      >
        {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
      </Button>
    </div>
  )
}

// ----------------------------------------------------------------
// Version history
// ----------------------------------------------------------------

interface VersionEntry {
  version: number
  date: string
  current: boolean
}

function VersionHistory({ file }: { file: CRMFile }) {
  const { create } = useFileMutations()
  const workspace = useAppStore((s) => s.workspace)
  const user = useAppStore((s) => s.user)
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = React.useState(false)
  const [progress, setProgress] = React.useState(0)

  // Mock version history: build a list v1..vCurrent using createdAt
  const history: VersionEntry[] = React.useMemo(() => {
    const created = new Date(file.createdAt)
    const out: VersionEntry[] = []
    for (let v = 1; v <= file.version; v++) {
      const offsetDays = (file.version - v) * 3
      const d = new Date(created.getTime() - offsetDays * 86400_000)
      out.push({ version: v, date: d.toISOString(), current: v === file.version })
    }
    return out.reverse()
  }, [file.version, file.createdAt])

  const handleUploadNewVersion = () => inputRef.current?.click()

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!workspace?.id || !user?.id) {
      toast.error('Workspace or user not available')
      e.target.value = ''
      return
    }
    setUploading(true)
    setProgress(0)
    const start = Date.now()
    const duration = 1500
    const tick = () => {
      const elapsed = Date.now() - start
      const pct = Math.min(100, Math.round((elapsed / duration) * 100))
      setProgress(pct)
      if (pct < 100) requestAnimationFrame(tick)
      else {
        create.mutate(
          {
            workspaceId: workspace.id,
            uploaderId: user.id,
            leadId: file.leadId,
            name: f.name,
            mimeType: f.type || 'application/octet-stream',
            size: f.size,
            url: `https://files.pulsecrm.app/${Date.now()}-${encodeURIComponent(f.name)}`,
            version: file.version + 1,
          } as Partial<CRMFile>,
          {
            onSuccess: () => {
              setUploading(false)
              toast.success(`Uploaded new version of ${f.name}`)
            },
            onError: () => {
              setUploading(false)
              toast.error('Upload failed')
            },
          },
        )
      }
    }
    requestAnimationFrame(tick)
    e.target.value = ''
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
          <History className="size-3" /> Version history
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-[11px] px-2" onClick={handleUploadNewVersion}>
          <Upload className="size-3" /> New version
        </Button>
        <input ref={inputRef} type="file" className="hidden" onChange={handleFile} />
      </div>
      {uploading ? (
        <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-2.5">
          <div className="text-[11px] text-muted-foreground mb-1.5">Uploading new version…</div>
          <div className="h-1.5 rounded-full bg-primary/20 overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : null}
      <ol className="space-y-1 max-h-[180px] overflow-y-auto scroll-area">
        {history.map((h) => (
          <li
            key={h.version}
            className={cn(
              'flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-[11px] border',
              h.current
                ? 'border-primary/30 bg-primary/5 text-foreground'
                : 'border-transparent hover:bg-muted/60 text-muted-foreground',
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              <span
                className={cn(
                  'size-1.5 rounded-full',
                  h.current ? 'bg-primary' : 'bg-muted-foreground/50',
                )}
              />
              <span className="font-medium">v{h.version}</span>
              {h.current && (
                <Badge variant="secondary" className="text-[9px] uppercase tracking-wide py-0 px-1">
                  Current
                </Badge>
              )}
            </span>
            <span className="text-[10px] text-muted-foreground">{relTime(h.date)}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

// ----------------------------------------------------------------
// Sidebar
// ----------------------------------------------------------------

function FileSidebar({ file }: { file: CRMFile }) {
  const openDrawer = useAppStore((s) => s.openDrawer)
  const { data: leads = [] } = useLeads()
  const linkedLead = file.leadId ? leads.find((l) => l.id === file.leadId) : undefined
  const { Icon, label } = fileIconFor(file.mimeType)

  return (
    <aside className="w-full md:w-[240px] shrink-0 border-t md:border-t-0 md:border-l border-border/60 bg-muted/20 p-4 space-y-4">
      {/* Metadata */}
      <div className="space-y-0.5">
        <MetaRow label="Name">
          <span className="break-all" title={file.name}>{file.name}</span>
        </MetaRow>
        <MetaRow label="Type">
          <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
            {label}
          </Badge>
        </MetaRow>
        <MetaRow label="MIME">
          <span className="font-mono text-[11px] text-muted-foreground">{file.mimeType || '—'}</span>
        </MetaRow>
        <MetaRow label="Size">{formatSize(file.size)}</MetaRow>
        <MetaRow label="Version">v{file.version}</MetaRow>
      </div>

      <Separator />

      {/* Uploader */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Uploaded by
        </div>
        <div className="flex items-center gap-2">
          {file.uploader ? (
            <Avatar name={file.uploader.name} url={file.uploader.avatarUrl} size={22} />
          ) : (
            <span className="size-[22px] rounded-full bg-muted grid place-items-center">
              <Icon className="size-3 text-muted-foreground" />
            </span>
          )}
          <div className="min-w-0">
            <div className="text-[12px] font-medium truncate">
              {file.uploader?.name || 'Unknown'}
            </div>
            <div className="text-[10px] text-muted-foreground">{relTime(file.createdAt)}</div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Linked lead */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Linked lead
        </div>
        {linkedLead ? (
          <button
            onClick={() => openDrawer('lead', linkedLead.id)}
            className="w-full inline-flex items-center gap-2 px-2 py-1.5 rounded-md bg-primary/8 hover:bg-primary/12 transition-colors text-left"
          >
            <Link2 className="size-3 text-primary shrink-0" />
            <span className="text-[12px] font-medium truncate flex-1">{linkedLead.fullName}</span>
            <Eye className="size-3 text-muted-foreground" />
          </button>
        ) : (
          <div className="text-[11px] text-muted-foreground italic">Not linked to a lead.</div>
        )}
      </div>

      <Separator />

      {/* URL */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          URL
        </div>
        <CopyableUrl url={file.url} />
      </div>

      <Separator />

      {/* Version history */}
      <VersionHistory file={file} />
    </aside>
  )
}

// ----------------------------------------------------------------
// Main drawer
// ----------------------------------------------------------------

export function FileDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: files = [], isLoading } = useFiles()
  const file = files.find((f) => f.id === id)
  const { remove } = useFileMutations()

  const handleDelete = React.useCallback(() => {
    if (!file) return
    remove.mutate(file.id, {
      onSuccess: () => {
        toast.success('File deleted')
        onClose()
      },
      onError: () => toast.error('Could not delete file'),
    })
  }, [file, remove, onClose])

  // Loading
  if (isLoading && !file) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-6 w-2/3 rounded" />
        <Skeleton className="h-[300px] w-full rounded-lg" />
        <div className="flex justify-end gap-2">
          <Skeleton className="h-9 w-20 rounded" />
          <Skeleton className="h-9 w-20 rounded" />
        </div>
      </div>
    )
  }

  // Not found
  if (!file) {
    return (
      <div className="p-6">
        <div className="text-[14px] font-semibold">File not found</div>
        <div className="text-[12px] text-muted-foreground mt-1">
          This file may have been deleted.
        </div>
        <Button variant="outline" className="mt-4" onClick={onClose}>Close</Button>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18 }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border/60 bg-background pr-12">
        <div className="flex items-start gap-3">
          <div className={cn('size-10 rounded-xl grid place-items-center shrink-0', fileIconFor(file.mimeType).bg, fileIconFor(file.mimeType).fg)}>
            <Paperclip className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold tracking-tight truncate" title={file.name}>
              {file.name}
            </div>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                {fileIconFor(file.mimeType).label}
              </Badge>
              <span className="text-[11px] text-muted-foreground">{formatSize(file.size)}</span>
              {file.version > 1 && (
                <Badge variant="outline" className="text-[10px]">v{file.version}</Badge>
              )}
              <span className="text-[11px] text-muted-foreground">
                · {relTime(file.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        <div className="flex-1 min-w-0 p-5">
          <FilePreview file={file} />
        </div>
        <FileSidebar file={file} />
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t border-border p-4 flex items-center justify-between gap-2">
        <a href={file.url} target="_blank" rel="noreferrer">
          <Button variant="ghost">
            <Download className="size-4" /> Download
          </Button>
        </a>
        <Button
          variant="ghost"
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleDelete}
          disabled={remove.isPending}
        >
          <Trash2 className="size-4" /> Delete
        </Button>
      </div>
    </motion.div>
  )
}
