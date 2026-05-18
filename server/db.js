import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.resolve(__dirname, '../data')
const dbPath = path.join(dataDir, 'nongpo.sqlite')

fs.mkdirSync(dataDir, { recursive: true })

export const db = new Database(dbPath)
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    line_user_id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    full_name TEXT,
    phone TEXT,
    province TEXT,
    district TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    line_user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    crop TEXT NOT NULL,
    area_rai REAL NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    soil_type TEXT,
    soil_ph REAL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (line_user_id) REFERENCES users(line_user_id)
  );

  CREATE TABLE IF NOT EXISTS field_health (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    field_id INTEGER NOT NULL,
    ndvi REAL,
    risk_level TEXT NOT NULL,
    risk_area_rai REAL,
    note TEXT,
    observed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (field_id) REFERENCES fields(id)
  );

  CREATE TABLE IF NOT EXISTS buyer_offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    field_id INTEGER NOT NULL,
    buyer_line_user_id TEXT,
    buyer_name TEXT NOT NULL,
    price_per_kg REAL NOT NULL,
    distance_km REAL,
    quota_ton REAL,
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (field_id) REFERENCES fields(id)
  );

  CREATE TABLE IF NOT EXISTS supplier_profiles (
    line_user_id TEXT PRIMARY KEY,
    shop_name TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    service_radius_km REAL NOT NULL DEFAULT 20,
    phone TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (line_user_id) REFERENCES users(line_user_id)
  );

  CREATE TABLE IF NOT EXISTS supplier_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_line_user_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL,
    price REAL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_line_user_id) REFERENCES supplier_profiles(line_user_id)
  );

  CREATE TABLE IF NOT EXISTS supplier_offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_line_user_id TEXT NOT NULL,
    field_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    price REAL NOT NULL,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'sent',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_line_user_id) REFERENCES supplier_profiles(line_user_id),
    FOREIGN KEY (field_id) REFERENCES fields(id)
  );

  CREATE TABLE IF NOT EXISTS buyer_profiles (
    line_user_id TEXT PRIMARY KEY,
    buyer_name TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    phone TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (line_user_id) REFERENCES users(line_user_id)
  );

  CREATE TABLE IF NOT EXISTS buyer_quotas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    buyer_line_user_id TEXT NOT NULL,
    crop TEXT NOT NULL,
    required_ton REAL NOT NULL,
    target_price REAL NOT NULL,
    harvest_window TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (buyer_line_user_id) REFERENCES buyer_profiles(line_user_id)
  );

  CREATE TABLE IF NOT EXISTS field_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    field_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    payload_json TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (field_id) REFERENCES fields(id)
  );

  CREATE TABLE IF NOT EXISTS planting_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    line_user_id TEXT NOT NULL,
    field_id INTEGER,
    field_name TEXT NOT NULL,
    crop TEXT NOT NULL,
    variety TEXT,
    planting_date TEXT NOT NULL,
    method TEXT NOT NULL,
    seed_rate REAL,
    water_plan TEXT,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (field_id) REFERENCES fields(id),
    FOREIGN KEY (line_user_id) REFERENCES users(line_user_id)
  );
