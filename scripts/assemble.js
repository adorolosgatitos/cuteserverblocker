#!/usr/bin/env node
// builds dist/cuteserverblocker/ — the folder that goes into the windows zip.
// with --with-node (on windows) it also copies the running node.exe so the
// zip runs without installing anything.
import {
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
  copyFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist', 'cuteserverblocker');
const withNode = process.argv.includes('--with-node');

const BAT = String.raw`@echo off
setlocal
cd /d "%~dp0"

rem netsh needs admin rights, so relaunch elevated when needed
fltmc >nul 2>&1
if errorlevel 1 (
  echo.
  echo   windows needs admin to edit the firewall.
  echo   please accept the uac prompt ^<3
  echo.
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

set "NODE=%~dp0node\node.exe"
if not exist "%NODE%" set "NODE=node"

where "%NODE%" >nul 2>&1
if errorlevel 1 if "%NODE%"=="node" (
  echo.
  echo   node.exe not found - install node 18+ or use a zip that bundles it
  echo.
  pause
  exit /b
)

echo.
echo   starting cute server blocker... your browser should open
echo.
"%NODE%" "%~dp0server\index.js"

echo.
echo   the kitty left the terminal. bye~
pause
`;

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

for (const item of ['server', 'public', 'package.json', 'README.md', 'LICENSE']) {
  const src = path.join(ROOT, item);
  if (!existsSync(src)) {
    console.error(`missing ${item}, aborting`);
    process.exit(1);
  }
  cpSync(src, path.join(DIST, item), { recursive: true });
}

writeFileSync(path.join(DIST, 'cuteserverblocker.bat'), BAT);

if (withNode) {
  if (process.platform !== 'win32') {
    console.log('~ --with-node only bundles node.exe on windows, skipping here');
  } else {
    mkdirSync(path.join(DIST, 'node'), { recursive: true });
    copyFileSync(process.execPath, path.join(DIST, 'node', 'node.exe'));
    console.log(`+ bundled ${path.basename(process.execPath)}`);
  }
}

function sizeOf(p) {
  const st = statSync(p);
  if (st.isDirectory()) return readdirSync(p).reduce((n, f) => n + sizeOf(path.join(p, f)), 0);
  return st.size;
}

const mb = (sizeOf(DIST) / 1024 / 1024).toFixed(1);
console.log(`dist ready: ${DIST} (${mb} MiB)`);
