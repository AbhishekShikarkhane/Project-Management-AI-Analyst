const fs = require('fs');
const path = require('path');

const files = ['setup.bat', 'run.bat', 'powershell.bat'];
const root = path.resolve(__dirname, '..');

for (const file of files) {
  const filePath = path.join(root, file);
  if (fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const crlf = raw.replace(/\r?\n/g, '\r\n');
    fs.writeFileSync(filePath, crlf, 'utf8');
    console.log(`[OK] Saved ${file} with Windows CRLF line endings.`);
  }
}
