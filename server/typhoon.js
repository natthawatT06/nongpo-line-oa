const TYPHOON_BASE_URL = process.env.TYPHOON_BASE_URL || 'https://api.opentyphoon.ai/v1'
const TYPHOON_MODEL = process.env.TYPHOON_MODEL || 'typhoon-v2.5-30b-a3b-instruct'

const SUGARCANE_EXPERT_PROMPT = `
คุณคือน้องโป ผู้ช่วยเกษตรกรไทยที่เชี่ยวชาญเรื่อง "อ้อย" โดยเฉพาะ
ตอบเป็นภาษาไทย สุภาพ เข้าใจง่าย และใช้งานได้จริงในแปลง

ขอบเขตความเชี่ยวชาญ:
- การเตรียมดิน พันธุ์อ้อย การปลูก การให้น้ำ ปุ๋ย วัชพืช โรค แมลง และการเก็บเกี่ยวอ้อย
- การวิเคราะห์อาการจากคำบรรยายของเกษตรกร และการตั้งคำถามต่อเมื่อข้อมูลยังไม่พอ
- การแนะนำแบบระมัดระวัง ไม่เดาปริมาณสารเคมีหรือปุ๋ยเกินจริง ถ้าเกี่ยวกับสารกำจัดศัตรูพืชให้แนะนำให้อ่านฉลากและปรึกษาเจ้าหน้าที่เกษตรในพื้นที่
- ถ้าคำถามไม่เกี่ยวกับอ้อยหรือเกษตร ให้ตอบสั้นๆ แล้วชวนกลับมาที่เรื่องอ้อย

รูปแบบคำตอบ:
- เริ่มด้วยคำตอบสั้นที่ช่วยตัดสินใจได้
- ถ้ามีขั้นตอน ให้จัดเป็นข้อ 1-4 ข้อ
- ถ้าข้อมูลไม่พอ ให้ตอบจากสาเหตุที่เป็นไปได้ก่อน แล้วค่อยถามกลับไม่เกิน 3 คำถาม เช่น อายุอ้อย จังหวัด อาการที่เห็น หรือมีรูปถ่ายไหม
- อย่าอ้างว่าตรวจจากภาพ/ดาวเทียมได้ ถ้าผู้ใช้ไม่ได้ส่งข้อมูลนั้นมา
- ห้ามใช้อีโมจิ
`.trim()

export function isTyphoonConfigured() {
  return Boolean(process.env.TYPHOON_API_KEY)
}

