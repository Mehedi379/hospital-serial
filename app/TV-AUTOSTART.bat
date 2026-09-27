@echo off
REM ============================================================
REM  TV AUTOSTART — ekbar chalaben, tarpor SOB DIN auto.
REM  (Run ONCE, then forget: TV turns on = page + sound auto.)
REM
REM  KI KORBE:
REM   1. Boot hobar por 20 second por TV page auto khulbe -
REM      CLICK LAGBE NA, autoplay unlocked, direct sound cholbe.
REM   2. PC/TV-box restart korleo abar auto khulbe.
REM   3. Remove korte hole: TV-AUTOSTART.bat REMOVE
REM
REM  BOSHANU (ekbar matro):
REM   - Eta TV-box/mini-PC-te double-click korun
REM   - SERVER ar ROOM niche thik ache kina dekhe nin
REM ============================================================

setlocal EnableDelayedExpansion

set SERVER=http://192.168.1.104:5000
set ROOM=103
set ACTION=%1

set URL=%SERVER%/tv/%ROOM%
set PROFILE=%TEMP%\hospital-tv-profile
set TASK=HospitalTV-AutoStart
set "VBS=%~dp0hospital-tv-launch.vbs"

REM --- Chrome khunje nao (na thakle Edge) ---
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "!CHROME!" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "!CHROME!" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if exist "!CHROME!" (set "BROWSER=!CHROME!") else (set "BROWSER=msedge")

if /i "%ACTION%"=="REMOVE" goto :remove

REM --- VBS launcher (VBS string-er bhitore protita quote double hoy) ---
> "!VBS!" echo Set sh = CreateObject("WScript.Shell")
>>"!VBS!" echo sh.Run """!BROWSER!"" --kiosk --autoplay-policy=no-user-gesture-required --disable-features=Translate --user-data-dir=""!PROFILE!"" ""!URL!""", 0, False

schtasks /Create /F /TN "%TASK%" /SC ONLOGON /DELAY 0000:20 /TR "wscript.exe \"!VBS!\"" >nul 2>&1
if errorlevel 1 (
  echo.
  echo  [X] Task banano gelo na. File-ke right-click ^> "Run as administrator" diye abar chalaben.
  pause
  exit /b 1
)

REM --- Ekhon-i ekbar khule dao (kaj korche dekhte paren) ---
wscript.exe "!VBS!"

echo.
echo  ============================================
echo   TV AUTOSTART SET HOYE GECHE
echo   - Boot-er 20 sec por TV page auto khulbe
echo   - Sound CLICK CHARA direct cholbe
echo   - Remove: TV-AUTOSTART.bat REMOVE
echo  ============================================
timeout /t 4 >nul
exit /b 0

:remove
schtasks /Delete /F /TN "%TASK%" >nul 2>&1
del "!VBS!" >nul 2>&1
echo  Autostart remove hoyeche.
timeout /t 3 >nul
exit /b 0
