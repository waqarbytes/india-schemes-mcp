import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');

const srcData = resolve(root, 'data/schemes.json');
const destDir = resolve(root, 'dist/data');
const destData = resolve(destDir, 'schemes.json');

if (existsSync(srcData)) {
  mkdirSync(destDir, { recursive: true });
  copyFileSync(srcData, destData);
  console.log('✅ schemes.json copied to dist/data/schemes.json');
} else {
  console.warn('⚠️ Warning: data/schemes.json not found at', srcData);
}
