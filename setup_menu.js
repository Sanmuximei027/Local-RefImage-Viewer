const fs = require('fs');
const path = require('path');

const projectPath = __dirname.replace(/\\/g, '\\\\');
const nodeExePath = process.execPath.replace(/\\/g, '\\\\');

const regContent = `Windows Registry Editor Version 5.00

[HKEY_CLASSES_ROOT\\Directory\\shell\\OpenWithGalleryServer]
@="用图库查看(&G)"
"Icon"="${nodeExePath}"

[HKEY_CLASSES_ROOT\\Directory\\shell\\OpenWithGalleryServer\\command]
@="\\"${nodeExePath}\\" \\"${projectPath}\\\\server.js\\" \\"%1\\""

[HKEY_CLASSES_ROOT\\Directory\\Background\\shell\\OpenWithGalleryServer]
@="用图库查看(&G)"
"Icon"="${nodeExePath}"

[HKEY_CLASSES_ROOT\\Directory\\Background\\shell\\OpenWithGalleryServer\\command]
@="\\"${nodeExePath}\\" \\"${projectPath}\\\\server.js\\" \\"%V\\""
`;

fs.writeFileSync(path.join(__dirname, 'add_context_menu.reg'), regContent);
console.log('✅ 注册表文件 add_context_menu.reg 已生成！双击运行该文件即可添加到右键菜单。');
