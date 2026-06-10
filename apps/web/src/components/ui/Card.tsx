import type { AnchorHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import { cx } from './cx'

type CardSurfaceProps = {
  soft?: boolean;
  pad?: 'sm' | 'lg';
  framed?: boolean;
  accentFrame?: boolean;
}

function cardClassName(props: CardSurfaceProps & { interactive?: boolean; className?: string }) {
  return cx(
    'fcf-card',
    props.soft && 'fcf-card--soft',
    props.pad && `fcf-card--pad-${props.pad}`,
    props.interactive && 'fcf-card--link',
    props.framed && 'fcf-frame',
    props.accentFrame && 'fcf-frame--accent',
    props.className,
  )
}

export function Card({ soft, pad, framed, accentFrame, className, ...props }: HTMLAttributes<HTMLDivElement> & CardSurfaceProps) {
  return <div className={cardClassName({ soft, pad, framed, accentFrame, className })} {...props} />
}

export function CardLink({ soft, pad, framed, accentFrame, className, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & CardSurfaceProps) {
  return <a className={cardClassName({ soft, pad, framed, accentFrame, interactive: true, className })} {...props} />
}

export function CardChrome({ label, meta, className }: { label: ReactNode; meta?: ReactNode; className?: string }) {
  return (
    <div className={cx('fcf-card-chrome', className)}>
      <span className="label">{label}</span>
      <span className="fill" />
      {meta != null && <span className="meta">{meta}</span>}
    </div>
  )
}

export function CardTitle({ as: Comp = 'h3', className, ...props }: HTMLAttributes<HTMLHeadingElement> & { as?: 'h2' | 'h3' | 'h4' }) {
  return <Comp className={cx('fcf-card-title', className)} {...props} />
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cx('fcf-card-body', className)} {...props} />
}

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('fcf-panel', className)} {...props} />
}

export function PanelRow({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('fcf-panel-row', className)} {...props} />
}

export function Grid({ columns = 2, className, ...props }: HTMLAttributes<HTMLDivElement> & { columns?: 2 | 3 | 4 }) {
  return <div className={cx('fcf-grid', `fcf-grid--${columns}`, className)} {...props} />
}

export function Stat({ label, value, delta, deltaTone = 'up', className }: { label: ReactNode; value: ReactNode; delta?: ReactNode; deltaTone?: 'up' | 'down'; className?: string }) {
  return (
    <div className={cx('fcf-stat', className)}>
      <span className="k">{label}</span>
      <span className="v">{value}</span>
      {delta != null && <span className={cx('d', deltaTone === 'down' && 'd--down')}>{delta}</span>}
    </div>
  )
}
