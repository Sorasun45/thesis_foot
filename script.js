// script.js

const NUM_DOTS = 1000;
const leftFoot = document.getElementById('leftFoot');
const rightFoot = document.getElementById('rightFoot');
// ลบ input น้ำหนักผู้ป่วยออก ไม่ต้องใช้อีกต่อไป
const recordButton = document.getElementById('recordButton');
const stopRecordButton = document.getElementById('stopRecordButton');
const countdownDisplay = document.getElementById('countdownDisplay');
const recordModal = document.getElementById('recordModal');
const statsTableBody = document.getElementById('statsTableBody');

// START: เพิ่มตัวแปรสำหรับแสดงผลการวิเคราะห์ท่าทาง
const postureResultDisplay = document.getElementById('postureResult');
const detailedPostureResultDisplay = document.getElementById('detailedPostureResult');
let calibrationMode = false; // โหมด calibrate
let calibrationPosture = null; // ท่าที่เลือกในโหมด calibrate
// END: เพิ่มตัวแปรสำหรับแสดงผลการวิเคราะห์ท่าทาง

const SERVICE_UUID = "4a713002-c941-4c74-9b0d-b58097f5d475";
const CHARACTERISTIC_UUID = "4a713003-c941-4c74-9b0d-b58097f5d475";

const leftDots = [];
const rightDots = [];

// Declare bleCharacteristic globally to be accessible everywhere
let bleDevice;
let bleCharacteristic; // This needs to be accessible to the tare button
let dataHandlerBound; // เพื่อใช้ removeEventListener ได้อย่างถูกต้อง

const tareButton = document.getElementById('tareButton');
tareButton.addEventListener('click', async () => {
    // Check if connected and characteristic is available
    if (!bleCharacteristic) {
        if (postureResultDisplay) {
            postureResultDisplay.textContent = "Please connect to ESP32 before Taring.";
            postureResultDisplay.style.color = "#d32f2f"; // Red for error
        }
        return;
    }

    try {
        // ใช้คำสั่ง "tare" เพื่อบอก ESP32 ให้ทำ tare
        const tareCommand = new TextEncoder().encode('t');
        await bleCharacteristic.writeValue(tareCommand);
        if (postureResultDisplay) {
            postureResultDisplay.textContent = "Tare command sent to ESP32!";
            postureResultDisplay.style.color = "#4CAF50"; // Green for success
        }
        console.log("Tare command sent successfully.");
    } catch (error) {
        console.error("Error sending Tare command:", error);
        if (postureResultDisplay) {
            postureResultDisplay.textContent = `Error sending Tare command: ${error.message}`;
            postureResultDisplay.style.color = "#d32f2f"; // Red for error
        }
    }
});


// Initial sensor data (all zeros) - Keep this as a general object
let sensorData = {
    L1: 0, L2: 0, L3: 0, L4: 0,
    R1: 0, R2: 0, R3: 0, R4: 0
};

// ตำแหน่งของเซ็นเซอร์ (ใน % ของพื้นที่เท้า) - จากโค้ดเก่าของคุณ
const sensorPositions = {
    L1: { x: 25, y: 20 },
    L2: { x: 75, y: 20 },
    L3: { x: 25, y: 80 },
    L4: { x: 75, y: 80 },
    R1: { x: 25, y: 20 },
    R2: { x: 75, y: 20 },
    R3: { x: 25, y: 80 },
    R4: { x: 75, y: 80 }
};

// Variable to store patient weight (in grams) as the maximum color value for each foot
const FIXED_MAX_PRESSURE = 40000; // ปรับตามแรงกดสูงสุดที่ต้องการให้เป็นสีแดง

// Object to store references to the canvas elements for each sensor - จากโค้ดเก่าของคุณ
const sensorCanvases = {};

// Recording variables
let isRecording = false;
let recordingInterval;
let recordedData = []; // Array to store all sensor data points during recording
const RECORD_DURATION_MS = 2 * 60 * 1000; // 2 minute in milliseconds
let recordingStartTime;
let countdownTimer;

// Chart.js instance for the modal
let recordedDataChartInstance = null;

