'use client'

import * as React from 'react'
import { type UseQueryResult, type UseMutationResult } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { RefreshCw, AlertTriangle } from 'lucide-react'

interface QueryStateProps {
  /** The TanStack Query result object */
  query: Pick<UseQueryResult<any>, 'isLoading' | 'error' | 'refetch' | 'isFetching'>
  /** The mutation for retry context (optional) */
  mutation?: Pick<UseMutationResult<any, any, any, any>, 'isPending'>
  /** Render this while loading */
  loadingSkeleton?: React.ReactNode
  /** Custom error message */
  errorMessage?: string
  /** Additional class on the wrapper */
  className?: string
  children: React.ReactNode
}

export function QueryView({
  query,
  mutation,
  loadingSkeleton,
  errorMessage = 'Failed to load data',
  className,
  children,
}: QueryStateProps) {
  const { isLoading, error, refetch, isFetching } = query
  const isPending = mutation?.isPending

  if (isLoading) {
    return (
      <div className={cn('relative', className)}>
        {loadingSkeleton}
        {isFetching && !isLoading && (
          <div className="absolute top-2 right-2">
            <RefreshCw className="size-3 text-muted-foreground animate-spin" />
          </div>
        )}
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12 px-6 text-center rounded-xl border border-border/60 bg-card', className)}>
        <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 mb-3">
          <AlertTriangle size={20} />
        </div>
        <div className="text-[13px] font-medium mb-1">{errorMessage}</div>
        <p className="text-[11px] text-muted-foreground max-w-sm mb-3">
          {error instanceof Error ? error.message : 'An unexpected error occurred'}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isPending}
          className="h-8 gap-1.5"
        >
          <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className={cn('relative', className)}>
      {children}
      {isFetching && !isLoading && (
        <div className="absolute top-2 right-2 z-10">
          <RefreshCw className="size-3 text-muted-foreground animate-spin" />
        </div>
      )}
    </div>
  )
}

import { cn } from '@/lib/utils'
