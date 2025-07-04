import os
import sqlite3
import json
import base64
import cv2
import numpy as np
from datetime import datetime
from flask import Flask, request, jsonify, send_file
from flask_socketio import SocketIO, emit
from flask_cors import CORS
from ultralytics import YOLO
import io
from PIL import Image

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
CORS(app, origins="*")
socketio = SocketIO(app, cors_allowed_origins="*")

# Initialize YOLO model
model = YOLO('yolov8n.pt')

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

def process_image(image_data):
    try:
        # Decode base64 image
        image_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return None, 0, 0.0
        
        # Run YOLO detection
        results = model(img)
        
        # Process results
        person_count = 0
        max_confidence = 0.0
        
        for result in results:
            boxes = result.boxes
            if boxes is not None:
                for box in boxes:
                    # Check if detected class is person (class 0 in COCO dataset)
                    if int(box.cls[0]) == 0:
                        person_count += 1
                        confidence = float(box.conf[0])
                        max_confidence = max(max_confidence, confidence)
                        
                        # Draw bounding box
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
                        cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 2)
                        cv2.putText(img, f'Person {confidence:.2f}', 
                                  (x1, y1-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
        
        # Convert back to base64
        _, buffer = cv2.imencode('.jpg', img)
        processed_image = base64.b64encode(buffer).decode('utf-8')
        
        return processed_image, person_count, max_confidence
        
    except Exception as e:
        print(f"Error processing image: {e}")
        return None, 0, 0.0

# HTTP endpoint for ESP32-CAM (alternative to WebSocket)
@app.route('/api/upload_frame', methods=['POST'])
def upload_frame():
    try:
        data = request.get_json()
        image_data = data.get('image', '')
        timestamp = datetime.now().isoformat()
        
        if not image_data:
            return jsonify({'error': 'No image data provided'}), 400
        
        # Process the image
        processed_image, person_count, confidence = process_image(image_data)
        
        if processed_image is None:
            return jsonify({'error': 'Failed to process image'}), 500
        
        # Save image if persons detected
        if person_count > 0:
            image_filename = f"detection_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}.jpg"
            image_path = os.path.join('saved_images', image_filename)
            
            # Save original processed image
            image_bytes = base64.b64decode(processed_image)
            with open(image_path, 'wb') as f:
                f.write(image_bytes)
            
            # Save to database
            save_detection_to_db(person_count, image_filename, confidence)
        
        # Send processed frame to all WebSocket clients
        socketio.emit('detection', {
            'image': processed_image,
            'personCount': person_count,
            'timestamp': timestamp,
            'detections': []
        })
        
        return jsonify({
            'success': True,
            'personCount': person_count,
            'confidence': confidence,
            'timestamp': timestamp
        })
        
    except Exception as e:
        print(f"Error handling upload frame: {e}")
        return jsonify({'error': f'Processing error: {str(e)}'}), 500

# WebSocket handlers (existing code)
@socketio.on('connect')
def handle_connect():
    print('Client connected')
    emit('status', {'message': 'Connected to server'})

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

@socketio.on('image_frame')
def handle_image_frame(data):
    try:
        image_data = data.get('image', '')
        timestamp = datetime.now().isoformat()
        
        # Process the image
        processed_image, person_count, confidence = process_image(image_data)
        
        if processed_image is None:
            emit('error', {'message': 'Failed to process image'})
            return
        
        # Save image if persons detected
        if person_count > 0:
            image_filename = f"detection_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}.jpg"
            image_path = os.path.join('saved_images', image_filename)
            
            # Save original processed image
            image_bytes = base64.b64decode(processed_image)
            with open(image_path, 'wb') as f:
                f.write(image_bytes)
            
            # Save to database
            save_detection_to_db(person_count, image_filename, confidence)
        
        # Send processed frame back to all clients
        emit('detection', {
            'image': processed_image,
            'personCount': person_count,
            'timestamp': timestamp,
            'detections': []
        }, broadcast=True)
        
    except Exception as e:
        print(f"Error handling image frame: {e}")
        emit('error', {'message': f'Processing error: {str(e)}'})

# REST API endpoints (existing code)
@app.route('/api/detections', methods=['GET'])
def get_detections():
    try:
        conn = sqlite3.connect('database/detections.db')
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, timestamp, person_count, image_path, confidence
            FROM detections
            ORDER BY timestamp DESC
            LIMIT 50
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
        
        # Get image path before deleting
        cursor.execute('SELECT image_path FROM detections WHERE id = ?', (detection_id,))
        result = cursor.fetchone()
        
        if result:
            image_path = os.path.join('saved_images', result[0])
            if os.path.exists(image_path):
                os.remove(image_path)
            
            cursor.execute('DELETE FROM detections WHERE id = ?', (detection_id,))
            conn.commit()
        
        conn.close()
        return jsonify({'success': True})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/images/<filename>')
def get_image(filename):
    try:
        image_path = os.path.join('saved_images', filename)
        if os.path.exists(image_path):
            return send_file(image_path, mimetype='image/jpeg')
        else:
            return jsonify({'error': 'Image not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("Starting Flask server...")
    print("HTTP endpoint available at: /api/upload_frame")
    print("WebSocket available for frontend")
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)