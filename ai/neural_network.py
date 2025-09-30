import pandas as pd
import glob
import os # Import the os module for path manipulation
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense
import joblib # For saving scaler and label_encoder

# 🗂️ Read all CSV files from multiple subfolders
# Assuming all files are in subfolders within the "data" directory
# Example structure: data/person1/straight.csv, data/person2/lean_left.csv
# This will find all .csv files recursively within the 'data' directory
file_paths = glob.glob("data/**/*.csv", recursive=True)

# 🧾 Combine data from all files, adding a Label from the filename
dataframes = []

# Define a mapping from raw filename (without 'data\' and folder name) to clean label
# This mapping is crucial for consistent labels regardless of the person's folder
filename_to_clean_label = {
    "straight": "straight",
    "lean_left": "lean_left",
    "lean_right": "lean_right",
    "lean_forward": "lean_forward",
    "lean_back": "lean_back"
}

for file_path in file_paths:
    # Extract the filename (e.g., 'straight.csv')
    filename = os.path.basename(file_path)
    # Remove the '.csv' extension to get the raw label (e.g., 'straight')
    raw_label = filename.replace(".csv", "")

    # Get the clean label using the mapping, default to raw_label if not found
    label = filename_to_clean_label.get(raw_label, raw_label)

    try:
        # Read the CSV file
        df = pd.read_csv(file_path, sep=",")
        df["Label"] = label
        dataframes.append(df)
    except Exception as e:
        print(f"Error reading file {file_path}: {e}")
        continue # Skip to the next file if there's an error

# 🧩 Combine all data into a single DataFrame
if not dataframes:
    print("No CSV files found or processed. Please check your 'data' directory and its subfolders.")
    exit() # Exit if no data is found

full_data = pd.concat(dataframes, ignore_index=True)

# 🔍 Display a sample
print("--- Sample of Combined Data ---")
print(full_data.head())
print(f"\nTotal data points: {len(full_data)}")
print(f"Unique labels found: {full_data['Label'].unique()}")

# 🚀 Prepare data for AI training
X = full_data[['L1', 'L2', 'L3', 'L4', 'R1', 'R2', 'R3', 'R4']].values
y = full_data['Label'].values


# Encode labels to numerical format (one-hot encoding)
label_encoder = LabelEncoder()
y_encoded = label_encoder.fit_transform(y)
y_onehot = tf.keras.utils.to_categorical(y_encoded)

# Normalize features
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# Split data into training and testing sets
X_train, X_test, y_train, y_test = train_test_split(X_scaled, y_onehot, test_size=0.2, random_state=42)

# ⚙️ Build the Neural Network
model = Sequential([
    Dense(32, input_dim=8, activation='relu'),
    Dense(32, activation='relu'),
    Dense(32, activation='relu'),
    Dense(32, activation='relu'),
    Dense(32, activation='relu'),
    Dense(y_onehot.shape[1], activation='softmax')
])

model.compile(optimizer='adam', loss='categorical_crossentropy', metrics=['accuracy'])

# 🧠 Train Model
print("\n--- Training Model ---")
history = model.fit(X_train, y_train, epochs=100, batch_size=8, validation_split=0.1, verbose=1)
'''



# ------------------------------------------------------------------------------------
# After training the model, save the model, scaler, and label_encoder
print("\n--- Saving AI Assets ---")

# Save the Neural Network model
model.save('your_posture_model.h5')
print("Neural Network model saved as 'your_posture_model.h5'")

# Save the StandardScaler
joblib.dump(scaler, 'scaler.pkl')
print("StandardScaler saved as 'scaler.pkl'")

# Save the LabelEncoder
joblib.dump(label_encoder, 'label_encoder.pkl')
print("LabelEncoder saved as 'label_encoder.pkl'")

print("\n--- Training Report ---")
loss, accuracy = model.evaluate(X_test, y_test, verbose=0)
print(f"Test Loss: {loss:.4f}")
print(f"Test Accuracy: {accuracy:.4f}")

print("\n--- Available Posture Labels (from LabelEncoder) ---")
print(label_encoder.classes_)

# ------------------------------------------------------------------------------------
'''

# 🧪 Evaluate the model on the test set
loss, acc = model.evaluate(X_test, y_test, verbose=0)
print(f"\nFinal Test Accuracy: {acc * 100:.2f}%")

'''
# 🔍 Example prediction (uncomment to test)
print("\n--- Example Prediction ---")

# Replace with actual sensor values you want to test
sample_data = [[10000, 10000, 10000, 10000, 500, 500, 500, 500]] # Example for 'straight'
sample_scaled = scaler.transform(sample_data)
pred_probabilities = model.predict(sample_scaled)
predicted_index = pred_probabilities.argmax()
predicted_label = label_encoder.inverse_transform([predicted_index])
print(f"Predicted Posture: {predicted_label[0]} (Confidence: {pred_probabilities[0][predicted_index]*100:.2f}%)")
'''
# ---------------------------------------------------------------------------------------
import matplotlib.pyplot as plt
from sklearn.metrics import confusion_matrix, ConfusionMatrixDisplay
import numpy as np

# 🔮 Predict on the test set
y_pred_prob = model.predict(X_test)
y_pred = np.argmax(y_pred_prob, axis=1)
y_true = np.argmax(y_test, axis=1)

# 🧾 สร้าง Confusion Matrix
cm = confusion_matrix(y_true, y_pred)

# ✅ แสดง Confusion Matrix แบบเป็นรูปภาพ
disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=label_encoder.classes_)
fig, ax = plt.subplots(figsize=(6,6))
disp.plot(cmap=plt.cm.Blues, ax=ax, values_format='d')
plt.title("Confusion Matrix of Posture Classification")
plt.show()

# ---------------------------------------------------------------------------------------

# 📊 แปลง history เป็น DataFrame เพื่อสรุปเป็นตาราง
history_df = pd.DataFrame(history.history)

print("\n--- Training History Table ---")
print(history_df.head())  # แสดง 5 แถวแรก
print(f"\nColumns: {list(history_df.columns)}")  # loss, accuracy, val_loss, val_accuracy

# ✅ วาดกราฟ Accuracy
plt.figure(figsize=(10,5))
plt.plot(history_df['accuracy'], label='Training Accuracy')
plt.plot(history_df['val_accuracy'], label='Validation Accuracy')
plt.title("Model Accuracy")
plt.xlabel("Epoch")
plt.ylabel("Accuracy")
plt.legend()
plt.grid(True)
plt.show()

# 📉 วาดกราฟ Loss
plt.figure(figsize=(10,5))
plt.plot(history_df['loss'], label='Training Loss')
plt.plot(history_df['val_loss'], label='Validation Loss')
plt.title("Model Loss")
plt.xlabel("Epoch")
plt.ylabel("Loss")
plt.legend()
plt.grid(True)
plt.show()
