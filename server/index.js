import 'dotenv/config'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { messagingApi, middleware } from '@line/bot-sdk'
import {
  createPlantingPlan,
  createField,
  getBestOffer,
  getFieldHealth,
  getFieldsForUser,
  getLatestField,
  upsertFarmerRegistration,
  upsertUserRole,
} from './db.js'
import {
  addFarmerFieldToSupabase,
  addPlantingPlanToSupabase,
  getLatestAnyFarmerFieldFromSupabase,
  getLatestFarmerFieldFromSupabase,
  listFarmerFieldsFromSupabase,
  upsertFarmerRegistrationToSupabase,
} from './supabase.js'
import {
  appendFarmerFieldToGoogleSheets,
  appendFarmerRegistrationToGoogleSheets,
  appendPlantingPlanToGoogleSheets,
  getLatestFarmerFieldFromGoogleSheets,
  listFarmerFieldsFromGoogleSheets,
} from './googleSheets.js'
import { askSugarcaneExpert } from './typhoon.js'
import { getWeatherSummary } from './weather.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distPath = path.resolve(__dirname, '../dist')
const publicPath = path.resolve(__dirname, '../public')
const requiredEnv = ['LINE_CHANNEL_ACCESS_TOKEN', 'LINE_CHANNEL_SECRET']
const missingEnv = requiredEnv.filter((key) => !process.env[key])

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
}

const client = missingEnv.length
  ? null
  : new messagingApi.MessagingApiClient({
      channelAccessToken: config.channelAccessToken,
    })

const app = express()
const port = Number(process.env.PORT || 3000)
const publicLiffUrl = process.env.PUBLIC_LIFF_URL || 'https://liff.line.me/PUT_LIFF_ID_HERE'
const loginLiffUrl = process.env.PUBLIC_LIFF_URL_LOGIN || publicLiffUrl
const startLiffUrl = process.env.PUBLIC_LIFF_URL_START || publicLiffUrl
const startLiffJoiner = startLiffUrl.includes('?') ? '&' : '?'
const startPlantingUrl = `${startLiffUrl}${startLiffJoiner}view=plant`
const publicBaseUrl = (process.env.PUBLIC_WEB_URL || process.env.PUBLIC_ENDPOINT_URL || 'https://gently-labels-parent-xhtml.trycloudflare.com').replace(/\/$/, '')
const farmerRichMenuId = process.env.RICH_MENU_ID_FARMER

app.use('/assets', express.static(publicPath))
app.use(express.static(distPath))

app.post('/api/farmers/register', express.json(), async (req, res) => {
  const {
    lineUserId,
    fullName,
    phone,
    province,
    district,
  } = req.body || {}

  if (!lineUserId || !fullName || !phone || !province || !district) {
    res.status(400).json({
      ok: false,
      message: 'Missing farmer registration data',
    })
    return
  }

  const payload = {
    lineUserId,
    fullName: fullName.trim(),
    phone: phone.trim(),
    province: province.trim(),
    district: district.trim(),
  }

  const user = upsertFarmerRegistration(payload)
  let supabase
  let sheets

  try {
    supabase = await upsertFarmerRegistrationToSupabase(payload)
  } catch (error) {
    console.error('Supabase farmer registration failed:', error)
    supabase = { skipped: true, reason: 'Supabase insert failed; saved locally' }
  }

  try {
    sheets = await appendFarmerRegistrationToGoogleSheets(payload)
  } catch (error) {
    console.error('Google Sheets farmer registration failed:', error)
    sheets = { skipped: true, reason: 'Google Sheets append failed' }
  }

  res.json({ ok: true, user, supabase, sheets })
})

