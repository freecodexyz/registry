import { useId, useState, type ChangeEvent, type ReactNode } from 'react'
import { FaCoins } from 'react-icons/fa'
import { FiSearch } from 'react-icons/fi'
import type { Address } from 'viem'
import { DialogClose, Scrim } from '@freecodexyz/ui'
import type { TradableAsset } from './tradeApi'
import { TokenIcon } from './TokenIcon'
import { balanceKey, type TokenBalanceMap, type TokenBalanceState } from './useTokenBalance'

type TokenSelectorDialogProps = {
  assets: readonly TradableAsset[];
  balances: TokenBalanceMap;
  selectedToken: TradableAsset | null;
  onSelect: (address: Address) => void;
  onClose: () => void;
}

const UNKNOWN_BALANCE: TokenBalanceState = { label: '--', amount: null }

export function TokenSelectorDialog({ assets, balances, selectedToken, onSelect, onClose }: TokenSelectorDialogProps) {
  const titleId = useId()
  const yourTokensId = useId()
  const tradableAssetsId = useId()
  const [searchQuery, setSearchQuery] = useState('')
  const visibleAssets = assets.filter((asset) => matchesTokenSearch(asset, searchQuery))
  const walletAssets = visibleAssets.filter((asset) => hasPositiveBalance(readAssetBalance(balances, asset)))

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
    setSearchQuery(event.currentTarget.value)
  }

  function handleTokenSelect(address: Address) {
    onSelect(address)
    onClose()
  }

  return (
    <Scrim className="token-selector-scrim" onClick={onClose}>
      <div
        className="token-selector-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="token-selector-dialog__top">
          <h2 id={titleId}>Select a token</h2>
          <DialogClose className="token-selector-dialog__close" aria-label="Close token selector" onClick={onClose}>×</DialogClose>
        </header>
        <input
          className="token-selector-dialog__search"
          type="search"
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Search symbol, name, address"
          aria-label="Search tokens"
          autoComplete="off"
        />
        <div className="token-selector-dialog__content">
          <TokenSelectorSection
            title="Your Tokens"
            icon={<FaCoins aria-hidden="true" focusable="false" />}
            titleId={yourTokensId}
            assets={walletAssets}
            balances={balances}
            selectedToken={selectedToken}
            emptyLabel={searchQuery ? 'No wallet tokens match' : 'No wallet tokens'}
            onSelect={handleTokenSelect}
          />
          <TokenSelectorSection
            title="Tradable Assets"
            icon={<FiSearch aria-hidden="true" focusable="false" />}
            titleId={tradableAssetsId}
            assets={visibleAssets}
            balances={balances}
            selectedToken={selectedToken}
            emptyLabel={searchQuery ? 'No tradable assets match' : 'No tradable assets'}
            onSelect={handleTokenSelect}
          />
        </div>
      </div>
    </Scrim>
  )
}

function TokenSelectorSection({
  title,
  icon,
  titleId,
  assets,
  balances,
  selectedToken,
  emptyLabel,
  onSelect,
}: {
  title: string;
  icon: ReactNode;
  titleId: string;
  assets: readonly TradableAsset[];
  balances: TokenBalanceMap;
  selectedToken: TradableAsset | null;
  emptyLabel: string;
  onSelect: (address: Address) => void;
}) {
  return (
    <section className="token-selector-dialog__section" aria-labelledby={titleId}>
      <h3 id={titleId}>
        <span className="token-selector-dialog__section-icon">{icon}</span>
        <span>{title}</span>
      </h3>
      <div className="token-selector-dialog__list">
        {assets.length > 0
          ? assets.map((asset) => (
              <TokenSelectorRow
                key={asset.address}
                asset={asset}
                balance={readAssetBalance(balances, asset)}
                selected={selectedToken?.address.toLowerCase() === asset.address.toLowerCase()}
                onSelect={onSelect}
              />
            ))
          : <span className="token-selector-dialog__empty">{emptyLabel}</span>}
      </div>
    </section>
  )
}

function TokenSelectorRow({ asset, balance, selected, onSelect }: { asset: TradableAsset; balance: TokenBalanceState; selected: boolean; onSelect: (address: Address) => void }) {
  return (
    <button
      className="token-selector-dialog__row"
      type="button"
      onClick={() => onSelect(asset.address)}
      aria-pressed={selected}
    >
      <span className="token-selector-dialog__asset">
        <TokenIcon asset={asset} />
        <span className="token-selector-dialog__identity">
          <span className="token-selector-dialog__symbol">{asset.symbol}</span>
          <span className="token-selector-dialog__name">{asset.name}</span>
        </span>
      </span>
      <TokenSelectorBalance asset={asset} balance={balance} />
    </button>
  )
}

function TokenSelectorBalance({ asset, balance }: { asset: TradableAsset; balance: TokenBalanceState }) {
  if (!balance.amount) {
    return <span className="token-selector-dialog__balance token-selector-dialog__balance--muted">{balance.label}</span>
  }

  const symbolSuffix = ` ${asset.symbol}`
  const amountLabel = balance.label.endsWith(symbolSuffix)
    ? balance.label.slice(0, -symbolSuffix.length)
    : balance.label

  return (
    <span className="token-selector-dialog__balance" title={balance.label}>
      <span className="token-selector-dialog__balance-amount">{amountLabel}</span>
      <span className="token-selector-dialog__balance-symbol">{asset.symbol}</span>
    </span>
  )
}

function matchesTokenSearch(asset: TradableAsset, query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return true

  return asset.symbol.toLowerCase().includes(normalizedQuery) ||
    asset.name.toLowerCase().includes(normalizedQuery) ||
    asset.address.toLowerCase().includes(normalizedQuery)
}

function readAssetBalance(balances: TokenBalanceMap, asset: TradableAsset) {
  return balances[balanceKey(asset.address)] ?? UNKNOWN_BALANCE
}

function hasPositiveBalance(balance: TokenBalanceState) {
  if (!balance.amount) return false

  try {
    return BigInt(balance.amount) > 0n
  } catch {
    return false
  }
}
