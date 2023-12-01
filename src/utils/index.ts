/**
 *
 * @param num
 * @returns
 * @description byte 转 MB
 */
export function byteToMegabytes(num: number): number {
  return +(num / 1024 / 1024).toFixed(2);
}

/**
 *
 * @param num
 * @returns
 * @description ns 转 ms
 */
export function nsToMs(num: number): number {
  return +(num / 1000000).toFixed(2);
}
