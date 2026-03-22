const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process'); 
const sharp = require('sharp'); // 【重磅升级】引入世界级图像处理库

const app = express();
const port = 3000;

// ====== 辅助函数：读取和保存配置 ======
const CONFIG_FILE = path.join(__dirname, 'config.json');

function getConfig() {
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        } catch (e) { return { folders: [] }; }
    }
    return { folders: [] };
}

function saveConfig(config) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
}

// 处理命令行传入的文件夹路径（用于右键菜单）
const args = process.argv.slice(2);
let isFromContextMenu = false;
if (args.length > 0) {
    const newPath = args[0];
    if (fs.existsSync(newPath)) {
        isFromContextMenu = true;
        const config = getConfig();
        if (!config.folders.includes(newPath)) {
            config.folders.push(newPath);
            saveConfig(config);
            console.log(`已将文件夹添加到图库: ${newPath}`);
        }
        // 使用系统默认浏览器打开图库
        exec(`start http://localhost:3000`);
    }
}

// 配置文件路径：用于永久保存你添加的图库路径

// 解析前端发来的 JSON 数据

// ====== API 接口 ======

// 1. 获取已保存的所有文件夹列表
app.get('/api/folders', (req, res) => {
    res.json(getConfig().folders);
});

// 2. 添加一个新的文件夹路径
app.post('/api/folders', (req, res) => {
    const newPath = req.body.path;
    
    // 检查路径是否为空或不存在
    if (!newPath || !fs.existsSync(newPath)) {
        return res.status(400).json({ error: '路径不存在，请检查是否输入正确！(例如: D:\\Pictures)' });
    }

    const config = getConfig();
    // 检查是否已经添加过
    if (config.folders.includes(newPath)) {
        return res.status(400).json({ error: '该文件夹已经添加过了！' });
    }

    config.folders.push(newPath);
    saveConfig(config); // 保存到 config.json
    res.json(config.folders);
});

// 2.5 清空所有文件夹
app.delete('/api/folders', (req, res) => {
    const config = getConfig();
    config.folders = [];
    saveConfig(config);
    res.json(config.folders);
});

// 2.6 删除单个文件夹
app.delete('/api/folders/:index', (req, res) => {
    const index = parseInt(req.params.index);
    const config = getConfig();
    if (index >= 0 && index < config.folders.length) {
        config.folders.splice(index, 1);
        saveConfig(config);
    }
    res.json(config.folders);
});

// 3. 读取某个特定文件夹内的图片列表
// 前端会传 folderIndex (文件夹在列表中的序号) 过来
app.get('/api/images', (req, res) => {
    const index = parseInt(req.query.folderIndex);
    const config = getConfig();
    const targetFolder = config.folders[index];

    if (!targetFolder || !fs.existsSync(targetFolder)) {
        return res.status(404).json({ error: '找不到该文件夹' });
    }

    try {
        const files = fs.readdirSync(targetFolder);
        const images = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
        });
        res.json(images);
    } catch (error) {
        res.status(500).json({ error: '读取文件夹内容失败，可能有权限问题' });
    }
});

// 4. 【核心】动态提供真实图片文件
// 因为文件夹是动态的，不能再用静态托管了。我们需要自己写接口返回文件流。
app.get('/api/image_file', (req, res) => {
    const index = parseInt(req.query.folderIndex);
    const filename = req.query.filename;
    
    const config = getConfig();
    const targetFolder = config.folders[index];

    if (!targetFolder) return res.status(404).send('Folder not found');

    // 拼接出本地真实的绝对路径
    const absoluteImagePath = path.join(targetFolder, filename);
    
    // 发送文件给前端展示
    res.sendFile(absoluteImagePath);
});

// 5. 【黑科技】让 Node.js 后台呼出 Windows 的文件夹选择器！
app.get('/api/choose_folder', (req, res) => {
    // 【关键修复2：解决中文路径乱码】强制 PowerShell 使用 UTF-8 编码输出，防止 Node.js 接收到乱码路径
    const psScript = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Add-Type -AssemblyName System.windows.forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = '请选择要添加到图库的文件夹'; if($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK){ Write-Host $f.SelectedPath -NoNewline }`;

    // 【关键修复1】：必须加上 -STA 参数
    exec(`powershell.exe -STA -Command "${psScript}"`, { encoding: 'utf8' }, (error, stdout, stderr) => {
        if (error) {
            console.error('弹窗失败:', error);
            return res.status(500).json({ error: '无法打开文件夹选择器' });
        }
        
        // 拿到 PowerShell 返回的选中的路径字符串
        const selectedPath = stdout.trim();
        if (selectedPath) {
            res.json({ path: selectedPath });
        } else {
            // 用户点击了取消
            res.json({ path: null });
        }
    });
});

// 4.5 【重磅性能升级：实时生成缩略图】
// 为了解决滚动卡顿问题，我们绝不能给前端直接返回几兆大小的原图！
app.get('/api/thumbnail', async (req, res) => {
    const index = parseInt(req.query.folderIndex);
    const filename = req.query.filename;
    
    const config = getConfig();
    const targetFolder = config.folders[index];
    if (!targetFolder) return res.status(404).send('Folder not found');

    const absoluteImagePath = path.join(targetFolder, filename);

    try {
        // 使用 sharp 库，实时读取硬盘里的原图，并瞬间压缩成一张宽 300px 的极小缩略图发送给前端。
        // 原本一张 5MB 的照片，经过这里处理后发给网页只有大概 20KB！流畅度提升百倍！
        const buffer = await sharp(absoluteImagePath)
            .resize(300) // 宽度压到 300 像素
            .jpeg({ quality: 80 }) // 转成中等画质的 JPG
            .toBuffer();

        res.set('Content-Type', 'image/jpeg');
        res.send(buffer);
    } catch (error) {
        console.error("生成缩略图失败，回退发送原图:", filename);
        // 如果处理失败（比如格式不支持），就老老实实发原图
        res.sendFile(absoluteImagePath);
    }
});

// ==============================================

const server = app.listen(port, () => {
    console.log('\n=======================================');
    console.log(`✅ 进阶版多图库服务器启动成功!`);
    console.log(`🌐 请在浏览器打开: http://localhost:${port}`);
    console.log(`💾 你的配置将保存在: ${CONFIG_FILE}`);
    console.log('=======================================\n');
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`端口 ${port} 已被占用，说明图库服务器已经在运行啦！可以直接在浏览器查看。`);
        // 当从右键菜单打开时，就算服务器已在运行，前面也已经把目录加进 config.json 并在浏览器打开了，这里直接退出即可
        setTimeout(() => process.exit(0), 1000); 
    } else {
        console.error(err);
    }
});