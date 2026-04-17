Set fso = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")
myDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.Run Chr(34) & myDir & "\start-crm.bat" & Chr(34), 0, False
