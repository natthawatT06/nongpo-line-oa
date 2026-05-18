import { useEffect, useState } from 'react'
import {
  BadgeCheck,
  CalendarClock,
  ChevronRight,
  Droplets,
  Leaf,
  LocateFixed,
  Map,
  MapPin,
  MessageCircle,
  Navigation,
  PackageCheck,
  Save,
  Sprout,
  Wheat,
} from 'lucide-react'
import './App.css'

function App() {
  const view = getCurrentView()
  if (view === 'login') {
    return <FieldRegistrationPage />
  }

  if (view === 'field') {
    return <FieldAddPage />
  }

  if (view === 'plant') {
    return <StartPlantingPage />
  }

  if (view === 'register') {
    return <FieldRegistrationPage />
  }

  return <FieldAddPage />
}

function getCurrentView() {
  const params = new URLSearchParams(window.location.search)
  const directView = params.get('view')
  if (directView) return directView

  const liffState = params.get('liff.state')
  if (liffState) {
    const stateText = decodeURIComponent(liffState)
    const stateUrl = new URL(stateText, window.location.origin)
    const stateView = stateUrl.searchParams.get('view')
    if (stateView) return stateView
  }

  if (window.location.pathname === '/start' || window.location.pathname === '/plant') {
    return 'plant'
  }

  if (window.location.pathname === '/field') {
    return 'field'
  }

  if (window.location.pathname === '/login') {
    return 'login'
  }

  return null
}

function FieldRegistrationPage() {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    province: '',
    district: '',
  })
  const [status, setStatus] = useState('idle')

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function submitFarmer(event) {
    event.preventDefault()
    setStatus('saving')

    let response
    try {
      const lineUserId = await resolveLineUserId()
      response = await fetch('/api/farmers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineUserId,
          fullName: form.fullName,
          phone: form.phone,
          province: form.province,
          district: form.district,
        }),
      })
    } catch {
      setStatus('error')
      return
    }

    if (!response.ok) {
      setStatus('error')
      return
    }

    setStatus('saved')
  }

  return (
    <main className="liff-page farmer-auth-page">
      <section className="liff-hero farmer-auth-hero">
        <div className="hero-copy">
          <span className="sprout-mark">น้องโป</span>
          <h1>{mode === 'login' ? 'เข้าสู่ระบบ' : 'ลงทะเบียนเกษตร'}</h1>
          <p>{mode === 'login' ? 'กลับเข้าสู่ผู้ช่วยเกษตรกรของคุณผ่านบัญชี LINE' : 'กรอกข้อมูลสั้น ๆ เพื่อเริ่มใช้งานบริการเกษตร'}</p>
        </div>
        <div className="nongpo-mascot">
          <Leaf size={30} />
        </div>
      </section>

      <section className="auth-choice" aria-label="เลือกวิธีเริ่มต้น">
        <button type="button" className={mode === 'login' ? 'is-active' : ''} onClick={() => setMode('login')}>
          <Navigation size={19} />
          เข้าสู่ระบบ
        </button>
        <button type="button" className={mode === 'register' ? 'is-active' : ''} onClick={() => setMode('register')}>
          <BadgeCheck size={19} />
          ลงทะเบียน
        </button>
      </section>

      {mode === 'login' ? (
        <section className="form-panel auth-panel login-panel">
          <div className="login-mark">
            <Leaf size={28} />
          </div>
          <h2>เข้าสู่ระบบน้องโป</h2>
          <p>ใช้บัญชี LINE เดิมเพื่อเปิดใช้งานเมนูเกษตรกร และกลับไปจัดการข้อมูลของคุณได้ทันที</p>
          <button className="line-login-button" type="button" onClick={resolveLineUserId}>
            <MessageCircle size={22} />
            เข้าสู่ระบบด้วย LINE
          </button>
          <button className="text-switch-button" type="button" onClick={() => setMode('register')}>
            ยังไม่มีบัญชี? ลงทะเบียนเกษตร
          </button>
        </section>
      ) : (
        <form className="field-form farmer-register-form" onSubmit={submitFarmer}>
          <section className="form-panel auth-panel">
            <div className="panel-title-row">
              <div>
                <h2>ข้อมูลเกษตรกร</h2>
                <p>กรอกเฉพาะข้อมูลติดต่อก่อน รายละเอียดแปลงค่อยเพิ่มภายหลังจาก rich menu ได้</p>
              </div>
            </div>

            <FormRow icon={<Leaf size={22} />} label="ชื่อ-นามสกุล">
              <input value={form.fullName} required onChange={(event) => updateField('fullName', event.target.value)} />
            </FormRow>
            <FormRow icon={<MessageCircle size={22} />} label="เบอร์โทร">
              <input value={form.phone} required inputMode="tel" onChange={(event) => updateField('phone', event.target.value)} />
            </FormRow>
            <FormRow icon={<MapPin size={22} />} label="จังหวัด">
              <input value={form.province} required onChange={(event) => updateField('province', event.target.value)} />
            </FormRow>
            <FormRow icon={<Map size={22} />} label="อำเภอ">
              <input value={form.district} required onChange={(event) => updateField('district', event.target.value)} />
            </FormRow>
          </section>

          <button className="save-field-button" type="submit" disabled={status === 'saving'}>
            <Save size={26} />
            {status === 'saving' ? 'กำลังลงทะเบียน...' : status === 'saved' ? 'ลงทะเบียนแล้ว' : 'ลงทะเบียนเกษตร'}
          </button>
          {status === 'saved' && <p className="save-note">ลงทะเบียนสำเร็จ กลับไปที่ LINE แล้วใช้ rich menu เกษตรกรต่อได้เลยครับ</p>}
          {status === 'error' && <p className="save-note error">ลงทะเบียนไม่สำเร็จ ลองตรวจข้อมูลอีกครั้งครับ</p>}
          <button className="text-switch-button" type="button" onClick={() => setMode('login')}>
            มีบัญชีแล้ว? เข้าสู่ระบบ
          </button>
        </form>
      )}
    </main>
  )
}