app.post('/api/farmers/register-local', express.json(), (req, res) => {
  const {
    lineUserId,
    fullName,
    phone,
    province,
    district,
  } = req.body || {}

  if (!lineUserId || !fullName || !phone || !province || !district) {
    res.status(400).json({
      ok: false,
      message: 'Missing farmer registration data',
    })
    return
  }

  const user = upsertFarmerRegistration({
    lineUserId,
    fullName: fullName.trim(),
    phone: phone.trim(),
    province: province.trim(),
    district: district.trim(),
  })

  res.json({ ok: true, user })
})

app.post('/api/farmers/login', express.json(), async (req, res) => {
  const lineUserId = String(req.body?.lineUserId || '')

  if (!lineUserId) {
    res.status(400).json({
      ok: false,
      message: 'Missing lineUserId',
    })
    return
  }

  upsertUserRole(lineUserId, 'farmer')

  if (client) {
    await client.unlinkRichMenuIdFromUser(lineUserId).catch(() => null)
  }

  res.json({ ok: true })
})

app.post('/api/fields/add', express.json(), async (req, res) => {
  const {
    lineUserId,
    fieldName,
    crop,
    areaRai,
    latitude,
    longitude,
    province,
    district,
    note,
  } = req.body || {}

  if (!lineUserId || !fieldName || !crop) {
    res.status(400).json({
      ok: false,
      message: 'Missing required field data',
    })
    return
  }

  const fieldPayload = {
    lineUserId,
    fieldName: fieldName.trim(),
    crop: crop.trim(),
    areaRai: areaRai === '' || areaRai == null ? null : Number(areaRai),
    latitude: latitude === '' || latitude == null ? null : Number(latitude),
    longitude: longitude === '' || longitude == null ? null : Number(longitude),
    province: province?.trim() || null,
    district: district?.trim() || null,
    note: note?.trim() || null,
  }
  let supabase
  let sheets

  try {
    supabase = await addFarmerFieldToSupabase(fieldPayload)
  } catch (error) {
    console.error('Supabase field insert failed:', error)
    supabase = { skipped: true, reason: 'Supabase insert failed; saved locally' }
  }

  try {
    sheets = await appendFarmerFieldToGoogleSheets(fieldPayload)
  } catch (error) {
    console.error('Google Sheets field append failed:', error)
    sheets = { skipped: true, reason: 'Google Sheets append failed' }
  }

  const local = saveFieldLocallyIfComplete(fieldPayload)

  res.json({ ok: true, supabase, sheets, local })
})

app.get('/api/fields/list', async (req, res) => {
  const lineUserId = String(req.query.lineUserId || '')

  if (!lineUserId) {
    res.status(400).json({
      ok: false,
      message: 'Missing lineUserId',
    })
    return
  }

  try {
    const supabase = await listFarmerFieldsFromSupabase(lineUserId)
    if (supabase.fields?.length) {
      res.json({ ok: true, fields: supabase.fields, source: 'supabase' })
      return
    }
  } catch (error) {
    console.error('Supabase field list failed:', error)
  }

  try {
    const sheets = await listFarmerFieldsFromGoogleSheets(lineUserId)
    if (sheets.fields?.length) {
      res.json({ ok: true, fields: sheets.fields, source: 'google-sheets' })
      return
    }
  } catch (error) {
    console.error('Google Sheets field list failed:', error)
  }

  res.json({
    ok: true,
    fields: getFieldsForUser(lineUserId).map((field) => ({ ...field, source: 'sqlite' })),
    source: 'sqlite',
  })
})

