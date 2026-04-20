Set fso = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")
myDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.Run "cmd /c """ & myDir & "\stop-crm.bat""", 0, True
WshShell.Popup "CRM stopped", 3, "CRM", 64
