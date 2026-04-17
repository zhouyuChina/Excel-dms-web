@echo off
chcp 65001 >nul 2>&1
title CRM - 關閉中
setlocal enabledelayedexpansion

set "ROOT=%~dp0"
set "PGBIN=%ROOT%pgsql\bin"
set "PGDATA=%ROOT%pgdata"

echo.
echo  正在關閉 CRM 系統...
echo.

REM --- 讀取 port 資訊 ---
set "PGPORT=5433"
if exist "%ROOT%_pgport.tmp" (
    set /p PGPORT=<"%ROOT%_pgport.tmp"
    del "%ROOT%_pgport.tmp" >nul 2>&1
)
if exist "%ROOT%_apiport.tmp" (
    del "%ROOT%_apiport.tmp" >nul 2>&1
)

REM --- 關閉 Node.js ---
echo  [1/2] 關閉伺服器...
taskkill /fi "IMAGENAME eq node.exe" /f >nul 2>&1

REM --- 關閉 PostgreSQL ---
echo  [2/2] 關閉資料庫...
"%PGBIN%\pg_ctl.exe" stop -D "%PGDATA%" -m fast >nul 2>&1

echo.
echo  ✓ CRM 已安全關閉
echo.
timeout /t 2 /nobreak >nul
exit
