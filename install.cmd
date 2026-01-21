@ECHO OFF

net session >nul 2>&1
if %errorlevel% neq 0 (
	powershell -Command "Start-Process cmd -ArgumentList '/c cd /d %CD% && \"%~f0\"' -Verb runAs"
	exit /b
)

call uninstall.cmd

mkdir C:\bununban
copy dist\bununban-windows-x64.exe C:\bununban
copy uninstall.cmd C:\bununban

netsh interface tcp set global timestamps=enabled

schtasks /create /tn "bununban" /tr "C:\bununban\bununban-windows-x64.exe" /sc onlogon /rl highest
schtasks /run /tn "bununban"

start http://localhost:8008