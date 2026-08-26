const path = require('path');
const fs = require('fs');
const builder = require('C:/Users/acer/Documents/finance_tracker/node_modules/electron-builder');

const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'dist-desktop');

console.log('Packaging...');
console.log('ProjectDir:', rootDir);
console.log('OutDir:', outDir);

builder.build({
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
}).then((res) => {
  console.log('Builder finished. Output files:', res);
  const setupExe = path.join(outDir, 'Simon & Son Invoice Ledger Setup.exe');
  const rootExe = path.join(rootDir, 'Simon & Son Invoice Ledger Setup.exe');
  console.log('setupExe exists:', fs.existsSync(setupExe));
  if (fs.existsSync(setupExe)) {
    fs.copyFileSync(setupExe, rootExe);
    console.log('Copied to root:', rootExe, '(' + (fs.statSync(rootExe).size / (1024*1024)).toFixed(2) + ' MB)');
  }
}).catch((err) => {
  console.error('Builder error:', err);
});
