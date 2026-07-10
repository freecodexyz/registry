import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { Tab, Tabs } from '@freecodexyz/ui'

export type TradeView = {
  id: string;
  label: string;
  render: () => ReactNode;
}

type TradeViewSwitcherProps = {
  views: readonly TradeView[];
  paramName?: string;
}

export function TradeViewSwitcher({ views, paramName = 'view' }: TradeViewSwitcherProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedViewId = searchParams.get(paramName)
  const activeView = views.find((view) => view.id === selectedViewId) ?? views[0] ?? null

  function selectView(viewId: string) {
    const next = new URLSearchParams(searchParams)
    if (viewId === views[0]?.id) next.delete(paramName)
    else next.set(paramName, viewId)
    setSearchParams(next)
  }

  if (!activeView) return null

  const panelId = `trade-view-panel-${activeView.id}`
  const activeTabId = `trade-view-tab-${activeView.id}`

  return (
    <section className="trade-view-switcher" aria-label="Trade tools">
      <Tabs className="trade-view-switcher__tabs" aria-label="Trade view">
        {views.map((view) => {
          const selected = view.id === activeView.id
          return (
            <Tab
              key={view.id}
              id={`trade-view-tab-${view.id}`}
              className="trade-view-switcher__tab"
              selected={selected}
              aria-controls={selected ? panelId : undefined}
              onClick={() => selectView(view.id)}
            >
              {view.label}
            </Tab>
          )
        })}
      </Tabs>
      <div id={panelId} className="trade-view-switcher__panel" role="tabpanel" aria-labelledby={activeTabId}>
        {activeView.render()}
      </div>
    </section>
  )
}
