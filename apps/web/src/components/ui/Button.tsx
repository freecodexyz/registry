import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes } from 'react'
import { cx } from './cx'

type ButtonVariant = 'accent' | 'dark' | 'ghost' | 'light' | 'danger'
type ButtonSize = 'sm' | 'lg'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  icon?: boolean;
}

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  icon?: boolean;
}

function buttonClassName(variant: ButtonVariant, size: ButtonSize | undefined, block: boolean | undefined, icon: boolean | undefined, className: string | undefined) {
  return cx('fcf-btn', `fcf-btn--${variant}`, size && `fcf-btn--${size}`, block && 'fcf-btn--block', icon && 'fcf-btn--icon', className)
}

export function Button({ variant = 'accent', size, block, icon, className, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClassName(variant, size, block, icon, className)}
      {...props}
    />
  )
}

export function ButtonLink({ variant = 'accent', size, block, icon, className, ...props }: ButtonLinkProps) {
  return <a className={buttonClassName(variant, size, block, icon, className)} {...props} />
}

export function ButtonGroup({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('fcf-btn-group', className)} {...props} />
}
