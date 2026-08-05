/**
 * CSV Import API
 *  POST /api/crm/import?action=preview   { csv: string }
 *  POST /api/crm/import?action=import    { workspaceId, rows, mapping, entityType }
 *  GET  /api/crm/import?action=history&workspaceId=...
 */
import { db, ok, fail, requireWorkspace, serialize } from '@/lib/api'

interface PreviewRow { [k: string]: string }

function parseCSV(text: string): { headers: string[]; rows: PreviewRow[] } {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim())
  if (!lines.length) return { headers: [], rows: [] }
  const parseLine = (line: string): string[] => {
    const out: string[] = []
    let cur = ''
    let inQuote = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
        else inQuote = !inQuote
      } else if (c === ',' && !inQuote) {
        out.push(cur); cur = ''
      } else cur += c
    }
    out.push(cur)
    return out
  }
  const headers = parseLine(lines[0]).map((h) => h.trim())
  const rows: PreviewRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i])
    const row: PreviewRow = {}
    headers.forEach((h, idx) => { row[h] = (cells[idx] || '').trim() })
    rows.push(row)
  }
  return { headers, rows }
}

export async function GET(req: Request) {
  const workspaceId = requireWorkspace(req)
  if (!workspaceId) return fail('workspaceId required', 400)
  const url = new URL(req.url)
  if (url.searchParams.get('action') === 'history') {
    const logs = await db.auditLog.findMany({
      where: { workspaceId, action: 'csv_import' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    return ok(serialize(logs))
  }
  return fail('unknown action', 400)
}

export async function POST(req: Request) {
  const body = await req.json()
  const { action } = body

  if (action === 'preview') {
    const { csv } = body as { csv: string }
    const { headers, rows } = parseCSV(csv || '')
    return ok({ headers, rows: rows.slice(0, 50), totalRows: rows.length })
  }

  if (action === 'import') {
    const { workspaceId, rows, mapping, entityType, ownerId } = body as {
      workspaceId: string
      rows: PreviewRow[]
      mapping: Record<string, string>
      entityType: 'lead' | 'contact' | 'company'
      ownerId?: string
    }
    if (!workspaceId) return fail('workspaceId required', 400)

    let imported = 0
    let duplicates = 0

    if (entityType === 'lead') {
      for (const row of rows) {
        const fullName = (row[mapping.fullName] || row[mapping.name] || '').trim()
        const email = (row[mapping.email] || '').trim()
        if (!fullName && !email) continue
        // Duplicate detection by email
        if (email) {
          const existing = await db.lead.findFirst({ where: { workspaceId, email } })
          if (existing) { duplicates++; continue }
        }
        await db.lead.create({
          data: {
            workspaceId,
            fullName: fullName || email,
            email,
            phone: row[mapping.phone] || null,
            source: row[mapping.source] || 'csv_import',
            status: 'new',
            score: Number(row[mapping.score]) || 0,
            estimatedValue: Number(row[mapping.value]) || null,
            ownerId: ownerId || null,
          },
        })
        imported++
      }
    } else if (entityType === 'contact') {
      for (const row of rows) {
        const firstName = (row[mapping.firstName] || '').trim()
        const lastName = (row[mapping.lastName] || '').trim()
        const email = (row[mapping.email] || '').trim()
        if (!firstName && !lastName && !email) continue
        if (email) {
          const existing = await db.contact.findFirst({ where: { workspaceId, email } })
          if (existing) { duplicates++; continue }
        }
        await db.contact.create({
          data: {
            workspaceId,
            firstName: firstName || 'Unknown',
            lastName,
            email,
            phone: row[mapping.phone] || null,
            jobTitle: row[mapping.jobTitle] || null,
          },
        })
        imported++
      }
    } else if (entityType === 'company') {
      for (const row of rows) {
        const name = (row[mapping.name] || '').trim()
        if (!name) continue
        const existing = await db.company.findFirst({ where: { workspaceId, name } })
        if (existing) { duplicates++; continue }
        await db.company.create({
          data: {
            workspaceId,
            name,
            domain: row[mapping.domain] || null,
            industry: row[mapping.industry] || null,
            website: row[mapping.website] || null,
          },
        })
        imported++
      }
    }

    await db.auditLog.create({
      data: {
        workspaceId,
        action: 'csv_import',
        entityType,
        entityId: null,
        meta: JSON.stringify({ imported, duplicates, total: rows.length }),
      },
    })

    return ok({ imported, duplicates, total: rows.length })
  }

  if (action === 'undo') {
    const { auditLogId } = body
    const log = await db.auditLog.findUnique({ where: { id: auditLogId } })
    if (!log) return fail('log not found', 404)
    const meta = log.meta ? JSON.parse(log.meta) : {}
    // For demo: just mark as undone (in production we'd track imported IDs)
    await db.auditLog.update({
      where: { id: auditLogId },
      data: { meta: JSON.stringify({ ...meta, undone: true }) },
    })
    return ok({ undone: true })
  }

  return fail('unknown action', 400)
}
