import os
import sqlite3
import json
import base64
from datetime import datetime
from flask import Flask, request, jsonify, send_file
from flask_socketio import SocketIO, emit
from flask_cors import CORS
from PIL import Image
import io
import numpy as np
import cv2
from ultralytics import YOLO

try:
    yolo_model = YOLO('yolov8n.pt')  # سيتم تحميل النموذج تلقائيًا إذا لم يكن موجودًا
    print('[INFO] YOLOv8 model loaded successfully.')
except Exception as e:
    print('[FATAL ERROR] YOLOv8 model could not be loaded:', e)
    raise SystemExit('YOLOv8 model load failed, please check your internet connection or model path.')

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
CORS(app, origins="*")
socketio = SocketIO(app, cors_allowed_origins="*")

# Create directories
os.makedirs('saved_images', exist_ok=True)
os.makedirs('database', exist_ok=True)

# Database setup
def init_db():
    conn = sqlite3.connect('database/detections.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS detections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            person_count INTEGER NOT NULL,
            image_path TEXT NOT NULL,
            confidence REAL NOT NULL
        )
    ''')
    conn.commit()
    conn.close()

init_db()

def save_detection_to_db(person_count, image_path, confidence):
    conn = sqlite3.connect('database/detections.db')
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO detections (timestamp, person_count, image_path, confidence)
        VALUES (?, ?, ?, ?)
    ''', (datetime.now().isoformat(), person_count, image_path, confidence))
    conn.commit()
    conn.close()

def process_image_yolo(image_data):
    """معالجة الصورة باستخدام YOLO ورسم الإطارات حول الأشخاص"""
    try:
        if yolo_model is None:
            print('[ERROR] YOLO model is not loaded!')
            return None, 0, 0.0
        # فك ترميز الصورة من base64
        image_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            print('[ERROR] Failed to decode image')
            return None, 0, 0.0
        # كشف الأشخاص
        results = yolo_model(img)
        person_count = 0
        max_confidence = 0.0
        # رسم الإطارات حول الأشخاص
        for result in results:
            boxes = result.boxes
            if boxes is not None:
                for box in boxes:
                    cls = int(box.cls[0]) if hasattr(box, 'cls') else -1
                    if cls == 0:  # الشخص class 0 في COCO
                        person_count += 1
                        confidence = float(box.conf[0]) if hasattr(box, 'conf') else 0.0
                        max_confidence = max(max_confidence, confidence)
                        x1, y1, x2, y2 = map(int, box.xyxy[0])
                        cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 2)
                        cv2.putText(img, f'Person {confidence:.2f}', (x1, y1-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0,255,0), 2)
        # إعادة ترميز الصورة المعدلة
        _, buffer = cv2.imencode('.jpg', img)
        processed_image = base64.b64encode(buffer).decode('utf-8')
        return processed_image, person_count, max_confidence
    except Exception as e:
        print(f"[ERROR] Exception in process_image_yolo: {e}")
        return None, 0, 0.0

# HTTP endpoint for ESP32-CAM
@app.route('/api/upload_frame', methods=['POST'])
def upload_frame():
    try:
        data = request.get_json()
        image_data = data.get('image', '')
        timestamp = datetime.now().isoformat()
        
        if not image_data:
            return jsonify({'error': 'No image data provided'}), 400
        
        # Process the image
        processed_image, person_count, confidence = process_image_yolo(image_data)

        if processed_image is None:
            return jsonify({'error': 'Failed to process image (YOLO)'}), 500

        # حفظ الصورة المعدلة مع الإطارات دائمًا
        image_filename = f"detection_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}.jpg"
        image_path = os.path.join('saved_images', image_filename)
        image_bytes = base64.b64decode(processed_image)
        with open(image_path, 'wb') as f:
            f.write(image_bytes)
        save_detection_to_db(person_count, image_filename, confidence)

        # بث الصورة المعدلة مع البيانات عبر WebSocket
        socketio.emit('detection', {
            'image': processed_image,
            'personCount': person_count,
            'confidence': confidence,
            'timestamp': timestamp,
            'imageFilename': image_filename if image_filename else None,
            'detections': []
        })
        # بث الإحصائيات الجديدة
        socketio.emit('stats', get_stats(), broadcast=True)

        print(f"Frame processed - Person count: {person_count}")

        return jsonify({
            'success': True,
            'personCount': person_count,
            'confidence': confidence,
            'timestamp': timestamp,
            'imageFilename': image_filename if image_filename else None
        })

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({'error': f'Processing error: {str(e)}'}), 500