// Function to convert pressure value to a hot-cold color scale - จากโค้ดเก่าของคุณ
function getPressureColor(value) {
    // ใช้ค่า FIXED_MAX_PRESSURE คงที่
    const displayValue = Math.max(0, Math.min(FIXED_MAX_PRESSURE, value));
    const scaledValue = (displayValue / FIXED_MAX_PRESSURE) * 100;

    let r, g, b;
    if (scaledValue < 25) { // Blue → Cyan
        r = 0;
        g = Math.round(255 * (scaledValue / 25));
        b = 255;
    } else if (scaledValue < 50) { // Cyan → Green
        r = 0;
        g = 255;
        b = Math.round(255 * (1 - (scaledValue - 25) / 25));
    } else if (scaledValue < 75) { // Green → Yellow
        r = Math.round(255 * ((scaledValue - 50) / 25));
        g = 255;
        b = 0;
    } else { // Yellow → Red
        r = 255;
        g = Math.round(255 * (1 - (scaledValue - 75) / 25));
        b = 0;
    }
    return `rgb(${r},${g},${b})`;
}

// Create initial dots - จากโค้ดเก่าของคุณ
function createDots(container, dotsArray) {
    container.innerHTML = ''; // Clear existing content
    dotsArray.length = 0; // Clear the array as well

    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;

    const approximateDotDiameter = 20;

    const cols = Math.floor(containerWidth / approximateDotDiameter);
    const rows = Math.floor(containerHeight / approximateDotDiameter);

    if (cols === 0 || rows === 0) {
        console.warn("Container too small to render dots effectively.");
        return;
    }

    const actualDotDiameterX = containerWidth / cols;
    const actualDotDiameterY = containerHeight / rows;

    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            const dot = document.createElement('div');
            dot.classList.add('dot');
            dot.style.position = 'absolute';

            dot.style.width = `${actualDotDiameterX}px`;
            dot.style.height = `${actualDotDiameterY}px`;
            dot.style.borderRadius = '50%';

            dot.style.left = `${j * actualDotDiameterX}px`;
            dot.style.top = `${i * actualDotDiameterY}px`;

            container.appendChild(dot);
            dotsArray.push(dot);
        }
    }
}

// Update dot colors based on pressure values - จากโค้ดเก่าของคุณ
function updateDotColors(dots, prefix) {
    dots.forEach(dot => {
        const footWidth = leftFoot.offsetWidth; // Use leftFoot as reference
        const footHeight = leftFoot.offsetHeight;

        const dotStyle = window.getComputedStyle(dot);
        const dotX_px = parseFloat(dotStyle.left);
        const dotY_px = parseFloat(dotStyle.top);

        const dotX_percent = (dotX_px / footWidth) * 100;
        const dotY_percent = (dotY_px / footHeight) * 100;

        let totalWeightedPressure = 0;
        let totalWeight = 0;

        for (let i = 1; i <= 4; i++) {
            const sensorKey = `${prefix}${i}`;
            const sensorVal = sensorData[sensorKey];
            const sensorPos = sensorPositions[sensorKey];

            const distance = Math.sqrt(
                Math.pow(dotX_percent - sensorPos.x, 2) + Math.pow(dotY_percent - sensorPos.y, 2)
            );

            const weight = 1 / (distance + 0.1);
            totalWeightedPressure += sensorVal * weight;
            totalWeight += weight;
        }

        let interpolatedPressure = 0;
        if (totalWeight > 0) {
            interpolatedPressure = totalWeightedPressure / totalWeight;
        }

        dot.style.backgroundColor = getPressureColor(interpolatedPressure);
    });
}

// Create mini canvas graphs - จากโค้ดเก่าของคุณ
function createSensorCanvas(footContainer, prefix) {
    for (let i = 1; i <= 4; i++) {
        const canvas = document.createElement('canvas');
        canvas.width = 70;
        canvas.height = 35;
        canvas.classList.add('sensor-graph');

        const label = document.createElement('div');
        label.classList.add('sensor-label');
        label.innerText = `${prefix}${i}`;

        const wrapper = document.createElement('div');
        wrapper.classList.add('sensor-graph-wrapper');

        const pos = sensorPositions[`${prefix}${i}`];
        wrapper.style.left = `calc(${pos.x}% - 35px)`;
        wrapper.style.top = `calc(${pos.y}% - 25px)`;

        wrapper.appendChild(canvas);
        wrapper.appendChild(label);
        footContainer.appendChild(wrapper);

        sensorCanvases[`${prefix}${i}`] = canvas;
    }
}

