# neural_network_api.py
from flask import Flask, request, jsonify
from flask_cors import CORS # ใช้สำหรับจัดการ Cross-Origin Resource Sharing
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import load_model
import joblib # สำหรับโหลด scaler และ label_encoder
import os # สำหรับตรวจสอบว่าไฟล์มีอยู่จริง
import sys # สำหรับออกจากโปรแกรมในกรณีที่โหลด assets ไม่สำเร็จ

app = Flask(__name__)
CORS(app) # เปิดใช้งาน CORS เพื่อให้หน้าเว็บของคุณสามารถเรียก API นี้ได้

# กำหนด PATH ไปยังไฟล์โมเดลและอุปกรณ์เสริม
MODEL_PATH = 'your_posture_model.h5'
SCALER_PATH = 'scaler.pkl'
LABEL_ENCODER_PATH = 'label_encoder.pkl'

# ตัวแปรสำหรับเก็บโมเดล, scaler, และ label_encoder
model = None
scaler = None
label_encoder = None

def load_assets():
    """โหลดโมเดล, scaler, และ label_encoder เมื่อเซิร์ฟเวอร์เริ่มต้น"""
    global model, scaler, label_encoder
    try:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(f"Model file not found at {MODEL_PATH}")
        if not os.path.exists(SCALER_PATH):
            raise FileNotFoundError(f"Scaler file not found at {SCALER_PATH}")
        if not os.path.exists(LABEL_ENCODER_PATH):
            raise FileNotFoundError(f"Label encoder file not found at {LABEL_ENCODER_PATH}")

        model = load_model(MODEL_PATH)
        scaler = joblib.load(SCALER_PATH)
        label_encoder = joblib.load(LABEL_ENCODER_PATH)
        print("--- AI Assets Loaded Successfully! ---")
        print(f"Loaded Model: {MODEL_PATH}")
        print(f"Loaded Scaler: {SCALER_PATH}")
        print(f"Loaded Label Encoder: {LABEL_ENCODER_PATH}")
        print(f"Known Labels (from LabelEncoder): {label_encoder.classes_}")

    except Exception as e:
        print(f"--- ERROR LOADING AI ASSETS: {e} ---")
        print("Please ensure 'your_posture_model.h5', 'scaler.pkl', and 'label_encoder.pkl' are in the same directory.")
        # ออกจากโปรแกรมหากไม่สามารถโหลด assets ได้ เพื่อป้องกันการทำงานผิดพลาด
        sys.exit(1)

# เรียกใช้ฟังก์ชันโหลด assets เมื่อแอปเริ่มต้น
with app.app_context():
    load_assets()

@app.route('/predict_posture', methods=['POST'])
def predict_posture():
    """API Endpoint สำหรับรับข้อมูลเซ็นเซอร์และทำนายท่าทาง"""
    if not model or not scaler or not label_encoder:
        return jsonify({"error": "AI model assets not loaded on server."}), 500

    data = request.json
    if not data:
        return jsonify({"error": "No data provided."}), 400

    # ตรวจสอบว่าข้อมูลมีครบ 8 ตัวแปรหรือไม่ (L1-L4, R1-R4)
    required_keys = ['L1', 'L2', 'L3', 'L4', 'R1', 'R2', 'R3', 'R4']
    if not all(key in data for key in required_keys):
        return jsonify({"error": "Missing sensor data. Expected L1-L4, R1-R4."}), 400

    try:
        # รับข้อมูลจาก JSON และแปลงเป็น numpy array
        input_data = np.array([
            data['L1'], data['L2'], data['L3'], data['L4'],
            data['R1'], data['R2'], data['R3'], data['R4']
        ]).reshape(1, -1) # Reshape เป็น (1, 8) สำหรับ 1 sample

        # Normalize ข้อมูลด้วย scaler ที่โหลดมา
        input_scaled = scaler.transform(input_data)

        # ทำนายผลด้วยโมเดล
        predictions = model.predict(input_scaled)
        predicted_probabilities = predictions[0].tolist() # แปลงเป็น list ของความน่าจะเป็น

        # หา index ของ Label ที่มีความน่าจะเป็นสูงสุด
        predicted_index = np.argmax(predictions[0])

        # ดึงชื่อ Label ดิบจาก LabelEncoder (เช่น 'data\straight')
        raw_predicted_label = label_encoder.inverse_transform([predicted_index])[0]
        # ลบ 'data\' ออกจาก Label เพื่อให้เหลือแต่ชื่อที่ต้องการ (เช่น 'straight')
        clean_predicted_label = raw_predicted_label.replace('data\\', '')

        # สร้าง dictionary ของความน่าจะเป็น โดยใช้ชื่อ Label ที่สะอาดแล้ว (ไม่มี 'data\')
        probabilities_dict = {}
        for i, raw_label_from_encoder in enumerate(label_encoder.classes_):
            clean_label = raw_label_from_encoder.replace('data\\', '')
            probabilities_dict[clean_label] = predicted_probabilities[i]

        response = {
            "predicted_posture": clean_predicted_label,
            "probabilities": probabilities_dict
        }
        return jsonify(response)

    except Exception as e:
        # ดักจับข้อผิดพลาดระหว่างการประมวลผล
        print(f"Prediction Error: {e}")
        return jsonify({"error": f"An error occurred during prediction: {str(e)}"}), 500

if __name__ == '__main__':
    # รัน Flask server
    # debug=True จะช่วยให้เห็น error และรีสตาร์ทเซิร์ฟเวอร์อัตโนมัติเมื่อโค้ดเปลี่ยน (สำหรับการพัฒนา)
    # host='0.0.0.0' จะทำให้เซิร์ฟเวอร์เข้าถึงได้จากภายนอกเครื่อง (เช่น จากเครื่องอื่นในเครือข่ายเดียวกัน)
    # port=5000 คือพอร์ตที่เซิร์ฟเวอร์จะเปิด
    app.run(debug=True, host='0.0.0.0', port=5000)
