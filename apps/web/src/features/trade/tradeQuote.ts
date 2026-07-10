import type { SwapJob } from './tradeApi'
import { isRecord } from './tradeUtils'

export function readQuoteInputAmount(swap: SwapJob | null): string | null {
  return readNestedString(swap?.quote?.quote, ['input', 'amount']) ?? readNestedString(swap?.quote?.raw, ['quote', 'input', 'amount'])
}

export function readQuoteOutputAmount(swap: SwapJob | null): string | null {
  return readNestedString(swap?.quote?.quote, ['output', 'amount']) ?? readNestedString(swap?.quote?.raw, ['quote', 'output', 'amount'])
}

export function readQuoteInputUsd(swap: SwapJob | null): string | null {
  return readNestedString(swap?.quote?.quote, ['input', 'usd']) ?? readNestedString(swap?.quote?.raw, ['quote', 'input', 'usd'])
}

export function readQuoteOutputUsd(swap: SwapJob | null): string | null {
  return readNestedString(swap?.quote?.quote, ['output', 'usd']) ?? readNestedString(swap?.quote?.raw, ['quote', 'output', 'usd'])
}

function readNestedString(value: unknown, path: readonly string[]): string | null {
  let current = value
  for (const key of path) {
    if (!isRecord(current)) return null
    current = current[key]
  }

  return typeof current === 'string' && current ? current : null
}
