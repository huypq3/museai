'use client'

import { useState, KeyboardEvent } from 'react'

export default function TagInput({
  tags,
  onChange,
  placeholder = 'Thêm từ khóa...',
}: {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}) {
  const [input, setInput] = useState('')

  const addTag = () => {
    const val = input.trim().toLowerCase()
    if (val && !tags.includes(val)) {
      onChange([...tags, val])
    }
    setInput('')
  }

  const removeTag = (tag: string) => {
    onChange(tags.filter(t => t !== tag))
  }

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag()
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6,
      padding: '8px 10px',
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 10,
      minHeight: 40,
    }}>
      {tags.map(tag => (
        <span
          key={tag}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 10px',
            borderRadius: 20,
            background: 'rgba(201,168,76,0.15)',
            border: '1px solid rgba(201,168,76,0.3)',
            fontSize: 12,
            color: '#C9A84C',
          }}
        >
          {tag}
          <button
            onClick={() => removeTag(tag)}
            style={{
              background: 'none',
              border: 'none',
              color: '#C9A84C',
              cursor: 'pointer',
              fontSize: 14,
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKey}
        onBlur={addTag}
        placeholder={tags.length === 0 ? placeholder : ''}
        style={{
          flex: 1,
          minWidth: 80,
          background: 'none',
          border: 'none',
          outline: 'none',
          color: '#F5F0E8',
          fontSize: 13,
        }}
      />
    </div>
  )
}
