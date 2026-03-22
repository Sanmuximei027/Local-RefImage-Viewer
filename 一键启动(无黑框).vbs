Set ws = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentFolder = fso.GetParentFolderName(WScript.ScriptFullName)

' 必须显式指定进入当前目录，并加上引号防空格路径
ws.CurrentDirectory = currentFolder

' 必须用 cmd /c 包装，以确保环境变量能正确解析 node 命令
ws.Run "cmd /c node launcher.js", 0, False
