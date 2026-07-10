'use client'

import * as React from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export interface ConfirmOptions {
  title?: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Style of the confirm action button */
  variant?: 'danger' | 'default'
}

interface ConfirmState extends ConfirmOptions {
  open: boolean
  resolve?: (value: boolean) => void
}

const ConfirmContext = React.createContext<(options?: ConfirmOptions) => Promise<boolean>>(
  () => Promise.resolve(false)
)

/**
 * Provides a promise-based confirmation dialog.
 * Usage:  const confirm = useConfirm();  if (!(await confirm({...}))) return
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<ConfirmState>({ open: false })

  const confirm = React.useCallback((options: ConfirmOptions = {}) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...options, open: true, resolve })
    })
  }, [])

  const handleClose = React.useCallback(
    (result: boolean) => {
      setState((prev) => {
        prev.resolve?.(result)
        return { ...prev, open: false }
      })
    },
    []
  )

  const isDanger = state.variant !== 'default'

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={state.open} onOpenChange={(o) => { if (!o) handleClose(false) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div
                className={
                  'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ' +
                  (isDanger ? 'bg-danger-soft text-danger-soft-foreground' : 'bg-primary-soft text-primary-soft-foreground')
                }
              >
                {isDanger ? <Trash2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
              </div>
              <div className="space-y-1.5 pt-0.5">
                <DialogTitle>{state.title ?? 'Aktion bestätigen'}</DialogTitle>
                <DialogDescription>
                  {state.description ?? 'Möchten Sie diese Aktion wirklich ausführen?'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter className="mt-2 gap-2">
            <Button variant="outline" onClick={() => handleClose(false)}>
              {state.cancelLabel ?? 'Abbrechen'}
            </Button>
            <Button
              variant={isDanger ? 'destructive' : 'default'}
              onClick={() => handleClose(true)}
            >
              {state.confirmLabel ?? (isDanger ? 'Löschen' : 'Bestätigen')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  return React.useContext(ConfirmContext)
}