# حساب الإحصائيات

def get_stats():
    conn = sqlite3.connect('database/detections.db')
    cursor = conn.cursor()
    # إجمالي الكشوفات
    cursor.execute('SELECT COUNT(*), COALESCE(SUM(person_count), 0) FROM detections')
    total_detections, total_persons = cursor.fetchone()
    # اليوم
    today_str = datetime.now().date().isoformat()
    cursor.execute('SELECT COUNT(*), COALESCE(SUM(person_count), 0) FROM detections WHERE DATE(timestamp) = ?', (today_str,))
    today_detections, today_persons = cursor.fetchone()
    # آخر كشف
    cursor.execute('SELECT person_count FROM detections ORDER BY timestamp DESC LIMIT 1')
    row = cursor.fetchone()
    live_count = row[0] if row else 0
    # المتوسط
    avg_persons = (total_persons / total_detections) if total_detections > 0 else 0
    conn.close()
    return {
        'live_count': live_count,
        'today_detections': today_detections,
        'total_detections': total_detections,
        'avg_persons': round(avg_persons, 2)
    }

@app.route('/api/stats', methods=['GET'])
def api_stats():
    return jsonify(get_stats())

# WebSocket handlers
@socketio.on('connect')
def handle_connect():
    print('Client connected')
    emit('status', {'message': 'Connected to server'})

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

# REST API endpoints
@app.route('/api/detections', methods=['GET'])
def get_detections():
    try:
        conn = sqlite3.connect('database/detections.db')
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, timestamp, person_count, image_path, confidence
            FROM detections
            ORDER BY timestamp DESC
        ''')
        
        detections = []
        for row in cursor.fetchall():
            detections.append({
                'id': row[0],
                'timestamp': row[1],
                'personCount': row[2],
                'imagePath': row[3],
                'confidence': row[4]
            })
        
        conn.close()
        return jsonify(detections)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/detections/<int:detection_id>', methods=['DELETE'])
def delete_detection(detection_id):
    try:
        conn = sqlite3.connect('database/detections.db')
        cursor = conn.cursor()
        
        cursor.execute('SELECT image_path FROM detections WHERE id = ?', (detection_id,))
        result = cursor.fetchone()
        
        if result:
            image_path = os.path.join('saved_images', result[0])
            if os.path.exists(image_path):
                os.remove(image_path)
            
            cursor.execute('DELETE FROM detections WHERE id = ?', (detection_id,))
            conn.commit()
        
        conn.close()
        # بث الإحصائيات الجديدة بعد الحذف
        socketio.emit('stats', get_stats(), broadcast=True)
        return jsonify({'success': True})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

import mimetypes

@app.route('/api/images/<filename>')
def get_image(filename):
    try:
        image_path = os.path.join('saved_images', filename)
        if os.path.exists(image_path):
            mime_type, _ = mimetypes.guess_type(image_path)
            if not mime_type:
                mime_type = 'application/octet-stream'
            return send_file(image_path, mimetype=mime_type)
        else:
            print(f'[ERROR] Image not found: {image_path}')
            return jsonify({'error': 'Image not found'}), 404
    except Exception as e:
        print(f'[ERROR] Exception in get_image: {e}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/test')
def test_endpoint():
    return jsonify({
        'status': 'Server is running!',
        'message': 'ESP32-CAM Detection System Backend'
    })

if __name__ == '__main__':
    print("🚀 Starting ESP32-CAM Detection Server")
    print("✅ Server will be available at: http://localhost:5000")
    print("✅ Test endpoint: http://localhost:5000/api/test")
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)