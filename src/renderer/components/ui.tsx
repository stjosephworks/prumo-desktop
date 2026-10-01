// The few pieces every screen is built from, in the site's manner: ruled lines, small radii, serif headings,
// navy for what acts and brass for what marks.
import { SquareTerminal } from 'lucide-react'
import { type ButtonHTMLAttributes, type ReactNode, useEffect, useState } from 'react'

export function cx(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(' ')
}

const BUTTON = {
  primary: 'bg-navy text-card hover:bg-ink border border-navy',
  secondary: 'border border-rule bg-card text-ink hover:border-brass hover:text-navy',
  ghost: 'text-muted-foreground hover:bg-muted hover:text-ink',
  danger: 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
} as const

const SIZE = { sm: 'h-7 px-2.5 text-xs gap-1.5', md: 'h-8 px-3 text-sm gap-2' } as const

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BUTTON
  size?: keyof typeof SIZE
}

export function buttonClass(
  variant: keyof typeof BUTTON = 'secondary',
  size: keyof typeof SIZE = 'md',
) {
  return cx(
    'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors',
    'disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-3.5',
    BUTTON[variant],
    SIZE[size],
  )
}

export function Button({ variant, size, className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={cx(buttonClass(variant, size), className)} {...props} />
}

/** A quiet label for what a project is made of. */
export function Tag({
  children,
  tone = 'plain',
}: {
  children: ReactNode
  tone?: 'plain' | 'brass' | 'warning'
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-sm border px-1.5 py-px font-mono text-[0.7rem] leading-4',
        tone === 'plain' && 'border-rule bg-card text-muted-foreground',
        tone === 'brass' && 'border-brass/50 bg-brass/10 text-brass-ink',
        tone === 'warning' && 'border-warning/40 bg-warning/10 text-warning',
      )}
    >
      {children}
    </span>
  )
}

const DOT = {
  running: 'bg-success',
  starting: 'bg-warning animate-pulse',
  stopped: 'bg-rule',
  failed: 'bg-destructive',
  warning: 'bg-warning',
} as const

export function StatusDot({ state }: { state: keyof typeof DOT }) {
  return <span className={cx('inline-block size-2 shrink-0 rounded-full', DOT[state])} />
}

/** The top of a screen: a small line above, the title in serif, and what can be done on the right. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="flex items-end justify-between gap-6 pb-6">
      <div className="min-w-0">
        {eyebrow !== undefined && (
          <p className="mb-2 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-brass-ink">
            {eyebrow}
          </p>
        )}
        <h1 className="font-serif text-[1.9rem] font-semibold leading-tight tracking-[-0.02em] text-navy">
          {title}
        </h1>
        {description !== undefined && (
          <div className="mt-1.5 text-sm text-muted-foreground">{description}</div>
        )}
      </div>
      {actions !== undefined && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}

/** A ruled section, with the brass tick the site opens each of its sections with. */
export function Section({
  title,
  aside,
  children,
  className,
}: {
  title: ReactNode
  aside?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cx('relative border-t border-rule pt-5', className)}>
      <span aria-hidden="true" className="absolute left-0 top-[-1px] h-px w-10 bg-brass" />
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="font-serif text-lg font-semibold tracking-tight text-navy">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

const NOTICE = {
  info: 'border-navy/20 bg-navy/[0.04] text-ink',
  brass: 'border-brass/40 bg-brass/[0.08] text-ink',
  warning: 'border-warning/40 bg-warning/[0.08] text-ink',
  error: 'border-destructive/30 bg-destructive/[0.06] text-destructive',
} as const

export function Notice({
  tone = 'info',
  icon,
  children,
  action,
  className,
}: {
  tone?: keyof typeof NOTICE
  icon?: ReactNode
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cx(
        'flex items-center gap-3 rounded-md border px-4 py-3 text-sm [&>svg]:size-4 [&>svg]:shrink-0',
        NOTICE[tone],
        className,
      )}
    >
      {icon}
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  )
}

export const INPUT =
  'block h-9 w-full rounded-md border border-rule bg-card px-3 text-sm text-ink placeholder:text-muted-foreground/70 focus:border-brass focus:outline-none'

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[0.8rem] font-medium text-ink">
      {children}
    </label>
  )
}

/** A thin brass bar that moves while something runs whose end nobody can predict. */
export function ProgressBar({
  label = 'Working',
  className,
}: {
  label?: string
  className?: string
}) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      // Positioned by the caller: `absolute` to sit on an edge, `relative` to take a line of its own.
      className={cx('h-0.5 w-full overflow-hidden bg-brass/15', className ?? 'relative')}
    >
      <div className="progress-indeterminate absolute inset-y-0 w-1/3 bg-brass" />
    </div>
  )
}

/**
 * The way to a command's output: a button like the others, filled while the output is open. It turns red when
 * the command failed and its output is closed, which only happens once the user has closed it themselves.
 */
export function TerminalToggle({
  open,
  onToggle,
  failed = false,
}: {
  open: boolean
  onToggle: () => void
  failed?: boolean
}) {
  return (
    <Button
      variant={open ? 'primary' : 'secondary'}
      size="sm"
      aria-pressed={open}
      title={open ? 'Hide terminal' : 'Show terminal'}
      onClick={onToggle}
      className={cx(
        failed && !open && 'border-destructive/50 text-destructive hover:text-destructive',
      )}
    >
      <SquareTerminal />
      Terminal
    </Button>
  )
}

/**
 * Whether a command's output is shown: out of sight while it works, opened by the user, and opened by itself when
 * the command fails, since that is when the output is what matters.
 */
export function useOutputPanel(failed: boolean): [boolean, () => void] {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (failed) setOpen(true)
  }, [failed])

  return [open, () => setOpen((current) => !current)]
}

/** Output a person reads, not a terminal: the log of a command the Desktop ran for them. */
export function LogBlock({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <pre
      className={cx(
        'overflow-auto rounded-md border border-ink bg-ink p-4 font-mono text-[0.72rem] leading-relaxed text-paper/85',
        className,
      )}
    >
      {children}
    </pre>
  )
}
