import * as fs from 'fs';
import * as os from 'os';
import { join } from 'path';
import * as v8 from 'v8';
import v8Profiler from 'v8-profiler-next';
import { NodejsMonitorOptions, ReporterData, ReporterOptions } from './types';
import { byteToMegabytes } from './utils';
import { PerformanceObserver, constants } from 'perf_hooks';

const CPUPROFILE_TITLE = 'main.cpuprofile';
const STATIC_PATH_DEFAULT = join(process.cwd(), './dist/public/');
const PROFILE_TIME_DEFAULT = 3 * 60 * 1000;

export function gcMonitor({
  reporter,
  debug = true
}: {
  reporter: (arg0: ReporterData, arg1: ReporterOptions) => void;
  debug?: boolean;
}) {
  // accumulative statistic data
  const statData = {
    gcScavengeCount: 0,
    gcScavengeTime: 0,
    gcMarkSweepCompactCount: 0,
    gcMarkSweepCompactTime: 0,
    gcIncrementalMarkingCount: 0,
    gcIncrementalMarkingTime: 0,
    gcProcessWeakCallbacksCount: 0,
    gcProcessWeakCallbacksTime: 0
  };
  const getDetailKeysName: (theKind: number) => (keyof typeof statData)[] = (
    theKind
  ) => {
    switch (theKind) {
      case constants.NODE_PERFORMANCE_GC_MINOR:
        return ['gcScavengeCount', 'gcScavengeTime'];
      case constants.NODE_PERFORMANCE_GC_MAJOR:
        return ['gcMarkSweepCompactCount', 'gcMarkSweepCompactTime'];
      case constants.NODE_PERFORMANCE_GC_INCREMENTAL:
        return ['gcIncrementalMarkingCount', 'gcIncrementalMarkingTime'];
      case constants.NODE_PERFORMANCE_GC_WEAKCB:
        return ['gcProcessWeakCallbacksCount', 'gcProcessWeakCallbacksTime'];
    }
    return [];
  };

  const obs = new PerformanceObserver((entryList) => {
    const entry = entryList.getEntries()[0];
    const { duration, startTime } = entry;
    const { kind, flag } = entry.detail as any;
    const [countKey, durationKey] = getDetailKeysName(kind);
    statData[countKey] += 1;
    statData[durationKey] += duration;
    const submitData = {
      gc_ts: Date.now(),
      gc_start_time: startTime,
      gc_time: duration,
      ...statData
    };
    reporter(
      {
        type: 'nodejs_monitor_gc',
        base: {
          env: process.env.ZAE_ENV || 'local',
          platform: 'nodejs',
          project: (process.env.ZAE_UNIT_NAME || 'nodejs-local') + '--native'
        },
        data: submitData
      },
      {
        dev: debug
      }
    );
  });

  obs.observe({ entryTypes: ['gc'], buffered: false });

  return () => obs.disconnect();
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
          project: (process.env.ZAE_UNIT_NAME || 'nodejs-local') + '--native'
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
  return `${STATIC_PATH}${CPUPROFILE_TITLE}`;
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
