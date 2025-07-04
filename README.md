# ESP32-CAM Detection System - مبسط

نظام كشف الأشخاص باستخدام ESP32-CAM مع واجهة ويب جميلة.

## 🚀 تشغيل سريع

### 1. تشغيل الباكند (Flask Server)

```bash
cd backend
pip install flask flask-socketio flask-cors pillow
python app.py
```

### 2. تشغيل الفرونت إند (React)

```bash
npm install
npm run dev
```

### 3. برمجة ESP32-CAM

1. افتح `esp32_cam/esp32_cam.ino` في Arduino IDE
2. غيّر إعدادات الشبكة:
   ```cpp
   const char* ssid = "اسم_شبكتك";
   const char* password = "كلمة_المرور";
   const char* server_host = "192.168.1.100"; // IP جهازك
   ```
3. ارفع الكود للـ ESP32-CAM

## 📁 هيكل المشروع

```
├── src/                    # React Frontend
├── backend/
│   ├── app.py             # Flask Server (مبسط)
│   └── requirements.txt   # مكتبات Python
└── esp32_cam/
    └── esp32_cam.ino      # كود ESP32-CAM (مبسط)
```

## ✨ المميزات

- **واجهة جميلة**: تصميم حديث مع Tailwind CSS
- **بث مباشر**: عرض الصور من ESP32-CAM
- **كشف الأشخاص**: محاكاة كشف (للاختبار)
- **تاريخ الكشف**: حفظ وعرض الصور المحفوظة
- **سهل التشغيل**: ملفات قليلة ومبسطة

## 🔧 استكشاف الأخطاء

- تأكد من أن جميع الأجهزة في نفس الشبكة
- تأكد من صحة IP Address
- تأكد من تشغيل Flask server قبل ESP32-CAM