const sensorHistory = {
    L1: [], L2: [], L3: [], L4: [],
    R1: [], R2: [], R3: [], R4: []
};

function updateSensorHistory(sensorKey, value) {
    const history = sensorHistory[sensorKey];
    history.push(value);
    if (history.length > 5) history.shift();
}

function drawSensorGraph(canvas, history) {
    if (!canvas) {
        console.error("Canvas element is missing for drawing graph.");
        return;
    }
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'var(--primary-color)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    ctx.beginPath();
    ctx.strokeStyle = 'var(--secondary-color)';
    ctx.lineWidth = 1.5;

    for (let i = 0; i < history.length; i++) {
        const clampedValue = Math.max(0, Math.min(FIXED_MAX_PRESSURE, history[i]));
        const graphValue = (clampedValue / FIXED_MAX_PRESSURE) * 100;

        const x = (canvas.width / (history.length - 1)) * i;
        const y = canvas.height - (graphValue * canvas.height / 100);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
}

function updateGraphs(prefix, footContainer) {
    for (let i = 1; i <= 4; i++) {
        const key = `${prefix}${i}`;
        const canvas = sensorCanvases[key];
        const value = sensorData[key];
        updateSensorHistory(key, value);
        drawSensorGraph(canvas, sensorHistory[key]);
    }
}

// ลบ validateAndSetMaxPressure ไม่ต้องใช้อีกต่อไป

// --- Recording Functionality ---

function startRecording() {
    if (isRecording) return;

    if (!bleCharacteristic) { // เพิ่มการตรวจสอบการเชื่อมต่อ BLE
        if (postureResultDisplay) {
            postureResultDisplay.textContent = "Please connect to ESP32 before starting recording.";
            postureResultDisplay.style.color = "#d32f2f";
        }
        return;
    }

    recordButton.disabled = true;
    stopRecordButton.disabled = false;
    recordButton.classList.add('recording');
    countdownDisplay.style.display = 'block';

    let countdown = 3;
    countdownDisplay.textContent = `Recording starts in ${countdown}...`;

    countdownTimer = setInterval(() => {
        countdown--;
        if (countdown > 0) {
            countdownDisplay.textContent = `Recording starts in ${countdown}...`;
        } else {
            clearInterval(countdownTimer);
            countdownDisplay.style.display = 'none';
            performRecording();
        }
    }, 1000);
}

function performRecording() {
    isRecording = true;
    recordedData = [];
    recordingStartTime = Date.now();
    console.log("Recording started...");

    // Initial data point
    recordedData.push({ ...sensorData, timestamp: Date.now() });

    recordingInterval = setInterval(() => {
        const currentData = { ...sensorData, timestamp: Date.now() };
        recordedData.push(currentData);

        const elapsed = Date.now() - recordingStartTime;
        const remaining = Math.max(0, RECORD_DURATION_MS - elapsed);
        const remainingSeconds = Math.ceil(remaining / 1000);

        if (remainingSeconds > 0) {
            recordButton.textContent = `Record (${remainingSeconds} s)`;
        } else {
            stopRecording(); // Automatically stop after RECORD_DURATION_MS
        }
    }, 100); // Record data every 100ms
}

function stopRecording() {
    if (!isRecording) return;

    clearInterval(countdownTimer);
    clearInterval(recordingInterval);
    isRecording = false;
    recordButton.disabled = false;
    stopRecordButton.disabled = true;
    recordButton.classList.remove('recording');
    recordButton.textContent = 'Record';
    countdownDisplay.style.display = 'none';

    console.log("Recording stopped. Data points collected:", recordedData.length);
    displayRecordingResults();
}

function displayRecordingResults() {
    if (recordedData.length === 0) {
        if (postureResultDisplay) {
            postureResultDisplay.textContent = "No data recorded.";
            postureResultDisplay.style.color = "#d32f2f";
        }
        return;
    }

    const sensorKeys = ['L1', 'L2', 'L3', 'L4', 'R1', 'R2', 'R3', 'R4'];
    const labels = recordedData.map((_, index) => (index * 0.1).toFixed(1)); // 0.1s interval
    const datasets = sensorKeys.map((key, index) => ({
        label: key,
        data: recordedData.map(dataPoint => dataPoint[key]),
        borderColor: `hsl(${index * 45}, 70%, 50%)`,
        fill: false,
        tension: 0.1,
        pointRadius: 0
    }));

    const ctx = document.getElementById('recordedDataChart').getContext('2d');

    if (recordedDataChartInstance) {
        recordedDataChartInstance.destroy();
    }

    recordedDataChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Time (seconds)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Pressure (grams)'
                    },
                    beginAtZero: true,
                    max: FIXED_MAX_PRESSURE
                }

            },
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            }
        }
    });

    let statsHtml = '';
    sensorKeys.forEach(key => {
        const values = recordedData.map(d => d[key]);
        if (values.length > 0) {
            const maxVal = Math.max(...values);
            const minVal = Math.min(...values);
            const avgVal = values.reduce((sum, val) => sum + val, 0) / values.length;
            statsHtml += `
                        <tr>
                            <td>${key}</td>
                            <td>${maxVal.toFixed(2)}</td>
                            <td>${minVal.toFixed(2)}</td>
                            <td>${avgVal.toFixed(2)}</td>
                        </tr>
                    `;
        } else {
            statsHtml += `
                        <tr>
                            <td>${key}</td>
                            <td>N/A</td>
                            <td>N/A</td>
                            <td>N/A</td>
                        </tr>
                    `;
        }
    });
    statsTableBody.innerHTML = statsHtml;

    showModal(); // Show the modal after rendering chart and stats
}

