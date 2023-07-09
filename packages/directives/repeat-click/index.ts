import { isFunction } from '@element-plus/utils'

import type { ObjectDirective } from 'vue'

export const REPEAT_INTERVAL = 100
export const REPEAT_DELAY = 600

export interface RepeatClickOptions {
  interval?: number
  delay?: number
  handler: (...args: unknown[]) => unknown
}
// 长按鼠标左键间隔100ms重复执行回调函数,如果100ms内鼠标弹起只执行一次
export const vRepeatClick: ObjectDirective<
  HTMLElement,
  RepeatClickOptions | RepeatClickOptions['handler']
> = {
  beforeMount(el, binding) {
    const value = binding.value
    const { interval = REPEAT_INTERVAL, delay = REPEAT_DELAY } = isFunction(
      value
    )
      ? {}
      : value

    let intervalId: ReturnType<typeof setInterval> | undefined
    let delayId: ReturnType<typeof setTimeout> | undefined

    const handler = () => (isFunction(value) ? value() : value.handler())

    const clear = () => {
      if (delayId) {
        clearTimeout(delayId)
        delayId = undefined
      }
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = undefined
      }
    }

    el.addEventListener('mousedown', (evt: MouseEvent) => {
      if (evt.button !== 0) return
      clear()
      handler()

      document.addEventListener('mouseup', () => clear(), {
        once: true,
      })

      delayId = setTimeout(() => {
        intervalId = setInterval(() => {
          handler()
        }, interval)
      }, delay)
    })
  },
}
