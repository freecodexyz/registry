import { Button } from '@freecodexyz/ui'

type WalletConnector = {
  id: string;
  name: string;
}

type WalletConnectorMenuProps<TConnector extends WalletConnector> = {
  connectors: readonly TConnector[];
  isOpen: boolean;
  onConnect: (connector: TConnector) => void;
  className?: string;
}

export function WalletConnectorMenu<TConnector extends WalletConnector>({ connectors, isOpen, onConnect, className = 'connect-menu__list' }: WalletConnectorMenuProps<TConnector>) {
  if (!isOpen) return null

  return (
    <div className={className} role="menu">
      {connectors.map((connector) => (
        <Button key={connector.id} variant="ghost" size="sm" block role="menuitem" onClick={() => onConnect(connector)}>
          {connector.name}
        </Button>
      ))}
    </div>
  )
}
