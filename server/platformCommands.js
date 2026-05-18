import {
  addSupplierInventory,
  createBuyerOffer,
  createBuyerQuota,
  createSupplierOffer,
  findQuotaMatches,
  findSupplierLeads,
  getSupplierInventory,
  getSupplierProfile,
  upsertBuyerProfile,
  upsertSupplierProfile,
} from './db.js'

export function parsePlatformCommand(text) {
  return (
    parseSupplierProfile(text) ||
    parseInventory(text) ||
    parseSupplierOffer(text) ||
    parseBuyerProfile(text) ||
    parseBuyerQuota(text) ||
    parseBuyerOffer(text)
  )
}

export function handlePlatformCommand(event, command) {
  const lineUserId = event.source?.userId
  if (!lineUserId) return textMessage('ไม่พบ LINE userId จึงบันทึกข้อมูลไม่ได้ครับ')
  if (command.error) return command.type === 'supplierProfile' ? supplierGuide() : buyerGuide()

  switch (command.type) {
    case 'supplierProfile':
      return saveSupplierProfile(lineUserId, command)
    case 'inventory':
      return saveInventory(lineUserId, command)
    case 'supplierOffer':
      return saveSupplierOffer(lineUserId, command)
    case 'buyerProfile':
      return saveBuyerProfile(lineUserId, command)
    case 'buyerQuota':
      return saveBuyerQuota(lineUserId, command)
    case 'buyerOffer':
      return saveBuyerOffer(lineUserId, command)
    default:
      return textMessage('ยังไม่รู้จักคำสั่งนี้ครับ')
  }
}

export function supplierLeadsMessage(event) {
  const lineUserId = event.source?.userId
  const supplier = getSupplierProfile(lineUserId)
  if (!supplier) return supplierGuide()

  const leads = findSupplierLeads(lineUserId)
  if (!leads.length) return textMessage('ยังไม่พบแปลงในรัศมีบริการของร้านคุณครับ')

  return {
    type: 'text',
    text: [
      `ลูกค้าใกล้ ${supplier.shop_name}`,
      ...leads.map((lead, index) => (
        `${index + 1}. #${lead.id} ${lead.name} (${lead.crop}) ${lead.area_rai} ไร่ - ${lead.distance_km.toFixed(1)} กม.`
      )),
      '',
      'ส่งข้อเสนอด้วยรูปแบบ:',
      'ส่งข้อเสนอปุ๋ย fieldId|สินค้า|ราคา|หมายเหตุ',
    ].join('\n'),
  }
}

export function supplierProfileMessage(event) {
  const lineUserId = event.source?.userId
  const supplier = getSupplierProfile(lineUserId)
  if (!supplier) return supplierGuide()

  const inventory = getSupplierInventory(lineUserId)
  return textMessage([
    `โปรไฟล์ร้าน: ${supplier.shop_name}`,
    `พิกัด: ${supplier.latitude}, ${supplier.longitude}`,
    `รัศมีบริการ: ${supplier.service_radius_km} กม.`,
    `เบอร์: ${supplier.phone || '-'}`,
    '',
    'สต็อกล่าสุด:',
    ...(inventory.length
      ? inventory.slice(0, 5).map((item) => `- ${item.product_name}: ${item.quantity} ${item.unit}${item.price ? ` ราคา ${item.price}` : ''}`)
      : ['- ยังไม่มีสินค้า']),
  ].join('\n'))
}

export function quotaMatchesMessage(event) {
  const lineUserId = event.source?.userId
  const matches = findQuotaMatches(lineUserId)
  if (!matches.length) return buyerGuide()

  return textMessage([
    'แปลงที่ตรงกับ quota ล่าสุด',
    ...matches.map((field, index) => (
      `${index + 1}. #${field.id} ${field.name} (${field.crop}) ${field.area_rai} ไร่ - ${field.distance_km.toFixed(1)} กม.`
    )),
    '',
    'ส่ง offer ด้วยรูปแบบ:',
    'ส่ง offer fieldId|ราคา/กก.|ปริมาณตัน|ชื่อโรงงาน',
  ].join('\n'))
}

export function supplierGuide() {
  return textMessage([
    'ลงทะเบียนร้านก่อนครับ:',
    'ลงทะเบียนร้าน ชื่อร้าน|lat|lon|รัศมีกม.|เบอร์',
    '',
    'ตัวอย่าง:',
    'ลงทะเบียนร้าน ปุ๋ยดีบางระกำ|16.752|100.12|20|0812345678',
    '',
    'เพิ่มสต็อก:',
    'เพิ่มสต็อก 16-20-0|38|กระสอบ|720',
  ].join('\n'))
}

export function buyerGuide() {
  return textMessage([
    'ลงทะเบียนโรงงานก่อนครับ:',
    'ลงทะเบียนโรงงาน ชื่อโรงงาน|lat|lon|เบอร์',
    '',
    'ตัวอย่าง:',
    'ลงทะเบียนโรงงาน โรงสี C|16.7|100.2|0899999999',
    '',
    'ตั้ง quota:',
    'ตั้ง quota ข้าวหอมมะลิ|70|12.80|5-20 มิ.ย.',
  ].join('\n'))
}

