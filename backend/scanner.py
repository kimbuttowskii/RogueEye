import subprocess
import re
import json
import logging
import math
from mac_vendor_lookup import MacLookup, AsyncMacLookup

# Initialize MacLookup
mac_lookup = None

async def init_mac_vendor_db():
    global mac_lookup
    try:
        logging.info("Initializing AsyncMacLookup...")
        mac_lookup = AsyncMacLookup()
        # Update vendors on startup
        try:
            logging.info("Updating vendor database...")
            await mac_lookup.update_vendors()
            logging.info("Vendor database updated successfully.")
        except Exception as e:
            logging.error(f"Failed to update vendors: {e}")
    except Exception as e:
        logging.warning(f"Could not initialize MacLookup: {e}")
        mac_lookup = None

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def get_signal_dbm(quality_percentage):
    """
    Converts Windows Signal Quality (0-100%) to dBm.
    Approximate formula: dBm = (Quality / 2) - 100
    """
    try:
        quality = int(str(quality_percentage).replace('%', '').strip())
        return (quality / 2) - 100
    except ValueError:
        return -100 # Default weak signal

def calculate_distance(rssi, tx_power=-50, n=3.0):
    """
    Estimates distance based on RSSI.
    d = 10 ^ ((TxPower - RSSI) / (10 * n))
    
    Args:
        rssi: Received Signal Strength Indicator in dBm.
        tx_power: RSSI at 1 meter (default -50 dBm for typical WiFi).
        n: Path loss exponent (2.0 for free space, 3.0-4.0 for indoor).
    """
    if rssi == 0:
        return -1.0 # Unknown

    try:
        exponent = (tx_power - rssi) / (10 * n)
        return round(math.pow(10, exponent), 2)
    except Exception:
        return -1.0


def scan_networks():
    """
    Executes the windows netsh command to scan for wifi networks.
    Returns the raw output as a string.
    """
    try:
        # Run netsh wlan show networks mode=bssid
        # check=True raises a CalledProcessError if the command fails
        result = subprocess.run(
            ['netsh', 'wlan', 'show', 'networks', 'mode=bssid'],
            capture_output=True,
            text=True,
            check=True,
            encoding='utf-8', 
            errors='ignore' # Ignore encoding errors if any
        )
        return result.stdout
    except subprocess.CalledProcessError as e:
        logging.error(f"Error executing netsh: {e}")
        return None
    except Exception as e:
        logging.error(f"Distrubing error during scan: {e}")
        return None

