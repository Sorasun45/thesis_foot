import pandas as pd
import glob
import os
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense
import joblib
import matplotlib.pyplot as plt
from sklearn.metrics import confusion_matrix, ConfusionMatrixDisplay
import numpy as np

# 🗂️ Read all CSV files from multiple subfolders
file_paths = glob.glob("data/**/*.csv", recursive=True)
dataframes = []

# Mapping filenames to clean labels
filename_to_clean_label = {
    "straight": "straight",
    "lean_left": "lean_left",
    "lean_right": "lean_right",
    "lean_forward": "lean_forward",
    "lean_back": "lean_back"
}

for file_path in file_paths:
    filename = os.path.basename(file_path)
    raw_label = filename.replace(".csv", "")
    label = filename_to_clean_label.get(raw_label, raw_label)

    try:
        df = pd.read_csv(file_path, sep=",")
        df["Label"] = label
        dataframes.append(df)
    except Exception as e:
        print(f"Error reading file {file_path}: {e}")
        continue

if not dataframes:
    print("No CSV files found.")
    exit()

# 🧩 Combine all data
full_data = pd.concat(dataframes, ignore_index=True)

print("--- Sample of Combined Data ---")
print(full_data.head())
print(f"\nTotal data points: {len(full_data)}")
print(f"Unique labels found: {full_data['Label'].unique()}")

# 🚀 Prepare data
X = full_data[['L1', 'L2', 'L3', 'L4', 'R1', 'R2', 'R3', 'R4']].values
y = full_data['Label'].values

label_encoder = LabelEncoder()
y_encoded = label_encoder.fit_transform(y)
y_onehot = tf.keras.utils.to_categorical(y_encoded)

scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# ⚖️ Split with stratify
X_train, X_test, y_train, y_test = train_test_split(
    X_scaled, y_onehot, test_size=0.2, random_state=42, stratify=y_encoded
)

# ⚙️ Build Neural Network
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

# 🔮 Predict
y_pred_prob = model.predict(X_test)
y_pred = np.argmax(y_pred_prob, axis=1)
y_true = np.argmax(y_test, axis=1)

# 🧾 Confusion Matrix (ไม่ normalized)
cm = confusion_matrix(y_true, y_pred)
disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=label_encoder.classes_)
fig, ax = plt.subplots(figsize=(6,6))
disp.plot(cmap=plt.cm.Blues, ax=ax, values_format='d')
plt.title("Confusion Matrix (Raw Counts)")
plt.show()

# 🧾 Confusion Matrix (normalized)
cm_norm = confusion_matrix(y_true, y_pred, normalize='true')
disp_norm = ConfusionMatrixDisplay(confusion_matrix=cm_norm, display_labels=label_encoder.classes_)
fig, ax = plt.subplots(figsize=(6,6))
disp_norm.plot(cmap=plt.cm.Blues, ax=ax, values_format='.2f')
plt.title("Confusion Matrix (Normalized per Class)")
plt.show()

# 📊 Training History
history_df = pd.DataFrame(history.history)
print("\n--- Training History Table ---")
print(history_df.head())

# Accuracy graph
plt.figure(figsize=(10,5))
plt.plot(history_df['accuracy'], label='Training Accuracy')
plt.plot(history_df['val_accuracy'], label='Validation Accuracy')
plt.title("Model Accuracy")
plt.xlabel("Epoch")
plt.ylabel("Accuracy")
plt.legend()
plt.grid(True)
plt.show()

# Loss graph
plt.figure(figsize=(10,5))
plt.plot(history_df['loss'], label='Training Loss')
plt.plot(history_df['val_loss'], label='Validation Loss')
plt.title("Model Loss")
plt.xlabel("Epoch")
plt.ylabel("Loss")
plt.legend()
plt.grid(True)
plt.show()
