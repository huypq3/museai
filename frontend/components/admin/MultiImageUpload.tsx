'use client'

import ImageUpload from './ImageUpload'

export default function MultiImageUpload({
  values,
  onChange,
  label = 'Gallery images',
}: {
  values: string[]
  onChange: (values: string[]) => void
  label?: string
}) {
  const add = () => onChange([...(values || []), ''])
  const update = (index: number, url: string) => {
    const next = [...values]
    next[index] = url
    onChange(next)
  }
  const remove = (index: number) => {
    onChange(values.filter((_, i) => i !== index))
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: 'rgba(245,240,232,0.72)' }}>{label}</div>
        <button type="button" onClick={add} style={btn}>+ Add image</button>
      </div>
      {values.map((v, i) => (
        <div key={i} style={{ border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10, padding: 10, marginBottom: 8 }}>
          <ImageUpload value={v} onChange={(url) => update(i, url)} label={`Image #${i + 1}`} />
          <button type="button" onClick={() => remove(i)} style={btnDanger}>Remove image</button>
        </div>
      ))}
      {values.length === 0 && (
        <div style={{ fontSize: 12, color: 'rgba(245,240,232,0.55)' }}>No gallery images yet</div>
      )}
    </div>
  )
}

const btn: any = {
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.04)',
  color: '#F5F0E8',
  cursor: 'pointer',
}

const btnDanger: any = {
  ...btn,
  color: '#fca5a5',
  border: '1px solid rgba(248,113,113,0.3)',
}
