@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

set "ROOT=%~dp0"
set "PGBIN=%ROOT%pgsql\bin"
set "PGDATA=%ROOT%pgdata"
set "PIDFILE=%ROOT%_crm.pid"

REM ============================================================
REM  1. 關閉 Node.js — 優先用 PID 檔（最精準）
REM ============================================================
if exist "%PIDFILE%" (
    set /p NODE_PID=<"%PIDFILE%"
    taskkill /pid !NODE_PID! /f >nul 2>&1
    del "%PIDFILE%" >nul 2>&1
)

REM fallback A: 用 port 找 PID
set "APIPORT=8080"
if exist "%ROOT%_apiport.tmp" (
    set /p APIPORT=<"%ROOT%_apiport.tmp"
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":!APIPORT! " ^| findstr "LISTENING" 2^>nul') do (
    taskkill /pid %%a /f >nul 2>&1
)

REM fallback B: 用路徑特徵殺（兜底）
wmic process where "name='node.exe' and commandline like '%%CRM_final%%'" call terminate >nul 2>&1

REM ============================================================
REM  2. 關閉 PostgreSQL — pg_ctl 優先，wmic 兜底
REM ============================================================
set "PGPORT=5500"
if exist "%ROOT%_pgport.tmp" (
    set /p PGPORT=<"%ROOT%_pgport.tmp"
)
"%PGBIN%\pg_ctl.exe" stop -D "%PGDATA%" -m fast >nul 2>&1
wmic process where "name='postgres.exe' and commandline like '%%CRM_final%%'" call terminate >nul 2>&1

REM ============================================================
REM  3. 清理暫存檔
REM ============================================================
del "%ROOT%_pgport.tmp" >nul 2>&1
del "%ROOT%_apiport.tmp" >nul 2>&1
del "%PIDFILE%" >nul 2>&1

exit
