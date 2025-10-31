import audioGenerateUtils from '../utils/audioGenerate.js';

async function mainCmdHandler() {
  await audioGenerateUtils.generateMain();
}

export default mainCmdHandler;
