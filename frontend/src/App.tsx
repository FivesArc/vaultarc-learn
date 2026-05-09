import { useState, Component } from 'react'
import type { ReactNode } from 'react'
import { FileText, MessageSquare, Zap, Layers, Menu, X } from 'lucide-react'
import NotesPage from './pages/NotesPage'
import AskPage from './pages/AskPage'
import QuizPage from './pages/QuizPage'
import FlashcardsPage from './pages/FlashcardsPage'
import './index.css'

type Page = 'notes' | 'ask' | 'quiz' | 'flashcards'

const nav = [
  { id: 'notes' as Page, label: 'My Notes', icon: FileText },
  { id: 'ask' as Page, label: 'Ask AI', icon: MessageSquare },
  { id: 'flashcards' as Page, label: 'Flashcards', icon: Layers },
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
  const [sidebarOpen, setSidebarOpen] = useState(false)

  function navigate(id: Page) {
    setPage(id)
    setSidebarOpen(false)
  }

  return (
    <ErrorBoundary>
      <div className="layout">
        {/* Mobile overlay */}
        {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

        <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
          <div className="sidebar-header" style={{ cursor: 'pointer' }} onClick={() => navigate('notes')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="sidebar-brand">VaultArc <span>Learn</span></div>
                <div className="sidebar-sub">AI Study Companion</div>
              </div>
              <button className="mobile-close" onClick={(e) => { e.stopPropagation(); setSidebarOpen(false) }}><X size={16} /></button>
            </div>
          </div>
          <nav className="sidebar-nav">
            {nav.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`nav-item${page === id ? ' active' : ''}`}
                onClick={() => navigate(id)}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="main-wrapper">
          <div className="mobile-header">
            <button className="btn-ghost mobile-menu-btn" onClick={() => setSidebarOpen(true)}><Menu size={18} /></button>
            <div className="sidebar-brand" style={{ fontSize: 16 }}>VaultArc <span style={{ color: 'var(--accent)', fontStyle: 'italic' }}>Learn</span></div>
          </div>
          <main className="main">
            <ErrorBoundary>
              {page === 'notes' && <NotesPage />}
              {page === 'ask' && <AskPage />}
              {page === 'flashcards' && <FlashcardsPage />}
              {page === 'quiz' && <QuizPage />}
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </ErrorBoundary>
  )
}
