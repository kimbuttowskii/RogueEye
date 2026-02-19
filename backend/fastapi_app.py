from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
import os
import scanner
import logging

app = FastAPI(title="Rogue AP Detector API")

# Mount static files
static_dir = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Enable CORS (still useful if developing separately, but now less critical)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AccessPoint(BaseModel):
    SSID: str
    Authentication: str
    Encryption: str
    BSSID: str
    Signal: str
    RSSI: float
    Distance: float
    Vendor: str
    Radio: str
    Channel: str

class Threat(BaseModel):
    type: str
    message: str
    severity: str
    ap: AccessPoint

@app.get("/")
def read_root():
    return FileResponse(os.path.join(static_dir, 'index.html'))

@app.get("/scan", response_model=List[AccessPoint])
def get_scan_results():
    """
    Triggers a WiFi scan and returns the list of detected APs.
    """
    raw_output = scanner.scan_networks()
    if raw_output is None:
        raise HTTPException(status_code=500, detail="Failed to execute scan")
    
    results = scanner.parse_netsh_output(raw_output)
    return results

@app.get("/threats", response_model=List[Threat])
def get_threats():
    """
    Triggers a scan and analyzes it for threats.
    """
    raw_output = scanner.scan_networks()
    if raw_output is None:
        raise HTTPException(status_code=500, detail="Failed to execute scan")
    
    results = scanner.parse_netsh_output(raw_output)
    threats = scanner.detect_threats(results)
    return threats

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
