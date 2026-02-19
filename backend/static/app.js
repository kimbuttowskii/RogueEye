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

        // Format Distance
        let distanceStr = net.Distance > 0 ? `${net.Distance}m` : 'N/A';
        let vendorStr = net.Vendor.length > 20 ? net.Vendor.substring(0, 18) + '...' : net.Vendor;

        div.innerHTML = `
            <span title="${net.SSID}">${net.SSID || '<i>Hidden SSID</i>'}</span>
            <span style="font-size: 0.8em; opacity: 0.8;">${net.BSSID}</span>
            <span style="font-size: 0.8em; opacity: 0.8;" title="${net.Vendor}">${vendorStr}</span>
            <div style="display: flex; flex-direction: column; justify-content: center;">
                <div style="display: flex; align-items: center; gap: 5px;">
                    <span>${net.Signal}</span>
                </div>
                <span style="font-size: 0.7em; color: var(--text-secondary);">${distanceStr} (${net.RSSI} dBm)</span>
            </div>
            <span>${securityType}</span>
            <span class="status-badge ${statusClass}">${statusText}</span>
            <button class="track-btn" onclick="startTracking('${net.BSSID}', '${net.SSID ? net.SSID.replace(/'/g, "\\'") : ""}')" title="Track Signal">
                🎯
            </button>
        `;
        container.appendChild(div);
    });

    // Update Radar
    updateRadar(networks);
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

function updateRadar(networks) {
    const radar = document.querySelector('.radar-circle');
    // Clear existing markers (keep scanner line and others if any - careful not to remove scanner-line)
    // Actually, let's remove everything except .scanner-line
    const markers = radar.querySelectorAll('.dot-marker');
    markers.forEach(m => m.remove());

    networks.forEach(net => {
        // Distance mapping
        // Radar radius is 100px (200px width/height)
        // Let's say max range displayed is 50m.
        // 0m -> center (0px from center?? No, center is user)
        // Actually typically radar shows user at center.

        let dist = net.Distance;
        if (dist <= 0) dist = 50; // Unknown or far
        if (dist > 50) dist = 50; // Cap at 50m for visual

        // Map distance 0-50m to 0-100% radius
        // Close signals (low distance) should be near center.
        // Far signals (high distance) near edge.
        const msgDistance = (dist / 50) * 100; // Percent from center

        // Random angle since we don't have direction
        const angle = Math.random() * 360;

        // Convert Polar to Cartesian for CSS 'top' and 'left' %
        // Center is 50%, 50%
        // x = r * cos(theta)
        // y = r * sin(theta)

        // r is in percent (0 to 50% effectively of the container size, but let's use 0-45% to keep inside border)
        const radiusPercent = (msgDistance / 100) * 45;

        const angleRad = angle * (Math.PI / 180);
        const x = radiusPercent * Math.cos(angleRad);
        const y = radiusPercent * Math.sin(angleRad);

        const top = 50 + x; // x is horizontal, but top/left... 
        // CSS left is x, top is y. 
        // 50% + x%

        const marker = document.createElement('div');
        marker.className = 'dot-marker';
        marker.style.left = `${50 + x}%`;
        marker.style.top = `${50 + y}%`;

        // Color coding
        if (dist < 10) {
            marker.style.backgroundColor = 'var(--accent-red)';
            marker.style.boxShadow = '0 0 8px var(--accent-red)';
            marker.style.zIndex = 10;
        } else if (dist < 25) {
            marker.style.backgroundColor = 'orange';
            marker.style.boxShadow = '0 0 5px orange';
        } else {
            marker.style.backgroundColor = 'var(--accent-cyan)';
            marker.style.boxShadow = '0 0 4px var(--accent-cyan)';
        }


        // Tooltip
        marker.title = `${net.SSID} (${dist}m) - ${net.Vendor}`;

        radar.appendChild(marker);
    });
}


// --- RSSI Tracking Logic ---
let trackingInterval = null;
let trackingBSSID = null;
let lastBeepTime = 0;

