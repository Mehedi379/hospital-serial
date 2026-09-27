@echo off
REM ============================================================
REM Hospital Serial Calling - open ports 5000 (HTTP) + 5001 (HTTPS)
REM Run ONCE on the server PC (this computer). Admin rights needed.
REM After this, all TVs / phones on the same WiFi can connect to:
REM    http://<this-pc-ip>:5000   (panels + TVs)
REM    https://<this-pc-ip>:5001  (mobile "Add to Home Screen" install)
REM ============================================================

netsh advfirewall firewall show rule name="Hospital Serial Calling 5000" >nul 2>&1
if %errorlevel%==0 (
    echo Rule for port 5000 already exists.
) else (
    netsh advfirewall firewall add rule name="Hospital Serial Calling 5000" dir=in action=allow protocol=TCP localport=5000
    echo.
    echo Port 5000 (HTTP) is now OPEN on this PC's firewall.
)

echo.
netsh advfirewall firewall show rule name="Hospital Serial Calling 5001" >nul 2>&1
if %errorlevel%==0 (
    echo Rule for port 5001 already exists.
) else (
    netsh advfirewall firewall add rule name="Hospital Serial Calling 5001" dir=in action=allow protocol=TCP localport=5001
    echo.
    echo Port 5001 (HTTPS - mobile app install) is now OPEN.
)

echo.
echo This PC's address for TVs and phones (use in browser):
ipconfig | findstr /C:"IPv4"
echo.
echo Panels/TVs : http://192.168.1.104:5000/tv.html
echo Phone app  : http://192.168.1.104:5000/assistant.html?install=1
echo.
pause
