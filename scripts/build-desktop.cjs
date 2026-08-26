const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'dist-desktop');

console.log('🚀 Starting Clean Desktop Build Pipeline for main branch...');
console.log('📁 Root Directory:', rootDir);
console.log('📁 Output Directory:', outDir);

// 1. Build Vite frontend
console.log('\n⚡ Step 1: Building Vite frontend bundle...');
execSync('npx vite build', { cwd: rootDir, stdio: 'inherit' });

// 2. Protect frontend bundle with AST Obfuscation
console.log('\n🛡️ Step 2: Running AST obfuscation on frontend assets...');
require('./protect-build.cjs');

// 3. Run Electron-Builder
console.log('\n📦 Step 3: Packaging with electron-builder...');
let builder;
try {
  builder = require('electron-builder');
} catch (e) {
  builder = require('C:/Users/acer/Documents/finance_tracker/node_modules/electron-builder');
}

async function buildApp() {
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
        'package.json'
      ],
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
      },
      asar: true
    }
  });

  console.log('\n=============================================');
  console.log('🎉 BUILD COMPLETED SUCCESSFULLY! 🎉');
  console.log('=============================================');
  console.log('📦 Packaged files:', appPaths);

  if (Array.isArray(appPaths)) {
    for (const builtFile of appPaths) {
      if (builtFile.endsWith('.exe') && fs.existsSync(builtFile)) {
        const rootExe = path.join(rootDir, path.basename(builtFile));
        fs.copyFileSync(builtFile, rootExe);
        const sizeMB = (fs.statSync(rootExe).size / (1024 * 1024)).toFixed(2);
        console.log(`✅ Installer Path: ${builtFile}`);
        console.log(`✅ Mirrored Root Path: ${rootExe}`);
        console.log(`📊 File Size: ${sizeMB} MB`);
      }
    }
  }
}

buildApp().catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
