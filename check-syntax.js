#!/usr/bin/env node
/**
 * Syntax checker for mvp.html (and any single-file React/Babel HTML).
 * Extracts <script type="text/babel"> blocks and parses each with @babel/parser.
 * Exits 1 on any parse error, 0 on success.
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');

const file = process.argv[2];
if (!file) {
  console.error('Usage: node check-syntax.js <file.html>');
  process.exit(1);
}

const abs = path.resolve(file);
if (!fs.existsSync(abs)) {
  console.error(`File not found: ${abs}`);
  process.exit(1);
}

const html = fs.readFileSync(abs, 'utf8');

// Extract all Babel/JSX script blocks
const scriptRegex = /<script[^>]+type=["']text\/babel["'][^>]*>([\s\S]*?)<\/script>/gi;
let match;
let blockIndex = 0;
let errors = [];

while ((match = scriptRegex.exec(html)) !== null) {
  blockIndex++;
  const scriptContent = match[1];
  // Compute the line offset so error lines map back to the HTML file
  const linesBefore = html.slice(0, match.index + match[0].indexOf(match[1])).split('\n').length;

  try {
    parse(scriptContent, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });
    console.log(`✅  Block ${blockIndex}: OK`);
  } catch (err) {
    const htmlLine = linesBefore + (err.loc?.line ?? 1) - 1;
    errors.push({
      block: blockIndex,
      htmlLine,
      col: err.loc?.column ?? 0,
      message: err.message,
    });
    console.error(`❌  Block ${blockIndex} — parse error at HTML line ${htmlLine}, col ${err.loc?.column ?? '?'}: ${err.reasonCode || err.message}`);
  }
}

if (blockIndex === 0) {
  console.warn('⚠️  No <script type="text/babel"> blocks found in file.');
}

if (errors.length > 0) {
  console.error(`\n${errors.length} error(s) found. Fix them and re-run.`);
  process.exit(1);
} else {
  console.log('\nAll blocks parsed successfully.');
  process.exit(0);
}
