import { useEffect, useRef, useState } from 'react'
import { Camera, X } from 'lucide-react'
import { btnSecondary } from '../../components/ui'

// BarcodeDetector ships in Chromium (Android, desktop Chrome/Edge) but not yet in Firefox or
// Safari, and TypeScript's DOM lib doesn't describe it.
interface DetectedBarcode {
  rawValue: string
}
interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>
}
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike

const getDetector = (): BarcodeDetectorCtor | null => {
  const ctor = (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
  return ctor ?? null
}

export const canScan = () => !!getDetector() && !!navigator.mediaDevices?.getUserMedia

export function BarcodeScanner({ onDetect, onClose }: { onDetect: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  // Callbacks held in a ref so the camera isn't restarted whenever the parent re-renders.
  const cb = useRef({ onDetect, onClose })
  cb.current = { onDetect, onClose }

  useEffect(() => {
    const Detector = getDetector()
    if (!Detector) {
      setError('This browser cannot scan barcodes. Type the number instead, or use a USB scanner.')
      return
    }
    const detector = new Detector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] })
    let stream: MediaStream | null = null
    let timer = 0
    let stopped = false

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then(async (s) => {
        if (stopped) return s.getTracks().forEach((t) => t.stop())
        stream = s
        const el = video.current
        if (!el) return
        el.srcObject = s
        await el.play().catch(() => undefined)
        let busy = false
        timer = window.setInterval(async () => {
          if (busy || !el.videoWidth) return
          busy = true
          try {
            const found = await detector.detect(el)
            const code = found[0]?.rawValue
            if (code && !stopped) cb.current.onDetect(code)
          } catch {
            /* a frame that fails to decode is normal */
          } finally {
            busy = false
          }
        }, 250)
      })
      .catch(() => setError('Camera access was blocked. Allow it in your browser settings, or type the number.'))

    return () => {
      stopped = true
      window.clearInterval(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return (
    <div className="grid gap-2 rounded-xl border border-line bg-bg p-3">
      {error ? (
        <p className="text-sm text-bad">{error}</p>
      ) : (
        <div className="relative overflow-hidden rounded-lg bg-black">
          <video ref={video} muted playsInline className="aspect-video w-full object-cover" />
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-accent/80" />
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs text-mute">
          <Camera size={14} /> Point the camera at the barcode on the back of the case.
        </p>
        <button type="button" className={btnSecondary} onClick={onClose}>
          <X size={14} /> Stop
        </button>
      </div>
    </div>
  )
}
