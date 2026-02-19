@echo off
echo Starting Rogue WiFi AP Detector...
cd backend
python -m uvicorn fastapi_app:app --reload
pause
