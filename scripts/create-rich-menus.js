import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { messagingApi } from '@line/bot-sdk'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const outDir = path.join(rootDir, 'public', 'richmenus')
const envPath = path.join(rootDir, '.env')
const farmerRichMenuSource = path.join(outDir, 'farmer-source.png')
const loginLiffUrl = process.env.PUBLIC_LIFF_URL_LOGIN || process.env.PUBLIC_LIFF_URL
const startLiffUrl = process.env.PUBLIC_LIFF_URL_START || process.env.PUBLIC_LIFF_URL
const loginLiffJoiner = loginLiffUrl?.includes('?') ? '&' : '?'

const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
if (!token) {
  throw new Error('Missing LINE_CHANNEL_ACCESS_TOKEN in .env')
}

const client = new messagingApi.MessagingApiClient({ channelAccessToken: token })
const blobClient = new messagingApi.MessagingApiBlobClient({ channelAccessToken: token })

const menuSize = { width: 2500, height: 1686 }
const cellWidth = 833
const cellHeight = 843

const farmerMenu = {
  name: 'NongPo Farmer Menu',
  title: 'น้องโป - เกษตรกร',
  subtitle: 'พื้นที่ | แชท | ปลูก | สุขภาพ | โรค | ขาย',
  imagePath: farmerRichMenuSource,
  items: [
    ['เพิ่มพื้นที่', 'uri', `${loginLiffUrl}${loginLiffJoiner}view=field`],
    ['คุยกับน้องโป', 'message'],
    ['เริ่มปลูก', 'uri', startLiffUrl],
    ['ตรวจสุขภาพแปลง', 'message'],
    ['วิเคราะห์โรค', 'message'],
    ['หาที่ขาย', 'message'],
  ],
}

await fs.mkdir(outDir, { recursive: true })

const rendered = await renderMenuImage(farmerMenu)
const image = rendered.buffer
const imagePath = path.join(outDir, `farmer.${rendered.extension}`)
await fs.writeFile(imagePath, image)

const richMenuId = await createRichMenu(farmerMenu)
await blobClient.setRichMenuImage(richMenuId, new Blob([image], { type: rendered.contentType }))
await client.setDefaultRichMenu(richMenuId)
console.log(`farmer: ${richMenuId}`)
console.log('Farmer rich menu set as default')

await patchEnv(richMenuId)
console.log('Farmer rich menu ID written to .env')

async function createRichMenu(menu) {
  const areas = menu.items.map(([label, actionType, uri], index) => {
    const col = index % 3
    const row = Math.floor(index / 3)

    return {
      bounds: {
        x: col * cellWidth,
        y: row * cellHeight,
        width: index % 3 === 2 ? menuSize.width - col * cellWidth : cellWidth,
        height: cellHeight,
      },
      action: actionType === 'uri'
        ? {
            type: 'uri',
            label,
            uri,
          }
        : {
            type: 'message',
            label,
            text: label,
          },
    }
  })

  const response = await client.createRichMenu({
    size: menuSize,
    selected: true,
    name: menu.name,
    chatBarText: 'น้องโป',
    areas,
  })

  return response.richMenuId
}

async function renderMenuImage(menu) {
  const buffer = await sharp(menu.imagePath)
    .resize(menuSize.width, menuSize.height, { fit: 'cover', position: 'center' })
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer()

  return {
    buffer,
    contentType: 'image/jpeg',
    extension: 'jpg',
  }
}

async function patchEnv(farmerRichMenuId) {
  let env = ''
  try {
    env = await fs.readFile(envPath, 'utf8')
  } catch {
    // No existing .env yet.
  }

  const line = `RICH_MENU_ID_FARMER=${farmerRichMenuId}`
  if (env.match(/^RICH_MENU_ID_FARMER=.*/m)) {
    env = env.replace(/^RICH_MENU_ID_FARMER=.*/m, line)
  } else {
    env += `${env.endsWith('\n') || env.length === 0 ? '' : '\n'}${line}\n`
  }

  await fs.writeFile(envPath, env, 'utf8')
}
