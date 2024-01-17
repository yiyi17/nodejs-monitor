const {gcMonitor} = require('../dist/utils/memory-monitor')

function makeArray() {
  const arr = []
  for(let i = 0; i < 100000; i++) {
    arr.push(arr)
  }
  return arr
}

setInterval(() => {
  console.log(1);
  makeArray()
  
},2000)


// 内存、gc 监控
gcMonitor({
  reporter: function (data) {
    // eslint-disable-next-line no-console
    console.log(data);
  } // 基于韦伯进行上报，上报类型 `nodejs_monitor_gc` `nodejs_monitor`，支持自定义 reporter
});