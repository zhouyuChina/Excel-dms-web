Set fso = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")
myDir = fso.GetParentFolderName(WScript.ScriptFullName)

WshShell.Run "cmd /c """ & myDir & "\start-crm.bat""", 0, False

Dim url, port, ready
port = "8080"
If fso.FileExists(myDir & "\_apiport.tmp") Then
    Set f = fso.OpenTextFile(myDir & "\_apiport.tmp", 1)
    port = Trim(f.ReadLine)
    f.Close
End If
url = "http://127.0.0.1:" & port

ready = False
For i = 1 To 40
    WScript.Sleep 1000
    On Error Resume Next
    Set http = CreateObject("MSXML2.XMLHTTP")
    http.open "GET", url & "/api/health", False
    http.send
    If Err.Number = 0 Then
        If http.status = 200 Then
            ready = True
            Exit For
        End If
    End If
    On Error GoTo 0
Next

If ready Then
    WshShell.Run url
Else
    WshShell.Popup "CRM start timeout", 5, "CRM", 48
End If
