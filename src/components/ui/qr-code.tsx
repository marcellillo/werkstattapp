'use client'
import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'

interface QrCodeProps {
  value: string
  size?: number
  className?: string
}

export function QrCode({ value, size = 160, className }: QrCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!canvasRef.current || !value) return
    setError(false)
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    }).catch(() => setError(true))
  }, [value, size])

  if (error || !value) return null

  return <canvas ref={canvasRef} className={className} />
}

export function useQrDataUrl(value: string): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!value) { setDataUrl(null); return }
    QRCode.toDataURL(value, { width: 200, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } })
      .then(setDataUrl)
      .catch(() => setDataUrl(null))
  }, [value])
  return dataUrl
}

export function downloadQr(value: string, filename = 'qr-code.png') {
  QRCode.toDataURL(value, { width: 512, margin: 1 }).then(url => {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
  })
}