`)

try {
  db.prepare('ALTER TABLE buyer_offers ADD COLUMN buyer_line_user_id TEXT').run()
} catch {
  // Column already exists.
}

for (const statement of [
  'ALTER TABLE users ADD COLUMN full_name TEXT',
  'ALTER TABLE users ADD COLUMN phone TEXT',
  'ALTER TABLE users ADD COLUMN province TEXT',
  'ALTER TABLE users ADD COLUMN district TEXT',
  'ALTER TABLE planting_plans ADD COLUMN field_id INTEGER',
]) {
  try {
    db.prepare(statement).run()
  } catch {
    // Column already exists.
  }
}

export function upsertUserRole(lineUserId, role) {
  db.prepare(`
    INSERT INTO users (line_user_id, role, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(line_user_id)
    DO UPDATE SET role = excluded.role, updated_at = CURRENT_TIMESTAMP
  `).run(lineUserId, role)
}

export function getUserRole(lineUserId) {
  return db.prepare('SELECT role FROM users WHERE line_user_id = ?').get(lineUserId)?.role
}

export function upsertFarmerRegistration({ lineUserId, fullName, phone, province, district }) {
  db.prepare(`
    INSERT INTO users (line_user_id, role, full_name, phone, province, district, updated_at)
    VALUES (?, 'farmer', ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(line_user_id)
    DO UPDATE SET
      role = 'farmer',
      full_name = excluded.full_name,
      phone = excluded.phone,
      province = excluded.province,
      district = excluded.district,
      updated_at = CURRENT_TIMESTAMP
  `).run(lineUserId, fullName, phone, province, district)

  return db.prepare('SELECT * FROM users WHERE line_user_id = ?').get(lineUserId)
}

export function createField({
  lineUserId,
  name,
  crop,
  areaRai,
  latitude,
  longitude,
  soilType,
  soilPh,
}) {
  const result = db.prepare(`
    INSERT INTO fields (
      line_user_id, name, crop, area_rai, latitude, longitude, soil_type, soil_ph
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(lineUserId, name, crop, areaRai, latitude, longitude, soilType || null, soilPh || null)

  const fieldId = Number(result.lastInsertRowid)
  seedFieldData(fieldId)
  return getLatestField(lineUserId)
}

export function getLatestField(lineUserId) {
  return db.prepare(`
    SELECT *
    FROM fields
    WHERE line_user_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `).get(lineUserId)
}

export function getFieldsForUser(lineUserId) {
  return db.prepare(`
    SELECT
      id,
      name,
      crop,
      area_rai AS areaRai,
      latitude,
      longitude,
      soil_type AS soilType,
      soil_ph AS soilPh,
      created_at AS createdAt
    FROM fields
    WHERE line_user_id = ?
    ORDER BY created_at DESC, id DESC
  `).all(lineUserId)
}

export function getFieldHealth(fieldId) {
  return db.prepare(`
    SELECT *
    FROM field_health
    WHERE field_id = ?
    ORDER BY observed_at DESC, id DESC
    LIMIT 1
  `).get(fieldId)
}

export function getBestOffer(fieldId) {
  return db.prepare(`
    SELECT *
    FROM buyer_offers
    WHERE field_id = ?
    ORDER BY price_per_kg DESC, distance_km ASC
    LIMIT 1
  `).get(fieldId)
}

export function createPlantingPlan({
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
  upsertUserRole(lineUserId, 'farmer')

  const result = db.prepare(`
    INSERT INTO planting_plans (
      line_user_id, field_id, field_name, crop, variety, planting_date, method, seed_rate, water_plan, note
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    lineUserId,
    fieldId || null,
    fieldName,
    crop,
    variety || null,
    plantingDate,
    method,
    seedRate === '' || seedRate == null ? null : Number(seedRate),
    waterPlan || null,
    note || null,
  )

  return db.prepare('SELECT * FROM planting_plans WHERE id = ?').get(result.lastInsertRowid)
}

export function upsertSupplierProfile({
  lineUserId,
  shopName,
  latitude,
  longitude,
  serviceRadiusKm,
  phone,
}) {
  db.prepare(`
    INSERT INTO supplier_profiles (
      line_user_id, shop_name, latitude, longitude, service_radius_km, phone, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(line_user_id)
    DO UPDATE SET
      shop_name = excluded.shop_name,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      service_radius_km = excluded.service_radius_km,
      phone = excluded.phone,
      updated_at = CURRENT_TIMESTAMP
  `).run(lineUserId, shopName, latitude, longitude, serviceRadiusKm || 20, phone || null)

  return db.prepare('SELECT * FROM supplier_profiles WHERE line_user_id = ?').get(lineUserId)
}

export function addSupplierInventory({ lineUserId, productName, quantity, unit, price }) {
  db.prepare(`
    INSERT INTO supplier_inventory (supplier_line_user_id, product_name, quantity, unit, price)
    VALUES (?, ?, ?, ?, ?)
  `).run(lineUserId, productName, quantity, unit, price || null)
}

export function getSupplierProfile(lineUserId) {
  return db.prepare('SELECT * FROM supplier_profiles WHERE line_user_id = ?').get(lineUserId)
}

export function getSupplierInventory(lineUserId) {
  return db.prepare(`
    SELECT *
    FROM supplier_inventory
    WHERE supplier_line_user_id = ?
    ORDER BY updated_at DESC, id DESC
  `).all(lineUserId)
}

export function findSupplierLeads(lineUserId) {
  const supplier = getSupplierProfile(lineUserId)
  if (!supplier) return []

  return db.prepare(`
    SELECT
      fields.*,
      field_health.risk_level,
      field_health.risk_area_rai,
      field_health.note,
      (
        6371 * acos(
          cos(radians(?)) * cos(radians(fields.latitude)) *
          cos(radians(fields.longitude) - radians(?)) +
          sin(radians(?)) * sin(radians(fields.latitude))
        )
      ) AS distance_km
    FROM fields
    LEFT JOIN field_health ON field_health.field_id = fields.id
    GROUP BY fields.id
    HAVING distance_km <= ?
    ORDER BY distance_km ASC
    LIMIT 5
  `).all(supplier.latitude, supplier.longitude, supplier.latitude, supplier.service_radius_km)
}

export function createSupplierOffer({ lineUserId, fieldId, productName, price, note }) {
  const result = db.prepare(`
    INSERT INTO supplier_offers (supplier_line_user_id, field_id, product_name, price, note)
    VALUES (?, ?, ?, ?, ?)
  `).run(lineUserId, fieldId, productName, price, note || null)

  return db.prepare('SELECT * FROM supplier_offers WHERE id = ?').get(result.lastInsertRowid)
}

export function upsertBuyerProfile({ lineUserId, buyerName, latitude, longitude, phone }) {
  db.prepare(`
    INSERT INTO buyer_profiles (line_user_id, buyer_name, latitude, longitude, phone, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(line_user_id)
    DO UPDATE SET
      buyer_name = excluded.buyer_name,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      phone = excluded.phone,
      updated_at = CURRENT_TIMESTAMP
  `).run(lineUserId, buyerName, latitude, longitude, phone || null)

  return db.prepare('SELECT * FROM buyer_profiles WHERE line_user_id = ?').get(lineUserId)
}

export function createBuyerQuota({
  lineUserId,
  crop,
  requiredTon,
  targetPrice,
  harvestWindow,
}) {
  const result = db.prepare(`
    INSERT INTO buyer_quotas (
      buyer_line_user_id, crop, required_ton, target_price, harvest_window
    )
    VALUES (?, ?, ?, ?, ?)
  `).run(lineUserId, crop, requiredTon, targetPrice, harvestWindow || null)

  return db.prepare('SELECT * FROM buyer_quotas WHERE id = ?').get(result.lastInsertRowid)
}

export function findQuotaMatches(lineUserId) {
  const quota = db.prepare(`
    SELECT *
    FROM buyer_quotas
    WHERE buyer_line_user_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `).get(lineUserId)
  const buyer = db.prepare('SELECT * FROM buyer_profiles WHERE line_user_id = ?').get(lineUserId)

  if (!quota || !buyer) return []

  return db.prepare(`
    SELECT
      fields.*,
      (
        6371 * acos(
          cos(radians(?)) * cos(radians(fields.latitude)) *
          cos(radians(fields.longitude) - radians(?)) +
          sin(radians(?)) * sin(radians(fields.latitude))
        )
      ) AS distance_km
    FROM fields
    WHERE fields.crop LIKE ?
    ORDER BY distance_km ASC
    LIMIT 8
  `).all(buyer.latitude, buyer.longitude, buyer.latitude, `%${quota.crop}%`)
}

export function createBuyerOffer({ lineUserId, fieldId, buyerName, pricePerKg, distanceKm, quotaTon, reason }) {
  const result = db.prepare(`
    INSERT INTO buyer_offers (
      field_id, buyer_line_user_id, buyer_name, price_per_kg, distance_km, quota_ton, reason
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(fieldId, lineUserId, buyerName, pricePerKg, distanceKm || null, quotaTon || null, reason || null)

  return db.prepare('SELECT * FROM buyer_offers WHERE id = ?').get(result.lastInsertRowid)
}

function seedFieldData(fieldId) {
  db.prepare(`
    INSERT INTO field_health (field_id, ndvi, risk_level, risk_area_rai, note)
    VALUES (?, 0.64, 'ปานกลาง', 1.2, 'NDVI ลดลงบริเวณทิศตะวันออก ควรถ่ายรูปใบ/ลำต้นเพื่อยืนยันอาการ')
  `).run(fieldId)

  db.prepare(`
    INSERT INTO buyer_offers (field_id, buyer_name, price_per_kg, distance_km, quota_ton, reason)
    VALUES (?, 'โรงสี C', 12.80, 18, 4.2, 'yield forecast ของแปลงตรงกับ quota โรงงาน')
  `).run(fieldId)
}
