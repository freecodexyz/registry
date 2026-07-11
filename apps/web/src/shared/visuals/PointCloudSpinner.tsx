import type { CSSProperties, HTMLAttributes } from 'react'
import { ScreenReaderOnly } from '@freecodexyz/ui'
import { PointCloud, type PointCloudShape } from './PointCloud'

const SPINNER_SCALES = {
  xs: 0.56,
  sm: 0.72,
  md: 0.9,
  lg: 1.15,
} as const

export type PointCloudSpinnerScale = keyof typeof SPINNER_SCALES | number

type PointCloudSpinnerProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  label?: string;
  scale?: PointCloudSpinnerScale;
  shape?: PointCloudShape;
}

function resolveScale(scale: PointCloudSpinnerScale) {
  const resolvedScale = typeof scale === 'number' ? scale : SPINNER_SCALES[scale]
  return Math.min(1.8, Math.max(0.35, resolvedScale))
}

export function PointCloudSpinner({ label = 'Loading', scale = 'md', shape = 'mobius', className, style, role = 'status', ...props }: PointCloudSpinnerProps) {
  const resolvedScale = resolveScale(scale)
  const spinnerStyle = {
    ...style,
    '--point-cloud-spinner-scale': String(resolvedScale),
  } as CSSProperties
  const spinnerClassName = className ? `point-cloud-spinner ${className}` : 'point-cloud-spinner'

  return (
    <div className={spinnerClassName} role={role} style={spinnerStyle} {...props}>
      <PointCloud className="point-cloud-spinner__cloud" shape={shape} density={Math.max(0.35, Math.min(0.75, resolvedScale))} />
      {label && <ScreenReaderOnly>{label}</ScreenReaderOnly>}
    </div>
  )
}