// *** แก้ไขฟังก์ชัน showModal() ***
function showModal() {
    recordModal.style.display = 'flex'; // เปลี่ยนเป็น 'flex' เพื่อให้จัดกึ่งกลางด้วย CSS flexbox
}

function closeModal() {
    recordModal.style.display = 'none';
    if (recordedDataChartInstance) {
        recordedDataChartInstance.destroy(); // Destroy previous chart instance
        recordedDataChartInstance = null;
    }
}

function downloadCSV() {
    if (recordedData.length === 0) {
        if (postureResultDisplay) {
            postureResultDisplay.textContent = "No data to download.";
            postureResultDisplay.style.color = "#d32f2f";
        }
        return;
    }

    const sensorKeys = ['L1', 'L2', 'L3', 'L4', 'R1', 'R2', 'R3', 'R4'];
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Time," + sensorKeys.join(",") + "\n";
    recordedData.forEach((row, index) => {
        const timestampInSeconds = (row.timestamp - recordingStartTime) / 1000;
        const values = sensorKeys.map(key => row[key]);
        csvContent += `${timestampInSeconds.toFixed(2)},${values.join(",")}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    let filename;
    if (calibrationMode && calibrationPosture) {
        filename = `${calibrationPosture}_foot_pressure_data_${new Date().toISOString().slice(0, 19).replace(/T|:/g, "-")}.csv`;
    } else {
        filename = `foot_pressure_data_${new Date().toISOString().slice(0, 19).replace(/T|:/g, "-")}.csv`;
    }
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ฟังก์ชันกลางสำหรับดาวน์โหลดข้อมูล
function downloadData() {
    if (calibrationMode && calibrationPosture) {
        downloadCalibrationCSV();
    } else {
        downloadCSV();
    }
}

// เพิ่ม event ให้ปุ่มดาวน์โหลด (สมมติว่ามีปุ่ม id="downloadButton")
const downloadButton = document.getElementById('downloadButton');
if (downloadButton) downloadButton.onclick = downloadData;
function calibrate() {
    calibrationMode = !calibrationMode;
    calibrationPosture = null;
    if (calibrationMode) {
        // เข้าสู่โหมด calibrate
        showCalibrationButtons();
        if (postureResultDisplay) {
            postureResultDisplay.textContent = "Calibration mode: กรุณาเลือกท่าทางที่ต้องการบันทึก";
            postureResultDisplay.style.color = "#1976D2";
        }
    } else {
        // กลับสู่โหมดปกติ
        if (detailedPostureResultDisplay) {
            detailedPostureResultDisplay.innerHTML = '<p>ความน่าจะเป็นของแต่ละท่าทางจะแสดงที่นี่เมื่อได้รับข้อมูล</p>';
        }
        if (postureResultDisplay) {
            postureResultDisplay.textContent = "กลับสู่โหมดปกติ";
            postureResultDisplay.style.color = "#2e7d32";
        }
    }
}

function showCalibrationButtons() {
    if (!detailedPostureResultDisplay) return;
    const postures = [
        { key: 'straight', label: 'Straight' },
        { key: 'lean_forward', label: 'Lean Forward' },
        { key: 'lean_back', label: 'Lean Back' },
        { key: 'lean_left', label: 'Lean Left' },
        { key: 'lean_right', label: 'Lean Right' }
    ];
    let html = '<h3>เลือกท่าทางสำหรับ Calibrate</h3><div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;">';
    postures.forEach(p => {
        html += `<button class="calib-btn" data-posture="${p.key}" style="padding:12px 18px;font-size:1em;border-radius:8px;background:#2196F3;color:#fff;border:none;cursor:pointer;">${p.label}</button>`;
    });
    html += '</div>';
    detailedPostureResultDisplay.innerHTML = html;
    // Add event listeners
    document.querySelectorAll('.calib-btn').forEach(btn => {
        btn.onclick = () => startCalibrationRecording(btn.getAttribute('data-posture'));
    });
}

function startCalibrationRecording(postureKey) {
    if (isRecording) return;
    calibrationPosture = postureKey;
    if (postureResultDisplay) {
        postureResultDisplay.textContent = `กำลังบันทึกท่า: ${postureKey} (2 นาที)`;
        postureResultDisplay.style.color = "#d32f2f";
    }
    recordButton.disabled = true;
    stopRecordButton.disabled = false;
    let countdown = 3;
    countdownDisplay.style.display = 'block';
    countdownDisplay.textContent = `Recording starts in ${countdown}...`;
    countdownTimer = setInterval(() => {
        countdown--;
        if (countdown > 0) {
            countdownDisplay.textContent = `Recording starts in ${countdown}...`;
        } else {
            clearInterval(countdownTimer);
            countdownTimer = null; // <- สำคัญ ต้องรีเซ็ตเป็น null เพื่อให้ handleData เริ่มเก็บข้อมูลได้
            countdownDisplay.style.display = 'none';
            performCalibrationRecording();
        }
    }, 1000);
}

function performCalibrationRecording() {
    isRecording = true;
    recordedData = [];
    recordingStartTime = Date.now();
    // Initial data point
    recordedData.push({ ...sensorData, timestamp: Date.now() });
    let elapsed = 0;
    let remaining = RECORD_DURATION_MS;
    countdownDisplay.style.display = 'block';
    updateCalibrationCountdown(RECORD_DURATION_MS);
    recordingInterval = setInterval(() => {
        const now = Date.now();
        const currentData = { ...sensorData, timestamp: now };
        recordedData.push(currentData);
        elapsed = now - recordingStartTime;
        remaining = Math.max(0, RECORD_DURATION_MS - elapsed);
        updateCalibrationCountdown(remaining);
        if (remaining <= 0) {
            stopCalibrationRecording();
        }
    }, 100); // record every 100ms
}

function stopCalibrationRecording() {
    // หยุด timers
    if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
    }
    if (recordingInterval) {
        clearInterval(recordingInterval);
        recordingInterval = null;
    }

    isRecording = false;
    recordButton.disabled = false;
    stopRecordButton.disabled = true;
    countdownDisplay.style.display = 'none';

    if (postureResultDisplay) {
        postureResultDisplay.textContent = `บันทึกท่า ${calibrationPosture} เสร็จสิ้น!`;
        postureResultDisplay.style.color = "#4CAF50";
    }

    // เรียก displayRecordingResults() เพื่อแสดง chart + stats + modal เหมือนโหมดปกติ
    displayRecordingResults();
}


function updateCalibrationCountdown(remainingMs) {
    const sec = Math.ceil(remainingMs / 1000);
    const min = Math.floor(sec / 60);
    const secDisplay = sec % 60;
    countdownDisplay.textContent = `เหลือเวลา ${min}:${secDisplay.toString().padStart(2, '0')} นาที`;
}


function displayCalibrationResults() {
    if (recordedData.length === 0) {
        if (postureResultDisplay) {
            postureResultDisplay.textContent = "No data recorded.";
            postureResultDisplay.style.color = "#d32f2f";
        }
        return;
    }
    const sensorKeys = ['L1', 'L2', 'L3', 'L4', 'R1', 'R2', 'R3', 'R4'];
    const labels = recordedData.map((_, index) => (index * 0.1).toFixed(1));
    const datasets = sensorKeys.map((key, index) => ({
        label: key,
        data: recordedData.map(dataPoint => dataPoint[key]),
        borderColor: `hsl(${index * 45}, 70%, 50%)`,
        fill: false,
        tension: 0.1,
        pointRadius: 0
    }));
    const ctx = document.getElementById('recordedDataChart').getContext('2d');
    if (recordedDataChartInstance) {
        recordedDataChartInstance.destroy();
    }
    recordedDataChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { title: { display: true, text: 'Time (seconds)' } },
                y: { title: { display: true, text: 'Pressure (grams)' }, beginAtZero: true, max: maxPressurePerFoot + 5000 }
            },
            plugins: { tooltip: { mode: 'index', intersect: false } }
        }
    });
    let statsHtml = '';
    sensorKeys.forEach(key => {
        const values = recordedData.map(d => d[key]);
        if (values.length > 0) {
            const maxVal = Math.max(...values);
            const minVal = Math.min(...values);
            const avgVal = values.reduce((sum, val) => sum + val, 0) / values.length;
            statsHtml += `
                        <tr>
                            <td>${key}</td>
                            <td>${maxVal.toFixed(2)}</td>
                            <td>${minVal.toFixed(2)}</td>
                            <td>${avgVal.toFixed(2)}</td>
                        </tr>
                    `;
        } else {
            statsHtml += `
                        <tr>
                            <td>${key}</td>
                            <td>N/A</td>
                            <td>N/A</td>
                            <td>N/A</td>
                        </tr>
                    `;
        }
    });
    statsTableBody.innerHTML = statsHtml;
    showModal();
}

function downloadCalibrationCSV() {
    if (!calibrationPosture || recordedData.length === 0) return;
    const sensorKeys = ['L1', 'L2', 'L3', 'L4', 'R1', 'R2', 'R3', 'R4'];
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Time," + sensorKeys.join(",") + "\n";
    recordedData.forEach((row) => {
        const timestampInSeconds = (row.timestamp - recordingStartTime) / 1000;
        const values = sensorKeys.map(key => row[key]);
        csvContent += `${timestampInSeconds.toFixed(2)},${values.join(",")}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const filename = `${calibrationPosture}.csv`;
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- BLE Connection ---

async function connectToESP32() {
    try {
        console.log("Requesting Bluetooth Device...");
        bleDevice = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: [SERVICE_UUID]
        });

        bleDevice.addEventListener("gattserverdisconnected", onDisconnected);

        await connectGatt(bleDevice);
    } catch (error) {
        console.error("Connection failed", error);
    }
}

async function connectGatt(device) {
    console.log("Connecting to GATT Server...");
    const server = await device.gatt.connect();

    console.log("Getting Service...");
    const service = await server.getPrimaryService(SERVICE_UUID);

    console.log("Getting Characteristic...");
    bleCharacteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);

    // ✅ เคลียร์ listener เก่าก่อน
    if (dataHandlerBound) {
        bleCharacteristic.removeEventListener("characteristicvaluechanged", dataHandlerBound);
    }

    dataHandlerBound = handleData.bind(this);
    await bleCharacteristic.startNotifications();
    bleCharacteristic.addEventListener("characteristicvaluechanged", dataHandlerBound);

    console.log("ESP32 connected and notifications started.");
}

