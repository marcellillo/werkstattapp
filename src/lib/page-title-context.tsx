'use client'
import { createContext, useContext, useState, useMemo } from 'react'

interface PageTitleCtx {
  title: string | null
  setTitle: (t: string | null) => void
}

const PageTitleContext = createContext<PageTitleCtx | null>(null)

export function PageTitleProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = useState<string | null>(null)
  const value = useMemo(() => ({ title, setTitle }), [title])
  return <PageTitleContext.Provider value={value}>{children}</PageTitleContext.Provider>
}

export function usePageTitleContext() {
  const ctx = useContext(PageTitleContext)
  if (!ctx) throw new Error('usePageTitleContext must be used within PageTitleProvider')
  return ctx
}
