import type { HTMLAttributes, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { cx } from './cx'

export function TableViewport({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('data-table-scroll', className)} {...props} />
}

export function Table({ zebra, className, ...props }: TableHTMLAttributes<HTMLTableElement> & { zebra?: boolean }) {
  return <table className={cx('fcf-table', zebra && 'fcf-table--zebra', className)} {...props} />
}

export function TableCell({ className, numeric, mono, ...props }: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean; mono?: boolean }) {
  return <td className={cx(numeric && 'num', mono && 'mono', className)} {...props} />
}

export function TableHeader({ className, numeric, ...props }: ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return <th className={cx(numeric && 'num', className)} {...props} />
}
