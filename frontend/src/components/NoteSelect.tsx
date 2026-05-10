import type { Note, Subject } from '../lib/api'

interface Props {
  notes: Note[]
  subjects: Subject[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  style?: React.CSSProperties
}

export default function NoteSelect({ notes, subjects, value, onChange, placeholder = 'Select a note…', style }: Props) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={style}>
      <option value="">{placeholder}</option>
      {subjects.map((s) => {
        const subjectNotes = notes.filter(n => n.subject_id === s.id)
        if (!subjectNotes.length) return null

        // Group by section, preserving section order from note positions
        const sectionMap = new Map<string, Note[]>()
        const noSection: Note[] = []

        for (const n of subjectNotes) {
          if (n.section) {
            if (!sectionMap.has(n.section)) sectionMap.set(n.section, [])
            sectionMap.get(n.section)!.push(n)
          } else {
            noSection.push(n)
          }
        }

        // Sort notes within each section by position then created_at
        const sortNotes = (arr: Note[]) =>
          [...arr].sort((a, b) => (a.position ?? 999) - (b.position ?? 999) || a.created_at - b.created_at)

        const sections = [...sectionMap.entries()]

        if (sections.length === 0) {
          // No sections — flat list under subject
          return (
            <optgroup key={s.id} label={s.name}>
              {sortNotes(noSection).map(n => <option key={n.id} value={n.id}>{n.title}</option>)}
            </optgroup>
          )
        }

        // Has sections — one optgroup per section
        return sections.map(([section, sNotes]) => (
          <optgroup key={`${s.id}-${section}`} label={`${s.name}  ›  ${section}`}>
            {sortNotes(sNotes).map(n => <option key={n.id} value={n.id}>{n.title}</option>)}
          </optgroup>
        )).concat(
          noSection.length > 0 ? [
            <optgroup key={`${s.id}-none`} label={`${s.name}  ›  Other`}>
              {sortNotes(noSection).map(n => <option key={n.id} value={n.id}>{n.title}</option>)}
            </optgroup>
          ] : []
        )
      })}
      {notes.filter(n => !n.subject_id).length > 0 && (
        <optgroup label="Uncategorized">
          {notes.filter(n => !n.subject_id)
            .sort((a, b) => (a.position ?? 999) - (b.position ?? 999) || a.created_at - b.created_at)
            .map(n => <option key={n.id} value={n.id}>{n.title}</option>)}
        </optgroup>
      )}
    </select>
  )
}
