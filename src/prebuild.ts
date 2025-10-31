import fs from 'node:fs/promises';
import configEmbed from './utils/configEmbed.js';

const packageJsonData = JSON.parse(await fs.readFile('../package.json', 'utf-8'));
packageJsonData.name = configEmbed.APPLICATION_NAME;
packageJsonData.version = configEmbed.VERSION_NUMBER;
await fs.writeFile('../package.json', JSON.stringify(packageJsonData, null, 2), 'utf-8');
