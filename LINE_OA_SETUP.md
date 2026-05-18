# NongPo LINE OA Setup

## Tech stack

- LINE Official Account: front door for all users.
- LINE Messaging API: webhook, reply messages, push alerts, Flex Messages.
- LINE Rich Menu: farmer menu first.
- LIFF: opens web pages inside LINE for field registration, maps, dashboards, offers.
- React + Vite: current prototype UI.
- Later: Supabase PostgreSQL/PostGIS for users, roles, field polygons, alerts, offers.

## First user flow

1. User adds NongPo LINE OA.
2. Backend saves the user as a farmer by LINE userId.
3. Backend links the farmer Rich Menu to that user.

## Rich menu groups

### Farmer

- เพิ่มพื้นที่
- คุยกับน้องโป
- เริ่มปลูก
- ตรวจสุขภาพแปลง
- วิเคราะห์โรค
- หาที่ขาย

## Demo messages to implement first

### เริ่มปลูก

วิเคราะห์จากข้อมูลดินกรมพัฒนาที่ดิน + Sentinel-2 + THEOS-2 แล้ว แปลงของคุณเหมาะกับข้าวหอมมะลิ 86% ช่วงปลูกที่แนะนำคือ 22-25 พ.ค. เพราะความชื้นเริ่มเหมาะสมและฝนยังไม่หนักเกินไป

### ตรวจแปลง

AI ตรวจพบความผิดปกติจากภาพดาวเทียมบริเวณทิศตะวันออกของแปลง พื้นที่ประมาณ 1.2 ไร่ กรุณาเข้าไปตรวจพื้นที่จริงและถ่ายรูปใบ/ลำต้นส่งกลับมาเพื่อให้ AI วิเคราะห์อาการเพิ่มเติม

### ขายผลผลิต

โรงสี C สนใจรับซื้อข้าวจากแปลงของคุณที่ราคา 12.80 บาท/กก. เนื่องจาก yield forecast ของแปลงคุณคาดว่าจะได้ 4.2 ตัน และช่วงเก็บเกี่ยวตรงกับ quota ที่โรงงานต้องการ

## Next integration tasks

1. Messaging API channel is enabled for the NongPo OA.
2. Webhook URL can use `/webhook` or `/api/line/webhook`.
3. Run `npm run line:richmenu` to create the farmer rich menu on LINE.
4. The generated `RICH_MENU_ID_FARMER` is written to `.env`.
5. Restart `npm run dev:bot` after creating rich menus.
6. Ask the user to type `เมนู`, then the bot links the farmer rich menu to that LINE user.

## Current rich menu behavior

Rich menus do not open the prototype web app by default. Each tap sends a LINE message such as `เพิ่มพื้นที่`, `เริ่มปลูก`, `ตรวจสุขภาพแปลง`, `วิเคราะห์โรค`, or `หาที่ขาย`, and the webhook replies directly inside LINE with a Flex Message.

Use LIFF only for deeper screens that really need a web UI, such as drawing field polygons, viewing a map, or comparing offers.

## Farmer LIFF registration

The field registration screen is available at:

`PUBLIC_LIFF_URL?view=register`

LINE no longer allows new LIFF apps to be added directly to Messaging API channels. Create a LINE Login channel under the same provider, add a LIFF app there, then set:

- `PUBLIC_LIFF_URL` to the deployed web endpoint
- `VITE_LIFF_ID` to the LIFF ID from the LINE Login channel

After editing `.env`, run `npm run build` and restart `npm run dev:bot`.
