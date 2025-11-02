import fs from 'node:fs';
import configEmbed from './utils/configEmbed.js';

const packageJsonData = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
packageJsonData.name = configEmbed.APPLICATION_NAME;
packageJsonData.version = configEmbed.VERSION_NUMBER;
fs.writeFileSync('package.json', JSON.stringify(packageJsonData, null, 2), 'utf-8');
