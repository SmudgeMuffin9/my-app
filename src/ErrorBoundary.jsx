import { Component } from 'react'

// Catches any crash in the game so we see a readable message on screen
// instead of a blank white page. Shows the error + a button to recover.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // also log it to the console for full detail
    console.error('Caught by ErrorBoundary:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <section id="center">
          <h1>💥 Oops — something crashed</h1>
          <p className="lb-error" style={{ whiteSpace: 'pre-wrap', maxWidth: 600 }}>
            {String(this.state.error?.message || this.state.error)}
          </p>
          <button
            className="play-btn"
            onClick={() => this.setState({ error: null })}
          >
            ↩️ Back to safety
          </button>
        </section>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
