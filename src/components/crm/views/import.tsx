'use client'

/**
 * Pulse CRM — CSV Import view
 *
 * A premium 4-step wizard (Linear / Stripe import flow inspired):
 *   1. Upload        — drag-and-drop, file picker, or paste CSV; download template
 *   2. Map Columns   — entity-type selector, auto-matched column → field mapping, owner
 *   3. Review        — summary cards, duplicate-handling options, final import button
 *   4. Done & History— success state + import-history table with undo
 *
 * API contract (see /api/crm/import/route.ts):
 *   POST ?action=preview  { action:'preview',  csv }                  → { headers, rows[≤50], totalRows }
 *   POST ?action=import   { action:'import', workspaceId, rows, mapping, entityType, ownerId } → { imported, duplicates, total }
 *   GET  ?action=history&workspaceId=…                                 → AuditLog[]   (meta is a JSON string)
 *   POST ?action=undo     { action:'undo', auditLogId }                → { undone: true }
 */

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '@/lib/store'
import { useSettings } from '@/lib/hooks'
import { Avatar, relTime, EmptyState } from '@/components/crm/shared'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { Membership, AuditLog } from '@/lib/types'
import {
  Upload,
  FileText,
  ClipboardPaste,
  Download,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  AlertCircle,
  FileUp,
  RotateCcw,
  UserPlus,
  Users,
  Building2,
  Loader2,
  Info,
  History,
  Undo2,
  X,
  Sparkles,
  FileSpreadsheet,
} from 'lucide-react'

// ---------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------

type EntityType = 'lead' | 'contact' | 'company'
type Step = 1 | 2 | 3 | 4

interface FieldDef {
  key: string
  label: string
  required?: boolean
  /** the single hard-required field used for step validation */
  primary?: boolean
}

const FIELD_DEFS: Record<EntityType, FieldDef[]> = {
  lead: [
    { key: 'fullName', label: 'Full Name', required: true, primary: true },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'source', label: 'Source' },
    { key: 'score', label: 'Score' },
    // NOTE: backend reads `mapping.value` for estimated value (not `estimatedValue`)
    { key: 'value', label: 'Estimated Value' },
  ],
  contact: [
    { key: 'firstName', label: 'First Name', required: true, primary: true },
    { key: 'lastName', label: 'Last Name', required: true },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'jobTitle', label: 'Job Title' },
  ],
  company: [
    { key: 'name', label: 'Name', required: true, primary: true },
    { key: 'domain', label: 'Domain' },
    { key: 'industry', label: 'Industry' },
    { key: 'website', label: 'Website' },
  ],
}

const ENTITY_META: Record<
  EntityType,
  { label: string; singular: string; icon: React.ComponentType<{ size?: number; className?: string }> }
> = {
  lead: { label: 'Leads', singular: 'Lead', icon: UserPlus },
  contact: { label: 'Contacts', singular: 'Contact', icon: Users },
  company: { label: 'Companies', singular: 'Company', icon: Building2 },
}

const SKIP = '__skip__'

const TEMPLATE_CSV =
  'fullName,email,phone,source,score,estimatedValue\n' +
  'Alice Johnson,alice@acme.io,+1-555-0100,Website,82,12500\n' +
  'Bob Smith,bob@beta.dev,+1-555-0101,Referral,65,8200\n' +
  'Carol Lee,carol@gamma.co,+1-555-0102,Cold Email,47,5400\n'

const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: 'Upload' },
  { n: 2, label: 'Map Columns' },
  { n: 3, label: 'Review' },
  { n: 4, label: 'Done' },
]

// ---------------------------------------------------------------
// CSV parsing (client-side mirror of the backend parser so we can
// import the full file even when the preview sliced to 50 rows)
// ---------------------------------------------------------------
function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim())
  if (!lines.length) return { headers: [], rows: [] }
  const parseLine = (line: string): string[] => {
    const out: string[] = []
    let cur = ''
    let inQuote = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') {
        if (inQuote && line[i + 1] === '"') {
          cur += '"'
          i++
        } else inQuote = !inQuote
      } else if (c === ',' && !inQuote) {
        out.push(cur)
        cur = ''
      } else cur += c
    }
    out.push(cur)
    return out
  }
  const headers = parseLine(lines[0]).map((h) => h.trim())
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = (cells[idx] || '').trim()
    })
    rows.push(row)
  }
  return { headers, rows }
}

