import { useState, useEffect, useRef } from 'react'
import { Timer, RotateCcw, Play, Pause, Coffee } from 'lucide-react'

type Phase = 'focus' | 'short' | 'long'

const PHASES: Record<Phase, { label: string; default: number; color: string }> = {
  focus: { label: 'Focus', default: 25, color: 'var(--accent)' },
  short: { label: 'Short Break', default: 5, color: 'var(--success)' },
  long: { label: 'Long Break', default: 15, color: '#6a9ec4' },
}

export default function StudyTimerPage() {
  const [phase, setPhase] = useState<Phase>('focus')
  const [durations, setDurations] = useState({ focus: 25, short: 5, long: 15 })
  const [secondsLeft, setSecondsLeft] = useState(25 * 60)
  const [running, setRunning] = useState(false)
  const [sessions, setSessions] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            clearInterval(intervalRef.current!)
            setRunning(false)
            if (phase === 'focus') setSessions((n) => n + 1)
            return 0
          }
          return s - 1
        })
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running, phase])

  function switchPhase(p: Phase) {
    setRunning(false)
    setPhase(p)
    setSecondsLeft(durations[p] * 60)
  }

  function reset() {
    setRunning(false)
    setSecondsLeft(durations[phase] * 60)
  }

  function updateDuration(p: Phase, val: number) {
    const v = Math.max(1, Math.min(60, val))
    setDurations((d) => ({ ...d, [p]: v }))
    if (p === phase && !running) setSecondsLeft(v * 60)
  }

  const total = durations[phase] * 60
  const progress = (total - secondsLeft) / total
  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const secs = String(secondsLeft % 60).padStart(2, '0')
  const phaseInfo = PHASES[phase]

  const r = 90
  const circ = 2 * Math.PI * r
  const dash = circ * (1 - progress)

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Study Timer</h2>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{sessions} session{sessions !== 1 ? 's' : ''} completed today</span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
        {(Object.keys(PHASES) as Phase[]).map((p) => (
          <button key={p} onClick={() => switchPhase(p)} style={{ fontSize: 13, padding: '6px 16px', borderRadius: 999, background: phase === p ? 'var(--accent)' : 'var(--surface2)', color: phase === p ? '#fff' : 'var(--text-muted)', border: `1px solid ${phase === p ? 'var(--accent)' : 'var(--border)'}`, cursor: 'pointer', fontWeight: phase === p ? 600 : 400 }}>
            {PHASES[p].label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 40 }}>
        <svg width={220} height={220} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={110} cy={110} r={r} fill="none" stroke="var(--border)" strokeWidth={10} />
          <circle cx={110} cy={110} r={r} fill="none" stroke={phaseInfo.color} strokeWidth={10}
            strokeDasharray={circ} strokeDashoffset={dash}
            style={{ transition: running ? 'stroke-dashoffset 1s linear' : 'none' }} />
        </svg>
        <div style={{ marginTop: -140, textAlign: 'center', zIndex: 1, position: 'relative' }}>
          <div style={{ fontSize: 52, fontWeight: 700, fontFamily: 'var(--font-serif)', color: 'var(--text)', letterSpacing: 2 }}>{mins}:{secs}</div>
          <div style={{ fontSize: 13, color: phaseInfo.color, fontWeight: 600, marginTop: 4 }}>{phaseInfo.label}</div>
        </div>
        <div style={{ marginTop: 60 }} />
      </div>

      <div className="flex gap-2" style={{ justifyContent: 'center', marginBottom: 40 }}>
        <button onClick={() => setRunning((r) => !r)} className="btn-primary" style={{ padding: '12px 32px', fontSize: 15, gap: 8 }}>
          {running ? <><Pause size={16} />Pause</> : <><Play size={16} />{secondsLeft === durations[phase] * 60 ? 'Start' : 'Resume'}</>}
        </button>
        <button onClick={reset} className="btn-ghost" style={{ padding: '12px 20px' }}><RotateCcw size={16} /></button>
      </div>

      <div className="card" style={{ maxWidth: 400 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 16, color: 'var(--text-muted)' }}>Duration Settings (minutes)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(Object.keys(PHASES) as Phase[]).map((p) => (
            <div key={p} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {p === 'focus' ? <Timer size={14} color={PHASES[p].color} /> : <Coffee size={14} color={PHASES[p].color} />}
                <span style={{ fontSize: 13 }}>{PHASES[p].label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => updateDuration(p, durations[p] - 1)} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface2)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                <span style={{ width: 28, textAlign: 'center', fontSize: 14, fontWeight: 600 }}>{durations[p]}</span>
                <button onClick={() => updateDuration(p, durations[p] + 1)} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface2)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
