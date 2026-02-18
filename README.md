# RogueEye: Rogue WiFi AP Detector

![Project Status](https://img.shields.io/badge/Status-Active-brightgreen)
![Python](https://img.shields.io/badge/Python-3.x-blue)
![Platform](https://img.shields.io/badge/Platform-Windows-0078D6)

**RogueEye** is a cybersecurity tool designed to detect Rogue Access Points (APs) in your vicinity. Built for the Final Year Project (FYP), it provides a real-time "Cyberpunk-style" dashboard to monitor WiFi threats.

## 🚀 Features

- **Real-time Scanning**: Uses Windows native `netsh` command to scan nearby networks.
- **Threat Detection**:
  - **Open Networks**: Flags unsecured APs.
  - **Hidden Networks**: Identifies APs hiding their SSID.
  - **Evil Twins**: Detects potential impersonators (SSID security mismatch).
- **Interactive Dashboard**:
  - Live "Radar" visual.
  - Sound Alerts for immediate threat notification.
  - System Logs for audit trails.
- **Configurable**: Toggle sound alerts and auto-scan intervals.

## 🛠️ Requirements

- **OS**: Windows 10/11 (Required for `netsh` compatibility).
- **Hardware**: WiFi Adapter (Internal Laptop card or USB Dongle).
- **Software**: Python 3.8+.

## 📦 Installation

1.  **Clone the repository** (or download usage files):
    ```bash
    git clone https://github.com/yourusername/rogue-wifi-detector.git
    cd rogue-wifi-detector
    ```

2.  **Install Dependencies**:
    ```bash
    pip install -r backend/requirements.txt
    ```

## ▶️ Usage

1.  **Start the Application**:
    Simply double-click **`run.bat`** in the main folder.

    *Or run via terminal:*
    ```bash
    cd backend
    python -m uvicorn fastapi_app:app --reload
    ```

2.  **Access Dashboard**:
    Open your browser and navigate to: [http://127.0.0.1:8000](http://127.0.0.1:8000)

<img width="1920" height="927" alt="image" src="https://github.com/user-attachments/assets/ff14d482-f392-4f38-aba5-80eaea63622a" />


## ⚠️ Disclaimer

This tool is for **educational and defensive purposes only**. Do not use this tool to monitor networks you do not own or have permission to audit.

## 📄 License

MIT License

