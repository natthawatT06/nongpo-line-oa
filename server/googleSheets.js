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
