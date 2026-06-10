import type { HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cx } from './cx'

type FieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

type ChoiceProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  children?: ReactNode;
}

export function Field({ label, hint, error, required, children, className }: FieldProps) {
  return (
    <label className={cx('fcf-field', className)}>
      <span className="fcf-label">
        {label}
        {required && <span className="req">*</span>}
      </span>
      {children}
      {error ? <span className="fcf-hint fcf-hint--error">{error}</span> : hint ? <span className="fcf-hint">{hint}</span> : null}
    </label>
  )
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx('fcf-input', className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx('fcf-textarea', className)} {...props} />
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="fcf-select-wrap">
      <select className={cx('fcf-select', className)} {...props}>{children}</select>
    </span>
  )
}

export function InputGroup({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('fcf-input-group', className)} {...props} />
}

export function InputAddon({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cx('fcf-input-addon', className)} {...props} />
}

export function Checkbox({ children, className, ...props }: ChoiceProps) {
  return (
    <label className={cx('fcf-check', className)}>
      <input type="checkbox" {...props} />
      <span className="box" />
      {children != null && <span>{children}</span>}
    </label>
  )
}

export function Radio({ children, className, ...props }: ChoiceProps) {
  return (
    <label className={cx('fcf-radio', className)}>
      <input type="radio" {...props} />
      <span className="dot" />
      {children != null && <span>{children}</span>}
    </label>
  )
}

export function Switch({ children, className, ...props }: ChoiceProps) {
  return (
    <label className={cx('fcf-switch', className)}>
      <input type="checkbox" {...props} />
      <span className="track" />
      {children != null && <span>{children}</span>}
    </label>
  )
}

export function Slider({ className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return <input type="range" className={cx('fcf-slider', className)} {...props} />
}
