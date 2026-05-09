import { useState } from 'react'
import { FileText, MessageSquare, Zap } from 'lucide-react'
import NotesPage from './pages/NotesPage'
import AskPage from './pages/AskPage'
import QuizPage from './pages/QuizPage'
import './index.css'

type Page = 'notes' | 'ask' | 'quiz'

const nav = [
  { id: 'notes' as Page, label: 'Notes', icon: FileText },
  { id: 'ask' as Page, label: 'Ask AI', icon: MessageSquare },
  { id: 'quiz' as Page, label: 'Quiz', icon: Zap },
]

export default function App() {
  const [page, setPage] = useState<Page>('notes')

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>VaultArc Learn</h1>
          <p>Your AI study companion</p>
        </div>
        <nav className="sidebar-nav">
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item${page === id ? ' active' : ''}`}
              onClick={() => setPage(id)}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="main">
        {page === 'notes' && <NotesPage />}
        {page === 'ask' && <AskPage />}
        {page === 'quiz' && <QuizPage />}
      </main>
    </div>
  )
}
