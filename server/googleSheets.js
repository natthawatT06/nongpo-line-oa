const googleSheetsWebhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL

function hasGoogleSheetsWebhook() {
  return Boolean(googleSheetsWebhookUrl && !['none', 'null', 'undefined'].includes(googleSheetsWebhookUrl.toLowerCase()))
}

async function appendToGoogleSheet(sheet, row) {
  if (!hasGoogleSheetsWebhook()) {
    return { skipped: true, reason: 'Missing GOOGLE_SHEETS_WEBHOOK_URL' }
  }

  const response = await fetch(googleSheetsWebhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sheet, row }),
  })

  const text = await response.text()
  let payload

  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = { raw: text }
  }

  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.message || `Google Sheets append failed with ${response.status}`)
  }

  return payload || { ok: true }
}

async function readFromGoogleSheet(sheet, params = {}) {
  if (!hasGoogleSheetsWebhook()) {
    return { skipped: true, reason: 'Missing GOOGLE_SHEETS_WEBHOOK_URL', rows: [] }
  }

  const url = new URL(googleSheetsWebhookUrl)
  url.searchParams.set('action', 'list')
  url.searchParams.set('sheet', sheet)

  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  })

  const response = await fetch(url)
  const text = await response.text()
  let payload

  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = { raw: text }
  }

  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.message || `Google Sheets read failed with ${response.status}`)
  }

  return payload || { ok: true, rows: [] }
}

function mapFarmerField(row) {
  const areaRai = row.area_rai === '' || row.area_rai == null ? null : Number(row.area_rai)
  const latitude = row.latitude === '' || row.latitude == null ? null : Number(row.latitude)
  const longitude = row.longitude === '' || row.longitude == null ? null : Number(row.longitude)

  return {
    id: `sheet-${row.row_number}`,
    name: row.field_name,
    crop: row.crop,
    areaRai,
    area_rai: areaRai,
    latitude,
    longitude,
    province: row.province || null,
    district: row.district || null,
    note: row.note || null,
    createdAt: row.created_at,
    created_at: row.created_at,
    source: 'google-sheets',
  }
}

export function appendFarmerRegistrationToGoogleSheets({
  lineUserId,
  fullName,
  phone,
  province,
  district,
}) {
  return appendToGoogleSheet('farmer_registrations', {
    line_user_id: lineUserId,
    full_name: fullName,
    phone,
    province,
    district,
  })
}

export function appendFarmerFieldToGoogleSheets({
  lineUserId,
  fieldName,
  crop,
  areaRai,
  latitude,
  longitude,
  province,
  district,
  note,
}) {
  return appendToGoogleSheet('farmer_fields', {
    line_user_id: lineUserId,
    field_name: fieldName,
    crop,
    area_rai: areaRai,
    latitude,
    longitude,
    province,
    district,
    note,
  })
}

export function appendPlantingPlanToGoogleSheets({
  lineUserId,
  fieldId,
  fieldName,
  crop,
  variety,
  plantingDate,
  method,
  seedRate,
  waterPlan,
  note,
}) {
  return appendToGoogleSheet('farmer_planting_plans', {
    line_user_id: lineUserId,
    farmer_field_id: fieldId,
    field_name: fieldName,
    crop,
    variety,
    planting_date: plantingDate,
    method,
    seed_rate: seedRate,
    water_plan: waterPlan,
    note,
  })
}

export async function listFarmerFieldsFromGoogleSheets(lineUserId) {
  const payload = await readFromGoogleSheet('farmer_fields', { lineUserId })
  const fields = (payload.rows || [])
    .map(mapFarmerField)
    .filter((field) => field.name && field.crop)
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))

  return { fields }
}

export async function getLatestFarmerFieldFromGoogleSheets(lineUserId) {
  const { fields } = await listFarmerFieldsFromGoogleSheets(lineUserId)
  return fields[0] || null
}