/** Build a { csvHeader → targetKey } map by matching header names to field labels/keys. */
function autoMatch(
  csvHeaders: string[],
  fields: FieldDef[],
): Record<string, string> {
  const mapping: Record<string, string> = {}
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const used = new Set<string>()
  // Pass 1 — exact normalized match (key or label)
  for (const h of csvHeaders) {
    const nh = norm(h)
    const m = fields.find(
      (f) => !used.has(f.key) && (norm(f.key) === nh || norm(f.label) === nh),
    )
    if (m) {
      mapping[h] = m.key
      used.add(m.key)
    }
  }
  // Pass 2 — includes fallback (e.g. "Email Address" → "email")
  for (const h of csvHeaders) {
    if (mapping[h]) continue
    const nh = norm(h)
    const m = fields.find(
      (f) =>
        !used.has(f.key) &&
        nh.length > 2 &&
        (nh.includes(norm(f.key)) || norm(f.key).includes(nh)),
    )
    if (m) {
      mapping[h] = m.key
      used.add(m.key)
    }
  }
  return mapping
}

/** Invert UI mapping { csvHeader → targetKey } to backend payload { targetKey → csvHeader }. */
function invertMapping(ui: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [csvHeader, targetKey] of Object.entries(ui)) {
    if (targetKey && targetKey !== SKIP) out[targetKey] = csvHeader
  }
  return out
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

