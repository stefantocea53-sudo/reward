#!/usr/bin/env node
// scripts/obfuscate.js — ID 14: obfuscate public/js/*.js at build time
// Copies public/ → dist/, applies javascript-obfuscator to all JS files
// Skips: config/config.js (must stay readable for middleware injection),
//        sw.js (Service Worker must be parseable by browser SW engine),
//        workers/*.js (same reason)

const fs   = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const SRC  = path.join(__dirname, '..', 'public');
const DIST = path.join(__dirname, '..', 'dist');

// Files to skip obfuscation (readable by browser internals or middleware)
const SKIP_OBFUSCATION = new Set([
  'config/config.js',   // middleware injects __CONFIG into this via string replacement
  'sw.js',              // SW registration needs parseable scope/install logic
]);

// Obfuscator options — string encryption + control flow + dead code
// Balanced for load speed vs analysis resistance
const OBFUSCATOR_OPTIONS = {
  compact: true,
  controlFlowFlattening: false,       // too slow on mobile, avoid
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.1,    // low — keeps file size reasonable
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayCallsTransformThreshold: 0.5,
  stringArrayEncoding: ['base64'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersChainedCalls: true,
  stringArrayThreshold: 0.75,
  unicodeEscapeSequence: false,       // avoid — inflates file size badly
  numbersToExpressions: false,        // avoid — slows mobile execution
  renameGlobals: false,               // must not rename window.__ globals
  renameProperties: false,            // must not rename DOM properties
  selfDefending: false,               // breaks in some WebViews
  debugProtection: false,             // already handled by cloak.js
  disableConsoleOutput: true,         // strip console.log in prod
  sourceMap: false,
  target: 'browser',
  seed: 42                            // deterministic output = reproducible deploys
};

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath  = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function obfuscateDir(srcDir, distDir, relBase) {
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath  = path.join(srcDir, entry.name);
    const distPath = path.join(distDir, entry.name);
    const relPath  = relBase ? relBase + '/' + entry.name : entry.name;

    if (entry.isDirectory()) {
      obfuscateDir(srcPath, distPath, relPath);
      continue;
    }

    if (!entry.name.endsWith('.js')) continue;
    if (SKIP_OBFUSCATION.has(relPath)) {
      console.log('  skip   ' + relPath);
      continue;
    }

    try {
      const src  = fs.readFileSync(srcPath, 'utf8');
      const out  = JavaScriptObfuscator.obfuscate(src, OBFUSCATOR_OPTIONS).getObfuscatedCode();
      fs.writeFileSync(distPath, out, 'utf8');

      const before = Buffer.byteLength(src, 'utf8');
      const after  = Buffer.byteLength(out, 'utf8');
      const pct    = Math.round((after / before) * 100);
      console.log('  obfusc ' + relPath + ' (' + before + 'B → ' + after + 'B, ' + pct + '%)');
    } catch (err) {
      console.error('  ERROR  ' + relPath + ': ' + err.message);
      // On error, copy original — don't break the build
      fs.copyFileSync(srcPath, distPath);
    }
  }
}

console.log('\n[build] Copying public/ → dist/');
copyDir(SRC, DIST);

console.log('[build] Obfuscating JS files...');
obfuscateDir(
  path.join(SRC, 'js'),
  path.join(DIST, 'js'),
  'js'
);

console.log('[build] Done. Obfuscated output in dist/\n');
