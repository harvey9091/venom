/**
 * AI Thinking simulation helper.
 *
 * Provides rotating "thinking" labels for each AI task category so the orb
 * feels alive while a (mock) AI operation runs. In production these would be
 * real progress events from an LLM pipeline.
 */
'use client'

export const THINKING_LABELS = {
  search: ['Searching workspace…', 'Finding matches…', 'Ranking results…'],
  analyze: ['Analyzing CRM…', 'Reading context…', 'Connecting data points…'],
  plan: ['Planning automation…', 'Mapping triggers…', 'Designing workflow…'],
  generate: ['Generating report…', 'Composing content…', 'Formatting output…'],
  duplicates: ['Finding duplicate leads…', 'Comparing records…', 'Scoring matches…'],
  email: ['Writing personalized email…', 'Adjusting tone…', 'Polishing draft…'],
  notes: ['Summarizing notes…', 'Extracting key points…', 'Organizing themes…'],
  score: ['Scoring companies…', 'Analyzing website…', 'Estimating budget…', 'Generating insights…'],
  transcribe: ['Transcribing audio…', 'Detecting speakers…', 'Cleaning transcript…'],
  backup: ['Preparing export…', 'Compressing workspace…', 'Uploading backup…'],
  restore: ['Restoring backup…', 'Verifying integrity…', 'Reloading workspace…'],
  theme: ['Applying theme…', 'Refreshing surfaces…'],
  workspace: ['Preparing workspace…', 'Configuring permissions…', 'Syncing data…'],
  upload: ['Uploading file…', 'Scanning for threats…', 'Generating preview…'],
  csv: ['Reading CSV…', 'Mapping columns…', 'Validating emails…', 'Detecting duplicates…', 'Importing rows…', 'Finalizing import…'],
  automation: ['Checking workflow…', 'Validating conditions…', 'Testing execution…'],
  sync: ['Syncing changes…', 'Updating records…'],
  default: ['Thinking…', 'Processing…', 'Working…'],
} as const

export type ThinkingCategory = keyof typeof THINKING_LABELS

export function getThinkingLabels(category: ThinkingCategory): readonly string[] {
  return THINKING_LABELS[category] || THINKING_LABELS.default
}

/**
 * Run a simulated AI thinking sequence with rotating labels.
 * Calls `onLabel` for each step, resolves when complete.
 */
export async function simulateAIThinking(
  category: ThinkingCategory,
  opts?: { duration?: number; onLabel?: (label: string, index: number, total: number) => void }
): Promise<void> {
  const labels = getThinkingLabels(category)
  const duration = opts?.duration ?? 1400
  const onLabel = opts?.onLabel
  for (let i = 0; i < labels.length; i++) {
    onLabel?.(labels[i], i, labels.length)
    await new Promise((r) => setTimeout(r, duration))
  }
}

/**
 * Mock AI response generator — returns a canned response based on the prompt.
 * Replace with a real LLM call (z-ai-web-dev-sdk) in production.
 */
export function mockAIResponse(prompt: string): string {
  const p = prompt.toLowerCase()
  if (p.includes('summar') || p.includes('overview')) {
    return 'Here\'s a summary of your workspace activity this week:\n\n• 14 new leads added (↑ 23% vs last week)\n• 8 deals moved to Demo stage\n• $147K in pipeline added\n• 3 deals worth $42K closed won\n\nYour hottest lead is Jordan Muller from Linear (score 92). Consider prioritizing the 5 deals in Negotiation stage — they represent $89K in potential revenue closing this month.'
  }
  if (p.includes('email') || p.includes('outreach')) {
    return 'Subject: Quick question about your dev workflow\n\nHi Jordan,\n\nNoticed Linear\'s engineering team has been scaling fast — congrats on the Series B! Most teams your size hit a wall with legacy CRM tooling around 50+ engineers.\n\nWould you be open to a 15-min chat this week? I\'d love to share how Venom CRM helped Vercel and Loom streamline their sales ops.\n\nBest,\nAva'
  }
  if (p.includes('score') || p.includes('rank')) {
    return 'Based on firmographic + behavioral signals, here are your top 5 scored leads:\n\n1. Jordan Muller (Linear) — 92/100 • $59K est. value\n2. Casey Silva (Notion) — 87/100 • $45K est. value\n3. Riley Cohen (Vercel) — 81/100 • $67K est. value\n4. Sam Kim (Figma) — 78/100 • $38K est. value\n5. Taylor Muller (Loom) — 74/100 • $52K est. value\n\nScoring factors: company size, funding stage, engagement frequency, tech stack match, decision-maker title.'
  }
  if (p.includes('report') || p.includes('analytics')) {
    return '## Weekly Sales Report\n\n**Revenue:** $42,000 closed (↑ 18% WoW)\n**Pipeline:** $387K open across 23 deals\n**Conversion:** 24% lead→deal (↑ 3pp)\n**Avg deal size:** $18.2K\n\n**Top performer:** Noah Patel — 4 deals, $31K\n**At risk:** 3 deals in Negotiation past expected close date\n\n**Recommendation:** Focus on the 5 stalled negotiation deals — they\'re 73% probable and represent $89K.'
  }
  if (p.includes('automat') || p.includes('workflow')) {
    return 'I can create that automation for you. Here\'s the plan:\n\n1. **Trigger:** When a lead\'s score crosses 80\n2. **Condition:** If source = "website" or "referral"\n3. **Action:** Assign to senior AE + tag "hot-lead" + send Slack notification\n4. **Action:** Create follow-up task due in 2 days\n\nWant me to build this in the Automation Builder?'
  }
  return 'I\'ve analyzed your request. Based on your workspace data, I recommend focusing on the 5 deals in Negotiation stage — they represent $89K in weighted pipeline value and have a 73% average close probability. Would you like me to draft outreach emails for the stalled ones, or create tasks to follow up?'
}