function FormRow({ icon, label, children }) {
  return (
    <label className="form-row">
      <span className="row-icon">{icon}</span>
      <span className="row-label">{label}</span>
      {children}
      <ChevronRight className="row-chevron" size={20} />
    </label>
  )
}

function FieldAddPage() {
  const [form, setForm] = useState({
    fieldName: '',
    crop: 'ข้าวหอมมะลิ',
    areaRai: '',
    latitude: '',
    longitude: '',
    province: '',
    district: '',
    note: '',
  })
  const [status, setStatus] = useState('idle')
  const [gpsStatus, setGpsStatus] = useState('idle')

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setGpsStatus('error')
      return
    }

    setGpsStatus('loading')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateField('latitude', position.coords.latitude.toFixed(6))
        updateField('longitude', position.coords.longitude.toFixed(6))
        setGpsStatus('ready')
      },
      () => setGpsStatus('error'),
      { enableHighAccuracy: true, timeout: 12000 },
    )
  }

  async function submitField(event) {
    event.preventDefault()
    setStatus('saving')

    let response
    try {
      const lineUserId = await resolveLineUserId()
      response = await fetch('/api/fields/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineUserId,
          fieldName: form.fieldName,
          crop: form.crop,
          areaRai: form.areaRai,
          latitude: form.latitude,
          longitude: form.longitude,
          province: form.province,
          district: form.district,
          note: form.note,
        }),
      })
    } catch {
      setStatus('error')
      return
    }

    if (!response.ok) {
      setStatus('error')
      return
    }

    setStatus('saved')
  }

  return (
    <main className="liff-page farmer-auth-page">
      <section className="liff-hero farmer-auth-hero field-add-hero">
        <div className="hero-copy">
          <span className="sprout-mark">เพิ่มพื้นที่</span>
          <h1>บันทึกแปลง</h1>
          <p>ใช้ GPS เพื่อปักตำแหน่ง แล้วกรอกข้อมูลแปลงสั้น ๆ</p>
        </div>
        <div className="nongpo-mascot">
          <MapPin size={30} />
        </div>
      </section>

      <form className="field-form farmer-register-form" onSubmit={submitField}>
        <section className="form-panel auth-panel">
          <div className="panel-title-row">
            <div>
              <h2>ตำแหน่งแปลง</h2>
              <p>กด GPS เพื่อดึงตำแหน่งปัจจุบัน หรือกรอกพิกัดเองได้</p>
            </div>
          </div>

          <button className="gps-button" type="button" onClick={useCurrentLocation}>
            <LocateFixed size={22} />
            {gpsStatus === 'loading' ? 'กำลังอ่าน GPS...' : gpsStatus === 'ready' ? 'ใช้ตำแหน่งนี้แล้ว' : 'ใช้ GPS ปัจจุบัน'}
          </button>

          {gpsStatus === 'error' && <p className="save-note error">อ่าน GPS ไม่สำเร็จ กรุณาอนุญาตตำแหน่ง หรือกรอกพิกัดเอง</p>}

          <div className="coord-grid compact">
            <label>
              Lat
              <input value={form.latitude} inputMode="decimal" onChange={(event) => updateField('latitude', event.target.value)} />
            </label>
            <label>
              Lon
              <input value={form.longitude} inputMode="decimal" onChange={(event) => updateField('longitude', event.target.value)} />
            </label>
          </div>
        </section>

        <section className="form-panel auth-panel">
          <h2>ข้อมูลแปลง</h2>
          <FormRow icon={<Leaf size={22} />} label="ชื่อแปลง">
            <input value={form.fieldName} required onChange={(event) => updateField('fieldName', event.target.value)} />
          </FormRow>
          <FormRow icon={<Sprout size={22} />} label="พืชที่ปลูก">
            <select value={form.crop} onChange={(event) => updateField('crop', event.target.value)}>
              <option>ข้าวหอมมะลิ</option>
              <option>ข้าวนาปี</option>
              <option>อ้อย</option>
              <option>มันสำปะหลัง</option>
              <option>ข้าวโพด</option>
              <option>ผัก</option>
              <option>ผลไม้</option>
            </select>
          </FormRow>
          <FormRow icon={<Map size={22} />} label="ขนาดพื้นที่">
            <input value={form.areaRai} inputMode="decimal" placeholder="ไร่" onChange={(event) => updateField('areaRai', event.target.value)} />
          </FormRow>
          <FormRow icon={<MapPin size={22} />} label="จังหวัด">
            <input value={form.province} onChange={(event) => updateField('province', event.target.value)} />
          </FormRow>
          <FormRow icon={<Navigation size={22} />} label="อำเภอ">
            <input value={form.district} onChange={(event) => updateField('district', event.target.value)} />
          </FormRow>
          <label className="note-field">
            หมายเหตุ
            <textarea value={form.note} rows="3" onChange={(event) => updateField('note', event.target.value)} />
          </label>
        </section>

        <button className="save-field-button" type="submit" disabled={status === 'saving'}>
          <Save size={26} />
          {status === 'saving' ? 'กำลังบันทึก...' : status === 'saved' ? 'บันทึกแล้ว' : 'บันทึกแปลง'}
        </button>
        {status === 'saved' && <p className="save-note">บันทึกแปลงสำเร็จ กลับไปใช้ rich menu เพื่อเริ่มปลูกหรือตรวจสุขภาพแปลงได้เลยครับ</p>}
        {status === 'error' && <p className="save-note error">บันทึกแปลงไม่สำเร็จ ลองตรวจข้อมูลอีกครั้งครับ</p>}
      </form>
    </main>
  )
}

