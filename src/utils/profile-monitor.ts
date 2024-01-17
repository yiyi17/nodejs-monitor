import * as fs from 'fs';
import { join } from 'path';

import v8Profiler from 'v8-profiler-next';
import { NodejsMonitorOptions, } from '../types';


const CPUPROFILE_TITLE = 'main.cpuprofile';
const STATIC_PATH_DEFAULT = join(process.cwd(), './dist/public/');
const PROFILE_TIME_DEFAULT = 3 * 60 * 1000;


let v8ProfileTimer: NodeJS.Timeout | undefined = undefined;
let v8ProfileCountTimer: NodeJS.Timeout | undefined = undefined;
let timeCount = 0;

export async function getV8Profile(
  options?: Pick<NodejsMonitorOptions, 'TIME' | 'STATIC_PATH' | 'server'>
): Promise<string> {
  const {
    TIME = PROFILE_TIME_DEFAULT,
    STATIC_PATH = STATIC_PATH_DEFAULT,
    server
  } = options || {};

  // 如果没有定时器，或者 timeCount 大于TIME,表示本次已经采集完成。需要重新赋值
  if (!v8ProfileCountTimer || timeCount >= TIME) {
    timeCount = 0;
    v8ProfileCountTimer = setInterval(() => {
      timeCount += 1000;
      if (timeCount >= TIME) {
        clearInterval(v8ProfileCountTimer);
        v8ProfileCountTimer = undefined;
      }
    }, 1000);
  }

  if (v8ProfileTimer) {
    return `Profile 生成中，请稍后重试,剩余时长 ${Math.floor(
      (TIME - timeCount) / 1000
    )} 秒`;
  }

  const v8ProfileFn = () => {
    // set generateType 1 to generate new format for cpuprofile
    // to be compatible with cpuprofile parsing in vscode.
    v8Profiler.setGenerateType(1);
    // ex. 3 mins cpu profile
    v8Profiler.startProfiling(CPUPROFILE_TITLE, true);

    v8ProfileTimer = setTimeout(() => {
      const profile = v8Profiler.stopProfiling(CPUPROFILE_TITLE);
      profile.export((error, result) => {
        if (error) {
          // eslint-disable-next-line no-console
          console.log(error);
          return;
        }
        const mainProfile = join(STATIC_PATH, CPUPROFILE_TITLE);

        // 判断文件夹是不是存在
        if (!fs.existsSync(STATIC_PATH)) {
          fs.mkdirSync(STATIC_PATH);
        }
        fs.existsSync(mainProfile) && fs.unlinkSync(mainProfile);
        fs.writeFileSync(mainProfile, result || '');
        profile.delete();
        clearTimeout(v8ProfileTimer);
        v8ProfileTimer = undefined;
      });
      // 采集 3 分钟的数据, 3 * 60 * 1000
    }, TIME);
  };
  if (!!server) {
    // 实现一个路由的创建
  } else {
    v8ProfileFn();
  }
  return `${STATIC_PATH}${CPUPROFILE_TITLE}`;
}