def parse_netsh_output(output):
    """
    Parses the raw output of 'netsh wlan show networks mode=bssid' into a structured list of dictionaries.
    """
    networks = []
    if not output:
        return networks

    # The output is hierarchical. 
    # SSID 1 : <name>
    #     ...
    #     BSSID 1 : <mac>
    #         Signal : <percentage>
    #     BSSID 2 : <mac>
    
    current_ssid = None
    current_bssid = None
    
    # Split by lines and iterate
    lines = output.splitlines()
    
    network_data = {}
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        if line.startswith("SSID"):
            # New Network Group
            parts = line.split(":", 1)
            if len(parts) == 2:
                ssid_name = parts[1].strip()
                # If we were already processing a network, save it (though BSSIDs are nested)
                # Actually, the structure classifies BSSIDs under SSIDs. 
                # We want a flat list of Access Points (BSSIDs) for detection.
                network_data = {
                    "SSID": ssid_name, 
                    "Authentication": "Unknown", 
                    "Encryption": "Unknown",
                    "BSSIDs": []
                }
                networks.append(network_data)
                
        elif line.startswith("Authentication"):
             if network_data:
                network_data["Authentication"] = line.split(":", 1)[1].strip()
                
        elif line.startswith("Encryption"):
             if network_data:
                network_data["Encryption"] = line.split(":", 1)[1].strip()
                
        elif line.startswith("BSSID"):
            # New Access Point under the current SSID
            mac = line.split(":", 1)[1].strip()
            # Start a new BSSID entry
            current_bssid = {
                "BSSID": mac,
                "Signal": "0%",
                "Radio": "Unknown",
                "Channel": "Unknown"
            }
            if network_data:
                network_data["BSSIDs"].append(current_bssid)
                
        elif line.startswith("Signal"):
            if current_bssid:
                 signal_str = line.split(":", 1)[1].strip()
                 current_bssid["Signal"] = signal_str
                 
                 # Calculate Extras
                 dbm = get_signal_dbm(signal_str)
                 current_bssid["RSSI"] = dbm
                 current_bssid["Distance"] = calculate_distance(dbm)
                 
                 # Vendor Lookup
                 try:
                     if mac_lookup:
                         vendor = mac_lookup.lookup(current_bssid["BSSID"])
                         current_bssid["Vendor"] = vendor
                     else:
                         current_bssid["Vendor"] = "Unknown"
                 except Exception as e:
                     # logging.debug(f"Vendor lookup failed for {current_bssid['BSSID']}: {e}")
                     current_bssid["Vendor"] = "Unknown"

        elif line.startswith("Radio type"):
             if current_bssid:
                 current_bssid["Radio"] = line.split(":", 1)[1].strip()
                 
        elif line.startswith("Channel"):
             if current_bssid:
                 current_bssid["Channel"] = line.split(":", 1)[1].strip()

    # Flatten the structure for easier processing by the frontend/detection logic?
    # Or keep it hierarchical? Flattened is usually better for a table view of "Physical APs".
    
    flat_aps = []
    for net in networks:
        for bssid_node in net.get("BSSIDs", []):
            ap = {
                "SSID": net["SSID"],
                "Authentication": net["Authentication"],
                "Encryption": net["Encryption"],
                "BSSID": bssid_node["BSSID"],
                "Signal": bssid_node["Signal"],
                "RSSI": bssid_node.get("RSSI", -100),
                "Distance": bssid_node.get("Distance", -1),
                "Vendor": bssid_node.get("Vendor", "Unknown"),
                "Radio": bssid_node["Radio"],
                "Channel": bssid_node["Channel"]
            }
            flat_aps.append(ap)
            
    return flat_aps

def detect_threats(aps, whitelist=None):
    """
    Analyzes the list of APs for potential threats.
    """
    threats = []
    seen_ssids = {}
    
    if whitelist is None:
        whitelist = []

    for ap in aps:
        # Rule 1: Unknown BSSID (Simple Whitelist Check)
        # If we have a whitelist, and this BSSID is not in it, flag it.
        # For now, we'll mark everything as 'Unknown' if we don't have a persistence layer yet,
        # but let's just implement the logic for 'Open' networks and 'Evil Twin' candidates.
        
        # Rule 2: Open Network
        if ap["Authentication"] == "Open":
            threats.append({
                "type": "OPEN_NETWORK",
                "message": f"Open network detected: {ap['SSID']} ({ap['BSSID']})",
                "severity": "medium",
                "ap": ap
            })

        # Rule 3: Hidden Network
        if not ap["SSID"]:
            threats.append({
                "type": "HIDDEN_NETWORK",
                "message": f"Hidden network detected! BSSID: {ap['BSSID']}",
                "severity": "medium",
                "ap": ap
            })
            
        # Rule 3: Evil Twin / Duplicate SSID with different characteristics
        # In a real enterprise mesh, same SSID on different channels is normal.
        # However, improved Evil Twin detection would check for:
        # - Same SSID, different Encryption (Critical)
        # - Same SSID, significantly different signal strength appearing suddenly (Hard to detect stateless)
        
        ssid = ap["SSID"]
        if ssid in seen_ssids:
            # We found a duplicate SSID.
            # Check if characteristics match
            previous_ap = seen_ssids[ssid]
            if previous_ap["Encryption"] != ap["Encryption"]:
                threats.append({
                    "type": "EVIL_TWIN_MISMATCH",
                    "message": f"Security mismatch for SSID {ssid}! Possible Evil Twin.",
                    "severity": "high",
                    "ap": ap
                })
        else:
            seen_ssids[ssid] = ap

    return threats

if __name__ == "__main__":
    # Test run
    raw_data = scan_networks()
    if raw_data:
        parsed = parse_netsh_output(raw_data)
        print(json.dumps(parsed, indent=2))
        
        alerts = detect_threats(parsed)
        print("\n--- THREATS ---")
        print(json.dumps(alerts, indent=2))
