export const MUSEUM_REQUIRED_FIELDS = [
  'name',
  'name_en',
  'address',
  'city',
  'phone',
  'email',
  'logo_url',
  'cover_image_url',
  'opening_hours',
  'ticket_price',
  'supported_languages',
  'ai_persona',
]

export const ARTIFACT_REQUIRED_FIELDS = [
  'name',
  'name_en',
  'category',
  'period',
  'description.vi',
  'description.en',
  'location.hall',
  'primary_image_url',
  'visual_features.description',
]

function getByPath(obj: any, path: string): any {
  return path.split('.').reduce((acc, key) => (acc ? acc[key] : undefined), obj)
}

export function calculateCompletion(entity: any, requiredFields: string[]) {
  const missing = requiredFields.filter((field) => {
    const value = getByPath(entity, field)
    if (Array.isArray(value)) return value.length === 0
    return value === undefined || value === null || value === ''
  })
  return {
    total: requiredFields.length,
    completed: requiredFields.length - missing.length,
    missing,
    score: Math.round(((requiredFields.length - missing.length) / requiredFields.length) * 100),
  }
}

export function validateArtifactPublishable(artifact: any) {
  const base = calculateCompletion(artifact, ARTIFACT_REQUIRED_FIELDS)
  const kbCount = Array.isArray(artifact?.knowledge_base) ? artifact.knowledge_base.length : 0
  const publishable = base.missing.length === 0 && kbCount >= 2
  const reasonCode = publishable
    ? ''
    : kbCount < 2
    ? 'knowledge_base_min_chunks'
    : 'missing_required_fields'
  return {
    ...base,
    kbCount,
    publishable,
    reasonCode,
  }
}
