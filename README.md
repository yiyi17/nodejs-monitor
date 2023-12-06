# nodejs APM 监控

nodejs APM 服务监控

## 快速开始

参数均为非必传，未传入则使用默认值

### 内存监控

```js
import {
  memoryMonitor
  getV8Profile,
  getHeapSnapshot
} from '@pvjs/nodejs-monitor';

// 内存、gc 监控
memoryMonitor({
  reporter: function (data) {
    // eslint-disable-next-line no-console
    console.log(data);
  } // 基于韦伯进行上报，上报类型 `nodejs_monitor_gc` `nodejs_monitor`，支持自定义 reporter
});

```

### 诊断接入

自定义路由接入，在项目的 controller 中调用下面的方法

```js
// 性能看板.cpuprofile
getV8Profile({
  TIME: 3 * 60 * 1000, // 收集 v8Profile 时长。默认 3 分钟
  STATIC_PATH: '<root>/public', // 文件存储的路径，会存在服务中, 默认 join(process.cwd(), '../public')
});

// 内存快照
getHeapSnapshot({
  STATIC_PATH: '<root>/public', // 文件存储的路径，会存在服务中, 默认 join(process.cwd(), '../public')
});
```

## 指标看板

可以使用指标服务

## v8Profile 使用

1、访问 `router`,生成 `main.cpuprofile`文件

2、wget `${STATIC_PATH}/main.cpuprofile` 获取线上 .`cpuprofile` 文件，然后基于 vscode 进行性能分析,`Flame Chart Visualizer for JavaScript Profiles`，下载 vscode 插件可以直接生成火焰图

注意 📢：请确保 `baseRouter` 在 `nginx` 配置指向当前的服务

### 示例

[profile](./public/profile.png) [profile flame](./public/profile-flame.png)

## heapSnapshot 使用

1、访问 `router`,生成 `heapSnapshot` 文件

2、wget `${STATIC_PATH}/main.heapSnapshot` 获取线上 `.heapSnapshot` 文件，然后使用 `Chrome Memory` 功能，加载生成的文件

注意 📢：

1、请确保 `baseRouter` 在 `nginx` 配置指向当前的服务

2、等到服务人少的时候进行收集文件，因为生成 `heapSnapshot` 可能比较耗时，文件可能会比较大，超出系统存储上线（特别是本身申请的内存就比较小的服务，可能需要手动清理生成的 `heapSnapshot` 文件）

## 指标说明

### 内存相关指标说明

#### 堆内存

- rss：常驻内存，node 进程分配的总内存大小
- external：v8 管理的 C++所占用的内存大小
- arrayBuffers：分配给 ArrayBuffer 的内存大小
- heapTotal：v8 申请的堆内存大小
- heapUsed：v8 已使用的堆内存大小

#### 堆内存详情

- ready_only_space：只读空间
- old_space：老生代空间，用来存放 New Space 晋升的对象
- code_space: 存放 v8 JIT 编译后的可执行代码
- map_space：：存放 Object 指向的隐藏类的指针对象，隐藏类指针是 v8 根据运行时记录下的对象布局结构，用于快速访问对象成员
- large_object_space：用于存放大于 1MB 而无法分配到页的对象
- code_large_object_space：代码大对象空间
- new_large_object_space：新生代大对象空间
- new_space:新生代空间，用来存放一些生命周期比较短的对象数据

#### 其他

- number_of_native_contextsnative_context 的值是当前活动的顶级上下文的数量。该数字随着时间的推移而增加表明存在内存泄漏。
- number_of_detached_contextsdetached_context 的值是已分离但尚未进行垃圾收集的上下文的数量。该数字非零表示存在潜在的内存泄漏。
- heap_size_limit: 就是老生代可以使用的最大内存

### GC 监控

- gc_ts: 1700642047578587,GC 发生的时间，精度可能需要提高到 ms 级别，而不是 second 级别
- gcScavengeCount: 23, 清除数量, V8 新生代内存中垃圾回收使用 Scavenge 算法。
- gcScavengeTime: 33933875, 清除耗时 ns，1ns = 十亿分之一秒，1 纳秒（ns）等于 0.000001 毫秒（ms）
- gcMarkSweepCompactCount: 3,gc 标记扫描压缩计数
- gcMarkSweepCompactTime: 19564916, gc 标记扫描压缩时间
- gcIncrementalMarkingCount: 6, gc 增量标记计数
- gcIncrementalMarkingTime: 2438334, gc 增量标记时间
- gcProcessWeakCallbacksCount: 3, gc 进程弱回调计数
- gcProcessWeakCallbacksTime: 24542, gc 进程弱回调时间
- gc_time: 3474250 gc 时间

## 更多材料

[Nodejs APM 监控](https://zhuanlan.zhihu.com/p/670656224)
