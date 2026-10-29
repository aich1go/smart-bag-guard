// State Variables
let mqttClient = null;
let isConnected = false;
let sensorInterval = null;
let previousLux = 0.0;

// Data state for MQTT Fusion
const nodeData = {
  edge1: { lux: 0.0, rms: 0.0, lastSeen: 0 },
  edge2: { rms: 0.0, gyro: 0.0, lastSeen: 0 }
};

const elements = {
  statusDot: document.getElementById("statusDot"),
  connectionStatus: document.getElementById("connectionStatus"),
  projectIdInput: document.getElementById("projectIdInput"),
  deviceRoleSelect: document.getElementById("deviceRoleSelect"),
  toggleSensorBtn: document.getElementById("toggleSensorBtn"),
  reconnectBtn: document.getElementById("reconnectBtn"),
  
  lux: document.getElementById("lux"),
  bagRms: document.getElementById("bagRms"),
  ownerRms: document.getElementById("ownerRms"),
  gyro: document.getElementById("gyro"),
  
  edge1Status: document.getElementById("edge1Status"),
  edge2Status: document.getElementById("edge2Status"),
  
  title: document.getElementById("alertTitle"),
  description: document.getElementById("alertDescription"),
  icon: document.getElementById("alertIcon"),
  
  rule1: document.getElementById("rule1"),
  rule2: document.getElementById("rule2"),
  rule3: document.getElementById("rule3"),
  
  simulateBtn: document.getElementById("simulateBtn")
};

// Initialize MQTT
function initMQTT() {
  const projectId = elements.projectIdInput.value.trim() || "smartbag_demo";
  const clientId = "client_" + Math.random().toString(16).substring(2, 10);
  
  elements.connectionStatus.textContent = "CONNECTING TO HIVEMQ CLOUD...";
  elements.statusDot.className = "dot";

  mqttClient = new Paho.MQTT.Client("broker.hivemq.com", 8884, "/mqtt", clientId);

  mqttClient.onConnectionLost = (responseObject) => {
    isConnected = false;
    elements.statusDot.className = "dot";
    elements.connectionStatus.textContent = "DISCONNECTED (" + (responseObject.errorMessage || "Lost") + ")";
  };

  mqttClient.onMessageArrived = (message) => {
    try {
      const payload = JSON.parse(message.payloadString);
      const deviceId = payload.device_id;
      
      if (deviceId === "edge1") {
        nodeData.edge1.lux = parseFloat(payload.lux || 0);
        nodeData.edge1.rms = parseFloat(payload.rms || 0);
        nodeData.edge1.lastSeen = Date.now();
        
        elements.lux.textContent = nodeData.edge1.lux.toFixed(1);
        elements.bagRms.textContent = nodeData.edge1.rms.toFixed(2);
        elements.edge1Status.textContent = "● ONLINE";
        elements.edge1Status.style.color = "#087e68";
      } else if (deviceId === "edge2") {
        nodeData.edge2.rms = parseFloat(payload.rms || 0);
        nodeData.edge2.gyro = parseFloat(payload.gyro || 0);
        nodeData.edge2.lastSeen = Date.now();
        
        elements.ownerRms.textContent = nodeData.edge2.rms.toFixed(2);
        elements.gyro.textContent = nodeData.edge2.gyro.toFixed(2);
        elements.edge2Status.textContent = "● ONLINE";
        elements.edge2Status.style.color = "#087e68";
      }
      
      evaluateSensorFusion();
    } catch (e) {
      console.error("Error parsing MQTT payload:", e);
    }
  };

  mqttClient.connect({
    useSSL: true,
    timeout: 10,
    onSuccess: () => {
      isConnected = true;
      elements.statusDot.className = "dot connected";
      elements.connectionStatus.textContent = "CONNECTED TO HIVEMQ CLOUD";
      
      // Subscribe to telemetry
      const topic = `smartbag/${projectId}/edge/+/telemetry`;
      mqttClient.subscribe(topic);
      console.log("Subscribed to:", topic);
    },
    onFailure: (err) => {
      isConnected = false;
      elements.statusDot.className = "dot";
      elements.connectionStatus.textContent = "CONNECTION FAILED: " + err.errorMessage;
    }
  });
}

// Sensor Fusion Decision Rules
function evaluateSensorFusion() {
  const lux = nodeData.edge1.lux;
  const bagRms = nodeData.edge1.rms;
  const ownerRms = nodeData.edge2.rms;

  const deltaLux = Math.abs(lux - previousLux);

  // Conditions
  const isCritical = deltaLux > 15 && ownerRms < 0.3;
  const isMovedAway = bagRms > 1.2 && ownerRms < 0.3;
  const isNormal = bagRms >= 0.7 && ownerRms >= 0.7;

  clearRules();

  if (isCritical) {
    elements.rule1.classList.add("active");
    elements.rule1.querySelector("b").textContent = "TRIGGERED";
    setAlert(
      "CRITICAL ALERT — TAS DIBUKA!",
      `Terdeteksi lonjakan cahaya ΔLux = ${deltaLux.toFixed(1)} Lux dan pemilik sedang diam/jauh (RMS = ${ownerRms.toFixed(2)} m/s²).`,
      "!",
      "critical"
    );
  } else if (isMovedAway) {
    elements.rule2.classList.add("active");
    elements.rule2.querySelector("b").textContent = "TRIGGERED";
    setAlert(
      "ALERT — TAS DIPINDAHKAN!",
      `Guncangan tas tinggi (RMS ${bagRms.toFixed(2)} m/s²), namun pemilik diam/jauh (RMS ${ownerRms.toFixed(2)} m/s²).`,
      "!",
      "warning"
    );
  } else if (isNormal) {
    elements.rule3.classList.add("active");
    elements.rule3.querySelector("b").textContent = "TRIGGERED";
    setAlert(
      "NORMAL — TAS DIBAWA PEMILIK",
      "Gerakan tas dan pemilik sama-sama aktif secara bersamaan.",
      "✓",
      "normal"
    );
  } else {
    setAlert(
      "MONITORING — STATUS AMAN",
      "Sistem memantau secara real-time dari kedua edge device.",
      "✓",
      "normal"
    );
  }

  previousLux = lux;
}

