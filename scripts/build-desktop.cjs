const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const builder = require('electron-builder');

const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'dist-desktop');
const prepackagedDir = path.join(outDir, 'Simon & Son Invoice Ledger-win32-x64');

async function buildDesktop() {
  console.log('================================================================');
  console.log('🚀 SIMON & SON INVOICE LEDGER — CLEAN STANDALONE DESKTOP BUILD');
  console.log('================================================================');
  console.log('📁 Project Root:     ', rootDir);
  console.log('📁 Output Directory: ', outDir);

  // 1. Terminate running instances to release file locks on Windows
  console.log('\n🛑 Step 1: Cleaning previous instances and old build artifacts...');
  try {
    execSync('powershell -Command "Get-Process -Name \'*Simon*\', \'*Invoice Ledger*\' -ErrorAction SilentlyContinue | Stop-Process -Force"');
  } catch (e) {
    // ignore
  }

  // Remove old folders
  const distDir = path.join(rootDir, 'dist');
  if (fs.existsSync(distDir)) {
    try { fs.rmSync(distDir, { recursive: true, force: true }); } catch (e) {}
  }
  if (fs.existsSync(outDir)) {
    try { fs.rmSync(outDir, { recursive: true, force: true }); } catch (e) {}
  }

  // Remove old root exe files
  const rootExeFiles = [
    path.join(rootDir, 'Simon & Son Invoice Ledger Setup.exe'),
    path.join(rootDir, 'Simon & Son Invoice Ledger Portable.exe'),
    path.join(rootDir, 'Simon & Son Invoice Ledger.exe')
  ];
  for (const f of rootExeFiles) {
    if (fs.existsSync(f)) {
      try { fs.unlinkSync(f); } catch (e) {}
    }
  }
  console.log('  ✅ Workspace cleared.');

  // 2. Vite Frontend Build
  console.log('\n⚡ Step 2: Building Vite React frontend...');
  execSync('npx vite build', { cwd: rootDir, stdio: 'inherit' });

  // 3. Obfuscate & Protect Frontend Bundle
  console.log('\n🛡️ Step 3: Running AST obfuscation & code protection...');
  require('./protect-build.cjs');

  // 4. Package Native Electron Runtime via Electron Packager
  console.log('\n📦 Step 4: Packaging native Electron application folder...');
  const packagerCmd = 'npx @electron/packager . "Simon & Son Invoice Ledger" --platform=win32 --arch=x64 --out=dist-desktop --asar --overwrite --icon=public/icon.ico --ignore="(\\.git|\\.vscode|\\.idea|backups|vercel\\.json|\\.vercel|src|scripts)"';
  execSync(packagerCmd, { cwd: rootDir, stdio: 'inherit' });

  // 5. Generate Standalone NSIS Installer and Portable Executables via electron-builder
  console.log('\n🎁 Step 5: Generating Windows Setup Installer (NSIS) and Portable Standalone EXE...');
  const buildResults = await builder.build({
    projectDir: rootDir,
    prepackaged: prepackagedDir,
    config: {
      appId: 'com.simonandson.invoicetracker',
      productName: 'Simon & Son Invoice Ledger',
      directories: {
        output: outDir
      },
      win: {
        icon: 'public/icon.ico',
        target: [
          { target: 'nsis', arch: ['x64'] },
          { target: 'portable', arch: ['x64'] }
        ],
        executableName: 'Simon & Son Invoice Ledger'
      },
      nsis: {
        oneClick: false,
        perMachine: false,
        allowToChangeInstallationDirectory: true,
        createDesktopShortcut: 'always',
        createStartMenuShortcut: true,
        shortcutName: 'Simon & Son Invoice Ledger',
        installerIcon: 'public/icon.ico',
        uninstallerIcon: 'public/icon.ico',
        installerHeaderIcon: 'public/icon.ico',
        artifactName: 'Simon & Son Invoice Ledger Setup.exe'
      },
      portable: {
        artifactName: 'Simon & Son Invoice Ledger Portable.exe'
      }
    }
  });

  console.log('\n================================================================');
  console.log('🎉 STANDALONE BUILD COMPLETED SUCCESSFULLY! 🎉');
  console.log('================================================================');

  // Copy outputs to project root for instant access
  const outputs = fs.readdirSync(outDir).filter((f) => f.endsWith('.exe'));
  for (const exe of outputs) {
    const src = path.join(outDir, exe);
    const dest = path.join(rootDir, exe);
    try {
      fs.copyFileSync(src, dest);
      const sizeMB = (fs.statSync(dest).size / (1024 * 1024)).toFixed(2);
      console.log(`\n📌 Executable: ${exe}`);
      console.log(`   ├─ Output Folder: ${src}`);
      console.log(`   ├─ Root Folder:   ${dest}`);
      console.log(`   └─ File Size:     ${sizeMB} MB`);
    } catch (e) {
      console.warn(`Warning copying ${exe} to root:`, e.message);
    }
  }

  console.log('\n✅ Built-in SQLite database engine: Node.js DatabaseSync (node:sqlite)');
  console.log('✅ Local Data Store: %APPDATA%/Simon & Son Invoice Ledger/ledger.db');
  console.log('✨ Build pipeline is ready and verified.\n');
}

buildDesktop().catch((err) => {
  console.error('\n❌ Desktop build failed:', err);
  process.exit(1);
});
