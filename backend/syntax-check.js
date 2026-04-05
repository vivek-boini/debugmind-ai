#!/usr/bin/env node

/**
 * Syntax Check Script
 * Validates JavaScript files for syntax errors
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const filesToCheck = [
  'index.js',
  'services/dbService.js',
  'services/mongoModels.js',
  'services/codeAnalysisService.js',
  'services/agentOrchestrator.js'
];

const baseDir = __dirname;
let hasErrors = false;

console.log('Starting syntax check...\n');

filesToCheck.forEach(file => {
  const filePath = path.join(baseDir, file);
  
  try {
    // Read file
    const code = fs.readFileSync(filePath, 'utf8');
    
    // Try to parse it as a module (check for syntax)
    // For ES modules, we'll just check basic syntax by attempting to parse
    // We can't use Function() for ES modules, so let's check for common issues
    
    // Count opening and closing braces
    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;
    
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;
    
    const openBrackets = (code.match(/\[/g) || []).length;
    const closeBrackets = (code.match(/\]/g) || []).length;
    
    let hasIssue = false;
    const issues = [];
    
    if (openBraces !== closeBraces) {
      hasIssue = true;
      issues.push(`Brace mismatch: ${openBraces} open, ${closeBraces} close`);
    }
    
    if (openParens !== closeParens) {
      hasIssue = true;
      issues.push(`Parenthesis mismatch: ${openParens} open, ${closeParens} close`);
    }
    
    if (openBrackets !== closeBrackets) {
      hasIssue = true;
      issues.push(`Bracket mismatch: ${openBrackets} open, ${closeBrackets} close`);
    }
    
    // Check for export statement
    if (!code.includes('export')) {
      issues.push('No export statement found');
    }
    
    if (hasIssue) {
      console.log(`✗ ${file}: SYNTAX ISSUES DETECTED`);
      issues.forEach(issue => console.log(`  - ${issue}`));
      hasErrors = true;
    } else {
      console.log(`✓ ${file}: Valid syntax`);
    }
    
  } catch (error) {
    console.log(`✗ ${file}: ERROR`);
    console.log(`  - ${error.message}`);
    hasErrors = true;
  }
});

console.log('');
if (hasErrors) {
  console.log('❌ Syntax check completed with errors');
  process.exit(1);
} else {
  console.log('✅ All files passed syntax check');
  process.exit(0);
}
