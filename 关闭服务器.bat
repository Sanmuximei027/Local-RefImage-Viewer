@echo off
chcp 65001 >nul
echo 正在安全关闭图库服务器...
taskkill /F /IM node.exe /T >nul 2>&1
if %errorlevel% equ 0 (
    msg * "图库服务器已成功关闭！"
) else (
    msg * "未发现正在运行的图库服务器。"
)
exit
