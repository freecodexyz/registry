import { useState } from 'react'
import type { TradableAsset } from './tradeApi'

type TokenIconProps = {
  asset: TradableAsset | null;
  className?: string;
  loading?: 'eager' | 'lazy';
}

export function TokenIcon({ asset, className = '', loading = 'lazy' }: TokenIconProps) {
  const imageUrl = readImageUrl(asset?.imageUrl)
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const shouldLoadImage = imageUrl !== null && failedUrl !== imageUrl
  const fallback = readFallbackLabel(asset)
  const classes = ['token-icon', className].filter(Boolean).join(' ')

  return (
    <span className={classes} aria-hidden="true">
      {shouldLoadImage
        ? (
            <img
              className="token-icon__image"
              src={imageUrl}
              alt=""
              width="32"
              height="32"
              loading={loading}
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setFailedUrl(imageUrl)}
            />
          )
        : <span className="token-icon__fallback">{fallback}</span>}
    </span>
  )
}

function readImageUrl(value: string | undefined): string | null {
  if (!value) return null

  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

function readFallbackLabel(asset: TradableAsset | null): string {
  const symbol = asset?.symbol.trim()
  if (!symbol) return '?'
  return symbol.slice(0, 2).toUpperCase()
}
