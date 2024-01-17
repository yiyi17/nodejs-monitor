import {
  gcMonitor,
  getHeapSnapshot,
  memoryMonitor as memoryMonitorFn,
} from "./utils/memory-monitor";
import {getV8Profile} from './utils/profile-monitor'
import { NodejsMonitorOptions } from "./types";
import postWeberJSON from "./utils/weber";

export * from  "./utils/memory-monitor";
export * from './utils/profile-monitor';
export * from "./types";
export * from "./utils/weber";

export function memoryMonitor(
  options?: Pick<NodejsMonitorOptions, "reporter">
): void {
  const { reporter = postWeberJSON } = options || {};
  memoryMonitorFn(reporter); // 内存监控
  gcMonitor({reporter});
}

// TODO:一行代码进行监控,开发中
export function nodejsMonitor(options?: Partial<NodejsMonitorOptions>): void {
  const {
    reporter = postWeberJSON,
    v8Profile = true,
    heapSnapshot = true,
  } = options || {};

  memoryMonitor({ reporter }); // 内存监控

  if (v8Profile) {
    getV8Profile(options); // V8 profiler监控
  }

  if (heapSnapshot) {
    getHeapSnapshot(options); // heapSnapshot 监控
  }
}

// nodejsMonitor({
//   reporter: function (data) {
//     // eslint-disable-next-line no-console
//     console.log(data);
//   }, // 基于韦伯进行上报，上报类型 `nodejs_monitor_gc` `nodejs_monitor`，支持自定义 reporter
//   TIME: 3 * 60 * 1000, // 收集 v8Profile 时长。默认 3 分钟
//   STATIC_PATH: '<root>/public', // 文件存储的路径，会存在服务中, 默认 join(process.cwd(), '../public')
//   v8Profile: true, // 是否开启 profile，默认 true
//   heapSnapshot: true, // 是否开启 heapSnapshot，默认 true
//   server: {
//     instance: null, // koa app,默认是 midway 实例
//     baseRouter: '/bff' // 路由 base path,默认是 '/bff'，${baseRouter}/__nodejs__/cpuprofile,
//   } // 是否开启服务，默认 false,
// });
