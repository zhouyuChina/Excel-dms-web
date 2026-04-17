@echo off
chcp 65001 >nul 2>&1
title CRM - 重置資料庫
setlocal enabledelayedexpansion

set "ROOT=%~dp0"
set "NODE=%ROOT%node\node.exe"
set "PGBIN=%ROOT%pgsql\bin"
set "PGDATA=%ROOT%pgdata"
set "PGPORT=5433"

echo.
echo  ==========================================
echo    CRM 重置資料庫（回到預設欄位狀態）
echo  ==========================================
echo.
echo  [警告] 這會清除所有客戶資料、匯入紀錄、匯出紀錄！
echo         只保留預設欄位定義。
echo.
echo  確定要重置嗎？
echo.
choice /c YN /m "  輸入 Y 確認重置，N 取消"
if errorlevel 2 (
    echo.
    echo  已取消。
    timeout /t 2 /nobreak >nul
    exit
)

echo.

REM --- 先關閉正在執行的 CRM ---
echo  [1/5] 關閉現有的 CRM 服務...
taskkill /fi "IMAGENAME eq node.exe" /f >nul 2>&1
"%PGBIN%\pg_ctl.exe" stop -D "%PGDATA%" -m fast >nul 2>&1
timeout /t 2 /nobreak >nul

REM --- 刪除舊的 pgdata ---
echo  [2/5] 清除舊資料庫...
if exist "%PGDATA%" (
    rmdir /s /q "%PGDATA%" >nul 2>&1
)
mkdir "%PGDATA%" >nul 2>&1

REM --- 重新初始化 ---
echo  [3/5] 初始化新資料庫...
"%PGBIN%\initdb.exe" -D "%PGDATA%" -U dms -E UTF8 --locale=C -A trust >nul 2>&1
if errorlevel 1 (
    echo  [錯誤] 資料庫初始化失敗
    pause
    exit /b 1
)

REM --- 檢查 port ---
netstat -an | findstr ":%PGPORT% " | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    for %%P in (5434 5435 5436 5437 5438) do (
        netstat -an | findstr ":%%P " | findstr "LISTENING" >nul 2>&1
        if errorlevel 1 (
            set "PGPORT=%%P"
            goto :reset_port_ok
        )
    )
)
:reset_port_ok

set "DATABASE_URL=postgresql://dms@127.0.0.1:%PGPORT%/dms?schema=public"

"%PGBIN%\pg_ctl.exe" start -D "%PGDATA%" -l "%ROOT%pg.log" -o "-p %PGPORT%" -w >nul 2>&1

set RETRIES=0
:reset_wait_db
"%PGBIN%\pg_isready.exe" -p %PGPORT% -U dms >nul 2>&1
if errorlevel 1 (
    set /a RETRIES+=1
    if !RETRIES! GEQ 20 (
        echo  [錯誤] 資料庫啟動失敗
        pause
        exit /b 1
    )
    timeout /t 1 /nobreak >nul
    goto reset_wait_db
)

"%PGBIN%\createdb.exe" -U dms -p %PGPORT% dms >nul 2>&1

REM --- 建立表結構 ---
echo  [4/5] 建立資料表結構...
cd /d "%ROOT%server"
echo DATABASE_URL=%DATABASE_URL%> "%ROOT%server\.env"
echo PORT=8080>> "%ROOT%server\.env"

"%NODE%" node_modules\prisma\build\index.js db push --skip-generate --accept-data-loss >nul 2>&1
if errorlevel 1 (
    echo  [錯誤] 資料表建立失敗
    "%PGBIN%\pg_ctl.exe" stop -D "%PGDATA%" -m fast >nul 2>&1
    pause
    exit /b 1
)
cd /d "%ROOT%"

REM --- 關閉資料庫（下次啟動CRM時會自動開啟）---
echo  [5/5] 完成清理...
"%PGBIN%\pg_ctl.exe" stop -D "%PGDATA%" -m fast >nul 2>&1

echo.
echo  ==========================================
echo    ✓ 資料庫已重置為預設狀態！
echo.
echo    下次啟動 CRM 時，伺服器會自動
echo    建立預設欄位定義。
echo  ==========================================
echo.
timeout /t 5 /nobreak >nul
exit