function startTracking(bssid, ssid) {
    trackingBSSID = bssid;

    // Show Modal
    const overlay = document.getElementById('tracking-overlay');
    overlay.style.display = 'flex';

    document.getElementById('track-ssid').innerText = ssid || 'Hidden Network';
    document.getElementById('track-bssid').innerText = bssid;

    addLog(`Started tracking target: ${ssid} (${bssid})`);

    // Start fast polling
    if (trackingInterval) clearInterval(trackingInterval);

    // Initial poll
    pollTarget();

    // Set interval (2s is likely the fastest practical on Windows)
    trackingInterval = setInterval(pollTarget, 2000);
}

function stopTracking() {
    const overlay = document.getElementById('tracking-overlay');
    overlay.style.display = 'none';

    if (trackingInterval) {
        clearInterval(trackingInterval);
        trackingInterval = null;
    }
    trackingBSSID = null;
    addLog("Stopped tracking.");
}

async function pollTarget() {
    if (!trackingBSSID) return;

    const countdownEl = document.getElementById('track-countdown');
    if (countdownEl) countdownEl.innerText = "Scanning...";

    try {
        // We reuse the standard scan endpoint
        const response = await fetch(`${API_URL}/scan`);
        if (!response.ok) throw new Error("Scan failed");

        const networks = await response.json();

        // Find our target
        const target = networks.find(n => n.BSSID === trackingBSSID);

        if (target) {
            updateTrackingUI(target.RSSI);
        } else {
            // Target lost momentarily
            document.getElementById('signal-value').innerText = "LOST";
            document.getElementById('signal-bar-fill').style.width = "0%";
        }

    } catch (e) {
        console.error("Tracking error:", e);
    } finally {
        // Reset countdown animation logic if we were doing custom counting
        if (countdownEl) countdownEl.innerText = "2.0";
    }
}

function updateTrackingUI(rssi) {
    const valEl = document.getElementById('signal-value');
    const barEl = document.getElementById('signal-bar-fill');

    valEl.innerHTML = `${rssi} <span class="unit">dBm</span>`;

    // Map RSSI (-100 to -30) to percentage (0 to 100)
    // -100 -> 0%
    // -30 -> 100%
    let percent = Math.max(0, Math.min(100, (rssi + 100) * (100 / 70)));
    barEl.style.width = `${percent}%`;

    // Color coding
    if (rssi > -60) barEl.style.background = '#22c55e'; // Green
    else if (rssi > -80) barEl.style.background = '#eab308'; // Yellow
    else barEl.style.background = '#ef4444'; // Red

    // Audio Feedback
    processGeigerAudio(rssi);
}

function processGeigerAudio(rssi) {
    const soundEnabled = document.getElementById('track-sound').checked;
    if (!soundEnabled) return;

    // Logic: The stronger the signal, the more frequent the beeps.
    // Since we only get updates every few seconds, we can't do a *real* geiger counter loop easily
    // without a separate timer that changes frequency.

    // Let's fire a burst of beeps proportional to strength right now to indicate "Fresh Data"
    // OR we can start a separate oscillator loop that beeps at X interval based on last known RSSI.

    // Let's do the "Burst" for now as it's less annoying if the user leaves it on.
    // Actually, real geiger continues. Let's try to simulate a continuous rate.

    startGeigerLoop(rssi);
}

let geigerLoop = null;
function startGeigerLoop(rssi) {
    if (geigerLoop) clearTimeout(geigerLoop);

    // Map RSSI to interval (ms)
    // -30 dBm (Strong) -> 100ms
    // -90 dBm (Weak) -> 1000ms
    // Linear interpolation
    // Slope m = (1000 - 100) / (-90 - -30) = 900 / -60 = -15
    // y - y1 = m(x - x1) -> y - 100 = -15(x - -30) -> y = -15(rssi + 30) + 100

    let interval = -15 * (rssi + 30) + 100;
    interval = Math.max(50, Math.min(2000, interval)); // Clamp

    const playBeep = () => {
        if (!document.getElementById('track-sound').checked || !trackingBSSID) return;

        // Play short click/beep
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'square'; // Clickier
        osc.frequency.setValueAtTime(800 + (rssi * 2), audioCtx.currentTime); // Pitch shift slightly

        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.03);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.03);

        // Schedule next
        geigerLoop = setTimeout(playBeep, interval);
    };

    playBeep();
}
