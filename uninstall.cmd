@ECHO OFF

net session >nul 2>&1
if %errorlevel% neq 0 (
	powershell -Command "Start-Process cmd -ArgumentList '/c cd /d %CD% && \"%~f0\"' -Verb runAs"
	exit /b
)

schtasks /delete /tn "bununban" /f
taskkill /f /im bununban-windows-x64.exe

sc delete windivert
sc stop windivert

timeout /t 1 /nobreak > nul
cmd /c "rmdir /s /q C:\bununban"