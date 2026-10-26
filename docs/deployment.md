# ติดตั้ง Xswift บน GitHub Pages

## 1. ตั้ง Apps Script

ทำขั้นตอนใน [คู่มือ Apps Script](../apps-script/README.md) จากบัญชีเจ้าของ Google Sheet เพื่อสร้าง PIN และ deploy web app

การตั้งค่า deploy ต้องเป็น **Execute as: Me** และ **Who has access: Anyone** เพื่อให้ GitHub Pages ส่งคำขอได้ โดย backend ตรวจ PIN ก่อนให้เข้าถึงข้อมูลรถและไฟล์รูปที่แอปสร้าง

## 2. ตั้ง URL ให้แอป

ใส่ URL ที่ Apps Script แสดงหลัง deploy (ลงท้ายด้วย `/exec`) ใน `config.js`:

```js
window.XSWIFT_CONFIG = {
  appsScriptUrl: "https://script.google.com/macros/s/DEPLOYMENT_ID/exec",
  spreadsheetId: "1xxaLYpoQvzXhIzkHllMToVo-SKeM4TKNik7kqDbKID4"
};
```

URL เป็น public ได้ แต่ห้ามใส่ PIN หรือ signing secret ใน config หรือ source code

## 3. เปิด GitHub Pages

1. Push source ไปยัง branch ที่ต้องการให้ Pages ใช้
2. ใน GitHub เปิด **Settings → Pages**
3. เลือก **Deploy from a branch**, เลือก branch `main` และโฟลเดอร์ `/ (root)`
4. เปิด `https://xserdevper-lab.github.io/Xswift/` ผ่าน HTTPS

## ความปลอดภัยและการใช้งาน

- การอัปโหลดจาก Settings เพิ่ม snapshot ในแท็บ `บันทึกรถ` และเหตุการณ์ใบเสร็จใน `ประวัติบำรุงรักษา (บันทึก)` เป็นแถวใหม่ แถวเก่าไม่ถูกแก้หรือลบ; ข้อมูลเดิมจากแท็บ `รถยนต์` และ `ประวัติบำรุงรักษา` ยังอ่านได้
- snapshot รถครอบคลุมฟิลด์รถ งวดที่จ่าย งบ/ยอดน้ำมัน โน้ต วันภาษี/ประกัน/ใบขับขี่/แบตเตอรี่/เข้าศูนย์ และรหัสรูปใน Drive; ไฟล์รูปจริงยังอยู่ใน Drive
- Upload ทำเมื่อผู้ใช้เลือกเองใน Settings เท่านั้น และแต่ละครั้งเพิ่ม snapshot รถอีกหนึ่งแถว
- ผู้ใช้กรอก PIN 10 หลักเพื่อรับเซสชัน 12 ชั่วโมงที่เก็บใน sessionStorage ของแท็บนั้น
- PIN ถูกเก็บบน Apps Script เป็น salted/iterated hash และ session ลงลายมือชื่อด้วย secret ใน Script Properties
- พยายามกรอก PIN ผิด 8 ครั้งจะพักการยืนยัน 10 นาที
- Web app ทำงานด้วยสิทธิ์เจ้าของ ดังนั้นผู้ที่มีทั้ง URL และ PIN ใช้สิทธิ์นั้นเข้าถึงข้อมูลรถชุดนี้ได้ ควรเก็บ PIN เป็นความลับ
- หากแก้ Apps Script ให้สร้าง deployment version ใหม่ใน **Deploy → Manage deployments → Edit → New version**
- หากลืม PIN ให้รัน `setupXswift` ใหม่จากโปรเจกต์ที่ผูกกับชีต ซึ่งจะยกเลิกเซสชันเดิมทั้งหมด

## แก้ปัญหา

- **Setup required**: ตรวจว่า `config.js` มี URL ที่ลงท้ายด้วย `/exec`
- **PIN required**: กรอก PIN 10 หลักจากขั้นตอน owner setup
- **Could not reach backend**: ตรวจอินเทอร์เน็ตและสถานะ Apps Script deployment
- **บันทึกไม่ได้/สิทธิ์ผิดพลาด**: ตรวจ Apps Script authorization กับ Sheets และ Drive APIs; ถ้าแท็บใหม่มีอยู่แล้ว ให้ตรวจ header `บันทึกรถ` และ `ประวัติบำรุงรักษา (บันทึก)` ตาม [คู่มือ Apps Script](../apps-script/README.md)
