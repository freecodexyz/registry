import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes } from 'react'
import { cx } from './cx'

export function NavLinks({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('fcf-navlinks', className)} {...props} />
}

export function NavLink({ active, className, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { active?: boolean }) {
  return <a className={cx('fcf-navlink', active && 'fcf-navlink--active', className)} {...props} />
}

export function Tabs({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div role="tablist" className={cx('fcf-tabs', className)} {...props} />
}

export function Tab({ selected, className, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return <button type={type} role="tab" aria-selected={selected} className={cx('fcf-tab', className)} {...props} />
}

export function Segment({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('fcf-segment', className)} {...props} />
}

export function SegmentButton({ pressed, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { pressed?: boolean }) {
  return <button type={type} aria-pressed={pressed} {...props} />
}

export function Breadcrumb({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <nav aria-label="Breadcrumb" className={cx('fcf-breadcrumb', className)} {...props} />
}

export function BreadcrumbLink({ className, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a className={className} {...props} />
}

export function BreadcrumbSeparator({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span aria-hidden="true" className={cx('sep', className)} {...props} />
}

export function BreadcrumbCurrent({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span aria-current="page" className={className} {...props} />
}

export function Pagination({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('fcf-pagination', className)} {...props} />
}

export function PaginationButton({ current, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { current?: boolean }) {
  return <button type={type} aria-current={current ? 'true' : undefined} {...props} />
}
