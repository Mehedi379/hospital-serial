@echo off
REM ============================================================
REM  Waiting-Room TV launcher — NO CLICK NEEDED for sound.
REM  Opens Chrome full-screen (kiosk) with autoplay unlocked,
REM  so the Bangla voice plays automatically on every call.
REM
REM  HOW TO USE
REM  1. Edit the two lines below:
REM       SERVER  = the server PC's address (from setup.html)
REM       ROOM    = this TV's room number (e.g. 103)
REM  2. Double-click this file on the TV / TV-box / mini-PC.
REM  3. Chrome opens full-screen on the right doctor's TV,
REM     sound works with no tapping. Press Alt+F4 to close.
REM ============================================================

set SERVER=http://192.168.1.104:5000
set ROOM=103

set URL=%SERVER%/tv/%ROOM%

REM Fresh, isolated profile so the autoplay flag always applies.
set PROFILE=%TEMP%\hospital-tv-profile

REM Try common Chrome locations, then Edge as a fallback.
set CHROME="%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist %CHROME% set CHROME="%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist %CHROME% set CHROME="%LocalAppData%\Google\Chrome\Application\chrome.exe"

if exist %CHROME% (
  start "" %CHROME% --kiosk --autoplay-policy=no-user-gesture-required --disable-features=Translate --user-data-dir="%PROFILE%" "%URL%"
) else (
  REM Fallback: Microsoft Edge (also Chromium, same flags)
  start "" msedge --kiosk --autoplay-policy=no-user-gesture-required --user-data-dir="%PROFILE%" "%URL%" --edge-kiosk-type=fullscreen
)
