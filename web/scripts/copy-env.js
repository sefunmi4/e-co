const fs = require('fs');
const path = require('path');
const src = path.resolve(__dirname, '../../shared/environments.json');
const dest = path.resolve(__dirname, '../public/environments.json');
fs.copyFileSync(src, dest);
