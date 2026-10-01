import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { useT } from '../i18n/i18n.tsx'

/**
 * The QR code Expo prints in its terminal, drawn here from the address it announced, so a phone can open the app
 * without the terminal being shown. In the site's ink, on the card's paper.
 */
export function ExpoQr({ url }: { url: string }) {
  const t = useT()
  const [svg, setSvg] = useState<string>()

  useEffect(() => {
    let current = true

    QRCode.toString(url, {
      type: 'svg',
      margin: 1,
      color: { dark: '#112439', light: '#fcfdfe' },
    }).then((drawn) => {
      if (current) setSvg(drawn)
    })

    return () => {
      current = false
    }
  }, [url])

  return (
    <div className="mx-5 mb-4 flex items-center gap-5 rounded-md border border-rule bg-paper/60 p-4">
      {svg !== undefined && (
        <img
          src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`}
          alt={t.expo.alt(url)}
          className="size-32 shrink-0 rounded-sm border border-rule"
        />
      )}
      <div className="min-w-0 text-sm">
        <p className="font-serif font-semibold text-navy">{t.expo.title}</p>
        <p className="mt-1 text-muted-foreground">{t.expo.body}</p>
        <p className="mt-2 truncate font-mono text-[0.72rem] text-ink">{url}</p>
      </div>
    </div>
  )
}
