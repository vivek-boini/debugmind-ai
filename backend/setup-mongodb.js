/**
 * MongoDB Integration Setup Script
 * 
 * Run this script to set up the MongoDB integration:
 * node setup-mongodb.js
 * 
 * This will:
 * 1. Create necessary directories
 * 2. Install required packages
 */

import { mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const directories = [
  'models',
  'config',
  'middleware'
];

console.log('🚀 Setting up MongoDB integration for DebugMind AI\n');

// Create directories
console.log('📁 Creating directories...');
directories.forEach(dir => {
  const fullPath = join(__dirname, dir);
  if (!existsSync(fullPath)) {
    mkdirSync(fullPath, { recursive: true });
    console.log(`  ✅ Created: ${dir}/`);
  } else {
    console.log(`  ⏭️  Exists: ${dir}/`);
  }
});

console.log('\n📦 Required packages:');
console.log('  npm install mongoose bcryptjs jsonwebtoken uuid --save');

console.log('\n🔧 Required environment variables (add to .env):');
console.log('  MONGODB_URI=mongodb://localhost:27017/debugmind');
console.log('  JWT_SECRET=your-secret-key-here');
console.log('  JWT_EXPIRES_IN=7d');

console.log('\n✅ Setup complete! Now run: npm install mongoose bcryptjs jsonwebtoken uuid --save');
