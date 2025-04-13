import bun from 'bun';
import configEmbed from './src/utils/configEmbed';

const packageJsonData = await bun.file('package.json').json();
packageJsonData.name = configEmbed.APPLICATION_NAME;
packageJsonData.version = configEmbed.VERSION_NUMBER;
await bun.write('package.json', JSON.stringify(packageJsonData, null, 2));