function clearRules() {
  [elements.rule1, elements.rule2, elements.rule3].forEach(rule => {
    rule.classList.remove("active");
    rule.querySelector("b").textContent = "—";
  });
}

function setAlert(title, description, icon, type) {
  elements.title.textContent = title;
  elements.description.textContent = description;
  elements.icon.textContent = icon;
  elements.icon.className = `alert-icon ${type}`;
}

// Local Sensor Reader & Publisher for Mobile
let isPublishing = false;
let currentAcc = { x: 0, y: 0, z: 9.81 };
let currentGyro = { x: 0, y: 0, z: 0 };
let currentLux = 0.5;

function toggleSensorPublisher() {
  const role = elements.deviceRoleSelect.value;
  if (role === "dashboard") {
    alert("Silakan pilih peran HP ini sebagai Edge 1 atau Edge 2 terlebih dahulu!");
    return;
  }

  if (isPublishing) {
    clearInterval(sensorInterval);
    isPublishing = false;
    elements.toggleSensorBtn.textContent = "▶️ Mulai Kirim Sensor HP Ini";
    elements.toggleSensorBtn.style.background = "#087eae";
    return;
  }

  // Request DeviceMotion permission if iOS/Android Chrome requires
  if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
    DeviceMotionEvent.requestPermission().then(response => {
      if (response === "granted") startSensorListening();
    });
  } else {
    startSensorListening();
  }

  isPublishing = true;
  elements.toggleSensorBtn.textContent = "⏹️ Hentikan Kirim Sensor";
  elements.toggleSensorBtn.style.background = "#d32f2f";

  // Start sending telemetry every 1 second
  sensorInterval = setInterval(() => {
    if (!isConnected) return;

    const projectId = elements.projectIdInput.value.trim() || "smartbag_demo";
    const topic = `smartbag/${projectId}/edge/${role}/telemetry`;

    // Compute RMS
    const mag = Math.sqrt(currentAcc.x**2 + currentAcc.y**2 + currentAcc.z**2);
    const rms = Math.abs(mag - 9.81);
    const gyroMag = Math.sqrt(currentGyro.x**2 + currentGyro.y**2 + currentGyro.z**2);

    let payload = {
      device_id: role,
      timestamp: Date.now()
    };

    if (role === "edge1") {
      payload.lux = currentLux;
      payload.rms = rms;
    } else {
      payload.rms = rms;
      payload.gyro = gyroMag;
    }

    const message = new Paho.MQTT.Message(JSON.stringify(payload));
    message.destinationName = topic;
    mqttClient.send(message);
  }, 1000);
}

function startSensorListening() {
  window.addEventListener("devicemotion", (event) => {
    if (event.accelerationIncludingGravity) {
      currentAcc.x = event.accelerationIncludingGravity.x || 0;
      currentAcc.y = event.accelerationIncludingGravity.y || 0;
      currentAcc.z = event.accelerationIncludingGravity.z || 9.81;
    }
    if (event.rotationRate) {
      currentGyro.x = event.rotationRate.alpha || 0;
      currentGyro.y = event.rotationRate.beta || 0;
      currentGyro.z = event.rotationRate.gamma || 0;
    }
  });

  // Sensor Cahaya (Jika Didukung Browser)
  if ("AmbientLightSensor" in window) {
    try {
      const sensor = new AmbientLightSensor();
      sensor.addEventListener("reading", () => {
        currentLux = sensor.illuminance;
      });
      sensor.start();
    } catch (err) {
      console.log("AmbientLightSensor not supported, using default lux.");
    }
  }
}

// Simulate button for offline demo
function simulateCondition() {
  const role = elements.deviceRoleSelect.value;
  const lux = +(Math.random() * 35).toFixed(1);
  const bagRms = +(Math.random() * 2.2).toFixed(2);
  const ownerRms = +(Math.random() * 1.4).toFixed(2);
  const gyro = +(Math.random() * 1.8).toFixed(2);

  nodeData.edge1.lux = lux;
  nodeData.edge1.rms = bagRms;
  nodeData.edge2.rms = ownerRms;
  nodeData.edge2.gyro = gyro;

  elements.lux.textContent = lux;
  elements.bagRms.textContent = bagRms;
  elements.ownerRms.textContent = ownerRms;
  elements.gyro.textContent = gyro;

  elements.edge1Status.textContent = "● SIMULATED";
  elements.edge1Status.style.color = "#168cbd";
  elements.edge2Status.textContent = "● SIMULATED";
  elements.edge2Status.style.color = "#168cbd";

  evaluateSensorFusion();
}

// Event Listeners
elements.reconnectBtn.addEventListener("click", initMQTT);
elements.toggleSensorBtn.addEventListener("click", toggleSensorPublisher);
elements.simulateBtn.addEventListener("click", simulateCondition);

// Start MQTT on Load
window.addEventListener("DOMContentLoaded", initMQTT);