app.post('/api/planting/start', express.json(), async (req, res) => {
  const {
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
  } = req.body || {}

  if (!lineUserId || !fieldName || !crop || !plantingDate || !method) {
    res.status(400).json({
      ok: false,
      message: 'Missing required planting data',
    })
    return
  }

  const payload = {
    lineUserId,
    fieldId: fieldId || null,
    fieldName: fieldName.trim(),
    crop: crop.trim(),
    variety: variety?.trim() || null,
    plantingDate,
    method: method.trim(),
    seedRate: seedRate === '' || seedRate == null ? null : Number(seedRate),
    waterPlan: waterPlan?.trim() || null,
    note: note?.trim() || null,
  }

  if (payload.seedRate != null && !Number.isFinite(payload.seedRate)) {
    res.status(400).json({
      ok: false,
      message: 'Invalid seed rate',
    })
    return
  }

  const plan = createPlantingPlan(payload)
  let supabase
  let sheets

  try {
    supabase = await addPlantingPlanToSupabase(payload)
  } catch (error) {
    console.error('Supabase planting plan insert failed:', error)
    supabase = { skipped: true, reason: 'Supabase insert failed; saved locally' }
  }

  try {
    sheets = await appendPlantingPlanToGoogleSheets(payload)
  } catch (error) {
    console.error('Google Sheets planting plan append failed:', error)
    sheets = { skipped: true, reason: 'Google Sheets append failed' }
  }

  res.json({ ok: true, plan, supabase, sheets })
})

app.post('/api/fields/register', express.json(), (req, res) => {
  const {
    lineUserId,
    name,
    crop,
    areaRai,
    latitude,
    longitude,
    soilType,
    soilPh,
  } = req.body || {}

  if (!lineUserId || !name || !crop || !Number.isFinite(Number(areaRai)) || !Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
    res.status(400).json({
      ok: false,
      message: 'Missing required field data',
    })
    return
  }

  upsertUserRole(lineUserId, 'farmer')
  const field = createField({
    lineUserId,
    name,
    crop,
    areaRai: Number(areaRai),
    latitude: Number(latitude),
    longitude: Number(longitude),
    soilType,
    soilPh: soilPh ? Number(soilPh) : null,
  })

  res.json({ ok: true, field })
})

const farmerMenuReplies = {
  เพิ่มพื้นที่: () => registrationGuide(),
  คุยกับน้องโป: () => chatWelcomeFlex(),
  'แปลงของฉัน': (event) => fieldFlex(event),
  เริ่มปลูก: (event) => plantFlex(event),
  ตรวจแปลง: (event) => healthFlex(event),
  ตรวจสุขภาพแปลง: (event) => healthFlex(event),
  วิเคราะห์โรค: (event) => diseaseFlex(event),
  'ปุ๋ย-น้ำ': (event) => inputsFlex(event),
  เก็บเกี่ยว: (event) => harvestFlex(event),
  ขายผลผลิต: (event) => sellFlex(event),
  หาที่ขาย: (event) => sellFlex(event),
  ขอข้อเสนอรับซื้อ: (event) => sellFlex(event),
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    scope: 'farmer-only',
    service: 'nongpo-line-oa',
    lineConfigured: missingEnv.length === 0,
    richMenuConfigured: Boolean(farmerRichMenuId),
    missingEnv,
  })
})

const lineWebhookMiddleware = missingEnv.length ? express.json() : middleware(config)

app.post('/api/line/webhook', lineWebhookMiddleware, lineWebhookHandler)
app.post('/webhook', lineWebhookMiddleware, lineWebhookHandler)

app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

async function lineWebhookHandler(req, res) {
  if (missingEnv.length) {
    res.status(500).json({
      ok: false,
      message: `Missing env: ${missingEnv.join(', ')}`,
    })
    return
  }

  try {
    await Promise.all((req.body.events || []).map(handleEvent))
    res.status(200).end()
  } catch (error) {
    console.error(error)
    res.status(500).end()
  }
}

async function handleEvent(event) {
  if (event.type === 'follow') {
    return setFarmerAndReply(event)
  }

  if (event.type === 'postback') {
    const params = new URLSearchParams(event.postback.data)
    if (params.get('action') === 'selectFarmer' || params.get('role') === 'farmer') {
      return setFarmerAndReply(event)
    }
  }

  if (event.type !== 'message' || event.message.type !== 'text') {
    return null
  }

  const text = event.message.text.trim()

  if (['เริ่มต้น', 'เลือกบทบาท', 'เกษตรกร', 'เมนู'].includes(text)) {
    return setFarmerAndReply(event)
  }

  const fieldPayload = parseFieldCommand(text)
  if (fieldPayload) {
    return saveFieldAndReply(event, fieldPayload)
  }

  const replyFactory = farmerMenuReplies[text]
  if (replyFactory) {
    return reply(event.replyToken, await replyFactory(event))
  }

  return answerSugarcaneQuestion(event, text)
}

