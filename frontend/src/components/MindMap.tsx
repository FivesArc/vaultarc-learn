type Branch = { name: string; children: string[] }
type Props = { center: string; branches: Branch[] }

const BRANCH_COLORS = ['#b87040', '#4a7c5e', '#6a9ec4', '#9b59b6', '#e67e22', '#1abc9c']

export default function MindMap({ center, branches }: Props) {
  const W = 400
  const H = 300
  const cx = W / 2
  const cy = H / 2
  const r = 118

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', maxWidth: 400, height: 'auto', display: 'block', margin: '0 auto' }}
      aria-label="Mind map"
    >
      {branches.map((branch, bi) => {
        const total = branches.length
        const angle = (2 * Math.PI / total) * bi - Math.PI / 2
        const bx = cx + r * Math.cos(angle)
        const by = cy + r * Math.sin(angle)
        const color = BRANCH_COLORS[bi % BRANCH_COLORS.length]
        const words = branch.name.split(' ')
        const mid = Math.ceil(words.length / 2)
        const line1 = words.slice(0, mid).join(' ')
        const line2 = words.slice(mid).join(' ')

        return (
          <g key={bi}>
            <line x1={cx} y1={cy} x2={bx} y2={by}
              stroke={color} strokeWidth={2} strokeOpacity={0.45} />
            <ellipse cx={bx} cy={by} rx={52} ry={20}
              fill={color} fillOpacity={0.1} stroke={color} strokeWidth={1.8} />
            <text x={bx} y={by + (line2 ? -3 : 5)} textAnchor="middle"
              fontSize={11} fill={color} fontFamily="Inter, sans-serif" fontWeight={700}>
              {line1}
            </text>
            {line2 && (
              <text x={bx} y={by + 9} textAnchor="middle"
                fontSize={11} fill={color} fontFamily="Inter, sans-serif" fontWeight={700}>
                {line2}
              </text>
            )}
          </g>
        )
      })}

      <ellipse cx={cx} cy={cy} rx={56} ry={24} fill="var(--accent)" />
      {(() => {
        const words = center.split(' ')
        const lines: string[] = []
        let cur = ''
        for (const w of words) {
          if ((cur + ' ' + w).trim().length > 12) { lines.push(cur.trim()); cur = w }
          else cur = (cur + ' ' + w).trim()
        }
        if (cur) lines.push(cur)
        const totalH = lines.length * 13
        return lines.map((line, i) => (
          <text key={i} x={cx} y={cy - totalH / 2 + 12 + i * 13} textAnchor="middle"
            fontSize={11} fill="white" fontFamily="Inter, sans-serif" fontWeight={700}>
            {line}
          </text>
        ))
      })()}
    </svg>
  )
}