function onDisconnected(event) {
    console.log("Device disconnected, trying to reconnect...");
    let device = event.target;

    setTimeout(async () => {
        try {
            await connectGatt(device);
            console.log("Reconnected.");
        } catch (err) {
            console.error("Reconnect failed", err);
        }
    }, 2000);
}



function handleData(event) {
    const value = new TextDecoder().decode(event.target.value);

    try {
        const parsedData = JSON.parse(value);

        if (parsedData.L1 !== undefined && parsedData.L2 !== undefined &&
            parsedData.L3 !== undefined && parsedData.L4 !== undefined &&
            parsedData.R1 !== undefined && parsedData.R2 !== undefined &&
            parsedData.R3 !== undefined && parsedData.R4 !== undefined) {

            sensorData.L1 = parsedData.L1;
            sensorData.L2 = parsedData.L2;
            sensorData.L3 = parsedData.L3;
            sensorData.L4 = parsedData.L4;
            sensorData.R1 = parsedData.R1;
            sensorData.R2 = parsedData.R2;
            sensorData.R3 = parsedData.R3;
            sensorData.R4 = parsedData.R4;

            // อัปเดตการแสดงผลบนเท้า
            updateDotColors(leftDots, 'L');
            updateDotColors(rightDots, 'R');
            updateGraphs('L', leftFoot);
            updateGraphs('R', rightFoot);
            document.getElementById('weight_sum').textContent = (
                (sensorData.L1 + sensorData.L2 + sensorData.L3 + sensorData.L4 +
                    sensorData.R1 + sensorData.R2 + sensorData.R3 + sensorData.R4) / 1000
            ).toFixed(2); // แสดงน้ำหนักรวมเป็นกิโลกรัม

            // ส่งข้อมูลไปวิเคราะห์ที่ Server เฉพาะเมื่อไม่อยู่ในโหมด calibrate
            if (!calibrationMode) {
                sendDataToServer(sensorData);
            }

            // ถ้ากำลังบันทึกข้อมูลอยู่ ให้เก็บข้อมูลลงใน recordedData
            // ตรวจสอบว่า countdownTimer เป็น null หมายถึงการนับถอยหลังเสร็จสิ้นแล้ว
            if (isRecording && countdownTimer === null) {
                recordedData.push({ ...sensorData, timestamp: Date.now() });
            }

        } else {
            console.warn("Received incomplete or unexpected data:", parsedData);
        }
    } catch (error) {
        console.error("Error parsing JSON data:", error, "Received data:", value);
        if (postureResultDisplay) {
            postureResultDisplay.textContent = `Error processing data: ${error.message}`;
            postureResultDisplay.style.color = "#d32f2f";
        }
    }
}

