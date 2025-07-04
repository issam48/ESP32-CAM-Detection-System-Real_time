#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>

// تعريف نوع الكاميرا
// إذا كنت تستخدم قطعة أخرى غير AI-THINKER، غيّر السطر التالي حسب نوع الكاميرا
#define CAMERA_MODEL_AI_THINKER

// تعريف pins للكاميرا
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

// إعدادات الشبكة
const char* ssid = "Galaxy A16 1819";        // ⚠️ غيّر اسم شبكتك هنا
const char* password = "12345678";           // ⚠️ غيّر كلمة المرور هنا

// إعدادات الخادم
const char* server_host = "192.168.208.172";   // ⚠️ غيّر IP جهازك هنا
const int server_port = 5000;

HTTPClient http;
unsigned long lastFrameTime = 0;
const unsigned long frameInterval = 1000; // إرسال كل ثانية

// تشفير Base64
String base64_encode(uint8_t* data, size_t length) {
  const char* chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  String encoded = "";
  
  for (size_t i = 0; i < length; i += 3) {
    uint32_t octet_a = i < length ? data[i] : 0;
    uint32_t octet_b = i + 1 < length ? data[i + 1] : 0;
    uint32_t octet_c = i + 2 < length ? data[i + 2] : 0;
    
    uint32_t triple = (octet_a << 0x10) + (octet_b << 0x08) + octet_c;
    
    encoded += chars[(triple >> 3 * 6) & 0x3F];
    encoded += chars[(triple >> 2 * 6) & 0x3F];
    encoded += chars[(triple >> 1 * 6) & 0x3F];
    encoded += chars[(triple >> 0 * 6) & 0x3F];
  }
  
  return encoded;
}

void printCameraError(esp_err_t err) {
  Serial.printf("Camera init failed: 0x%x\n", err);
  if (err == 0x20004) {
    Serial.println("[تشخيص] غالبًا هناك مشكلة في توصيل الأسلاك أو نوع الكاميرا غير صحيح أو نقص في التغذية الكهربائية.");
    Serial.println("- تحقق من أن جميع الأسلاك متصلة جيدًا حسب نوع الكاميرا.");
    Serial.println("- جرب مصدر طاقة أقوى (يفضل 5V/2A).");
    Serial.println("- تأكد من أنك اخترت CAMERA_MODEL الصحيح في أعلى الكود.");
  } else {
    Serial.println("[تشخيص] تحقق من توصيل الكاميرا ونوعها وجرّب إعادة التشغيل.");
  }
}

void setup() {
  Serial.begin(115200);
  Serial.println("ESP32-CAM Starting...");

  // تكوين الكاميرا
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  // تم التعديل لحل مشكلة فشل حجز الذاكرة (frame buffer malloc failed)
  config.frame_size = FRAMESIZE_QQVGA; // 160x120 أصغر حجم للصورة
  config.jpeg_quality = 15; // جودة أعلى للصورة
  config.fb_count = 1;
  config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  config.fb_location = CAMERA_FB_IN_DRAM; // استخدم DRAM بدل PSRAM

  // تهيئة الكاميرا
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    printCameraError(err);
    while (true) { delay(10000); } // أوقف البرنامج حتى يتم إصلاح المشكلة
  }
  Serial.println("Camera initialized");

  // الاتصال بالواي فاي
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("WiFi connected! IP: ");
  Serial.println(WiFi.localIP());
  Serial.println("Ready to send images");
}

int cameraFailCount = 0;
bool cameraRecovered = false;

void sendImage() {
  // التقاط الصورة
  camera_fb_t * fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("Camera capture failed");
    cameraFailCount++;
    cameraRecovered = false;
    if (cameraFailCount >= 3) {
      Serial.println("[إعادة تهيئة الكاميرا] حاول إعادة تهيئة الكاميرا تلقائياً...");
      esp_camera_deinit();
      delay(1000);
      // إعادة التهيئة
      camera_config_t config;
      config.ledc_channel = LEDC_CHANNEL_0;
      config.ledc_timer = LEDC_TIMER_0;
      config.pin_d0 = Y2_GPIO_NUM;
      config.pin_d1 = Y3_GPIO_NUM;
      config.pin_d2 = Y4_GPIO_NUM;
      config.pin_d3 = Y5_GPIO_NUM;
      config.pin_d4 = Y6_GPIO_NUM;
      config.pin_d5 = Y7_GPIO_NUM;
      config.pin_d6 = Y8_GPIO_NUM;
      config.pin_d7 = Y9_GPIO_NUM;
      config.pin_xclk = XCLK_GPIO_NUM;
      config.pin_pclk = PCLK_GPIO_NUM;
      config.pin_vsync = VSYNC_GPIO_NUM;
      config.pin_href = HREF_GPIO_NUM;
      config.pin_sccb_sda = SIOD_GPIO_NUM;
      config.pin_sccb_scl = SIOC_GPIO_NUM;
      config.pin_pwdn = PWDN_GPIO_NUM;
      config.pin_reset = RESET_GPIO_NUM;
      config.xclk_freq_hz = 20000000;
      config.pixel_format = PIXFORMAT_JPEG;
      config.frame_size = FRAMESIZE_QVGA;
      config.jpeg_quality = 10; // جودة أعلى للصورة
      config.fb_count = 1;
      config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
      config.fb_location = CAMERA_FB_IN_PSRAM;
      esp_err_t err = esp_camera_init(&config);
      if (err != ESP_OK) {
        printCameraError(err);
      } else {
        Serial.println("[INFO] تمت إعادة تهيئة الكاميرا بنجاح بعد الفشل.");
        cameraFailCount = 0;
      }
    }
    return;
  } else {
    if (!cameraRecovered && cameraFailCount > 0) {
      Serial.println("[INFO] الكاميرا عادت للعمل بعد الفشل!");
      cameraRecovered = true;
      cameraFailCount = 0;
    }
  }

  // تشفير الصورة
  String encoded = base64_encode(fb->buf, fb->len);
  
  // إنشاء JSON
  String jsonPayload = "{";
  jsonPayload += "\"image\":\"" + encoded + "\",";
  jsonPayload += "\"timestamp\":" + String(millis());
  jsonPayload += "}";
  
  esp_camera_fb_return(fb);

  // إرسال عبر HTTP
  http.begin("http://" + String(server_host) + ":" + String(server_port) + "/api/upload_frame");
  http.addHeader("Content-Type", "application/json");
  
  int httpResponseCode = http.POST(jsonPayload);
  
  if (httpResponseCode > 0) {
    Serial.printf("HTTP Response: %d\n", httpResponseCode);
  } else {
    Serial.printf("HTTP Error: %d\n", httpResponseCode);
  }
  
  http.end();
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    unsigned long currentTime = millis();
    
    if (currentTime - lastFrameTime >= frameInterval) {
      sendImage();
      lastFrameTime = currentTime;
    }
  } else {
    Serial.println("WiFi disconnected");
    WiFi.begin(ssid, password);
    delay(5000);
  }
  
  delay(100);
}