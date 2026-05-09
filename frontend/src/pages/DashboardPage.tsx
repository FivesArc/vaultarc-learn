import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import type { ProgressResult } from '../lib/api'
import { loadGamification, loadWeakAreas, removeWeakArea, BADGE_DEFS } from '../lib/gamification'
import type { WeakArea } from '../lib/gamification'
import { loadDeck, getDueCards } from '../lib/srs'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { Flame, Zap, CheckCircle, X, Trophy, BookOpen } from 'lucide-react'

export default function DashboardPage() {
  const [results, setResults] = useState<ProgressResult[]>([])
  const [weakAreas, setWeakAreas] = useState<WeakArea[]>([])
  const [loading, setLoading] = useState(true)
  const gam = loadGamification()

  useEffect(() => {
    api.progress().then((r) => { setResults(r); setLoading(false) }).catch(() => setLoading(false))
    setWeakAreas(loadWeakAreas())
  }, [])

  function dismiss(question: string) {
    removeWeakArea(question)
    setWeakAreas(loadWeakAreas())
  }

  // Line chart data: last 20 quiz attempts
  const lineData = [...results].reverse().slice(-20).map((r) => ({
    name: new Date(r.taken_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    score: Math.round((r.score / r.total) * 100),
  }))

  // Bar chart: avg score by note
  const byNote: Record<string, { total: number; count: number }> = {}
  for (const r of results) {
    if (!byNote[r.note_title]) byNote[r.note_title] = { total: 0, count: 0 }
    byNote[r.note_title].total += Math.round((r.score / r.total) * 100)
    byNote[r.note_title].count += 1
  }
  const barData = Object.entries(byNote).map(([name, v]) => ({
    name: name.length > 20 ? name.slice(0, 20) + '…' : name,
    avg: Math.round(v.total / v.count),
  })).sort((a, b) => a.avg - b.avg)

  const avgScore = results.length
    ? Math.round(results.reduce((s, r) => s + (r.score / r.total) * 100, 0) / results.length)
    : 0

  const earnedBadges = BADGE_DEFS.filter((b) => gam.badges.includes(b.id))
  const lockedBadges = BADGE_DEFS.filter((b) => !gam.badges.includes(b.id))

  const xpForLevel = 500
  const level = Math.floor(gam.xp / xpForLevel) + 1
  const xpProgress = gam.xp % xpForLevel

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Dashboard</h2>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard icon={<Flame size={20} color="#b87040" />} label="Study Streak" value={`${gam.streak} day${gam.streak !== 1 ? 's' : ''}`} sub="keep it going" />
        <StatCard icon={<Zap size={20} color="#b87040" />} label="XP" value={gam.xp.toString()} sub={`Level ${level}`} />
        <StatCard icon={<CheckCircle size={20} color="#4a7c5e" />} label="Quizzes Done" value={results.length.toString()} sub="total attempts" />
        <StatCard icon={<Trophy size={20} color="#b87040" />} label="Avg Score" value={results.length ? `${avgScore}%` : '—'} sub="across all quizzes" />
        <StatCard icon={<BookOpen size={20} color="#6a9ec4" />} label="Cards Due" value={(() => { try { const all = Object.keys(localStorage).filter(k => k.startsWith('vaultarc-srs-')); return all.reduce((n, k) => { const d = loadDeck(k.replace('vaultarc-srs-', '')); return n + getDueCards(d).length }, 0).toString() } catch { return '0' } })()} sub="for review today" />
      </div>

      {/* XP bar */}
      <div className="card" style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
          <span style={{ fontWeight: 600 }}>Level {level}</span>
          <span style={{ color: 'var(--text-muted)' }}>{xpProgress} / {xpForLevel} XP</span>
        </div>
        <div style={{ height: 10, background: 'var(--surface2)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(xpProgress / xpForLevel) * 100}%`, background: 'var(--accent)', borderRadius: 999, transition: 'width 0.5s ease' }} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{xpForLevel - xpProgress} XP to Level {level + 1}</div>
      </div>

      {/* Charts */}
      {results.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, marginBottom: 32 }}>
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 16, fontSize: 14 }}>Quiz Score History</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v: any) => `${v}%`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Line type="monotone" dataKey="score" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {barData.length > 0 && (
            <div className="card">
              <div style={{ fontWeight: 600, marginBottom: 16, fontSize: 14 }}>Score by Topic</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip formatter={(v: any) => `${v}%`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="avg" fill="var(--accent)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {loading && <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>Loading quiz history…</div>}

      {/* Weak areas */}
      {weakAreas.length > 0 && (
        <div className="card" style={{ marginBottom: 32 }}>
          <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 14, color: 'var(--danger)' }}>⚠️ Topics to Revisit</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Questions you've answered wrong — go back to these notes.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {weakAreas.map((w) => (
              <div key={w.question} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3 }}>{w.question}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{w.note_title} · wrong {w.wrong_count}×</div>
                </div>
                <button onClick={() => dismiss(w.question)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', padding: 4, cursor: 'pointer', flexShrink: 0 }}><X size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Badges */}
      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 16, fontSize: 14 }}>Badges</div>
        {earnedBadges.length > 0 && (
          <>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>EARNED</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
              {earnedBadges.map((b) => (
                <div key={b.id} style={{ textAlign: 'center', padding: '12px 16px', background: 'var(--accent-light)', border: '1px solid rgba(184,112,64,0.3)', borderRadius: 12, minWidth: 90 }}>
                  <div style={{ fontSize: 28 }}>{b.emoji}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginTop: 6, color: 'var(--accent)' }}>{b.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{b.desc}</div>
                </div>
              ))}
            </div>
          </>
        )}
        {lockedBadges.length > 0 && (
          <>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>LOCKED</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {lockedBadges.map((b) => (
                <div key={b.id} style={{ textAlign: 'center', padding: '12px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, minWidth: 90, opacity: 0.5 }}>
                  <div style={{ fontSize: 28, filter: 'grayscale(1)' }}>{b.emoji}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginTop: 6 }}>{b.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{b.desc}</div>
                </div>
              ))}
            </div>
          </>
        )}
        {earnedBadges.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Complete quizzes, review flashcards and study daily to earn badges.</div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>{icon}{label}</div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub}</div>
    </div>
  )
}
