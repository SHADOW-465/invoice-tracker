const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = 'C:/Users/acer/Documents/GitHub/invoice-tracker';
const outDir = path.join(rootDir, 'dist-desktop');

async function main() {
  console.log('🚀 Starting Clean Standalone Desktop Build Pipeline for main branch...');
  console.log('📁 Project Directory:', rootDir);

  // 1. Terminate any previous electron instances and clean dist-desktop
  console.log('\n🛑 Step 1: Cleaning previous instances and output folder...');
  try {
    execSync('powershell -Command "Get-Process -Name \'*Simon*\', \'*electron*\' -ErrorAction SilentlyContinue | Stop-Process -Force"');
  } catch (e) {}

  if (fs.existsSync(outDir)) {
    try {
      fs.rmSync(outDir, { recursive: true, force: true });
    } catch (e) {}
  }

  // 2. Build Vite frontend bundle
  console.log('\n⚡ Step 2: Running vite build...');
  execSync('npx vite build', { cwd: rootDir, stdio: 'inherit' });

  // 3. Package native Electron application folder using cached Electron runtime
  console.log('\n📦 Step 3: Packaging with Electron Packager (cached v33.4.11)...');
  const packagerCmd = 'npx @electron/packager . "Simon & Son Invoice Ledger" --platform=win32 --arch=x64 --out=dist-desktop --asar --overwrite --icon=public/icon.ico --electron-version=33.4.11 --ignore="(\\.git|\\.vscode|\\.idea|backups|build_standalone\\.cjs|vercel\\.json|\\.vercel)"';
  execSync(packagerCmd, { cwd: rootDir, stdio: 'inherit' });

  // 4. Generate Single-File NSIS Setup Installer with electron-builder
  console.log('\n🎁 Step 4: Generating single-file Windows Setup Installer (NSIS)...');
  const builder = require('C:/Users/acer/Documents/finance_tracker/node_modules/electron-builder');
  
  const appPaths = await builder.build({
    projectDir: rootDir,
    prepackaged: path.join(outDir, 'Simon & Son Invoice Ledger-win32-x64'),
    config: {
      appId: 'com.simonandson.invoicetracker',
      productName: 'Simon & Son Invoice Ledger',
      directories: {
        output: outDir
      },
      win: {
        icon: 'public/icon.ico',
        target: [
          { target: 'nsis', arch: ['x64'] }
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
        artifactName: 'Simon & Son Invoice Ledger Setup.${ext}'
      }
    }
  });

  const setupExe = path.join(outDir, 'Simon & Son Invoice Ledger Setup.exe');
  const rootExe = path.join(rootDir, 'Simon & Son Invoice Ledger Setup.exe');

  console.log('\n=============================================');
  console.log('🎉 BUILD COMPLETED SUCCESSFULLY! 🎉');
  console.log('=============================================');

  if (fs.existsSync(setupExe)) {
    fs.copyFileSync(setupExe, rootExe);
    const sizeMB = (fs.statSync(rootExe).size / (1024 * 1024)).toFixed(2);
    console.log(`✅ 1. Installer Path in dist-desktop: ${setupExe}`);
    console.log(`✅ 2. Mirrored Path in Project Root: ${rootExe}`);
    console.log(`📊 File Size: ${sizeMB} MB`);
  } else {
    console.log('Packager outputs:', appPaths);
  }
}

main().catch(err => {
  console.error('Fatal error during build:', err);
  process.exit(1);
});
