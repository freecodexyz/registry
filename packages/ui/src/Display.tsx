import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from './cx'

export function Dot({ size, round, className, ...props }: HTMLAttributes<HTMLSpanElement> & { size?: 'sm'; round?: boolean }) {
  return <span className={cx('fcf-dot', size === 'sm' && 'fcf-dot--sm', round && 'fcf-dot--round', className)} {...props} />
}

export function Rule({ solid, className, ...props }: HTMLAttributes<HTMLHRElement> & { solid?: boolean }) {
  return <hr className={cx('fcf-rule', solid && 'fcf-rule--solid', className)} {...props} />
}

export function Eyebrow({ plain, className, ...props }: HTMLAttributes<HTMLSpanElement> & { plain?: boolean }) {
  return <span className={cx('fcf-eyebrow', plain && 'fcf-eyebrow--plain', className)} {...props} />
}

export function MonoText({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cx('fcf-mono', className)} {...props} />
}

export function Frame({ accent, className, ...props }: HTMLAttributes<HTMLDivElement> & { accent?: boolean }) {
  return <div className={cx('fcf-frame', accent && 'fcf-frame--accent', className)} {...props} />
}

export function ScreenReaderOnly({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cx('fcf-sr-only', className)} {...props} />
}

export function Skeleton({ className, 'aria-hidden': ariaHidden = true, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden={ariaHidden} className={cx('fcf-skeleton', className)} {...props} />
}

export function Status({ tone = 'live', className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: 'live' | 'idle' | 'danger' }) {
  return <span className={cx('fcf-status', tone !== 'live' && `fcf-status--${tone}`, className)} {...props} />
}

export function Badge({ variant = 'default', dot, className, ...props }: HTMLAttributes<HTMLSpanElement> & { variant?: 'default' | 'accent' | 'solid' | 'dark' | 'danger'; dot?: boolean }) {
  return <span className={cx('fcf-badge', variant !== 'default' && `fcf-badge--${variant}`, dot && 'fcf-badge--dot', className)} {...props} />
}

export function Tag({ onRemove, removeLabel = 'Remove tag', children, className, ...props }: HTMLAttributes<HTMLSpanElement> & { onRemove?: () => void; removeLabel?: string }) {
  return (
    <span className={cx('fcf-tag', className)} {...props}>
      {children}
      {onRemove && <button type="button" aria-label={removeLabel} onClick={onRemove}>×</button>}
    </span>
  )
}

export function Notice({ tone = 'default', className, ...props }: HTMLAttributes<HTMLParagraphElement> & { tone?: 'default' | 'danger' }) {
  return <p className={cx('fcf-notice', tone === 'danger' && 'fcf-notice--danger', className)} {...props} />
}

export function KeyValue({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <span className={cx('fcf-kv', className)}>
      <span className="k">{label}</span>
      <span className="v">{children}</span>
    </span>
  )
}
