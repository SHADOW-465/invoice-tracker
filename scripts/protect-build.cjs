const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

console.log('🔒 Starting Code Protection Pipeline (AST Obfuscation)...');

// 1. Obfuscate all JavaScript files in dist/assets
const distAssetsDir = path.join(__dirname, '../dist/assets');
if (fs.existsSync(distAssetsDir)) {
  const files = fs.readdirSync(distAssetsDir);
  let obfuscatedCount = 0;

  files.forEach((file) => {
    if (file.endsWith('.js')) {
      const filePath = path.join(distAssetsDir, file);
      const code = fs.readFileSync(filePath, 'utf8');

      console.log(`  🛡️  Obfuscating bundle ${file}...`);
      const obfuscationResult = JavaScriptObfuscator.obfuscate(code, {
        compact: true,
        controlFlowFlattening: false,
        deadCodeInjection: false,
        numbersToExpressions: false,
        simplify: true,
        splitStrings: false,
        stringArray: true,
        stringArrayEncoding: ['base64'],
        stringArrayThreshold: 0.75,
        transformObjectKeys: true,
        unicodeEscapeSequence: false,
        disableConsoleOutput: false
      });

      fs.writeFileSync(filePath, obfuscationResult.getObfuscatedCode(), 'utf8');
      obfuscatedCount++;
    }
  });

  console.log(`  ✅ Successfully obfuscated ${obfuscatedCount} frontend asset bundle(s).`);
}

// 2. Clean up any residual bytenode loader files
const electronDir = path.join(__dirname, '../electron');
const entryLoaderPath = path.join(electronDir, 'entry.cjs');
const mainBytecode = path.join(electronDir, 'main.jsc');
if (fs.existsSync(entryLoaderPath)) fs.unlinkSync(entryLoaderPath);
if (fs.existsSync(mainBytecode)) fs.unlinkSync(mainBytecode);

console.log('🎉 Code protection complete! Ready for packaging.');
