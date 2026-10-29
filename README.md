# 🛡️ Smart Bag-Guard

**Pengaman Tas & Zipper Saat di Cafe / Perpustakaan**
*Proyek IoT - Dual Edge Device Android via MQTT Cloud*

---

## 1. Masalah & Ide
Saat meninggalkan tas di meja cafe atau perpustakaan, terdapat risiko ritsleting tas dibuka atau tas dipindahkan oleh orang lain. 
**Smart Bag-Guard** menggunakan 2 HP Android sebagai *edge device* yang terhubung ke **Cloud MQTT Broker** (HiveMQ Public) untuk memantau keamanan tas secara real-time.

---

## 2. Arsitektur System
- **Edge 1 (HP A - Di dalam Tas):**
  - **Light Sensor:** Mendeteksi lonjakan cahaya ($\Delta Lux$) saat ritsleting tas dibuka.
  - **Accelerometer:** Mendeteksi guncangan/gerakan tas ($RMS_{tas}$).
- **Edge 2 (HP B - Dibawa Pemilik):**
  - **Accelerometer:** Mendeteksi gerakan pemilik ($RMS_{pemilik}$).
  - **Gyroscope:** Mendeteksi rotasi & aktivitas jalan pemilik.
- **Broker Cloud & Dashboard:**
  - Protokol: **MQTT over WebSocket (WSS)** via `wss://broker.hivemq.com:8884/mqtt`.
  - Topic: `smartbag/{PROJECT_ID}/edge/{device_id}/telemetry`

---

## 3. Data Processing & Sensor Fusion
1. **Lux Delta Detection ($\Delta Lux$):** $\Delta Lux = |Lux_{sekarang} - Lux_{sebelumnya}|$
2. **Relative Motion RMS Difference ($\Delta RMS$):** Membandingkan $RMS_{tas}$ dan $RMS_{pemilik}$.

**Aturan Keputusan (Rule-Based Fusion):**
- **CRITICAL_ALERT (Tas Dibuka):** $\Delta Lux > 15	ext{ Lux}$ DAN $RMS_{pemilik} < 0.3	ext{ m/s}^2$
- **ALERT (Tas Dipindahkan):** $RMS_{tas} > 1.2	ext{ m/s}^2$ DAN $RMS_{pemilik} < 0.3	ext{ m/s}^2$
- **NORMAL (Tas Dibawa Pemilik):** $RMS_{tas} \ge 0.7	ext{ m/s}^2$ DAN $RMS_{pemilik} \ge 0.7	ext{ m/s}^2$

---

## 4. Cara Pengujian & Uji Coba di 2 HP

### Metode 1: Menggunakan GitHub Pages (Sangat Direkomendasikan)
1. Buka link **GitHub Pages** project ini di browser HP A, HP B, dan Laptop Dashboard.
2. Di HP A (Saku Tas), pilih mode **Edge 1**, isi `PROJECT_ID`, lalu tekan **Mulai Kirim Sensor**.
3. Di HP B (Pemilik), pilih mode **Edge 2**, isi `PROJECT_ID` yang sama, lalu tekan **Mulai Kirim Sensor**.
4. Di Laptop/Browser Dashboard, amati status keamanan terupdate secara otomatis lewat MQTT Cloud!

### Metode 2: Simulasi Demo
Tekan tombol **Simulasikan Kondisi** di Dashboard jika sedang menguji tanpa sensor fisik HP.
