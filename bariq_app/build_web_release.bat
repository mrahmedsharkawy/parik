@echo off
chcp 65001 >nul
title Bariq Flutter Web Release
cd /d "%~dp0"

where flutter >nul 2>nul
if errorlevel 1 (
  echo Flutter غير موجود في PATH.
  pause
  exit /b 1
)

flutter config --enable-web
flutter pub get
flutter build web --release

if errorlevel 1 (
  echo.
  echo Build failed.
  pause
  exit /b 1
)

echo.
echo تم إنشاء النسخة الحقيقية في:
echo build\web
echo.
pause