// ฟังก์ชันสำหรับส่งข้อมูลไปยัง Flask API
async function sendDataToServer(sensorData) {
    if (calibrationMode) return; // ถ้าอยู่ในโหมด calibrate ไม่ต้องส่งข้อมูล
    const requiredKeys = ['L1', 'L2', 'L3', 'L4', 'R1', 'R2', 'R3', 'R4'];
    if (!requiredKeys.every(key => typeof sensorData[key] === 'number')) {
        console.error("Invalid sensor data for server analysis:", sensorData);
        if (postureResultDisplay) {
            postureResultDisplay.textContent = 'Incomplete or invalid sensor data for analysis.';
            postureResultDisplay.style.color = "#d32f2f";
        }
        return;
    }

    try {
        const response = await fetch('http://127.0.0.1:5000/predict_posture', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(sensorData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const result = await response.json();
        console.log("Prediction from server:", result);

        if (postureResultDisplay) {
            postureResultDisplay.textContent = `Predicted Posture: ${result.predicted_posture}`;
            postureResultDisplay.style.color = "#2e7d32";
        }

        // อัปเดต detailedPostureResultDisplay เฉพาะเมื่อไม่ได้อยู่ใน calibrationMode
        if (!calibrationMode && detailedPostureResultDisplay) {
            if (result.probabilities) {
                let detailedResultsHTML = '<h3>Probabilities:</h3><ul>';
                const sortedProbabilities = Object.entries(result.probabilities)
                    .sort(([, probA], [, probB]) => probB - probA);
                sortedProbabilities.forEach(([label, probability]) => {
                    detailedResultsHTML += `<li>${label}: ${(probability * 100).toFixed(2)}%</li>`;
                });
                detailedResultsHTML += '</ul>';
                detailedPostureResultDisplay.innerHTML = detailedResultsHTML;
            } else {
                detailedPostureResultDisplay.innerHTML = '<p>Could not display detailed probabilities.</p>';
            }
        }

    } catch (error) {
        console.error('Error sending data to server or processing response:', error);
        if (postureResultDisplay) {
            postureResultDisplay.textContent = 'Error analyzing posture (Check Console).';
            postureResultDisplay.style.color = "#d32f2f";
        }
        if (detailedPostureResultDisplay) {
            detailedPostureResultDisplay.innerHTML = '<p>Please ensure Flask server is running.</p>';
        }
    }
}


// Initialize
createSensorCanvas(leftFoot, 'L');
createSensorCanvas(rightFoot, 'R');
createDots(leftFoot, leftDots);
createDots(rightFoot, rightDots);

// เพิ่ม event ให้ปุ่ม calibrate (ถ้ายังไม่มีใน html ให้เพิ่ม id="calibrateButton" ในปุ่ม)
const calibrateButton = document.getElementById('calibrateButton');
if (calibrateButton) calibrateButton.onclick = calibrate;

// ให้ปุ่มหยุดบันทึก (stopRecordButton) หยุดบันทึก calibration ได้ด้วย
stopRecordButton.addEventListener('click', () => {
    if (calibrationMode && isRecording) {
        stopCalibrationRecording();
    }
});

// Simulate data updates for testing without ESP32
// setInterval(() => {
//     if (!isRecording) { // Only update if not actively recording from real device
//         sensorData.L1 = Math.floor(Math.random() * maxPressurePerFoot * 0.2) + (maxPressurePerFoot * 0.3);
//         sensorData.L2 = Math.floor(Math.random() * maxPressurePerFoot * 0.2) + (maxPressurePerFoot * 0.3);
//         sensorData.L3 = Math.floor(Math.random() * maxPressurePerFoot * 0.2) + (maxPressurePerFoot * 0.3);
//         sensorData.L4 = Math.floor(Math.random() * maxPressurePerFoot * 0.2) + (maxPressurePerFoot * 0.3);
//         sensorData.R1 = Math.floor(Math.random() * maxPressurePerFoot * 0.2) + (maxPressurePerFoot * 0.3);
//         sensorData.R2 = Math.floor(Math.random() * maxPressurePerFoot * 0.2) + (maxPressurePerFoot * 0.3);
//         sensorData.R3 = Math.floor(Math.random() * maxPressurePerFoot * 0.2) + (maxPressurePerFoot * 0.3);
//         sensorData.R4 = Math.floor(Math.random() * maxPressurePerFoot * 0.2) + (maxPressurePerFoot * 0.3);
//
//         // Add some dynamic variation
//         sensorData.L1 += (Math.random() - 0.5) * 2000;
//         sensorData.R4 -= (Math.random() - 0.5) * 1500;
//     }
//
//     // Call handleData to simulate receiving data and trigger analysis
//     // Note: This simulation bypasses the TextDecoder and JSON.parse,
//     // so it directly updates sensorData and then calls sendDataToServer.
//     // If you want a full simulation, you'd need to format sensorData into a JSON string
//     // and then pass it to handleData.
//     // For simplicity, directly call functions that update display and send to server.
//     updateDotColors(leftDots, 'L');
//     updateDotColors(rightDots, 'R');
//     updateGraphs('L', leftFoot);
//     updateGraphs('R', rightFoot);
//     sendDataToServer(sensorData);
// }, 100); // Update every 100ms