async function setFarmerAndReply(event) {
  const userId = event.source?.userId

  if (userId) {
    upsertUserRole(userId, 'farmer')
    await client.unlinkRichMenuIdFromUser(userId).catch(() => null)
  }

  return reply(event.replyToken, [
    simpleText('สวัสดีครับ ผมน้องโป ผู้ช่วยดูแลแปลงของคุณ ก่อนเริ่มใช้งาน กดปุ่มลงทะเบียนเกษตรก่อนนะครับ'),
    registrationGuide(),
  ])
}

function parseFieldCommand(text) {
  const prefix = 'บันทึกแปลง '
  if (text === 'บันทึกแปลง') return { guide: true }
  if (!text.startsWith(prefix)) return null

  const parts = text.slice(prefix.length).split('|').map((part) => part.trim())
  if (parts.length < 5) return { guide: true }

  const [name, crop, areaRai, latitude, longitude, soilType, soilPh] = parts
  const parsed = {
    name,
    crop,
    areaRai: Number(areaRai),
    latitude: Number(latitude),
    longitude: Number(longitude),
    soilType: soilType || null,
    soilPh: soilPh ? Number(soilPh) : null,
  }

  if (
    !parsed.name ||
    !parsed.crop ||
    !Number.isFinite(parsed.areaRai) ||
    !Number.isFinite(parsed.latitude) ||
    !Number.isFinite(parsed.longitude)
  ) {
    return { guide: true }
  }

  return parsed
}

async function saveFieldAndReply(event, payload) {
  const userId = event.source?.userId
  if (!userId) return reply(event.replyToken, simpleText('ไม่พบ LINE userId จึงบันทึกแปลงไม่ได้ครับ'))

  if (payload.guide) {
    return reply(event.replyToken, registrationGuide())
  }

  const field = createField({ lineUserId: userId, ...payload })
  let cloudSave

  try {
    cloudSave = await addFarmerFieldToSupabase({
      lineUserId: userId,
      fieldName: payload.name,
      crop: payload.crop,
      areaRai: payload.areaRai,
      latitude: payload.latitude,
      longitude: payload.longitude,
      province: null,
      district: null,
      note: [payload.soilType, payload.soilPh ? `pH ${payload.soilPh}` : null].filter(Boolean).join(' / ') || null,
    })
  } catch (error) {
    console.error('Supabase LINE field save failed:', error)
    cloudSave = { skipped: true, reason: 'Supabase insert failed; saved locally' }
  }

  let sheetsSave

  try {
    sheetsSave = await appendFarmerFieldToGoogleSheets({
      lineUserId: userId,
      fieldName: payload.name,
      crop: payload.crop,
      areaRai: payload.areaRai,
      latitude: payload.latitude,
      longitude: payload.longitude,
      province: null,
      district: null,
      note: [payload.soilType, payload.soilPh ? `pH ${payload.soilPh}` : null].filter(Boolean).join(' / ') || null,
    })
  } catch (error) {
    console.error('Google Sheets LINE field append failed:', error)
    sheetsSave = { skipped: true, reason: 'Google Sheets append failed' }
  }

  const savedText = sheetsSave?.skipped && cloudSave?.skipped
    ? `บันทึกแปลง "${field.name}" ในระบบ LINE แล้วครับ แต่ยังส่งออกไปฐานข้อมูลออนไลน์ไม่สำเร็จ`
    : `บันทึกแปลง "${field.name}" แล้วครับ ต่อไปกด เริ่มปลูก / ตรวจแปลง / ขายผลผลิต ได้เลย`

  return reply(event.replyToken, [
    simpleText(savedText),
    await fieldFlex(event),
  ])
}