function StartPlantingPage() {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    fieldId: '',
    fieldName: '',
    crop: 'อ้อย',
    variety: 'ขอนแก่น 3',
    plantingDate: today,
    method: 'ปลูกท่อนพันธุ์',
    seedRate: '',
    waterPlan: 'รอน้ำฝน',
    note: '',
  })
  const [fields, setFields] = useState([])
  const [fieldsStatus, setFieldsStatus] = useState('loading')
  const [status, setStatus] = useState('idle')

  useEffect(() => {
    let isMounted = true

    async function loadFields() {
      try {
        const lineUserId = await resolveLineUserId()
        const response = await fetch(`/api/fields/list?lineUserId=${encodeURIComponent(lineUserId)}`)

        if (!response.ok) {
          throw new Error('Unable to load fields')
        }

        const payload = await response.json()
        if (!isMounted) return

        const availableFields = payload.fields || []
        setFields(availableFields)
        setFieldsStatus(availableFields.length ? 'ready' : 'empty')

        const firstField = availableFields[0]
        if (firstField) {
          setForm((current) => ({
            ...current,
            fieldId: String(firstField.id),
            fieldName: firstField.name,
          }))
        }
      } catch {
        if (isMounted) {
          setFieldsStatus('error')
        }
      }
    }

    loadFields()

    return () => {
      isMounted = false
    }
  }, [])

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function selectExistingField(value) {
    const selected = fields.find((field) => String(field.id) === value)
    setForm((current) => ({
      ...current,
      fieldId: value,
      fieldName: selected?.name || '',
    }))
  }

  async function submitPlanting(event) {
    event.preventDefault()
    setStatus('saving')

    let response
    try {
      const lineUserId = await resolveLineUserId()
      response = await fetch('/api/planting/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineUserId,
          fieldId: form.fieldId,
          fieldName: form.fieldName,
          crop: form.crop,
          variety: form.variety,
          plantingDate: form.plantingDate,
          method: form.method,
          seedRate: form.seedRate,
          waterPlan: form.waterPlan,
          note: form.note,
        }),
      })
    } catch {
      setStatus('error')
      return
    }

    if (!response.ok) {
      setStatus('error')
      return
    }

    setStatus('saved')
  }

  return (
    <main className="liff-page farmer-auth-page planting-page">
      <section className="liff-hero farmer-auth-hero planting-hero">
        <div className="hero-copy">
          <span className="sprout-mark">เริ่มปลูก</span>
          <h1>วางแผนรอบใหม่</h1>
          <p>เลือกแปลง พืช วันที่ปลูก และวิธีปลูก เพื่อให้น้องโปเริ่มติดตามรอบการผลิตนี้ให้</p>
        </div>
        <div className="nongpo-mascot planting-mascot">
          <Sprout size={34} />
        </div>
      </section>

      <form className="field-form farmer-register-form" onSubmit={submitPlanting}>
        <section className="form-panel auth-panel planting-summary">
          <div>
          <span className="eyebrow">คำแนะนำตั้งต้น</span>
          <h2>{form.crop}</h2>
            <p>ระบบจะใช้พื้นที่ วันที่ปลูก และพันธุ์อ้อยเพื่อเตือนให้น้ำ ใส่ปุ๋ย ตรวจโรค และประเมินช่วงเก็บเกี่ยวในเมนูถัดไป</p>
          </div>
          <div className="planting-chips">
            <span>{form.plantingDate || 'ยังไม่เลือกวัน'}</span>
            <span>{form.variety}</span>
          </div>
        </section>

        <section className="form-panel auth-panel">
          <h2>ข้อมูลการปลูก</h2>
          <FormRow icon={<Map size={22} />} label="พื้นที่">
            <select
              value={form.fieldId}
              required
              disabled={fieldsStatus !== 'ready'}
              onChange={(event) => selectExistingField(event.target.value)}
            >
              {fieldsStatus === 'loading' && <option value="">กำลังโหลดพื้นที่...</option>}
              {fieldsStatus === 'empty' && <option value="">ยังไม่มีพื้นที่ที่บันทึกไว้</option>}
              {fieldsStatus === 'error' && <option value="">โหลดพื้นที่ไม่สำเร็จ</option>}
              {fields.map((field) => (
                <option key={field.id} value={field.id}>
                  {field.name}{field.areaRai ? ` - ${field.areaRai} ไร่` : ''}
                </option>
              ))}
            </select>
          </FormRow>
          {fieldsStatus === 'empty' && <p className="save-note error">ยังไม่มีพื้นที่ในระบบ กรุณากดเมนูเพิ่มพื้นที่ก่อนเริ่มปลูกครับ</p>}
          {fieldsStatus === 'error' && <p className="save-note error">โหลดรายการพื้นที่ไม่สำเร็จ ลองปิดหน้านี้แล้วเปิดใหม่อีกครั้งครับ</p>}
          <FormRow icon={<Leaf size={22} />} label="พืช">
            <select value={form.crop} onChange={(event) => updateField('crop', event.target.value)}>
              <option>อ้อย</option>
              <option>ข้าวหอมมะลิ</option>
              <option>ข้าวนาปี</option>
              <option>มันสำปะหลัง</option>
              <option>ข้าวโพด</option>
              <option>ผัก</option>
              <option>ผลไม้</option>
            </select>
          </FormRow>
          <FormRow icon={<Wheat size={22} />} label="พันธุ์อ้อย">
            <select value={form.variety} onChange={(event) => updateField('variety', event.target.value)}>
              <option>ขอนแก่น 3</option>
              <option>LK92-11</option>
              <option>สุพรรณบุรี 50</option>
              <option>อู่ทอง 15</option>
              <option>K88-92</option>
              <option>กำแพงแสน 01-12</option>
              <option>อื่น ๆ</option>
            </select>
          </FormRow>
          <FormRow icon={<CalendarClock size={22} />} label="วันที่ปลูก">
            <input
              type="date"
              value={form.plantingDate}
              required
              onChange={(event) => updateField('plantingDate', event.target.value)}
            />
          </FormRow>
        </section>

        <section className="form-panel auth-panel">
          <h2>วิธีปลูกและน้ำ</h2>
          <FormRow icon={<Sprout size={22} />} label="วิธีปลูก">
            <select value={form.method} onChange={(event) => updateField('method', event.target.value)}>
              <option>ปลูกท่อนพันธุ์</option>
              <option>ปลูกอ้อยข้ามแล้ง</option>
              <option>ปลูกต้นฝน</option>
              <option>ปลูกด้วยเครื่องปลูก</option>
            </select>
          </FormRow>
          <FormRow icon={<PackageCheck size={22} />} label="ท่อนพันธุ์">
            <input
              value={form.seedRate}
              inputMode="decimal"
              placeholder="ตัน/ไร่"
              onChange={(event) => updateField('seedRate', event.target.value)}
            />
          </FormRow>
          <FormRow icon={<Droplets size={22} />} label="แผนน้ำ">
            <select value={form.waterPlan} onChange={(event) => updateField('waterPlan', event.target.value)}>
              <option>รอน้ำฝน</option>
              <option>สูบน้ำเข้าแปลง</option>
              <option>น้ำชลประทาน</option>
              <option>น้ำหยด/สปริงเกอร์</option>
            </select>
          </FormRow>
          <label className="note-field">
            หมายเหตุ
            <textarea
              value={form.note}
              rows="3"
              placeholder="เช่น เตรียมดินแล้ว รอฝนรอบหน้า"
              onChange={(event) => updateField('note', event.target.value)}
            />
          </label>
        </section>

        <button className="save-field-button" type="submit" disabled={status === 'saving' || fieldsStatus !== 'ready' || !form.fieldId}>
          <Save size={26} />
          {status === 'saving' ? 'กำลังเริ่มรอบปลูก...' : status === 'saved' ? 'เริ่มปลูกแล้ว' : 'บันทึกเริ่มปลูก'}
        </button>
        {status === 'saved' && <p className="save-note">บันทึกรอบปลูกสำเร็จ กลับไปคุยกับน้องโปเพื่อดูคำแนะนำรายสัปดาห์ได้เลยครับ</p>}
        {status === 'error' && <p className="save-note error">บันทึกรอบปลูกไม่สำเร็จ ลองตรวจข้อมูลแล้วส่งใหม่อีกครั้งครับ</p>}
      </form>
    </main>
  )
}

async function resolveLineUserId() {
  const view = getCurrentView()
  const startLiffId = import.meta.env.VITE_LIFF_ID_START
  const loginLiffId = import.meta.env.VITE_LIFF_ID_LOGIN || import.meta.env.VITE_LIFF_ID
  const liffId = view === 'plant' ? startLiffId : loginLiffId
  const localHosts = ['localhost', '127.0.0.1']

  if (localHosts.includes(window.location.hostname)) {
    return 'demo-farmer'
  }

  if (!liffId) {
    throw new Error('Missing LIFF ID')
  }

  const liff = (await import('@line/liff')).default
  try {
    await liff.init({ liffId })

    if (!liff.isLoggedIn()) {
      liff.login({ redirectUri: window.location.href })
      throw new Error('Redirecting to LINE login')
    }

    try {
      const profile = await liff.getProfile()
      return profile.userId
    } catch {
      const tokenUserId = liff.getDecodedIDToken()?.sub
      if (tokenUserId) return tokenUserId
      throw new Error('Unable to resolve LINE user id')
    }
  } catch (error) {
    console.warn('LIFF profile error:', error)
    throw error
  }
}

export default App