function saveSupplierProfile(lineUserId, command) {
  const supplier = upsertSupplierProfile({ lineUserId, ...command })
  return textMessage(`บันทึกร้าน ${supplier.shop_name} แล้วครับ ต่อไปเพิ่มสต็อกหรือกด ลูกค้าใกล้ฉัน ได้เลย`)
}

function saveInventory(lineUserId, command) {
  addSupplierInventory({ lineUserId, ...command })
  return textMessage(`เพิ่มสต็อก ${command.productName} ${command.quantity} ${command.unit} แล้วครับ`)
}

function saveSupplierOffer(lineUserId, command) {
  const offer = createSupplierOffer({ lineUserId, ...command })
  return textMessage(`ส่งข้อเสนอร้านปุ๋ยแล้ว: field #${offer.field_id} ${offer.product_name} ราคา ${offer.price} บาท`)
}

function saveBuyerProfile(lineUserId, command) {
  const buyer = upsertBuyerProfile({ lineUserId, ...command })
  return textMessage(`บันทึกโรงงาน ${buyer.buyer_name} แล้วครับ ต่อไปตั้ง quota หรือกด หาแปลง ได้เลย`)
}

function saveBuyerQuota(lineUserId, command) {
  const quota = createBuyerQuota({ lineUserId, ...command })
  return textMessage(`ตั้ง quota ${quota.crop} ${quota.required_ton} ตัน ที่ราคาเป้าหมาย ${quota.target_price} บาท/กก. แล้วครับ`)
}

function saveBuyerOffer(lineUserId, command) {
  const offer = createBuyerOffer({ lineUserId, ...command })
  return textMessage(`ส่ง offer ${offer.buyer_name} ให้ field #${offer.field_id} ที่ ${offer.price_per_kg} บาท/กก. แล้วครับ`)
}

function parseSupplierProfile(text) {
  const prefix = 'ลงทะเบียนร้าน '
  if (!text.startsWith(prefix)) return null
  const [shopName, latitude, longitude, serviceRadiusKm, phone] = splitPayload(text, prefix)
  if (!shopName || !isNumber(latitude) || !isNumber(longitude)) return { type: 'supplierProfile', error: true }
  return {
    type: 'supplierProfile',
    shopName,
    latitude: Number(latitude),
    longitude: Number(longitude),
    serviceRadiusKm: Number(serviceRadiusKm || 20),
    phone,
  }
}

function parseInventory(text) {
  const prefix = 'เพิ่มสต็อก '
  if (!text.startsWith(prefix)) return null
  const [productName, quantity, unit, price] = splitPayload(text, prefix)
  if (!productName || !isNumber(quantity) || !unit) return null
  return {
    type: 'inventory',
    productName,
    quantity: Number(quantity),
    unit,
    price: price ? Number(price) : null,
  }
}

function parseSupplierOffer(text) {
  const prefix = 'ส่งข้อเสนอปุ๋ย '
  if (!text.startsWith(prefix)) return null
  const [fieldId, productName, price, note] = splitPayload(text, prefix)
  if (!isNumber(fieldId) || !productName || !isNumber(price)) return null
  return {
    type: 'supplierOffer',
    fieldId: Number(fieldId),
    productName,
    price: Number(price),
    note,
  }
}

function parseBuyerProfile(text) {
  const prefix = 'ลงทะเบียนโรงงาน '
  if (!text.startsWith(prefix)) return null
  const [buyerName, latitude, longitude, phone] = splitPayload(text, prefix)
  if (!buyerName || !isNumber(latitude) || !isNumber(longitude)) return null
  return {
    type: 'buyerProfile',
    buyerName,
    latitude: Number(latitude),
    longitude: Number(longitude),
    phone,
  }
}

function parseBuyerQuota(text) {
  const prefix = 'ตั้ง quota '
  if (!text.startsWith(prefix)) return null
  const [crop, requiredTon, targetPrice, harvestWindow] = splitPayload(text, prefix)
  if (!crop || !isNumber(requiredTon) || !isNumber(targetPrice)) return null
  return {
    type: 'buyerQuota',
    crop,
    requiredTon: Number(requiredTon),
    targetPrice: Number(targetPrice),
    harvestWindow,
  }
}

function parseBuyerOffer(text) {
  const prefix = 'ส่ง offer '
  if (!text.startsWith(prefix)) return null
  const [fieldId, pricePerKg, quotaTon, buyerName] = splitPayload(text, prefix)
  if (!isNumber(fieldId) || !isNumber(pricePerKg)) return null
  return {
    type: 'buyerOffer',
    fieldId: Number(fieldId),
    pricePerKg: Number(pricePerKg),
    quotaTon: quotaTon ? Number(quotaTon) : null,
    buyerName: buyerName || 'โรงงาน',
    distanceKm: null,
    reason: 'ส่งจาก quota ของโรงงานผ่าน NongPo',
  }
}

function splitPayload(text, prefix) {
  return text.slice(prefix.length).split('|').map((part) => part.trim())
}

function isNumber(value) {
  return Number.isFinite(Number(value))
}

function textMessage(text) {
  return { type: 'text', text }
}
