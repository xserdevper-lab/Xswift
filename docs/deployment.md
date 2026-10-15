# ติดตั้ง Xswift บน GitHub Pages

## 1. ตั้งค่า Google Cloud

1. เลือกหรือสร้าง Google Cloud project
2. ใน **APIs & Services → Library** เปิด **Google Sheets API** และ **Google Drive API**
3. ที่ **Google Auth Platform** ตั้งค่า Branding และ Audience ให้ตรงกับบัญชีที่จะใช้งาน หากแอปอยู่สถานะ Testing ให้เพิ่มบัญชี Google ที่จะใช้เป็น test user
4. สร้าง OAuth Client ID ชนิด **Web application**
5. เพิ่ม Authorized JavaScript origin ของหน้าเว็บ เช่น `https://xserdevper-lab.github.io` (ใส่เฉพาะ origin ไม่ใส่ path `/Xswift/`)
6. ไม่ต้องสร้างหรือฝัง client secret สำหรับการใช้งาน GIS token client ฝั่ง browser

ขอบเขตสิทธิ์ที่แอปร้องขอคือ Sheets read/write และ Drive `drive.file` สำหรับไฟล์ที่แอปสร้าง

## 2. ตั้งค่าแอป

แก้ `config.js`:

```js
window.XSWIFT_CONFIG = {
  googleClientId: "ค่าที่ลงท้ายด้วย .apps.googleusercontent.com",
  spreadsheetId: "1xxaLYpoQvzXhIzkHllMToVo-SKeM4TKNik7kqDbKID4"
};
```

Client ID และ Spreadsheet ID เป็น public identifiers สำหรับแอปเว็บ ไม่มีรหัสลับให้ใส่ใน source ห้ามวาง access token หรือ client secret ใน repository

## 3. ให้สิทธิ์สเปรดชีต

แชร์สเปรดชีตที่กำหนดใน config ให้บัญชี Google ที่ผู้ใช้จะเลือกตอนเชื่อมต่อ โดยให้สิทธิ์ **Editor** ข้อมูลจะถูกเก็บในแท็บ `รถยนต์` รูปแบบสองคอลัมน์ `key` และ `value` เมื่อไม่มีแท็บนี้ แอปจะสร้างขึ้นและเริ่มด้วยฟิลด์รถที่กำหนด หากแท็บชื่อนี้มีข้อมูลแต่หัวตารางไม่ตรง แอปจะแจ้งข้อผิดพลาดและไม่เขียนทับ

## 4. เปิด GitHub Pages

1. Push source ไปยัง branch ที่ต้องการให้ Pages ใช้
2. ใน GitHub เปิด **Settings → Pages**
3. เลือก **Deploy from a branch**, ระบุ branch และโฟลเดอร์ `/ (root)` แล้วบันทึก
4. เพิ่ม origin ของหน้า Pages ใน OAuth Client ID หากเปลี่ยน domain ภายหลัง
5. เปิด URL ของ Pages แล้วทดสอบด้วยบัญชี Google ที่มีสิทธิ์แก้ไขชีต

สำหรับรีโป `xserdevper-lab/Xswift` URL ปกติคือ `https://xserdevper-lab.github.io/Xswift/` และ OAuth origin คือ `https://xserdevper-lab.github.io`.

## ข้อจำกัดและข้อมูลส่วนบุคคล

- ต้องเชื่อมต่ออินเทอร์เน็ตและลงชื่อเข้าใช้ใหม่หลังโหลดหน้าเว็บ; access token อยู่ในหน่วยความจำและไม่เก็บถาวร
- แอปนี้ไม่มี local cache ของข้อมูลรถ หากเชื่อมต่อ Google ไม่ได้จะแสดงข้อผิดพลาดแทนการแสดงข้อมูลเก่าที่อาจคลาดเคลื่อน
- การอัปโหลดรูปใหม่จะเก็บรูปใหม่ใน Drive แล้วเปลี่ยน file ID ในชีต รูปเก่าที่แอปอัปโหลดไว้จะไม่ถูกลบอัตโนมัติ
- หาก OAuth app อยู่ในสถานะ Testing, Google อาจจำกัดบัญชีผู้ทดสอบหรืออายุการอนุญาต
- ต้องพิจารณาขั้นตอน OAuth verification ของ Google ก่อนเปิดใช้ในวงกว้าง

## แก้ปัญหา

- **ตั้งค่า OAuth Client ID**: แทนค่าตัวอย่างใน `config.js` และตรวจ Authorized JavaScript origins
- **403 / insufficient permissions**: เปิด Sheets API/Drive API และตรวจว่าเลือกบัญชีที่มีสิทธิ์ Editor
- **ไม่พบสเปรดชีต**: ตรวจ Spreadsheet ID และสิทธิ์แชร์ของบัญชี Google
- **รูปโหลดไม่ได้**: ตรวจสิทธิ์ Drive ที่อนุญาตและลองเชื่อมต่อ Google ใหม่
- **แท็บรูปแบบไม่ตรง**: อย่าแก้ข้อมูลแท็บเดิมด้วยแอป ให้ตรวจว่าหัวแถวแรกเป็น `key | value` หรือเปลี่ยนชื่อแท็บเดิมก่อนเชื่อมต่อ
