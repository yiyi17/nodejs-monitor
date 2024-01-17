const {memoryMonitor} = require('../dist/utils/memory-monitor')

function makeArray() {
  const arr = []
  for(let i = 0; i < 10000; i++) {
    arr.push(arr)
  }
  return arr
}

makeArray()


// 内存、gc 监控
memoryMonitor({
  reporter: function (data) {
    // eslint-disable-next-line no-console
    console.log(data);
  } // 基于韦伯进行上报，上报类型 `nodejs_monitor_gc` `nodejs_monitor`，支持自定义 reporter
});