import { useState, Component } from 'react'
import type { ReactNode } from 'react'
import { FileText, MessageSquare, Zap } from 'lucide-react'
import NotesPage from './pages/NotesPage'
import AskPage from './pages/AskPage'
import QuizPage from './pages/QuizPage'
import './index.css'

type Page = 'notes' | 'ask' | 'quiz'

const nav = [
  { id: 'notes' as Page, label: 'My Notes', icon: FileText },
  { id: 'ask' as Page, label: 'Ask AI', icon: MessageSquare },
  { id: 'quiz' as Page, label: 'Quiz Me', icon: Zap },
]

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null }
  static getDerivedStateFromError(e: Error) { return { error: e.message } }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 40, color: 'var(--danger)', fontFamily: 'var(--font-sans)' }}>
        <strong>Something went wrong:</strong> {this.state.error}
      </div>
    )
    return this.props.children
  }
}

export default function App() {
  const [page, setPage] = useState<Page>('notes')

  return (
    <ErrorBoundary>
      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="sidebar-brand">VaultArc <span>Learn</span></div>
            <div className="sidebar-sub">AI Study Companion</div>
          </div>
          <nav className="sidebar-nav">
            {nav.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`nav-item${page === id ? ' active' : ''}`}
                onClick={() => setPage(id)}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </nav>
        </aside>
        <main className="main">
          <ErrorBoundary>
            {page === 'notes' && <NotesPage />}
            {page === 'ask' && <AskPage />}
            {page === 'quiz' && <QuizPage />}
          </ErrorBoundary>
        </main>
      </div>
    </ErrorBoundary>
  )
}
