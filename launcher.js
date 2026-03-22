const { exec, spawn } = require('child_process');
const path = require('path');

// 第一步：作为独立进程启动 server.js，使其脱离当前脚本
const serverProcess = spawn('node', ['server.js'], {
    detached: true,
    stdio: 'ignore', // 忽略输入输出，彻底静默
    windowsHide: true // Windows 下隐藏控制台
});

// 让当前脚本不必等待 server.js 结束就能退出
serverProcess.unref();

// 第二步：等待服务器启动后，打开浏览器
setTimeout(() => {
    const startUrl = 'http://localhost:3000';
    
    // 根据系统类型选择打开命令 (Windows 是 start, Mac 是 open)
    const startCmd = process.platform === 'win32' ? 'start' : 'open';
    
    exec(`${startCmd} ${startUrl}`, (err) => {
        if (err) {
            console.error('自动打开浏览器失败，请手动访问 http://localhost:3000');
        }
        // 完成后光速退出当前的启动器
        process.exit(0);
    });
}, 1500); // 给服务器 1.5 秒的启动时间
