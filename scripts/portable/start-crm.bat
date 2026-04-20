@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

set "ROOT=%~dp0"
set "NODE=%ROOT%node\node.exe"
set "PGBIN=%ROOT%pgsql\bin"
set "PGDATA=%ROOT%pgdata"
set "PIDFILE=%ROOT%_crm.pid"
set "PGPORT=5500"
set "APIPORT=8080"

REM ============================================================
REM  0. 防重複啟動
REM ============================================================
if exist "%PIDFILE%" (
    set /p SAVED_NODE_PID=<"%PIDFILE%"
    tasklist /fi "PID eq !SAVED_NODE_PID!" /nh 2>nul | findstr /i "node" >nul 2>&1
    if not errorlevel 1 (
        if exist "%ROOT%_apiport.tmp" set /p APIPORT=<"%ROOT%_apiport.tmp"
        start "" "http://127.0.0.1:!APIPORT!"
        exit /b 0
    )
    del "%PIDFILE%" >nul 2>&1
)

REM ============================================================
REM  0.5 清理殘留 process
REM ============================================================
"%PGBIN%\pg_ctl.exe" stop -D "%PGDATA%" -m fast >nul 2>&1
if exist "%ROOT%_apiport.tmp" (
    set /p OLD_APIPORT=<"%ROOT%_apiport.tmp"
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":!OLD_APIPORT! " ^| findstr "LISTENING" 2^>nul') do (
        taskkill /pid %%a /f >nul 2>&1
    )
)
wmic process where "name='node.exe' and commandline like '%%CRM_final%%'" call terminate >nul 2>&1
wmic process where "name='postgres.exe' and commandline like '%%CRM_final%%'" call terminate >nul 2>&1
del "%ROOT%_pgport.tmp" >nul 2>&1
del "%ROOT%_apiport.tmp" >nul 2>&1
del "%PIDFILE%" >nul 2>&1
ping -n 3 127.0.0.1 >nul

REM ============================================================
REM  1. 檢查必要檔案
REM ============================================================
if not exist "%NODE%" exit /b 1
if not exist "%PGBIN%\pg_ctl.exe" exit /b 1

REM ============================================================
REM  2. 檢查 VC++ Runtime
REM ============================================================
reg query "HKLM\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" /v Version >nul 2>&1
if errorlevel 1 (
    if exist "%ROOT%vc_redist.x64.exe" (
        "%ROOT%vc_redist.x64.exe" /install /quiet /norestart
    )
)

REM ============================================================
REM  3. 找可用的 DB port
REM ============================================================
netstat -an | findstr ":%PGPORT% " | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    for %%P in (5501 5502 5503 5504 5505) do (
        netstat -an | findstr ":%%P " | findstr "LISTENING" >nul 2>&1
        if errorlevel 1 (
            set "PGPORT=%%P"
            goto :pg_port_ok
        )
    )
    exit /b 1
)
:pg_port_ok

set "DATABASE_URL=postgresql://dms@127.0.0.1:%PGPORT%/dms?schema=public"

REM ============================================================
REM  4. 初始化或啟動資料庫
REM ============================================================
if not exist "%PGDATA%\PG_VERSION" (
    "%PGBIN%\initdb.exe" -D "%PGDATA%" -U dms -E UTF8 --locale=C -A trust >nul 2>&1
    if errorlevel 1 exit /b 1
    set "FIRST_RUN=1"
) else (
    set "FIRST_RUN=0"
)

"%PGBIN%\pg_ctl.exe" start -D "%PGDATA%" -l "%ROOT%pg.log" -o "-p %PGPORT%" -w >nul 2>&1

set RETRIES=0
:wait_db
"%PGBIN%\pg_isready.exe" -p %PGPORT% -U dms >nul 2>&1
if errorlevel 1 (
    set /a RETRIES+=1
    if !RETRIES! GEQ 30 exit /b 1
    ping -n 2 127.0.0.1 >nul
    goto wait_db
)

if "%FIRST_RUN%"=="1" (
    "%PGBIN%\createdb.exe" -U dms -p %PGPORT% dms >nul 2>&1
    if exist "%ROOT%dump.backup" (
        "%PGBIN%\pg_restore.exe" -U dms -d dms -p %PGPORT% --no-owner --no-privileges "%ROOT%dump.backup" >nul 2>&1
    ) else if exist "%ROOT%dump.sql" (
        "%PGBIN%\psql.exe" -U dms -d dms -p %PGPORT% -f "%ROOT%dump.sql" >nul 2>&1
    )
)

REM ============================================================
REM  5. 確認資料表結構
REM ============================================================
cd /d "%ROOT%server"
echo DATABASE_URL=%DATABASE_URL%> "%ROOT%server\.env"
echo PORT=%APIPORT%>> "%ROOT%server\.env"
"%NODE%" node_modules\prisma\build\index.js db push --skip-generate < nul >nul 2>&1
cd /d "%ROOT%"

REM ============================================================
REM  6. 找可用的 API port
REM ============================================================
netstat -an | findstr ":%APIPORT% " | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    set "APIPORT=8081"
    echo PORT=!APIPORT!>> "%ROOT%server\.env"
)

REM ============================================================
REM  7. 啟動 API server
REM ============================================================
start "" wscript //nologo "%ROOT%_run-server.vbs"
ping -n 3 127.0.0.1 >nul

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%APIPORT% " ^| findstr "LISTENING" 2^>nul') do (
    echo %%a> "%PIDFILE%"
)

echo %PGPORT%> "%ROOT%_pgport.tmp"
echo %APIPORT%> "%ROOT%_apiport.tmp"
