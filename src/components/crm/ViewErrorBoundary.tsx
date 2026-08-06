'use client'

import { Component, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onReset?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ViewErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('ViewErrorBoundary caught:', error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    this.props.onReset?.()
    toast.success('View recovered')
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 mb-4">
            <RefreshCw size={24} />
          </div>
          <div className="text-sm font-semibold mb-1">Something went wrong</div>
          <p className="text-xs text-muted-foreground max-w-sm mb-4">
            This view crashed unexpectedly. You can try reloading the data to recover.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={this.handleReset}
            className="h-8 gap-1.5"
          >
            <RefreshCw size={13} /> Reload view
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
