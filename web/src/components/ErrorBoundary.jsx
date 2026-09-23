import React from "react";

// A thrown render error used to blank the entire page. Contain it to the section
// that failed so the rest of the app stays usable.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }

  static getDerivedStateFromError(err) {
    return { err };
  }

  componentDidCatch(err, info) {
    console.error("Market Tape:", this.props.label || "section", "failed", err, info);
  }

  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.err) {
      this.setState({ err: null });
    }
  }

  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="note" style={{ borderLeftColor: "var(--neg)" }}>
        <h3>{this.props.label || "This section"} could not render</h3>
        <p>
          The rest of the app still works. The error was{" "}
          <code>{String(this.state.err.message || this.state.err)}</code>.
        </p>
        {this.props.onDismiss && (
          <button className="btn" onClick={this.props.onDismiss}>Close</button>
        )}
      </div>
    );
  }
}
