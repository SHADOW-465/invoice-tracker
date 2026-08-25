const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const builder = require('C:/Users/acer/Documents/finance_tracker/node_modules/electron-builder');

const rootDir = 'C:/Users/acer/Documents/GitHub/invoice-tracker';
const outDir = path.join(rootDir, 'dist-desktop');

async function main() {
  console.log('🚀 Building Standalone Windows Application for Simon & Son Invoice Ledger...');
  console.log('📁 Project directory:', rootDir);
  console.log('📁 Output directory:', outDir);

  // 1. Build Vite frontend
  console.log('⚡ Step 1: Running vite build...');
  execSync('npx vite build', { cwd: rootDir, stdio: 'inherit' });

  // 2. Kill any running electron processes
  console.log('🛑 Step 2: Stopping any running instances...');
  try {
    execSync('powershell -Command "Get-Process -Name \'*Simon*\', \'*electron*\' -ErrorAction SilentlyContinue | Stop-Process -Force"');
  } catch (e) {}

  // 3. Run electron-builder via JS API
  console.log('📦 Step 3: Packaging Windows Setup and Standalone Portable executables...');
  const appPaths = await builder.build({
    projectDir: rootDir,
    config: {
      appId: 'com.simonandson.invoicetracker',
      productName: 'Simon & Son Invoice Ledger',
      directories: {
        output: outDir
      },
      files: [
        'dist/**/*',
        'electron/**/*',
        'public/**/*',
        'src/lib/workbook.js',
        'Invoice Tracker.xlsx',
        'package.json'
      ],
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
        artifactName: 'Simon & Son Invoice Ledger Setup.${ext}'
      },
      portable: {
        artifactName: 'Simon & Son Invoice Ledger Portable.${ext}'
      },
      asar: true
    }
  });

  console.log('✅ Packaged outputs:', appPaths);

  // 4. Verify executables in dist-desktop and copy to root
  const setupExe = path.join(outDir, 'Simon & Son Invoice Ledger Setup.exe');
  const portableExe = path.join(outDir, 'Simon & Son Invoice Ledger Portable.exe');
  const rootExe = path.join(rootDir, 'Simon & Son Invoice Ledger.exe');

  console.log('\n=============================================');
  console.log('🎉🎉🎉 BUILD SUCCESSFUL! 🎉🎉🎉');
  console.log('=============================================');

  if (fs.existsSync(setupExe)) {
    const stat = fs.statSync(setupExe);
    console.log('✅ 1. Windows Setup Installer (Recommended to send):');
    console.log('   📍 Path:', setupExe);
    console.log('   📊 Size:', (stat.size / (1024 * 1024)).toFixed(2), 'MB');
    console.log('   🕒 Modified:', stat.mtime);
  }

  if (fs.existsSync(portableExe)) {
    const stat = fs.statSync(portableExe);
    console.log('✅ 2. Single-File Portable Executable (Zero-Install):');
    console.log('   📍 Path:', portableExe);
    console.log('   📊 Size:', (stat.size / (1024 * 1024)).toFixed(2), 'MB');
    console.log('   🕒 Modified:', stat.mtime);

    try {
      fs.copyFileSync(portableExe, rootExe);
      console.log('✅ 3. Root Workspace Executable:');
      console.log('   📍 Path:', rootExe);
    } catch (e) {}
  }
}

main().catch(err => {
  console.error('Fatal error during build:', err);
  process.exit(1);
});
