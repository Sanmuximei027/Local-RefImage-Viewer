@echo off
chcp 65001 >nul
:: 隐藏控制台窗口的 VBScript 魔法
if "%1"=="hide" goto :run
echo CreateObject("WScript.Shell").Run "cmd /c ""%~f0"" hide", 0, False > "%temp%\run_hidden.vbs"
cscript //nologo "%temp%\run_hidden.vbs"
del "%temp%\run_hidden.vbs"
exit

:run
cd /d "%~dp0"
:: 检查 Node.js 是否安装
node -v >nul 2>&1
if %errorlevel% neq 0 (
    msg * "未检测到 Node.js，请先安装 Node.js 后再运行此程序！"
    exit
)

:: 启动服务器并打开浏览器
start /b node server.js
ping 127.0.0.1 -n 2 >nul
start http://localhost:3000
exit
