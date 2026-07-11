import { useId, useState, type ChangeEvent } from 'react'
import type { Address } from 'viem'
import type { TradableAsset } from './tradeApi'
import { NumericText } from './NumericText'
import { TokenIcon } from './TokenIcon'
import { sanitizeDecimalInput } from './tradeUtils'
import { TokenSelectorDialog } from './TokenSelectorDialog'
import type { TokenBalanceMap } from './useTokenBalance'

type TokenAmountInputProps = {
  label: string;
  amount: string;
  assets: readonly TradableAsset[];
  balances: TokenBalanceMap;
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
  balances,
  token,
  metadata,
  balance,
  readOnly,
  onAmountChange,
  onTokenChange,
}: TokenAmountInputProps) {
  const amountInputId = useId()
  const [isSelectorOpen, setIsSelectorOpen] = useState(false)

  function handleAmountChange(event: ChangeEvent<HTMLInputElement>) {
    onAmountChange?.(sanitizeDecimalInput(event.currentTarget.value))
  }

  function handleTokenChange(address: Address) {
    onTokenChange(address)
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
        <button
          className="token-amount-input__token"
          type="button"
          onClick={() => setIsSelectorOpen(true)}
          aria-haspopup="dialog"
        >
          <TokenIcon asset={token} className="token-amount-input__token-icon" loading="eager" />
          <span>{token?.symbol ?? 'Select'}</span>
        </button>
      </div>
      <div className="token-amount-input__bottom">
        <span><NumericText value={metadata} /></span>
        <span>Balance <NumericText value={balance} /></span>
      </div>
      {isSelectorOpen && (
        <TokenSelectorDialog
          assets={assets}
          balances={balances}
          selectedToken={token}
          onSelect={handleTokenChange}
          onClose={() => setIsSelectorOpen(false)}
        />
      )}
    </section>
  )
}
