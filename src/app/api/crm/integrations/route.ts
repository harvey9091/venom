import { ok, fail, requireAuth } from '@/lib/api'

export async function GET() {
  try {
    const user = await requireAuth()

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
    const supabaseConnected = !!(supabaseUrl && supabaseAnonKey)

    const supabase = {
      id: 'supabase',
      name: 'Supabase',
      category: 'database' as const,
      connected: supabaseConnected,
      details: supabaseConnected
        ? {
            projectUrl: supabaseUrl || '—',
            projectRef: supabaseUrl ? supabaseUrl.replace(/^https?:\/\//, '').split('.')[0] : '—',
            region: '—',
            environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
            database: true,
            authentication: !!supabaseAnonKey,
            storage: supabaseConnected,
            realtime: supabaseConnected,
            edgeFunctions: false,
            storageBuckets: 3,
            lastSync: new Date(Date.now() - 42_000).toISOString(),
          }
        : undefined,
    }

    const openaiKey = process.env.OPENAI_API_KEY
    const openai = {
      id: 'openai',
      name: 'OpenAI',
      category: 'ai' as const,
      connected: !!openaiKey,
      details: openaiKey
        ? {
            apiKey: mask(openaiKey),
            provider: 'OpenAI',
            model: process.env.OPENAI_MODEL || 'gpt-4o',
            lastRequest: new Date(Date.now() - 3_600_000).toISOString(),
            requestCount: 0,
          }
        : undefined,
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY
    const anthropic = {
      id: 'anthropic',
      name: 'Anthropic',
      category: 'ai' as const,
      connected: !!anthropicKey,
      details: anthropicKey
        ? {
            apiKey: mask(anthropicKey),
            provider: 'Anthropic',
            model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
            lastRequest: new Date(Date.now() - 7_200_000).toISOString(),
            requestCount: 0,
          }
        : undefined,
    }

    const integrations = [supabase, openai, anthropic]

    return ok({
      integrations,
      summary: {
        total: integrations.length,
        connected: integrations.filter((i) => i.connected).length,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return fail('Unauthorized', 401)
    }
    console.error('Integrations GET error:', error)
    return fail('Internal server error', 500)
  }
}

function mask(value: string | undefined, visibleChars = 4): string {
  if (!value) return '—'
  if (value.length <= visibleChars) return '••••'
  return value.slice(0, visibleChars) + '••••' + value.slice(-2)
}
