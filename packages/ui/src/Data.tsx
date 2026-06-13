import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { cx } from './cx'

export function Meta({ columns, className, style, ...props }: HTMLAttributes<HTMLDivElement> & { columns?: number }) {
  const metaStyle = columns == null ? style : ({ ...(style ?? {}), '--cols': String(columns) } as CSSProperties)

  return <div className={cx('fcf-meta', className)} style={metaStyle} {...props} />
}

export function MetaCell({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cx('fcf-meta-cell', className)}>
      <span className="k">{label}</span>
      <span className="v">{children}</span>
    </div>
  )
}

export function Specs({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('fcf-specs', className)} {...props} />
}

export function SpecRow({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cx('fcf-spec-row', className)}>
      <span className="k">{label}</span>
      <span className="v">{children}</span>
    </div>
  )
}

export function Meter({ value, max = 100, className, ...props }: HTMLAttributes<HTMLDivElement> & { value: number; max?: number }) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0

  return (
    <div className={cx('fcf-meter', className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} {...props}>
      <span style={{ width: `${percent}%` }} />
    </div>
  )
}

export function CodeBlock({ className, ...props }: HTMLAttributes<HTMLPreElement>) {
  return <pre className={cx('fcf-code', className)} {...props} />
}
