Set fso = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")
myDir = fso.GetParentFolderName(WScript.ScriptFullName)
' Reset needs visible window so user can confirm Y/N
WshShell.Run Chr(34) & myDir & "\reset-db.bat" & Chr(34), 1, False
