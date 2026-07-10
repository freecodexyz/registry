import { useId, type ChangeEvent } from 'react'
import type { Address } from 'viem'
import { Select } from '@freecodexyz/ui'
import type { TradableAsset } from './tradeApi'
import { sanitizeDecimalInput } from './tradeUtils'

type TokenAmountInputProps = {
  label: string;
  amount: string;
  assets: readonly TradableAsset[];
  token: TradableAsset | null;
  metadata: string;
  balance: string;
  readOnly?: boolean;
  onAmountChange?: (amount: string) => void;
  onTokenChange: (address: Address) => void;
}

export function TokenAmountInput({
  label,
  amount,
  assets,
  token,
  metadata,
  balance,
  readOnly,
  onAmountChange,
  onTokenChange,
}: TokenAmountInputProps) {
  const amountInputId = useId()
  const tokenSelectId = useId()

  function handleAmountChange(event: ChangeEvent<HTMLInputElement>) {
    onAmountChange?.(sanitizeDecimalInput(event.currentTarget.value))
  }

  function handleTokenChange(event: ChangeEvent<HTMLSelectElement>) {
    onTokenChange(event.currentTarget.value as Address)
  }

  return (
    <section className="token-amount-input" aria-label={label}>
      <div className="token-amount-input__top">
        <label htmlFor={amountInputId}>{label}</label>
      </div>
      <div className="token-amount-input__control">
        <input
          id={amountInputId}
          className="token-amount-input__amount"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          readOnly={readOnly}
          value={amount}
          placeholder="0"
          onChange={handleAmountChange}
          aria-label={`${label} amount`}
        />
        <label className="token-amount-input__token" htmlFor={tokenSelectId}>
          <Select id={tokenSelectId} value={token?.address ?? ''} onChange={handleTokenChange} aria-label={`${label} token`}>
            {assets.map((swapToken) => (
              <option key={swapToken.address} value={swapToken.address}>{swapToken.symbol}</option>
            ))}
          </Select>
        </label>
      </div>
      <div className="token-amount-input__bottom">
        <span>{metadata}</span>
        <span>Balance <span className="token-swap-widget__number">{balance}</span></span>
      </div>
    </section>
  )
}