export async function askSugarcaneExpert({ question, field }) {
  if (!isTyphoonConfigured()) {
    return [
      'ตอนนี้ยังไม่ได้ตั้งค่า Typhoon API ครับ',
      'ให้เพิ่ม TYPHOON_API_KEY ในไฟล์ .env แล้วรีสตาร์ตบอท จากนั้นถามเรื่องอ้อยกับน้องโปได้เลย',
    ].join('\n')
  }

  const fieldContext = formatFieldContext(field)
  const keywordHints = buildThaiKeywordHints(question)
  const inferredIntent = inferQuestionIntent(question)
  const response = await fetch(`${TYPHOON_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.TYPHOON_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: TYPHOON_MODEL,
      messages: [
        { role: 'system', content: SUGARCANE_EXPERT_PROMPT },
        {
          role: 'user',
          content: [
            'The user wrote the following Thai farming question. Treat it as a valid user question, understand the Thai text, and answer in Thai.',
            fieldContext,
            keywordHints,
            inferredIntent,
            `Original Thai question: """${question}"""`,
          ].filter(Boolean).join('\n\n'),
        },
      ],
      temperature: 0.2,
      max_tokens: 900,
    }),
  })

  const body = await response.text()

  if (!response.ok) {
    throw new Error(`Typhoon API ${response.status}: ${body.slice(0, 300)}`)
  }

  const data = JSON.parse(body)
  const content = data?.choices?.[0]?.message?.content?.trim()

  if (!content) {
    throw new Error('Typhoon API returned an empty message')
  }

  return trimForLine(content)
}

function inferQuestionIntent(question) {
  const age = question.match(/(\d+)\s*(เดือน|วัน|ปี)/)?.[0]

  if (question.includes('ใบเหลือง')) {
    return 'Inferred user intent in English: The farmer asks what to do when sugarcane leaves are yellow. Give likely causes, immediate checks, and practical next steps.'
  }

  if (question.includes('ใบขาว')) {
    return 'Inferred user intent in English: The farmer asks about sugarcane white leaf disease. Explain risk, field checks, and what to do with infected clumps.'
  }

  if (question.includes('ปุ๋ย')) {
    return `Inferred user intent in English: The farmer asks what fertilizer to use for sugarcane${age ? ` at about ${age}` : ''}. Give practical fertilizer guidance and what information is needed to refine the recommendation.`
  }

  if (question.includes('เตรียมดิน') || question.includes('ปลูก')) {
    return 'Inferred user intent in English: The farmer asks about land preparation or planting sugarcane. Give practical preparation and planting steps.'
  }

  if (question.includes('หนอนกอ') || question.includes('แมลง') || question.includes('เพลี้ย')) {
    return 'Inferred user intent in English: The farmer asks about insects or pests in sugarcane. Give scouting steps and safe management guidance.'
  }

  if (question.includes('โรค')) {
    return 'Inferred user intent in English: The farmer asks about sugarcane disease. Give likely diagnostic steps and cautious management guidance.'
  }

  if (question.includes('น้ำ') || question.includes('แล้ง') || question.includes('น้ำท่วม')) {
    return 'Inferred user intent in English: The farmer asks about irrigation, drought, or waterlogging in sugarcane. Give practical water management guidance.'
  }

  if (question.includes('เก็บเกี่ยว') || question.includes('ตัดอ้อย')) {
    return 'Inferred user intent in English: The farmer asks about sugarcane harvest timing or cutting. Give harvest readiness checks and practical advice.'
  }

  return ''
}

function buildThaiKeywordHints(question) {
  const dictionary = [
    ['อ้อย', 'sugarcane'],
    ['ใบเหลือง', 'yellow leaves'],
    ['เหลือง', 'yellowing'],
    ['ใบขาว', 'sugarcane white leaf disease'],
    ['ใบไหม้', 'leaf scorch or leaf burn symptoms'],
    ['ใบจุด', 'leaf spot symptoms'],
    ['แดง', 'red discoloration'],
    ['รากเน่า', 'root rot'],
    ['ลำต้น', 'stalk'],
    ['แตกกอ', 'tillering'],
    ['ปลูก', 'planting'],
    ['เตรียมดิน', 'land preparation'],
    ['ดิน', 'soil'],
    ['น้ำ', 'irrigation or water'],
    ['แล้ง', 'drought'],
    ['น้ำท่วม', 'waterlogging'],
    ['ปุ๋ย', 'fertilizer'],
    ['ยูเรีย', 'urea fertilizer'],
    ['ไนโตรเจน', 'nitrogen'],
    ['โพแทสเซียม', 'potassium'],
    ['วัชพืช', 'weeds'],
    ['หญ้า', 'weeds'],
    ['แมลง', 'insects'],
    ['เพลี้ย', 'aphids or plant hoppers'],
    ['หนอนกอ', 'sugarcane stem borer'],
    ['หนอน', 'worms or larvae'],
    ['โรค', 'plant disease'],
    ['เก็บเกี่ยว', 'harvest'],
    ['ตัดอ้อย', 'sugarcane cutting or harvest'],
    ['ผลผลิต', 'yield'],
    ['ตัน', 'tons'],
    ['ไร่', 'rai area unit'],
    ['งอก', 'germination'],
  ]

  const hints = dictionary
    .filter(([thai]) => question.includes(thai))
    .map(([, english]) => english)

  if (!hints.length) return ''

  return `Detected Thai agriculture keyword hints: ${[...new Set(hints)].join(', ')}. Use these hints to understand the original Thai question, but answer naturally in Thai.`
}

function formatFieldContext(field) {
  if (!field) return ''

  const rows = [
    `ข้อมูลแปลงล่าสุดของผู้ใช้:`,
    `- ชื่อแปลง: ${field.name}`,
    `- พืชที่บันทึกไว้: ${field.crop}`,
    `- พื้นที่: ${field.area_rai} ไร่`,
    `- พิกัด: ${field.latitude}, ${field.longitude}`,
  ]

  if (field.soil_type) rows.push(`- ดิน: ${field.soil_type}`)
  if (field.soil_ph) rows.push(`- pH ดิน: ${field.soil_ph}`)

  return rows.join('\n')
}

function trimForLine(text) {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (normalized.length <= 4500) return normalized
  return `${normalized.slice(0, 4400).trim()}\n\nคำตอบยาวเกินไปครับ ถ้าต้องการ ผมช่วยแตกเป็นแผนรายขั้นตอนได้`
}