function chatWelcomeFlex() {
  return {
    type: 'flex',
    altText: 'คุยกับน้องโป',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#1F7A35',
        paddingAll: '18px',
        contents: [
          { type: 'text', text: 'คุยกับน้องโป', color: '#FFFFFF', size: 'xl', weight: 'bold' },
          { type: 'text', text: 'ผู้ช่วยผู้เชี่ยวชาญด้านอ้อย', color: '#DDF6D2', size: 'sm', weight: 'bold' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'text',
            text: 'ถามเรื่องอ้อยได้เลยครับ เช่น เตรียมดิน ใส่ปุ๋ย โรคใบขาว หนอนกอ วัชพืช น้ำ หรือช่วงเก็บเกี่ยว',
            wrap: true,
            color: '#26352A',
            size: 'sm',
          },
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            contents: [
              chatSuggestionButton('อ้อยใบเหลืองควรทำยังไง'),
              chatSuggestionButton('ปลูกอ้อยใหม่ควรเตรียมดินแบบไหน'),
              chatSuggestionButton('อ้อยอายุ 3 เดือนควรใส่ปุ๋ยอะไร'),
            ],
          },
        ],
      },
    },
  }
}

function chatSuggestionButton(text) {
  return {
    type: 'button',
    height: 'sm',
    style: 'secondary',
    action: {
      type: 'message',
      label: text,
      text,
    },
  }
}

async function answerSugarcaneQuestion(event, text) {
  try {
    const answer = await askSugarcaneExpert({
      question: text,
      field: await getLatestFieldForUser(event.source?.userId),
    })

    return reply(event.replyToken, simpleText(answer))
  } catch (error) {
    console.error('Typhoon chat failed:', error)
    return reply(
      event.replyToken,
      simpleText('ตอนนี้น้องโปเรียก Typhoon API ไม่สำเร็จครับ ลองถามใหม่อีกครั้ง หรือเช็ก TYPHOON_API_KEY ใน .env ก่อนนะครับ'),
    )
  }
}

async function fieldFlex(event) {
  const field = await getLatestFieldForUser(event.source?.userId)
  if (!field) return registrationGuide()

  return infoFlex({
    title: 'แปลงของฉัน',
    subtitle: 'ข้อมูลแปลงที่บันทึกจริง',
    body: `${field.name} พิกัด ${field.latitude.toFixed(4)}, ${field.longitude.toFixed(4)} ข้อมูลนี้ถูกเก็บในฐานข้อมูลของ NongPo แล้ว`,
    rows: [
      ['พื้นที่', `${field.area_rai} ไร่`],
      ['พืชหลัก', field.crop],
      ['ดิน/pH', `${field.soil_type || 'ยังไม่ระบุ'}${field.soil_ph ? ` / ${field.soil_ph}` : ''}`],
    ],
    button: 'ดู dashboard แปลง',
  })
}

async function plantFlex(event) {
  const field = await getLatestFieldForUser(event.source?.userId)
  if (!field) return registrationGuide()

  const weather = await safeWeather(field)
  const weatherText = weather
    ? `พยากรณ์จริง 7 วันจาก Open-Meteo: ฝนรวม ${weather.rainTotal.toFixed(1)} มม., อุณหภูมิ ${weather.minTemp}-${weather.maxTemp}°C`
    : 'ตอนนี้ดึงพยากรณ์อากาศจริงไม่ได้ จึงใช้ข้อมูลแปลงที่บันทึกไว้ก่อน'

  return infoFlex({
    title: 'เริ่มปลูก',
    subtitle: 'ข้อมูลแปลง + Weather API จริง',
    body: `${weatherText} ระบบแนะนำให้วางแผน ${field.crop} ตามหน้าต่างอากาศและข้อมูลดินของแปลง`,
    rows: [
      ['ประเภทดิน', field.soil_type || 'ยังไม่ระบุ'],
      ['ช่วงปลูก', weather ? `${weather.bestWindow.start}-${weather.bestWindow.end}` : 'รอข้อมูลอากาศ'],
      ['ฝน 7 วัน', weather ? `${weather.rainTotal.toFixed(1)} มม.` : 'ไม่พร้อม'],
    ],
    button: 'เปิดหน้าเริ่มปลูก',
    uri: startPlantingUrl,
  })
}

