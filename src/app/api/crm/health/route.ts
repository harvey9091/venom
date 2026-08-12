import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

function parseDatabaseUrl(url: string) {
  try {
    const parsed = new URL(url)
    const databaseName = parsed.pathname.replace(/^\//, '') || null
    return {
      databaseUrlProtocol: parsed.protocol.replace(/:$/, ''),
      databaseUrlHostname: parsed.hostname,
      databaseUrlPort: parsed.port ? Number(parsed.port) : null,
      databaseUrlDatabaseName: databaseName,
    }
  } catch {
    return {
      databaseUrlProtocol: null,
      databaseUrlHostname: null,
      databaseUrlPort: null,
      databaseUrlDatabaseName: null,
    }
  }
}

export async function GET() {
  const diagnostics: Record<string, unknown> = {
    nodeEnv: process.env.NODE_ENV,
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    vercel: Boolean(process.env.VERCEL),
  }

  if (process.env.DATABASE_URL) {
    const parsed = parseDatabaseUrl(process.env.DATABASE_URL)
    diagnostics.databaseUrlProtocol = parsed.databaseUrlProtocol
    diagnostics.databaseUrlHostname = parsed.databaseUrlHostname
    diagnostics.databaseUrlPort = parsed.databaseUrlPort
    diagnostics.databaseUrlDatabaseName = parsed.databaseUrlDatabaseName
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      ok: false,
      code: 'CONFIGURATION_ERROR',
      error: 'DATABASE_URL environment variable is not set',
      diagnostics,
    }, { status: 500 })
  }

  try {
    await db.$connect()
    const result = await db.$queryRaw`SELECT 1 as connected`
    diagnostics.databaseConnected = true
    diagnostics.queryResult = result

    return NextResponse.json({
      ok: true,
      message: 'Database connection successful',
      diagnostics,
    })
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    diagnostics.databaseConnected = false
    diagnostics.errorName = err.name
    diagnostics.errorMessage = err.message
    diagnostics.errorCode = (err as { code?: string }).code
    diagnostics.errorCause = err.cause instanceof Error ? err.cause.message : err.cause

    console.error('[CRM Health] Database connection failed')
    console.error('[CRM Health] Error:', err.message)
    if ((err as { code?: string }).code) {
      console.error('[CRM Health] Prisma error code:', (err as { code?: string }).code)
    }

    return NextResponse.json({
      ok: false,
      code: 'DATABASE_CONNECTION_ERROR',
      error: 'Database connection failed',
      diagnostics,
    }, { status: 503 })
  }
}
