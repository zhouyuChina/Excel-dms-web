@echo off
chcp 65001 >nul 2>&1
title CRM 客戶管理系統 - 啟動中
setlocal enabledelayedexpansion

set "ROOT=%~dp0"
set "NODE=%ROOT%node\node.exe"
set "PGBIN=%ROOT%pgsql\bin"
set "PGDATA=%ROOT%pgdata"
set "PGPORT=5433"
set "APIPORT=8080"

echo.
echo  ==========================================
echo     CRM 客戶管理系統
echo  ==========================================
echo.

if not exist "%NODE%" (
    echo  [錯誤] 找不到 Node.js: %NODE%
    echo  請確認資料夾結構完整。
    pause
    exit /b 1
)
if not exist "%PGBIN%\pg_ctl.exe" (
    echo  [錯誤] 找不到 PostgreSQL: %PGBIN%
    echo  請確認資料夾結構完整。
    pause
    exit /b 1
)

REM --- 檢查 VC++ Runtime ---
reg query "HKLM\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" /v Version >nul 2>&1
if errorlevel 1 (
    if exist "%ROOT%vc_redist.x64.exe" (
        echo  [準備] 首次使用，安裝必要元件 Visual C++ Runtime...
        echo  （可能會彈出安裝視窗，請按「安裝」）
        "%ROOT%vc_redist.x64.exe" /install /quiet /norestart
        echo  [準備] 安裝完成
    ) else (
        echo  [警告] 偵測不到 Visual C++ Runtime，如果啟動失敗，
        echo         請至 https://aka.ms/vs/17/release/vc_redist.x64.exe 下載安裝
    )
)

REM --- 檢查 DB port ---
netstat -an | findstr ":%PGPORT% " | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo  [注意] Port %PGPORT% 已被佔用，嘗試其他 port...
    for %%P in (5434 5435 5436 5437 5438) do (
        netstat -an | findstr ":%%P " | findstr "LISTENING" >nul 2>&1
        if errorlevel 1 (
            set "PGPORT=%%P"
            echo  [注意] 使用 port !PGPORT!
            goto :pg_port_ok
        )
    )
    echo  [錯誤] 找不到可用的資料庫 port
    pause
    exit /b 1
)
:pg_port_ok

set "DATABASE_URL=postgresql://dms@127.0.0.1:%PGPORT%/dms?schema=public"
set "PORT=%APIPORT%"

REM --- 1. 初始化或啟動資料庫 ---
if not exist "%PGDATA%\PG_VERSION" (
    echo  [1/4] 首次啟動，初始化資料庫...
    "%PGBIN%\initdb.exe" -D "%PGDATA%" -U dms -E UTF8 --locale=C -A trust >nul 2>&1
    if errorlevel 1 (
        echo  [錯誤] 資料庫初始化失敗，請查看 pg.log
        pause
        exit /b 1
    )
    set "FIRST_RUN=1"
) else (
    set "FIRST_RUN=0"
)

echo  [1/4] 啟動資料庫...
"%PGBIN%\pg_ctl.exe" start -D "%PGDATA%" -l "%ROOT%pg.log" -o "-p %PGPORT%" -w >nul 2>&1

echo  [2/4] 等待資料庫就緒...
set RETRIES=0
:wait_db
"%PGBIN%\pg_isready.exe" -p %PGPORT% -U dms >nul 2>&1
if errorlevel 1 (
    set /a RETRIES+=1
    if !RETRIES! GEQ 30 (
        echo  [錯誤] 資料庫啟動逾時，請查看 pg.log
        pause
        exit /b 1
    )
    timeout /t 1 /nobreak >nul
    goto wait_db
)
echo  [2/4] 資料庫就緒

if "%FIRST_RUN%"=="1" (
    echo  [2/4] 建立資料庫...
    "%PGBIN%\createdb.exe" -U dms -p %PGPORT% dms >nul 2>&1

    if exist "%ROOT%dump.backup" (
        echo  [2/4] 還原資料（可能需要數分鐘）...
        "%PGBIN%\pg_restore.exe" -U dms -d dms -p %PGPORT% --no-owner --no-privileges "%ROOT%dump.backup" >nul 2>&1
        echo  [2/4] 資料還原完成
    ) else if exist "%ROOT%dump.sql" (
        echo  [2/4] 還原資料...
        "%PGBIN%\psql.exe" -U dms -d dms -p %PGPORT% -f "%ROOT%dump.sql" >nul 2>&1
        echo  [2/4] 資料還原完成
    )
)

REM --- 每次啟動都確認表結構 ---
echo  [2/4] 確認資料表結構...
cd /d "%ROOT%server"
echo DATABASE_URL=%DATABASE_URL%> "%ROOT%server\.env"
echo PORT=%APIPORT%>> "%ROOT%server\.env"

"%NODE%" node_modules\prisma\build\index.js db push --skip-generate --accept-data-loss >nul 2>&1
if errorlevel 1 (
    echo  [警告] 資料表結構確認失敗，系統仍會嘗試啟動
) else (
    echo  [2/4] 資料表結構確認完成
)
cd /d "%ROOT%"

REM --- 檢查 API port ---
netstat -an | findstr ":%APIPORT% " | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo  [注意] Port %APIPORT% 已被佔用，嘗試 8081...
    set "APIPORT=8081"
    set "PORT=8081"
    echo PORT=!APIPORT!>> "%ROOT%server\.env"
)

REM --- 3. 啟動 API（完全隱藏視窗）---
echo  [3/4] 啟動伺服器...
cd /d "%ROOT%server"
start "" /b cmd /c ""%NODE%" dist\index.js > "%ROOT%api.log" 2>&1"
cd /d "%ROOT%"

REM --- 記錄 port 供關閉腳本使用 ---
echo %PGPORT%> "%ROOT%_pgport.tmp"
echo %APIPORT%> "%ROOT%_apiport.tmp"

echo  [3/4] 等待伺服器就緒...
set RETRIES=0
:wait_api
timeout /t 1 /nobreak >nul
curl.exe -s -o nul http://127.0.0.1:%APIPORT%/api/health >nul 2>&1
if errorlevel 1 (
    set /a RETRIES+=1
    if !RETRIES! GEQ 20 (
        echo  [警告] 伺服器啟動較慢，仍嘗試開啟瀏覽器
        goto open_browser
    )
    goto wait_api
)

:open_browser
echo  [4/4] 開啟瀏覽器...
start "" "http://127.0.0.1:%APIPORT%"

echo.
echo  ==========================================
echo    CRM 已在背景啟動！
echo.
echo    網址: http://127.0.0.1:%APIPORT%
echo.
echo    要關閉系統請雙擊「關閉CRM.bat」
echo  ==========================================
echo.

REM --- 啟動完成，此視窗自動關閉 ---
timeout /t 3 /nobreak >nul
exit
