import * as os from 'os';
import { PerformanceObserver, constants } from 'perf_hooks';
import * as v8 from 'v8';
import { byteToMegabytes } from '.';
import { ReporterData, ReporterOptions, NodejsMonitorOptions } from '../types';
import { join } from 'path';

const STATIC_PATH_DEFAULT = join(process.cwd(), './dist/public/');

const { GCLoad } = require('./nodejs-native-gc-load')
const gcLoad = new GCLoad();

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
      gc_load: gcLoad.load(),
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

  gcLoad.start();
  obs.observe({ entryTypes: ['gc'], buffered: false });

  return () =>{
    obs.disconnect()
    gcLoad.stop()
  };
}

export function memoryMonitor({reporter}: {reporter: (arg0: ReporterData, arg1: ReporterOptions) => void}): void {
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
