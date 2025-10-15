const fs = require('fs');
const path = require('path');

const { toJSON } = require('@e-co/config');

const outputPath = path.resolve(__dirname, '..', 'public', 'runtime-config.json');

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(toJSON(), null, 2));
