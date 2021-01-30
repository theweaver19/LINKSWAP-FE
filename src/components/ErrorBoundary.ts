import React, { Component, ReactNode } from 'react'

export interface Props {
  children: ReactNode
}

type State = {
  readonly error: Error | null
  readonly errorInfo?: Object
}

export class ErrorBoundary extends Component<Props, State> {
  readonly state: State = {
    error: null
  }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: Object): void {
    this.setState({ error, errorInfo })
  }
  render(): any {
    if (this.state.error) {
      return 'Please make sure you have metamask installed on your browser and refresh the page'
    }

    return this.props.children
  }
}

export default ErrorBoundary
