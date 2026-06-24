import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Notice } from '@freecodexyz/ui'

type ErrorBoundaryProps = {
  children: ReactNode;
  label: string;
  resetKey: string;
}

type ErrorBoundaryState = {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`${this.props.label} render failed`, error, errorInfo)
  }

  componentDidUpdate(previousProps: ErrorBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="route-error" data-accent="emerald">
        <Notice tone="danger" role="alert">
          {this.props.label} failed to render. Reload the page or try another route.
        </Notice>
      </main>
    )
  }
}
