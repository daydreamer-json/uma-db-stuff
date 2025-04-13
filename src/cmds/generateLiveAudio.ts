import argvUtils from '../utils/argv';
import audioGenerateUtils from '../utils/audioGenerate';

async function mainCmdHandler() {
  await audioGenerateUtils.generateMain();
}

export default mainCmdHandler;
