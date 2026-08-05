/**
 * AIAssistant — global slide-over drawer with a large Thinking Orb above
 * the response area. Simulates an AI conversation with rotating thinking
 * labels while generating.
 *
 * In production, replace `simulateAIThinking` + `mockAIResponse` with a real
 * LLM call (z-ai-web-dev-sdk). The UI + orb states stay the same.
 */
'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAppStore } from '@/lib/store'
import { useThinkingStore } from '@/lib/thinking'
import { simulateAIThinking, mockAIResponse, type ThinkingCategory } from '@/lib/ai-sim'
import { ThinkingState } from './thinking-state'
import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles, Send, X, ArrowUpRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  thinkingLabels?: string[]
}

const SUGGESTIONS = [
  { label: 'Summarize my week', prompt: 'Give me a summary of my workspace activity this week', category: 'analyze' as ThinkingCategory },
  { label: 'Draft outreach email', prompt: 'Write a personalized outreach email to my top lead', category: 'email' as ThinkingCategory },
  { label: 'Score my leads', prompt: 'Score and rank my top 5 leads', category: 'score' as ThinkingCategory },
  { label: 'Build a report', prompt: 'Generate a weekly sales report', category: 'generate' as ThinkingCategory },
  { label: 'Suggest an automation', prompt: 'Suggest an automation for hot lead routing', category: 'plan' as ThinkingCategory },
]

export function AIAssistant() {
  const open = useAppStore((s) => s.assistantOpen)
  const setOpen = useAppStore((s) => s.setAssistantOpen)
  const seedPrompt = useAppStore((s) => s.assistantSeedPrompt)
  const navigate = useAppStore((s) => s.navigate)

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [currentLabel, setCurrentLabel] = useState('Thinking…')
  const [progress, setProgress] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const startTask = useThinkingStore((s) => s.startTask)
  const updateTask = useThinkingStore((s) => s.updateTask)
  const stopTask = useThinkingStore((s) => s.stopTask)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isThinking, currentLabel])

  // Handle seed prompt from command palette / other triggers
  useEffect(() => {
    if (open && seedPrompt) {
      setInput(seedPrompt)
      // Auto-submit after a short delay
      setTimeout(() => {
        submitPrompt(seedPrompt)
        useAppStore.getState().setAssistantOpen(true) // keep open
        // Clear the seed by setting state directly via store hack:
        useAppStore.setState({ assistantSeedPrompt: null })
      }, 200)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seedPrompt])

  async function submitPrompt(promptText?: string) {
    const text = (promptText ?? input).trim()
    if (!text || isThinking) return

    const userMsg: Message = { id: `u_${Date.now()}`, role: 'user', content: text }
    setMessages((m) => [...m, userMsg])
    setInput('')
    setIsThinking(true)
    setProgress(0)

    // Pick a category based on prompt content
    const category: ThinkingCategory = pickCategory(text)

    const taskId = startTask({
      label: 'Understanding request…',
      variant: 'orbit',
      size: 'lg',
      priority: 'foreground',
    })

    try {
      await simulateAIThinking(category, {
        duration: 1100,
        onLabel: (label, index, total) => {
          setCurrentLabel(label)
          setProgress(Math.round(((index + 1) / total) * 100))
          updateTask(taskId, { label, progress: Math.round(((index + 1) / total) * 100) })
        },
      })

      const response = mockAIResponse(text)
      const assistantMsg: Message = {
        id: `a_${Date.now()}`,
        role: 'assistant',
        content: response,
      }
      setMessages((m) => [...m, assistantMsg])
    } finally {
      setIsThinking(false)
      setProgress(0)
      stopTask(taskId)
    }
  }

  function pickCategory(text: string): ThinkingCategory {
    const p = text.toLowerCase()
    if (p.includes('email') || p.includes('outreach')) return 'email'
    if (p.includes('score') || p.includes('rank')) return 'score'
    if (p.includes('report') || p.includes('analytics')) return 'generate'
    if (p.includes('automat') || p.includes('workflow')) return 'plan'
    if (p.includes('summar') || p.includes('overview')) return 'analyze'
    if (p.includes('search') || p.includes('find')) return 'search'
    return 'analyze'
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submitPrompt()
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-full sm:max-w-[520px] p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary/60 grid place-items-center text-primary-foreground">
                <Sparkles size={14} />
              </div>
              AI Assistant
            </SheetTitle>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
              <X size={14} />
            </Button>
          </div>
        </SheetHeader>

        {/* Messages + Thinking Orb */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-area px-4 py-4">
          {messages.length === 0 && !isThinking && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
              >
                <ThinkingState label="Ready when you are" size="lg" variant="orbit" theme="rainbow" />
              </motion.div>
              <p className="text-sm text-muted-foreground mt-4 max-w-xs">
                Ask me anything about your CRM — summaries, drafts, scores, reports, or automation ideas.
              </p>
              <div className="grid grid-cols-1 gap-1.5 mt-5 w-full max-w-sm">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => submitPrompt(s.prompt)}
                    className="group flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors text-left"
                  >
                    <span className="text-[13px] font-medium">{s.label}</span>
                    <ArrowUpRight size={13} className="text-muted-foreground group-hover:text-primary transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {messages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className={cn(
                  'flex',
                  m.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap',
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-muted text-foreground rounded-bl-md border border-border/50'
                  )}
                >
                  {m.content}
                </div>
              </motion.div>
            ))}

            {/* Large Thinking Orb above the response area */}
            <AnimatePresence>
              {isThinking && (
                <motion.div
                  className="flex flex-col items-center py-6"
                  initial={{ opacity: 0, scale: 0.9, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, scale: 0.9, filter: 'blur(8px)' }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                >
                  <ThinkingState
                    label={currentLabel}
                    size="xl"
                    variant="orbit"
                    theme="rainbow"
                    progress={progress}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-border p-3">
          <div className="relative">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your CRM…"
              className="min-h-[44px] max-h-[160px] resize-none pr-12 text-[13px] rounded-xl"
              disabled={isThinking}
            />
            <Button
              size="icon"
              className="absolute right-2 bottom-2 h-7 w-7 rounded-lg"
              onClick={() => submitPrompt()}
              disabled={!input.trim() || isThinking}
            >
              <Send size={13} />
            </Button>
          </div>
          <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
            <span>Press Enter to send · Shift+Enter for new line</span>
            <button
              className="hover:text-foreground transition-colors"
              onClick={() => navigate('settings')}
            >
              Settings →
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