async function healthFlex(event) {
  const field = await getLatestFieldForUser(event.source?.userId)
  if (!field) return registrationGuide()

  const health = getFieldHealth(field.id)

  return infoFlex({
    title: 'ตรวจสุขภาพแปลง',
    subtitle: 'Satellite/AI health layer',
    body:
      health?.note ||
      'ยังไม่มีสัญญาณผิดปกติล่าสุด ระบบจะติดตาม NDVI และแจ้งเตือนเมื่อพบ pattern เสี่ยง',
    rows: [
      ['NDVI', health?.ndvi ? String(health.ndvi) : 'รอภาพล่าสุด'],
      ['พื้นที่เสี่ยง', health?.risk_area_rai ? `${health.risk_area_rai} ไร่` : '0 ไร่'],
      ['ระดับเสี่ยง', health?.risk_level || 'ปกติ'],
    ],
    button: 'ดูจุดเสี่ยงบนแผนที่',
    uri: `${loginLiffUrl}${loginLiffUrl.includes('?') ? '&' : '?'}view=health`,
  })
}

async function diseaseFlex(event) {
  const field = await getLatestFieldForUser(event.source?.userId)
  if (!field) return registrationGuide()

  return infoFlex({
    title: 'วิเคราะห์โรค',
    subtitle: 'AI disease screening',
    body: `ส่งรูปใบหรือลำต้นจากแปลง ${field.name} เข้ามาได้เลยครับ ระยะแรก NongPo จะใช้ข้อมูลสุขภาพแปลงร่วมกับอาการที่คุณเล่า เพื่อแนะนำความเสี่ยงโรคและแนวทางตรวจซ้ำ`,
    rows: [
      ['ข้อมูลที่ต้องการ', 'รูปใบ/ลำต้น + จุดที่พบ'],
      ['ผลลัพธ์', 'โรคที่เป็นไปได้ + ระดับเสี่ยง'],
      ['คำแนะนำ', 'ตรวจซ้ำ/ดูแลเฉพาะจุด'],
    ],
    button: 'เปิดหน้าส่งรูปวิเคราะห์',
    uri: `${loginLiffUrl}${loginLiffUrl.includes('?') ? '&' : '?'}view=disease`,
  })
}

async function inputsFlex(event) {
  const field = await getLatestFieldForUser(event.source?.userId)
  if (!field) return registrationGuide()

  return infoFlex({
    title: 'ปุ๋ย-น้ำ',
    subtitle: 'Precision input',
    body: `อิงจากแปลง ${field.name} ระบบแนะนำให้ดูแลแบบแบ่งโซน ไม่ใส่ปุ๋ย/น้ำเหมารวมทั้งแปลง`,
    rows: [
      ['ปุ๋ยแนะนำ', field.crop.includes('ข้าว') ? '16-20-0' : 'สูตรตามชนิดพืช'],
      ['โซนต้องดูแล', '3 จุด'],
      ['ประหยัดคาดการณ์', '14%'],
    ],
    button: 'ดูสูตรและปริมาณ',
  })
}

