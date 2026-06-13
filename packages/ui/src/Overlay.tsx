import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import { cx } from './cx'

type ToastProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  tone?: 'default' | 'danger';
  title: ReactNode;
}

export function Scrim({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('fcf-scrim', className)} {...props} />
}

export function Dialog({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div role="dialog" aria-modal="true" className={cx('fcf-dialog', className)} {...props} />
}

export function DialogEyebrow({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cx('fcf-dialog-eyebrow', className)} {...props} />
}

export function DialogTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={className} {...props} />
}

export function DialogDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={className} {...props} />
}

export function DialogActions({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('fcf-dialog-actions', className)} {...props} />
}

export function DialogClose({ className, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={cx('fcf-dialog-close', className)} {...props} />
}

export function TooltipHost({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cx('fcf-tooltip-host', className)} {...props} />
}

export function Tooltip({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cx('fcf-tooltip', className)} {...props} />
}

export function ToastStack({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('fcf-toast-stack', className)} {...props} />
}

export function Toast({ tone = 'default', title, children, className, ...props }: ToastProps) {
  return (
    <div className={cx('fcf-toast', tone === 'danger' && 'fcf-toast--danger', className)} {...props}>
      <span className="bar" />
      <span className="body">
        <span className="title">{title}</span>
        {children != null && <span className="desc">{children}</span>}
      </span>
    </div>
  )
}
