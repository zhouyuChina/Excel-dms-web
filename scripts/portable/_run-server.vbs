Set fso = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")
myDir = fso.GetParentFolderName(WScript.ScriptFullName)
nodeExe = myDir & "\node\node.exe"
serverDir = myDir & "\server"
logFile = myDir & "\api.log"
cmd = "cmd /c cd /d """ & serverDir & """ && """ & nodeExe & """ dist\index.js >""" & logFile & """ 2>&1"
WshShell.Run cmd, 0, False
