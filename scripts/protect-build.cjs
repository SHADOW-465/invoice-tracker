const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');
const bytenode = require('bytenode');

console.log('🔒 Starting Level 2 & Level 3 Code Protection Pipeline...');

// 1. Obfuscate all JavaScript files in dist/assets
const distAssetsDir = path.join(__dirname, '../dist/assets');
if (fs.existsSync(distAssetsDir)) {
  const files = fs.readdirSync(distAssetsDir);
  let obfuscatedCount = 0;

  files.forEach((file) => {
    if (file.endsWith('.js')) {
      const filePath = path.join(distAssetsDir, file);
      const code = fs.readFileSync(filePath, 'utf8');

      console.log(`  🛡️  Obfuscating AST for ${file}...`);
      const obfuscationResult = JavaScriptObfuscator.obfuscate(code, {
        compact: true,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 0.75,
        deadCodeInjection: false, // keep performance snappy
        numbersToExpressions: true,
        simplify: true,
        splitStrings: true,
        splitStringsChunkLength: 6,
        stringArray: true,
        stringArrayEncoding: ['base64'],
        stringArrayThreshold: 0.8,
        transformObjectKeys: true,
        unicodeEscapeSequence: false,
        disableConsoleOutput: false // keeps log visibility clean
      });

      fs.writeFileSync(filePath, obfuscationResult.getObfuscatedCode(), 'utf8');
      obfuscatedCount++;
    }
  });

  console.log(`  ✅ Successfully obfuscated ${obfuscatedCount} frontend asset bundle(s).`);
}

// 2. Compile Electron main process into raw V8 Bytecode (.jsc)
const electronDir = path.join(__dirname, '../electron');
const mainSource = path.join(electronDir, 'main.cjs');
const mainBytecode = path.join(electronDir, 'main.jsc');

if (fs.existsSync(mainSource)) {
  console.log('  ⚡ Compiling Electron main.cjs into V8 Bytecode (main.jsc)...');
  bytenode.compileFile({
    filename: mainSource,
    output: mainBytecode,
    electron: true
  });
  console.log('  ✅ V8 Bytecode compiled successfully: electron/main.jsc');
}

// 3. Create entry loader for compiled bytecode
const entryLoaderPath = path.join(electronDir, 'entry.cjs');
const entryContent = `// Protected Bytecode Loader
require('bytenode');
require('./main.jsc');
`;
fs.writeFileSync(entryLoaderPath, entryContent, 'utf8');
console.log('  ✅ Created protected entry loader: electron/entry.cjs');

console.log('🎉 Code protection complete! Ready for packaging.');
