const fs = require('fs');
const path = require('path');

// Minimal 1x1 or simple PNG buffer generator for icons
function createSimplePng(size, r, g, b) {
  // SVG is cleaner and can be converted or used directly
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="6" fill="#1a73e8"/>
    <path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L14 2Z" fill="#ffffff" stroke="#ffffff" stroke-width="0.5" stroke-linejoin="round"/>
  </svg>`;
}

const dir = path.join(__dirname, 'icons');
fs.writeFileSync(path.join(dir, 'icon.svg'), createSimplePng(128));
console.log('Icon SVG written');
