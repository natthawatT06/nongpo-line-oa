import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const isUsableEnvValue = (value) => value && !['none', 'null', 'undefined'].includes(value.toLowerCase())
const isValidHttpUrl = (value) => {
  if (!isUsableEnvValue(value)) return false

  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export const supabaseAdmin = isValidHttpUrl(supabaseUrl) && isUsableEnvValue(supabaseServiceRoleKey)
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null

export async function upsertFarmerRegistrationToSupabase({
  lineUserId,
  fullName,
  phone,
  province,
  district,
}) {
  if (!supabaseAdmin) {
    return { skipped: true, reason: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }
  }

  const { data, error } = await supabaseAdmin
    .from('farmer_registrations')
    .upsert({
      line_user_id: lineUserId,
      full_name: fullName,
      phone,
      province,
      district,
    }, {
      onConflict: 'line_user_id',
    })
    .select()
    .single()

  if (error) {
    throw error
  }

  return { data }
}

export async function addFarmerFieldToSupabase({
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
  if (!supabaseAdmin) {
    return { skipped: true, reason: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }
  }

  const { data, error } = await supabaseAdmin
    .from('farmer_fields')
    .insert({
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
    .select()
    .single()

  if (error) {
    throw error
  }

  return { data }
}

export async function listFarmerFieldsFromSupabase(lineUserId) {
  if (!supabaseAdmin) {
    return { skipped: true, reason: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY', fields: [] }
  }

  const { data, error } = await supabaseAdmin
    .from('farmer_fields')
    .select('id, field_name, crop, area_rai, latitude, longitude, province, district, note, created_at')
    .eq('line_user_id', lineUserId)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return {
    fields: data.map((field) => ({
      id: field.id,
      name: field.field_name,
      crop: field.crop,
      areaRai: field.area_rai,
      latitude: field.latitude,
      longitude: field.longitude,
      province: field.province,
      district: field.district,
      note: field.note,
      createdAt: field.created_at,
      source: 'supabase',
    })),
  }
}

export async function addPlantingPlanToSupabase({
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
  if (!supabaseAdmin) {
    return { skipped: true, reason: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }
  }

  const { data, error } = await supabaseAdmin
    .from('farmer_planting_plans')
    .insert({
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
    .select()
    .single()

  if (error) {
    throw error
  }

  return { data }
}
