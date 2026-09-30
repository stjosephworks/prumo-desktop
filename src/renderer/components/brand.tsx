// The plumb bob and the wordmark, drawn as prumo-site draws them (src/features/site/brand.tsx there).

export function PlumbMark({
  className = '',
  lineLength = 30,
}: {
  className?: string
  lineLength?: number
}) {
  const bobTop = lineLength + 4

  return (
    <svg
      viewBox={`0 0 24 ${bobTop + 40}`}
      className={`text-navy ${className}`}
      role="presentation"
      aria-hidden="true"
    >
      <line x1="12" y1="0" x2="12" y2={lineLength} stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y={lineLength} width="6" height="4" rx="1" fill="currentColor" />
      <polygon
        points={`12,${bobTop} 2,${bobTop + 12} 12,${bobTop + 36} 22,${bobTop + 12}`}
        fill="currentColor"
      />
      <polygon
        points={`12,${bobTop} 12,${bobTop + 36} 22,${bobTop + 12}`}
        fill="currentColor"
        opacity="0.35"
      />
    </svg>
  )
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2">
      <PlumbMark className="h-7 w-auto" lineLength={16} />
      <span className="font-serif text-xl font-semibold tracking-tight text-navy">Prumo</span>
      <span className="mt-1 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-brass-ink">
        Desktop
      </span>
    </span>
  )
}
