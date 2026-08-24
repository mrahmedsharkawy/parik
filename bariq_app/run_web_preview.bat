@echo off
chcp 65001 >nul
title Bariq Flutter Web Preview
cd /d "%~dp0"

where flutter >nul 2>nul
if errorlevel 1 (
  echo.
  echo [BARIQ] Flutter غير موجود في PATH.
  echo ثبّت Flutter SDK ثم افتح الملف مرة أخرى.
  echo https://docs.flutter.dev/get-started/install/windows
  echo.
  pause
  exit /b 1
)

echo.
echo ==========================================
echo       BARIQ - REAL FLUTTER WEB PREVIEW
echo ==========================================
echo.

flutter config --enable-web
if errorlevel 1 goto :error

flutter pub get
if errorlevel 1 goto :error

echo.
echo تشغيل نفس كود Flutter الحقيقي في Chrome...
echo لا تغلق هذه النافذة أثناء المعاينة.
echo.

flutter run -d chrome --web-port 5500
exit /b %errorlevel%

:error
echo.
echo حدث خطأ أثناء تجهيز Flutter Web.
pause
exit /b 1