// ---------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------
function StepIndicator({ step }: { step: Step }) {
  return (
    <div className="flex items-center w-full max-w-xl mx-auto select-none">
      {STEPS.map((s, i) => {
        const done = step > s.n
        const current = step === s.n
        return (
          <React.Fragment key={s.n}>
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div
                className={cn(
                  'w-9 h-9 rounded-full grid place-items-center text-[13px] font-semibold transition-all duration-300',
                  done && 'bg-primary text-primary-foreground shadow-soft',
                  current &&
                    'bg-primary text-primary-foreground ring-4 ring-primary/20 shadow-glow scale-105',
                  !done && !current && 'bg-muted text-muted-foreground border border-border',
                )}
              >
                {done ? <Check size={16} strokeWidth={3} /> : s.n}
              </div>
              <span
                className={cn(
                  'text-[11px] font-medium transition-colors',
                  (done || current) ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  'flex-1 h-0.5 mx-2 mb-5 rounded-full transition-colors duration-300',
                  step > s.n ? 'bg-primary' : 'bg-border',
                )}
              />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------
// Step 1 — Upload
// ---------------------------------------------------------------
function UploadStep({
  csv,
  setCsv,
  fileName,
  setFileName,
  onContinue,
  isPending,
}: {
  csv: string
  setCsv: (v: string) => void
  fileName: string
  setFileName: (v: string) => void
  onContinue: () => void
  isPending: boolean
}) {
  const [pasteMode, setPasteMode] = React.useState(false)
  const [pasteText, setPasteText] = React.useState('')
  const [dragging, setDragging] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const fileSize = csv ? new Blob([csv]).size : 0

  const readFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      toast.error('Please select a .csv file')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result || '')
      setCsv(text)
      setFileName(file.name)
      setPasteText('')
    }
    reader.onerror = () => toast.error('Could not read file')
    reader.readAsText(file)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) readFile(file)
  }

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'pulse-leads-template.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Template downloaded')
  }

  const handlePasteContinue = () => {
    if (!pasteText.trim()) {
      toast.error('Paste some CSV content first')
      return
    }
    setCsv(pasteText)
    setFileName('pasted.csv')
    onContinue()
  }

  return (
    <div className="max-w-3xl mx-auto w-full">
      <div className="text-center mb-6">
        <h2 className="text-lg font-semibold">Upload your CSV</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Drag a file, browse, or paste CSV content. We&apos;ll preview the first rows for mapping.
        </p>
      </div>

      {!pasteMode ? (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              inputRef.current?.click()
            }
          }}
          role="button"
          tabIndex={0}
          className={cn(
            'card-premium relative rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-all duration-200',
            dragging
              ? 'border-primary bg-primary/5 scale-[1.01] shadow-glow'
              : 'border-border hover:border-primary/40 hover:bg-muted/30',
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) readFile(f)
              e.target.value = ''
            }}
          />
          <div
            className={cn(
              'w-16 h-16 mx-auto rounded-2xl grid place-items-center mb-4 transition-all',
              dragging ? 'bg-primary text-primary-foreground scale-110' : 'bg-primary/10 text-primary',
            )}
          >
            <Upload size={28} />
          </div>
          <div className="text-[15px] font-medium">
            {dragging ? 'Drop to upload' : 'Drag your CSV file here, or click to browse'}
          </div>
          <div className="text-xs text-muted-foreground mt-1.5">
            .csv files only — up to a few MB
          </div>

          {fileName && csv && (
            <div className="mt-5 inline-flex items-center gap-3 px-4 py-2.5 rounded-xl bg-background border border-border shadow-soft max-w-full">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 grid place-items-center shrink-0">
                <FileSpreadsheet size={18} />
              </div>
              <div className="text-left min-w-0">
                <div className="text-[13px] font-medium truncate max-w-[220px]">{fileName}</div>
                <div className="text-[11px] text-muted-foreground tabular-nums">
                  {formatBytes(fileSize)} · {csv.split('\n').filter((l) => l.trim()).length - 1} rows
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setCsv('')
                  setFileName('')
                }}
                className="ml-1 p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      ) : (
        <Card className="card-premium p-5 shadow-soft">
          <Label className="text-[13px] font-medium">Paste CSV content</Label>
          <Textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={'fullName,email,phone,source\nAlice,alice@acme.io,+1-555-0100,Website'}
            className="mt-2 min-h-[200px] font-mono text-[12px] resize-y scroll-area"
          />
          <div className="flex items-center justify-between mt-3">
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {pasteText ? `${pasteText.split('\n').filter((l) => l.trim()).length} lines` : 'Empty'}
            </span>
            <Button size="sm" variant="outline" onClick={handlePasteContinue} disabled={!pasteText.trim()}>
              Use pasted CSV
              <ArrowRight size={14} />
            </Button>
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between mt-5">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setPasteMode((v) => !v)
              setCsv('')
              setFileName('')
            }}
          >
            {pasteMode ? (
              <>
                <FileUp size={14} />
                Upload a file
              </>
            ) : (
              <>
                <ClipboardPaste size={14} />
                Paste CSV
              </>
            )}
          </Button>
          <Button variant="ghost" size="sm" onClick={downloadTemplate}>
            <Download size={14} />
            Download template
          </Button>
        </div>
        <Button onClick={onContinue} disabled={!csv.trim() || isPending}>
          {isPending ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Parsing…
            </>
          ) : (
            <>
              Continue
              <ArrowRight size={14} />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------
// Step 2 — Map Columns
// ---------------------------------------------------------------
function MapColumnsStep({
  entityType,
  setEntityType,
  headers,
  previewRows,
  totalRows,
  mapping,
  setMapping,
  ownerId,
  setOwnerId,
  onBack,
  onContinue,
  members,
}: {
  entityType: EntityType
  setEntityType: (t: EntityType) => void
  headers: string[]
  previewRows: Record<string, string>[]
  totalRows: number
  mapping: Record<string, string>
  setMapping: (m: Record<string, string>) => void
  ownerId: string
  setOwnerId: (id: string) => void
  onBack: () => void
  onContinue: () => void
  members: Membership[]
}) {
  const fields = FIELD_DEFS[entityType]
  const primaryField = fields.find((f) => f.primary)
  const primaryMapped = primaryField
    ? Object.values(mapping).includes(primaryField.key)
    : true

  // Re-run auto-match when entity type changes
  React.useEffect(() => {
    setMapping(autoMatch(headers, fields))
  }, [entityType])

  const setHeaderMapping = (header: string, target: string) => {
    setMapping({ ...mapping, [header]: target })
  }

  return (
    <div className="max-w-5xl mx-auto w-full">
      <div className="mb-5">
        <h2 className="text-lg font-semibold">Map your columns</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Match each CSV column to a target field. Required fields are marked with{' '}
          <span className="text-rose-500 font-medium">*</span>.
        </p>
      </div>

      {/* Entity type selector */}
      <div className="card-premium rounded-xl border bg-card p-4 mb-5 shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
          <div className="flex items-center gap-2 shrink-0">
            <Label className="text-[13px] font-medium whitespace-nowrap">Import as</Label>
          </div>
          <ToggleGroup
            type="single"
            value={entityType}
            onValueChange={(v) => v && setEntityType(v as EntityType)}
            variant="outline"
            className="flex-wrap"
          >
            {(Object.keys(ENTITY_META) as EntityType[]).map((t) => {
              const Icon = ENTITY_META[t].icon
              return (
                <ToggleGroupItem
                  key={t}
                  value={t}
                  className="gap-1.5 px-3 py-1.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  <Icon size={14} />
                  <span className="text-[12px] font-medium">{ENTITY_META[t].label}</span>
                </ToggleGroupItem>
              )
            })}
          </ToggleGroup>
          <div className="flex-1" />
          <Badge variant="secondary" className="tabular-nums">
            {totalRows} rows
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
        {/* Mapping table */}
        <Card className="card-premium shadow-soft overflow-hidden p-0">
          <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={15} className="text-muted-foreground" />
              <span className="text-[13px] font-semibold">Column mapping</span>
            </div>
            <span className="text-[11px] text-muted-foreground">{headers.length} columns</span>
          </div>
          <div className="max-h-[420px] overflow-y-auto scroll-area">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="text-[11px] uppercase tracking-wide">CSV column</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">Target field</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {headers.map((h) => {
                  const target = mapping[h] || SKIP
                  const isMapped = target !== SKIP
                  return (
                    <TableRow key={h} className="hover:bg-muted/40">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'w-1.5 h-1.5 rounded-full shrink-0',
                              isMapped ? 'bg-emerald-500' : 'bg-muted-foreground/40',
                            )}
                          />
                          <span className="truncate">{h}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select value={target} onValueChange={(v) => setHeaderMapping(h, v)}>
                          <SelectTrigger
                            size="sm"
                            className={cn(
                              'h-8 w-full min-w-[160px]',
                              !isMapped && 'text-muted-foreground',
                            )}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SKIP} className="text-muted-foreground">
                              (Skip)
                            </SelectItem>
                            {fields.map((f) => (
                              <SelectItem key={f.key} value={f.key}>
                                {f.label}
                                {f.required && <span className="text-rose-500 ml-0.5">*</span>}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Side: preview + owner */}
        <div className="space-y-4">
          {entityType !== 'company' && (
            <Card className="card-premium p-4 shadow-soft">
              <Label className="text-[12px] font-medium">Owner</Label>
              <p className="text-[11px] text-muted-foreground mt-0.5 mb-2">
                Assign imported {ENTITY_META[entityType].label.toLowerCase()} to a teammate.
              </p>
              <Select value={ownerId || '__none__'} onValueChange={(v) => setOwnerId(v === '__none__' ? '' : v)}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue placeholder="No owner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" className="text-muted-foreground">
                    No owner
                  </SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      <span className="flex items-center gap-2">
                        {m.user?.name || m.user?.email || 'Unknown'}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Card>
          )}

          <Card className="card-premium p-4 shadow-soft">
            <div className="flex items-center gap-2 mb-2">
              <FileSpreadsheet size={14} className="text-muted-foreground" />
              <span className="text-[12px] font-medium">Preview</span>
              <span className="text-[10px] text-muted-foreground ml-auto">
                first {Math.min(previewRows.length, 5)} rows
              </span>
            </div>
            <div className="max-h-[260px] overflow-auto scroll-area rounded-lg border border-border/40">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/50">
                  <TableRow>
                    {headers.slice(0, 4).map((h) => (
                      <TableHead key={h} className="text-[10px] uppercase whitespace-nowrap">
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.slice(0, 5).map((row, i) => (
                    <TableRow key={i}>
                      {headers.slice(0, 4).map((h) => (
                        <TableCell key={h} className="text-[11px] whitespace-nowrap max-w-[120px] truncate">
                          {row[h] || <span className="text-muted-foreground/40">—</span>}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>

      {/* Validation hint */}
      {!primaryMapped && (
        <div className="mt-4 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[12px]">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>
            The required field{' '}
            <span className="font-semibold">{primaryField?.label}</span> is not mapped. Map a CSV
            column to it to continue.
          </span>
        </div>
      )}

      <div className="flex items-center justify-between mt-6">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft size={14} />
          Back
        </Button>
        <Button onClick={onContinue} disabled={!primaryMapped}>
          Continue
          <ArrowRight size={14} />
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------
// Step 3 — Review & Confirm
// ---------------------------------------------------------------
function ReviewStep({
  entityType,
  workspaceName,
  totalRows,
  invalidCount,
  duplicateMode,
  setDuplicateMode,
  onBack,
  onImport,
  isImporting,
}: {
  entityType: EntityType
  workspaceName: string
  totalRows: number
  invalidCount: number
  duplicateMode: 'skip' | 'update'
  setDuplicateMode: (m: 'skip' | 'update') => void
  onBack: () => void
  onImport: () => void
  isImporting: boolean
}) {
  const willImport = totalRows - invalidCount
  const entityLabel = ENTITY_META[entityType].label

  return (
    <div className="max-w-3xl mx-auto w-full">
      <div className="text-center mb-6">
        <h2 className="text-lg font-semibold">Review &amp; confirm</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Ready to import{' '}
          <span className="font-semibold text-foreground tabular-nums">{willImport}</span> rows as{' '}
          <span className="font-semibold text-foreground">{entityLabel}</span> into{' '}
          <span className="font-semibold text-foreground">{workspaceName}</span>.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <Card className="card-premium p-4 shadow-soft">
          <div className="flex items-center gap-2 text-emerald-600 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 grid place-items-center">
              <CheckCircle2 size={16} />
            </div>
            <span className="text-[11px] font-medium uppercase tracking-wide">Will import</span>
          </div>
          <div className="text-2xl font-bold tabular-nums">{willImport}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">new {entityLabel.toLowerCase()}</div>
        </Card>
        <Card className="card-premium p-4 shadow-soft">
          <div className="flex items-center gap-2 text-amber-600 mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 grid place-items-center">
              <AlertCircle size={16} />
            </div>
            <span className="text-[11px] font-medium uppercase tracking-wide">Duplicates</span>
          </div>
          <div className="text-2xl font-bold tabular-nums">—</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">detected by email at import</div>
        </Card>
        <Card className="card-premium p-4 shadow-soft">
          <div className="flex items-center gap-2 text-rose-600 mb-2">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 grid place-items-center">
              <X size={16} />
            </div>
            <span className="text-[11px] font-medium uppercase tracking-wide">Invalid rows</span>
          </div>
          <div className="text-2xl font-bold tabular-nums">{invalidCount}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">missing required fields</div>
        </Card>
      </div>

      <Card className="card-premium p-5 shadow-soft mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Info size={15} className="text-muted-foreground" />
          <span className="text-[13px] font-semibold">Duplicate handling</span>
        </div>
        <RadioGroup
          value={duplicateMode}
          onValueChange={(v) => setDuplicateMode(v as 'skip' | 'update')}
          className="gap-2"
        >
          <label
            htmlFor="dup-skip"
            className={cn(
              'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all',
              duplicateMode === 'skip'
                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                : 'border-border hover:bg-muted/40',
            )}
          >
            <RadioGroupItem id="dup-skip" value="skip" className="mt-0.5" />
            <div>
              <div className="text-[13px] font-medium">Skip duplicates</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Rows with an email that already exists are skipped. (default)
              </div>
            </div>
          </label>
          <label
            htmlFor="dup-update"
            className={cn(
              'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all',
              duplicateMode === 'update'
                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                : 'border-border hover:bg-muted/40',
            )}
          >
            <RadioGroupItem id="dup-update" value="update" className="mt-0.5" />
            <div>
              <div className="text-[13px] font-medium">Update existing</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Overwrite matching records with the CSV values.
              </div>
            </div>
          </label>
        </RadioGroup>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} disabled={isImporting}>
          <ArrowLeft size={14} />
          Back
        </Button>
        <Button onClick={onImport} disabled={isImporting || willImport <= 0}>
          {isImporting ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Importing…
            </>
          ) : (
            <>
              <Upload size={14} />
              Import {willImport} rows
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------
// Step 4 — Done & History
// ---------------------------------------------------------------
interface HistoryMeta {
  imported?: number
  duplicates?: number
  total?: number
  undone?: boolean
}

function DoneStep({
  result,
  entityType,
  workspaceId,
  onImportAnother,
  onViewLeads,
}: {
  result: { imported: number; duplicates: number; total: number }
  entityType: EntityType
  workspaceId: string
  onImportAnother: () => void
  onViewLeads: () => void
}) {
  const qc = useQueryClient()
  const { data: history, isLoading, refetch } = useQuery<AuditLog[]>({
    queryKey: ['import-history', workspaceId],
    queryFn: async () => {
      const r = await fetch(`/api/crm/import?action=history&workspaceId=${workspaceId}`)
      const j = await r.json()
      return (j.data as AuditLog[]) || []
    },
    enabled: !!workspaceId,
  })

  const undoMutation = useMutation({
    mutationFn: async (auditLogId: string) => {
      const r = await fetch('/api/crm/import?action=undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'undo', auditLogId }),
      })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'Undo failed')
      return j.data
    },
    onSuccess: () => {
      toast.success('Import undone')
      refetch()
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['contacts'] })
      qc.invalidateQueries({ queryKey: ['companies'] })
    },
    onError: () => toast.error('Could not undo import'),
  })

  const rows = history || []

  return (
    <div className="max-w-3xl mx-auto w-full">
      {/* Success hero */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 18 }}
        className="card-premium rounded-2xl p-8 text-center shadow-soft mb-6"
      >
        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 text-emerald-600 grid place-items-center mb-4">
          <CheckCircle2 size={36} strokeWidth={2.5} />
        </div>
        <h2 className="text-xl font-semibold">Import complete</h2>
        <p className="text-sm text-muted-foreground mt-1.5">
          Imported{' '}
          <span className="font-semibold text-foreground tabular-nums">{result.imported}</span>{' '}
          {ENTITY_META[entityType].label.toLowerCase()}, skipped{' '}
          <span className="font-semibold text-foreground tabular-nums">{result.duplicates}</span>{' '}
          duplicates.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
          <Button onClick={onImportAnother} variant="outline">
            <RotateCcw size={14} />
            Import another file
          </Button>
          <Button onClick={onViewLeads}>
            View imported leads
            <ArrowRight size={14} />
          </Button>
        </div>
      </motion.div>

      {/* History */}
      <Card className="card-premium shadow-soft overflow-hidden p-0">
        <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History size={15} className="text-muted-foreground" />
            <span className="text-[13px] font-semibold">Import history</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="h-7 text-[11px]"
          >
            <RotateCcw size={12} />
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<History size={20} />}
            title="No imports yet"
            hint="Your completed imports will appear here."
          />
        ) : (
          <div className="max-h-[360px] overflow-y-auto scroll-area">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="text-[11px] uppercase">Date</TableHead>
                  <TableHead className="text-[11px] uppercase">Type</TableHead>
                  <TableHead className="text-[11px] uppercase text-right">Imported</TableHead>
                  <TableHead className="text-[11px] uppercase text-right">Duplicates</TableHead>
                  <TableHead className="text-[11px] uppercase text-right">Total</TableHead>
                  <TableHead className="text-[11px] uppercase">Status</TableHead>
                  <TableHead className="text-[11px] uppercase text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((log) => {
                  let meta: HistoryMeta = {}
                  try {
                    meta = log.meta ? (JSON.parse(log.meta as string) as HistoryMeta) : {}
                  } catch {
                    meta = {}
                  }
                  const undone = meta.undone === true
                  return (
                    <TableRow key={log.id} className={cn(undone && 'opacity-60')}>
                      <TableCell className="text-[12px] whitespace-nowrap">
                        {relTime(log.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {log.entityType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[12px] text-right tabular-nums font-medium">
                        {meta.imported ?? '—'}
                      </TableCell>
                      <TableCell className="text-[12px] text-right tabular-nums text-muted-foreground">
                        {meta.duplicates ?? '—'}
                      </TableCell>
                      <TableCell className="text-[12px] text-right tabular-nums text-muted-foreground">
                        {meta.total ?? '—'}
                      </TableCell>
                      <TableCell>
                        {undone ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <X size={11} />
                            Undone
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600">
                            <Check size={11} />
                            Completed
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!undone && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[11px] text-muted-foreground hover:text-rose-600"
                            disabled={undoMutation.isPending}
                            onClick={() => undoMutation.mutate(log.id)}
                          >
                            <Undo2 size={12} />
                            Undo
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------
// Main ImportView
// ---------------------------------------------------------------
export function ImportView() {
  const user = useAppStore((s) => s.user)
  const workspace = useAppStore((s) => s.workspace)
  const navigate = useAppStore((s) => s.navigate)
  const qc = useQueryClient()

  const { data: membersData } = useSettings('members')
  const members = (membersData as Membership[] | undefined) || []

  const [step, setStep] = React.useState<Step>(1)
  const [csv, setCsv] = React.useState('')
  const [fileName, setFileName] = React.useState('')
  const [entityType, setEntityType] = React.useState<EntityType>('lead')
  const [mapping, setMapping] = React.useState<Record<string, string>>({})
  const [ownerId, setOwnerId] = React.useState('')
  const [duplicateMode, setDuplicateMode] = React.useState<'skip' | 'update'>('skip')
  const [preview, setPreview] = React.useState<{
    headers: string[]
    rows: Record<string, string>[]
    totalRows: number
  } | null>(null)
  const [importResult, setImportResult] = React.useState<{
    imported: number
    duplicates: number
    total: number
  } | null>(null)

  // Full client-parsed rows (for the actual import payload)
  const allRows = React.useMemo(() => {
    if (!csv) return []
    return parseCSV(csv).rows
  }, [csv])

  // --- preview mutation ---
  const previewMutation = useMutation({
    mutationFn: async (csvText: string) => {
      const r = await fetch('/api/crm/import?action=preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview', csv: csvText }),
      })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'Preview failed')
      return j.data as { headers: string[]; rows: Record<string, string>[]; totalRows: number }
    },
    onSuccess: (data) => {
      setPreview(data)
      setMapping(autoMatch(data.headers, FIELD_DEFS[entityType]))
      setStep(2)
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : 'Could not parse CSV')
    },
  })

  const handlePreview = () => {
    if (!csv.trim()) {
      toast.error('Upload or paste a CSV first')
      return
    }
    // Quick client-side sanity check
    const parsed = parseCSV(csv)
    if (!parsed.headers.length) {
      toast.error('The CSV appears to be empty')
      return
    }
    previewMutation.mutate(csv)
  }

  // --- import mutation ---
  const importMutation = useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace')
      const rows = allRows
      const inverted = invertMapping(mapping)
      const r = await fetch('/api/crm/import?action=import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'import',
          workspaceId: workspace.id,
          rows,
          mapping: inverted,
          entityType,
          ownerId: ownerId || undefined,
        }),
      })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'Import failed')
      return j.data as { imported: number; duplicates: number; total: number }
    },
    onSuccess: (data) => {
      setImportResult(data)
      setStep(4)
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['contacts'] })
      qc.invalidateQueries({ queryKey: ['companies'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['import-history', workspace?.id] })
      toast.success(`Imported ${data.imported} ${ENTITY_META[entityType].singular.toLowerCase()}${data.imported === 1 ? '' : 's'}`)
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : 'Import failed')
    },
  })

  // --- invalid row estimate (matches backend skip conditions) ---
  const invalidCount = React.useMemo(() => {
    if (!allRows.length || !preview) return 0
    const inv = invertMapping(mapping)
    if (entityType === 'lead') {
      const fnKey = inv.fullName
      const emKey = inv.email
      return allRows.filter(
        (r) => !(r[fnKey] || '').trim() && !(r[emKey] || '').trim(),
      ).length
    }
    if (entityType === 'contact') {
      const fnKey = inv.firstName
      const lnKey = inv.lastName
      const emKey = inv.email
      return allRows.filter(
        (r) =>
          !(r[fnKey] || '').trim() &&
          !(r[lnKey] || '').trim() &&
          !(r[emKey] || '').trim(),
      ).length
    }
    // company
    const nameKey = inv.name
    return allRows.filter((r) => !(r[nameKey] || '').trim()).length
  }, [allRows, mapping, entityType, preview])

  const handleReset = () => {
    setStep(1)
    setCsv('')
    setFileName('')
    setEntityType('lead')
    setMapping({})
    setOwnerId('')
    setDuplicateMode('skip')
    setPreview(null)
    setImportResult(null)
  }

  const totalForReview = preview?.totalRows ?? allRows.length

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Header */}
      <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-4 border-b border-border/40">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={16} className="text-primary" />
          <h1 className="text-[15px] font-semibold tracking-tight">Import CSV</h1>
        </div>
        <p className="text-[12px] text-muted-foreground">
          Bulk-import {ENTITY_META.lead.label.toLowerCase()}, {ENTITY_META.contact.label.toLowerCase()}, or{' '}
          {ENTITY_META.company.label.toLowerCase()} from a spreadsheet.
        </p>
      </div>

      {/* Step indicator */}
      <div className="px-4 sm:px-6 lg:px-8 py-5">
        <StepIndicator step={step} />
      </div>

      <Separator className="mb-6" />

      {/* Step content */}
      <div className="flex-1 px-4 sm:px-6 lg:px-8 pb-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {step === 1 && (
              <UploadStep
                csv={csv}
                setCsv={setCsv}
                fileName={fileName}
                setFileName={setFileName}
                onContinue={handlePreview}
                isPending={previewMutation.isPending}
              />
            )}
            {step === 2 && preview && (
              <MapColumnsStep
                entityType={entityType}
                setEntityType={setEntityType}
                headers={preview.headers}
                previewRows={preview.rows}
                totalRows={preview.totalRows}
                mapping={mapping}
                setMapping={setMapping}
                ownerId={ownerId}
                setOwnerId={setOwnerId}
                onBack={() => setStep(1)}
                onContinue={() => setStep(3)}
                members={members}
              />
            )}
            {step === 3 && preview && (
              <ReviewStep
                entityType={entityType}
                workspaceName={workspace?.name || 'this workspace'}
                totalRows={totalForReview}
                invalidCount={invalidCount}
                duplicateMode={duplicateMode}
                setDuplicateMode={setDuplicateMode}
                onBack={() => setStep(2)}
                onImport={() => importMutation.mutate()}
                isImporting={importMutation.isPending}
              />
            )}
            {step === 4 && importResult && workspace && (
              <DoneStep
                result={importResult}
                entityType={entityType}
                workspaceId={workspace.id}
                onImportAnother={handleReset}
                onViewLeads={() => navigate('leads')}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      <footer className="mt-auto px-4 sm:px-6 lg:px-8 py-3 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Info size={12} />
          {user ? `Signed in as ${user.name}` : 'Not signed in'}
        </span>
        <span className="tabular-nums">Step {step} of 4</span>
      </footer>
    </div>
  )
}
