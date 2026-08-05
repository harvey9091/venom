/**
 * Helper for CRM API routes.
 * Reads workspaceId / userId from query string (since we're SPA without real auth).
 * Returns standard JSON responses with consistent shape.
 */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const ok = (data: unknown, init?: ResponseInit) =>
  NextResponse.json({ ok: true, data }, init)

export const fail = (error: string, status = 400) =>
  NextResponse.json({ ok: false, error }, { status })

export function getWorkspaceId(req: Request): string | null {
  const url = new URL(req.url)
  return url.searchParams.get('workspaceId')
}

export function requireWorkspace(req: Request): string | null {
  const ws = getWorkspaceId(req)
  return ws
}

/** Convenience: serialize a Prisma row to JSON-safe format (Date -> ISO string). */
export function serialize<T>(row: T): T {
  return JSON.parse(JSON.stringify(row)) as T
}

export { db }
