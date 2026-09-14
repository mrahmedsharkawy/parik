@echo off
cd /d "%~dp0"
start "" "http://127.0.0.1:8080/bot-training.html"
node scripts\serve-local.mjs