async function harvestFlex(event) {
  const field = await getLatestFieldForUser(event.source?.userId)
  if (!field) return registrationGuide()

  const weather = await safeWeather(field)

  return infoFlex({
    title: 'เก็บเกี่ยว',
    subtitle: 'Maturity index',
    body: `ประเมินจากข้อมูลแปลง ${field.name} และอากาศจริง ${weather ? `ฝน 7 วัน ${weather.rainTotal.toFixed(1)} มม.` : 'ที่ยังไม่พร้อม'} ระยะแรกใช้ rule-based forecast ก่อน แล้วค่อยเสียบโมเดล yield จริง`,
    rows: [
      ['ผลผลิตคาดการณ์', `${estimateYield(field).toFixed(1)} ตัน`],
      ['ความมั่นใจ', '78%'],
      ['ความเสี่ยงฝน', weather ? (weather.wetDays >= 3 ? 'สูง' : 'ปานกลาง') : 'ไม่พร้อม'],
    ],
    button: 'ตั้งแจ้งเตือนเก็บเกี่ยว',
  })
}

async function sellFlex(event) {
  const field = await getLatestFieldForUser(event.source?.userId)
  if (!field) return registrationGuide()

  const offer = getBestOffer(field.id)
  const yieldTon = estimateYield(field)

  return infoFlex({
    title: `${offer?.buyer_name || 'โรงสี C'} สนใจรับซื้อ`,
    subtitle: 'YIM Buyer Matching',
    body: `ราคาเสนอ ${offer?.price_per_kg || 12.8} บาท/กก. เพราะ yield forecast ของแปลง ${field.name} คาดว่าจะได้ ${yieldTon.toFixed(1)} ตัน และตรงกับ quota ที่โรงงานต้องการ`,
    rows: [
      ['ราคาเสนอ', `${offer?.price_per_kg || 12.8} บาท/กก.`],
      ['ระยะทาง', `${offer?.distance_km || 18} กม.`],
      ['คาดรับซื้อ', `${offer?.quota_ton || yieldTon.toFixed(1)} ตัน`],
    ],
    button: 'ขอข้อเสนอรับซื้อ',
    messageText: 'ขอข้อเสนอรับซื้อ',
  })
}

function infoFlex({ title, subtitle, body, rows, button, uri = publicLiffUrl, messageText }) {
  return {
    type: 'flex',
    altText: title,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#1F7A35',
        paddingAll: '18px',
        contents: [
          { type: 'text', text: subtitle, color: '#DDF6D2', size: 'sm', weight: 'bold' },
          { type: 'text', text: title, color: '#FFFFFF', size: 'xl', weight: 'bold', wrap: true },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: body, wrap: true, color: '#26352A', size: 'sm' },
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            contents: rows.map(([label, value]) => ({
              type: 'box',
              layout: 'baseline',
              contents: [
                { type: 'text', text: label, color: '#6C7A6E', size: 'sm', flex: 3 },
                { type: 'text', text: value, color: '#145C2A', size: 'sm', weight: 'bold', flex: 5, wrap: true },
              ],
            })),
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#1F7A35',
            action: messageText
              ? {
                  type: 'message',
                  label: button,
                  text: messageText,
                }
              : {
                  type: 'uri',
                  label: button,
                  uri,
                },
          },
        ],
      },
    },
  }
}

