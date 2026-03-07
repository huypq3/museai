'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminFetch } from '@/lib/adminAuth'
import ImageUpload from '@/components/admin/ImageUpload'
import MultiImageUpload from '@/components/admin/MultiImageUpload'
import TagInput from '@/components/admin/TagInput'
import { validateArtifactPublishable } from '@/lib/validation'
import { useAdminI18n } from '@/lib/i18n/admin'

type Tab = 'basic' | 'vision' | 'knowledge' | 'scenes'

export default function NewArtifactPage() {
  const router = useRouter()
  const { locale } = useAdminI18n()
  const tr = (vi: string, en: string) => (locale === 'en' ? en : vi)
  const [museumId, setMuseumId] = useState('')
  const [tab, setTab] = useState<Tab>('basic')
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState<any>({
    name: '',
    name_en: '',
    category: 'other',
    period: '',
    origin: '',
    description: { vi: '', en: '' },
    location: { hall: '', floor: 0, position: '' },
    primary_image_url: '',
    gallery_images: [],
    visual_features: { description: '', distinctive_marks: [] },
    knowledge_base: [],
    scenes: [],
    status: 'draft',
  })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setMuseumId(params.get('museum') || '')
  }, [])

  const completion = useMemo(() => validateArtifactPublishable(form), [form])

  const addChunk = () =>
    setForm((f: any) => ({
      ...f,
      knowledge_base: [...f.knowledge_base, { chunk_id: '', category: 'other', title: '', content: '' }],
    }))
  const addScene = () =>
    setForm((f: any) => ({
      ...f,
      scenes: [...f.scenes, { keyword: '', image_url: '', trigger_words: [] }],
    }))

  const submit = async (status: 'draft' | 'published') => {
    setSubmitted(true)
    if (!museumId) return alert(tr('Thiếu museum_id', 'Missing museum_id'))
    if (status === 'published' && !completion.publishable) {
      return alert(`${tr('Chưa đủ dữ liệu để xuất bản', 'Not enough data to publish')}: ${completion.reason}`)
    }
    setSaving(true)
    try {
      const payload = {
        museum_id: museumId,
        ...form,
        status,
      }
      const data = await adminFetch('/admin/exhibits/', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      router.push(`/admin/exhibits/${data.id}`)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ flex: 1, padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h1 style={{ margin: 0, color: '#C9A84C', fontFamily: 'Cormorant Garamond, serif' }}>{tr('Thêm hiện vật mới', 'Add new artifact')}</h1>
        <button onClick={() => router.back()} style={btn}>← {tr('Quay lại', 'Back')}</button>
      </div>

      <div style={{ marginBottom: 12, color: completion.publishable ? '#86efac' : '#fca5a5', fontSize: 13 }}>
        {tr('Hồ sơ hiện vật', 'Artifact profile')}: {completion.completed}/{completion.total} {completion.publishable ? '✅' : '⚠️'} {completion.publishable ? '' : `— ${completion.reason}`}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <TabBtn active={tab === 'basic'} onClick={() => setTab('basic')}>{tr('Thông tin cơ bản', 'Basic info')}</TabBtn>
        <TabBtn active={tab === 'vision'} onClick={() => setTab('vision')}>Camera Recognition</TabBtn>
        <TabBtn active={tab === 'knowledge'} onClick={() => setTab('knowledge')}>Knowledge Base</TabBtn>
        <TabBtn active={tab === 'scenes'} onClick={() => setTab('scenes')}>Scenes</TabBtn>
      </div>

      <div style={card}>
        {tab === 'basic' && (
          <div style={grid2}>
            <Field label={tr('Tên hiện vật (vi) *', 'Artifact name (vi) *')}><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={input} /></Field>
            {submitted && !form.name && <ErrorText>Vui lòng nhập tên hiện vật (vi)</ErrorText>}
            <Field label={tr('Tên hiện vật (en) *', 'Artifact name (en) *')}><input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} style={input} /></Field>
            {submitted && !form.name_en && <ErrorText>Vui lòng nhập tên hiện vật (en)</ErrorText>}
            <Field label={tr('Danh mục *', 'Category *')}>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={input}>
                {['statue', 'painting', 'document', 'weapon', 'ceramic', 'other'].map((x) => <option key={x}>{x}</option>)}
              </select>
            </Field>
            <Field label={tr('Thời kỳ *', 'Period *')}><input value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} style={input} /></Field>
            {submitted && !form.period && <ErrorText>Vui lòng nhập thời kỳ</ErrorText>}
            <Field label={tr('Xuất xứ', 'Origin')}><input value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} style={input} /></Field>
            <Field label={tr('Vị trí - Hall *', 'Location - Hall *')}><input value={form.location.hall} onChange={(e) => setForm({ ...form, location: { ...form.location, hall: e.target.value } })} style={input} /></Field>
            {submitted && !form.location.hall && <ErrorText>Vui lòng nhập khu trưng bày</ErrorText>}
            <Field label={tr('Vị trí - Floor', 'Location - Floor')}><input type="number" value={form.location.floor} onChange={(e) => setForm({ ...form, location: { ...form.location, floor: Number(e.target.value) } })} style={input} /></Field>
            <Field label={tr('Vị trí - Position', 'Location - Position')}><input value={form.location.position} onChange={(e) => setForm({ ...form, location: { ...form.location, position: e.target.value } })} style={input} /></Field>
            <Field label={tr('Mô tả VI *', 'Description VI *')}><textarea value={form.description.vi} onChange={(e) => setForm({ ...form, description: { ...form.description, vi: e.target.value } })} style={{ ...input, minHeight: 90 }} /></Field>
            {submitted && !form.description.vi && <ErrorText>Thiếu mô tả tiếng Việt</ErrorText>}
            <Field label={tr('Mô tả EN *', 'Description EN *')}><textarea value={form.description.en} onChange={(e) => setForm({ ...form, description: { ...form.description, en: e.target.value } })} style={{ ...input, minHeight: 90 }} /></Field>
            {submitted && !form.description.en && <ErrorText>Thiếu mô tả tiếng Anh</ErrorText>}
            <div style={{ gridColumn: '1 / -1' }}>
              <ImageUpload value={form.primary_image_url} onChange={(url) => setForm({ ...form, primary_image_url: url })} label={tr('Ảnh chính *', 'Primary image *')} />
              {submitted && !form.primary_image_url && <ErrorText>Thiếu ảnh chính</ErrorText>}
              <MultiImageUpload values={form.gallery_images} onChange={(gallery_images) => setForm({ ...form, gallery_images })} />
            </div>
          </div>
        )}

        {tab === 'vision' && (
          <div>
            <Field label={tr('Mô tả đặc điểm nhận dạng *', 'Recognition description *')}>
              <textarea
                value={form.visual_features.description}
                onChange={(e) => setForm({ ...form, visual_features: { ...form.visual_features, description: e.target.value } })}
                style={{ ...input, minHeight: 100 }}
              />
            </Field>
            {submitted && !form.visual_features.description && <ErrorText>Thiếu mô tả nhận dạng camera</ErrorText>}
            <Field label={tr('Dấu hiệu đặc trưng (tags)', 'Distinctive marks (tags)')}>
              <TagInput tags={form.visual_features.distinctive_marks} onChange={(tags) => setForm({ ...form, visual_features: { ...form.visual_features, distinctive_marks: tags } })} />
            </Field>
          </div>
        )}

        {tab === 'knowledge' && (
          <div>
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 13, opacity: 0.85 }}>{tr('Nội dung AI dùng để trả lời khách tham quan', 'Knowledge used by AI to answer visitors')}</div>
              <button onClick={addChunk} style={btn}>+ {tr('Thêm chunk', 'Add chunk')}</button>
            </div>
            {form.knowledge_base.map((k: any, idx: number) => (
              <div key={idx} style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 10, marginBottom: 10 }}>
                <div style={grid2}>
                  <Field label={tr('Danh mục', 'Category')}>
                    <select value={k.category} onChange={(e) => {
                      const next = [...form.knowledge_base]
                      next[idx] = { ...k, category: e.target.value }
                      setForm({ ...form, knowledge_base: next })
                    }} style={input}>
                      {['biography', 'artifact_info', 'battle', 'legend', 'technique', 'faq', 'other'].map((x) => <option key={x}>{x}</option>)}
                    </select>
                  </Field>
                  <Field label={tr('Tiêu đề', 'Title')}><input value={k.title || ''} onChange={(e) => {
                    const next = [...form.knowledge_base]
                    next[idx] = { ...k, title: e.target.value }
                    setForm({ ...form, knowledge_base: next })
                  }} style={input} /></Field>
                </div>
                <Field label={tr('Nội dung', 'Content')}>
                  <textarea value={k.content || ''} onChange={(e) => {
                    const next = [...form.knowledge_base]
                    next[idx] = { ...k, content: e.target.value }
                    setForm({ ...form, knowledge_base: next })
                  }} style={{ ...input, minHeight: 90 }} />
                </Field>
                <button onClick={() => {
                  const next = form.knowledge_base.filter((_: any, i: number) => i !== idx)
                  setForm({ ...form, knowledge_base: next })
                }} style={btn}>{tr('Xóa chunk', 'Delete chunk')}</button>
              </div>
            ))}
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              {form.knowledge_base.length}/5 chunks {form.knowledge_base.length < 2 ? `⚠️ ${tr('Chưa đủ để AI trả lời tốt', 'Not enough for good answers')}` : '✅'}
            </div>
          </div>
        )}

        {tab === 'scenes' && (
          <div>
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 13, opacity: 0.85 }}>{tr('Ảnh minh họa theo keyword', 'Illustration images by keyword')}</div>
              <button onClick={addScene} style={btn}>+ {tr('Thêm scene', 'Add scene')}</button>
            </div>
            {form.scenes.map((s: any, idx: number) => (
              <div key={idx} style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 10, marginBottom: 10 }}>
                <Field label={tr('Keyword', 'Keyword')}><input value={s.keyword} onChange={(e) => {
                  const next = [...form.scenes]
                  next[idx] = { ...s, keyword: e.target.value }
                  setForm({ ...form, scenes: next })
                }} style={input} /></Field>
                <ImageUpload value={s.image_url} onChange={(url) => {
                  const next = [...form.scenes]
                  next[idx] = { ...s, image_url: url }
                  setForm({ ...form, scenes: next })
                }} label={tr('Ảnh scene', 'Scene image')} />
                <Field label={tr('Trigger words', 'Trigger words')}>
                  <TagInput tags={s.trigger_words || []} onChange={(tags) => {
                    const next = [...form.scenes]
                    next[idx] = { ...s, trigger_words: tags }
                    setForm({ ...form, scenes: next })
                  }} />
                </Field>
                <button onClick={() => {
                  const next = form.scenes.filter((_: any, i: number) => i !== idx)
                  setForm({ ...form, scenes: next })
                }} style={btn}>{tr('Xóa scene', 'Delete scene')}</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
        <button onClick={() => submit('draft')} disabled={saving} style={btn}>{tr('Lưu nháp', 'Save draft')}</button>
        <button onClick={() => submit('published')} disabled={saving} style={btnPrimary}>{tr('Xuất bản', 'Publish')}</button>
      </div>
    </div>
  )
}

function TabBtn({ active, onClick, children }: any) {
  return (
    <button onClick={onClick} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: active ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.04)', color: active ? '#C9A84C' : '#F5F0E8', cursor: 'pointer' }}>
      {children}
    </button>
  )
}
function Field({ label, children }: any) {
  return (
    <label style={{ display: 'block', marginBottom: 10 }}>
      <div style={{ fontSize: 12, color: 'rgba(245,240,232,0.7)', marginBottom: 6 }}>{label}</div>
      {children}
    </label>
  )
}
function ErrorText({ children }: any) {
  return <div style={{ fontSize: 12, color: '#fca5a5', marginBottom: 8 }}>{children}</div>
}
const card: any = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 14 }
const grid2: any = { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }
const input: any = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', color: '#F5F0E8', boxSizing: 'border-box' }
const btn: any = { padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.04)', color: '#F5F0E8', cursor: 'pointer' }
const btnPrimary: any = { ...btn, background: '#C9A84C', color: '#0A0A0A', border: 'none', fontWeight: 600 }
