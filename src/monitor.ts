import * as fs from 'fs';
import memwatch from 'node-memwatch-new';
import * as os from 'os';
import { join } from 'path';
import * as v8 from 'v8';
import v8Profiler from 'v8-profiler-next';
import { NodejsMonitorOptions, ReporterData, ReporterOptions } from './types';
import { byteToMegabytes, nsToMs } from './utils';

const CPUPROFILE_TITLE = 'main.cpuprofile';
const STATIC_PATH_DEFAULT = join(process.cwd(), './dist/public/');
const PROFILE_TIME_DEFAULT = 3 * 60 * 1000;

export function gcMonitor(
  reporter: (arg0: ReporterData, arg1: ReporterOptions) => void
): void {
  memwatch.on('stats', function (stats: any) {
    const {
      gc_ts,
      gc_time,
      gcScavengeCount,
      gcScavengeTime,
      gcMarkSweepCompactCount,
      gcMarkSweepCompactTime,
      gcIncrementalMarkingCount,
      gcIncrementalMarkingTime,
      gcProcessWeakCallbacksCount,
      gcProcessWeakCallbacksTime
    } = stats;

    reporter(
      {
        type: 'nodejs_monitor_gc',
        base: {
          env: process.env.ZAE_ENV || 'local',
          platform: 'nodejs',
          project: process.env.ZAE_APP_NAME || 'nodejs-local'
        },
        data: {
          gc_ts: Math.floor(gc_ts / 1000),
          gc_time: nsToMs(gc_time),
          gcScavengeCount,
          gcScavengeTime: nsToMs(gcScavengeTime),
          gcMarkSweepCompactCount,
          gcMarkSweepCompactTime: nsToMs(gcMarkSweepCompactTime),
          gcIncrementalMarkingCount,
          gcIncrementalMarkingTime: nsToMs(gcIncrementalMarkingTime),
          gcProcessWeakCallbacksCount,
          gcProcessWeakCallbacksTime: nsToMs(gcProcessWeakCallbacksTime)
        }
      },
      {
        dev: process.env.NODE_ENV === 'local'
      }
    );
  });

  // 这个 info 类似于这个数据结构
  /**
     * {  start: Fri, 29 Jun 2012 14:12:13 GMT,
          end: Fri, 29 Jun 2012 14:12:33 GMT,
          growth: 67984,
          reason: 'heap growth over 5 consecutive GCs (20s) - 11.67 mb/hr' 
       }
     */
  // 如果经过连续的5次垃圾回收后，内存仍没有被释放，意味有内存泄漏，node-memwatch会触发leak事件。
  memwatch.on('leak', function (info: any) {
    // eslint-disable-next-line no-console
    console.log('leak:');
    // eslint-disable-next-line no-console
    console.log(info);
  });
}

export function memoryMonitor(
  reporter: (arg0: ReporterData, arg1: ReporterOptions) => void
): void {
  function getMemory() {
    // 监听内存
    const sysTotal = os.totalmem();
    const { heapUsed, heapTotal, rss, arrayBuffers, external } =
      process.memoryUsage();
    // v8堆内存
    const v8MemoryAnalysis = v8.getHeapSpaceStatistics();
    const {
      number_of_native_contexts,
      number_of_detached_contexts,
      heap_size_limit
    } = v8.getHeapStatistics();

    const data = {
      rss: byteToMegabytes(rss),
      sysTotal: byteToMegabytes(sysTotal),
      external: byteToMegabytes(external),
      arrayBuffers: byteToMegabytes(arrayBuffers),
      heapTotal: byteToMegabytes(heapTotal),
      heapUsed: byteToMegabytes(heapUsed),
      ...v8MemoryAnalysis.map((item) => {
        return {
          space_name: item.space_name,
          space_used_size: byteToMegabytes(item.space_used_size)
        };
      }),
      number_of_native_contexts: number_of_native_contexts,
      number_of_detached_contexts: number_of_detached_contexts,
      heap_size_limit: byteToMegabytes(heap_size_limit)
    };
    reporter(
      {
        type: 'nodejs_monitor',
        base: {
          env: process.env.ZAE_ENV || 'local',
          platform: 'nodejs',
          project: process.env.ZAE_APP_NAME || 'nodejs-local'
        },
        data
      },
      {
        dev: process.env.NODE_ENV === 'local'
      }
    );
  }
  const TIMER_TIME = 5000;
  // 执行定时器，定时执行下面的代码
  // eslint-disable-next-line prefer-const
  let timer;
  clearInterval(timer);
  timer = setInterval(getMemory, TIMER_TIME);
}

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
  return `${STATIC_PATH}${CPUPROFILE_TITLE} `;
}

export function getHeapSnapshot(
  options?: Pick<NodejsMonitorOptions, 'STATIC_PATH' | 'server'>
): void {
  const { STATIC_PATH = STATIC_PATH_DEFAULT, server = false } = options || {};
  if (!!server) {
    // 实现一个路由的创建
  } else {
    // 开发环境会阻塞主进程，生产环境不会
    v8.writeHeapSnapshot(join(STATIC_PATH, 'main.heapsnapshot'));
  }
}
