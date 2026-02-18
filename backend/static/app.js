const API_URL = "http://127.0.0.1:8000";

// --- Audio Context for Alarms ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playAlertSound() {
    // Check if sound is enabled in settings
    const soundEnabled = document.getElementById('setting-sound')?.checked;
    if (!soundEnabled) return;

    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    const now = audioCtx.currentTime;

    // Beep 1
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1200, now);
    gain1.gain.setValueAtTime(0.1, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.1);

    // Beep 2 (delayed by 150ms)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1200, now + 0.15);
    gain2.gain.setValueAtTime(0.1, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.25);
}

function switchView(viewName) {
    // Hide all views
    document.querySelectorAll('.view-section').forEach(el => el.style.display = 'none');

    // Show selected view
    const target = document.getElementById(`view-${viewName}`);
    if (target) {
        target.style.display = 'block'; // or flex/grid depending on layout
    }

    // Update Sidebar Active State
    document.querySelectorAll('nav li').forEach(li => li.classList.remove('active'));
    // Find the specific li that called this function - strictly ideally we'd pass 'this' but let's select by attribute
    const activeLink = document.querySelector(`nav li[onclick="switchView('${viewName}')"]`);
    if (activeLink) activeLink.classList.add('active');
}

function addLog(message) {
    const logs = document.getElementById('system-logs');
    if (!logs) return;

    const time = new Date().toLocaleTimeString();
    const entry = document.createElement('p');
    entry.className = 'log-entry';
    entry.innerText = `[${time}] ${message}`;
    entry.style.borderBottom = '1px solid #334155';
    entry.style.padding = '5px 0';

    logs.prepend(entry);
}

async function startScan() {
    const btn = document.getElementById('scan-btn');
    const container = document.getElementById('network-container');
    const threatsContainer = document.getElementById('threat-container');

    btn.innerText = "SCANNING...";
    btn.disabled = true;
    container.innerHTML = '<div class="loading-state">Scanning airwaves...</div>';
    addLog("Initiating new scan...");

    try {
        // Fetch Scan Results
        const response = await fetch(`${API_URL}/scan`);
        if (!response.ok) throw new Error("Scan failed");

        const networks = await response.json();
        renderNetworks(networks);
        addLog(`Scan complete. Found ${networks.length} networks.`);

        // Fetch Potential Threats (In a real app, this might be a separate background check)
        const threatResponse = await fetch(`${API_URL}/threats`);
        if (threatResponse.ok) {
            const threats = await threatResponse.json();
            renderThreats(threats);
            if (threats.length > 0) {
                addLog(`WARNING: ${threats.length} threats detected!`);
                playAlertSound(); // Play alarm!
            } else {
                addLog("Security analysis: No threats found.");
            }
        }

    } catch (error) {
        console.error("Error:", error);
        container.innerHTML = `<div class="loading-state" style="color: var(--accent-red)">Error: ${error.message}</div>`;
        addLog(`Error during scan: ${error.message}`);
    } finally {
        btn.innerText = "INITIATE SCAN";
        btn.disabled = false;
    }
}

function renderNetworks(networks) {
    const container = document.getElementById('network-container');
    container.innerHTML = '';

    if (networks.length === 0) {
        container.innerHTML = '<div class="loading-state">No networks found.</div>';
        return;
    }

    networks.forEach(net => {
        const div = document.createElement('div');
        div.className = 'network-item';

        // Determine status style
        let statusClass = 'status-secure';
        let statusText = 'SECURE';

        if (net.Authentication === 'Open') {
            statusClass = 'status-open';
            statusText = 'OPEN';
        } else if (net.Authentication === 'Unknown') {
            statusClass = 'status-warning';
            statusText = 'UNKNOWN';
        }

        // Clean up signal string
        const signal = net.Signal.replace('%', '');
        const signalBar = `<div style="width: ${signal}px; height: 4px; background: currentColor; border-radius: 2px;"></div>`;

        // Format Security Type (e.g. "WPA2-Personal" -> "WPA2")
        let securityType = net.Authentication.split('-')[0];
        if (net.Authentication === 'Open') securityType = 'None';

        div.innerHTML = `
            <span title="${net.SSID}">${net.SSID || '<i>Hidden SSID</i>'}</span>
            <span style="font-size: 0.8em; opacity: 0.8;">${net.BSSID}</span>
            <div style="display: flex; align-items: center; gap: 5px;">
                <span>${net.Signal}</span>
            </div>
            <span>${securityType}</span>
            <span class="status-badge ${statusClass}">${statusText}</span>
        `;
        container.appendChild(div);
    });
}

function renderThreats(threats) {
    const container = document.getElementById('threat-container');
    container.innerHTML = '';

    if (threats.length === 0) {
        container.innerHTML = '<div class="no-threats">No active threats detected. System Green.</div>';
        return;
    }

    threats.forEach(threat => {
        const div = document.createElement('div');
        div.className = 'threat-item';

        div.innerHTML = `
            <div class="threat-head">
                <span>${threat.type}</span>
                <span>${threat.severity.toUpperCase()}</span>
            </div>
            <div>${threat.message}</div>
        `;
        container.appendChild(div);
    });
}
// --- Settings Logic ---
let autoScanInterval = null;

function saveSettings() {
    const soundEnabled = document.getElementById('setting-sound').checked;
    const autoScanEnabled = document.getElementById('settings-autoscan').checked;

    // Save to localStorage
    localStorage.setItem('scz_sound', soundEnabled);
    localStorage.setItem('scz_autoscan', autoScanEnabled);

    addLog("Configuration saved.");

    // Apply Auto-Scan
    if (autoScanEnabled) {
        if (!autoScanInterval) {
            addLog("Auto-Scan enabled (30s interval).");
            autoScanInterval = setInterval(() => {
                const btn = document.getElementById('scan-btn');
                if (!btn.disabled) {
                    startScan();
                }
            }, 30000);
        }
    } else {
        if (autoScanInterval) {
            clearInterval(autoScanInterval);
            autoScanInterval = null;
            addLog("Auto-Scan disabled.");
        }
    }
}

function loadSettings() {
    const soundEnabled = localStorage.getItem('scz_sound') === 'true';
    const autoScanEnabled = localStorage.getItem('scz_autoscan') === 'true';

    const soundCheck = document.getElementById('setting-sound');
    if (soundCheck) soundCheck.checked = soundEnabled;

    const autoScanCheck = document.getElementById('settings-autoscan');
    if (autoScanCheck) autoScanCheck.checked = autoScanEnabled;

    // Apply initial state
    if (autoScanEnabled) {
        saveSettings(); // Re-trigger logic
    }
}

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    loadSettings();
});