function registrationGuide() {
  const liffJoiner = loginLiffUrl.includes('?') ? '&' : '?'
  return {
    type: 'flex',
    altText: 'ลงทะเบียนเกษตร',
    contents: {
      type: 'bubble',
      size: 'mega',
      hero: {
        type: 'image',
        url: `${publicBaseUrl}/assets/line/register-farmer-hero-v2.jpg`,
        size: 'full',
        aspectRatio: '1200:620',
        aspectMode: 'cover',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        backgroundColor: '#FFF8DB',
        contents: [
          {
            type: 'text',
            text: 'ลงทะเบียนเกษตร',
            weight: 'bold',
            size: 'xxl',
            color: '#145A2A',
            wrap: true,
          },
          {
            type: 'text',
            text: 'บันทึกพื้นที่และข้อมูลแปลงครั้งแรก เพื่อให้น้องโปช่วยวางแผนปลูก ตรวจสุขภาพ วิเคราะห์โรค และหาที่ขายได้ตรงกับพื้นที่ของคุณ',
            size: 'sm',
            color: '#3F5F3E',
            wrap: true,
            lineSpacing: '4px',
          },
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            margin: 'lg',
            contents: [
              registrationRow('ข้อมูลแปลง', 'พืช พื้นที่ และพิกัด'),
              registrationRow('แผนที่', 'ปักตำแหน่งและขอบเขตแปลง'),
              registrationRow('พร้อมใช้งาน', 'รับคำแนะนำผ่าน rich menu'),
            ],
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        backgroundColor: '#FFF8DB',
        contents: [
          {
            type: 'button',
            style: 'primary',
            height: 'sm',
            color: '#1F7A35',
            action: {
              type: 'uri',
              label: 'ลงทะเบียนเกษตร',
              uri: `${loginLiffUrl}${liffJoiner}view=login`,
            },
          },
        ],
      },
      styles: {
        body: {
          backgroundColor: '#FFF8DB',
        },
        footer: {
          backgroundColor: '#FFF8DB',
        },
      },
    },
  }
}

function registrationRow(label, value) {
  return {
    type: 'box',
    layout: 'baseline',
    contents: [
      {
        type: 'text',
        text: label,
        color: '#145A2A',
        size: 'sm',
        weight: 'bold',
        flex: 3,
      },
      {
        type: 'text',
        text: value,
        color: '#6A7A55',
        size: 'sm',
        flex: 5,
        wrap: true,
      },
    ],
  }
}

async function safeWeather(field) {
  if (!Number.isFinite(Number(field?.latitude)) || !Number.isFinite(Number(field?.longitude))) {
    return null
  }

  try {
    return await getWeatherSummary(field.latitude, field.longitude)
  } catch (error) {
    console.warn('Weather API failed:', error.message)
    return null
  }
}

function estimateYield(field) {
  const cropFactor = field.crop.includes('ข้าว') ? 0.55 : 0.45
  return Number(field.area_rai || 0) * cropFactor
}

async function getLatestFieldForUser(lineUserId) {
  if (!lineUserId) return null

  try {
    const supabaseField = await getLatestFarmerFieldFromSupabase(lineUserId)
    if (supabaseField) return supabaseField

    const fallbackField = await getLatestAnyFarmerFieldFromSupabase()
    if (fallbackField) return fallbackField
  } catch (error) {
    console.error('Supabase latest field lookup failed:', error)
  }

  try {
    const sheetsField = await getLatestFarmerFieldFromGoogleSheets(lineUserId)
    if (sheetsField) return sheetsField
  } catch (error) {
    console.error('Google Sheets latest field lookup failed:', error)
  }

  return getLatestField(lineUserId)
}

function saveFieldLocallyIfComplete({
  lineUserId,
  fieldName,
  crop,
  areaRai,
  latitude,
  longitude,
}) {
  if (
    !Number.isFinite(Number(areaRai)) ||
    !Number.isFinite(Number(latitude)) ||
    !Number.isFinite(Number(longitude))
  ) {
    return { skipped: true, reason: 'Missing local SQLite coordinates or area' }
  }

  try {
    upsertUserRole(lineUserId, 'farmer')
    return createField({
      lineUserId,
      name: fieldName,
      crop,
      areaRai: Number(areaRai),
      latitude: Number(latitude),
      longitude: Number(longitude),
    })
  } catch (error) {
    console.error('Local field save failed:', error)
    return { skipped: true, reason: 'Local SQLite insert failed' }
  }
}

function simpleText(text) {
  return { type: 'text', text }
}

function reply(replyToken, messages) {
  return client.replyMessage({
    replyToken,
    messages: Array.isArray(messages) ? messages : [messages],
  })
}

app.listen(port, () => {
  console.log(`NongPo farmer bot listening on http://127.0.0.1:${port}`)
  if (missingEnv.length) {
    console.log(`Missing env: ${missingEnv.join(', ')}`)
  }
})
