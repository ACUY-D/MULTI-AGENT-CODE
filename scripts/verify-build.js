#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Verificando build del proyecto MCP Dev Orchestrator...\n');

const requiredFiles = ['dist/index.js', 'README.md', 'LICENSE', 'package.json'];

let hasErrors = false;

requiredFiles.forEach((file) => {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file}`);
  } else {
    console.error(`❌ Missing: ${file}`);
    hasErrors = true;
  }
});

// Check for additional important files
const additionalChecks = [
  { file: 'dist/tools/index.js', required: false },
  { file: 'dist/resources/index.js', required: false },
  { file: 'dist/prompts/index.js', required: false },
  { file: 'dist/cli/index.js', required: false },
  { file: 'CHANGELOG.md', required: true },
];

console.log('\n📋 Additional checks:\n');

additionalChecks.forEach(({ file, required }) => {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file}`);
  } else if (required) {
    console.error(`❌ Missing (required): ${file}`);
    hasErrors = true;
  } else {
    console.warn(`⚠️  Missing (optional): ${file}`);
  }
});

// Check package.json fields
console.log('\n📦 Package.json validation:\n');

try {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(packageJsonContent);

  const requiredFields = [
    'name',
    'version',
    'description',
    'main',
    'types',
    'license',
    'author',
    'repository',
    'keywords',
  ];

  requiredFields.forEach((field) => {
    if (packageJson[field]) {
      console.log(`✅ ${field}: ${typeof packageJson[field] === 'object' ? 'defined' : packageJson[field]}`);
    } else {
      console.error(`❌ Missing field: ${field}`);
      hasErrors = true;
    }
  });

  // Check if version follows semver
  const versionRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;
  if (!versionRegex.test(packageJson.version)) {
    console.error(`❌ Invalid version format: ${packageJson.version}`);
    hasErrors = true;
  }
} catch (error) {
  console.error('❌ Failed to read or parse package.json:', error.message);
  hasErrors = true;
}

// Check build output size
console.log('\n📊 Build size analysis:\n');

function getFileSizeInKB(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return (stats.size / 1024).toFixed(2);
  } catch {
    return null;
  }
}

const buildFiles = [
  'dist/index.js',
  'dist/cli/index.js',
  'dist/tools/index.js',
  'dist/resources/index.js',
  'dist/prompts/index.js',
];

let totalSize = 0;
buildFiles.forEach((file) => {
  const fullPath = path.join(process.cwd(), file);
  const size = getFileSizeInKB(fullPath);
  if (size) {
    totalSize += Number.parseFloat(size);
    console.log(`📄 ${file}: ${size} KB`);
  }
});

if (totalSize > 0) {
  console.log(`\n📦 Total build size: ${totalSize.toFixed(2)} KB`);

  if (totalSize > 5000) {
    console.warn('⚠️  Warning: Build size exceeds 5MB. Consider optimizing dependencies.');
  }
}

// Final result
console.log('\n' + '='.repeat(50));

if (hasErrors) {
  console.error('\n❌ Build verification failed!');
  console.error('Please fix the issues above before publishing.\n');
  process.exit(1);
} else {
  console.log('\n✅ Build verification passed!');
  console.log('Ready for publishing.\n');
  process.exit(0);
}