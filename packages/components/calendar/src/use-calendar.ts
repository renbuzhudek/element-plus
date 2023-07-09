import { computed, ref, useSlots } from 'vue'
import dayjs from 'dayjs'
import { useDeprecated, useLocale } from '@element-plus/hooks'
import { debugWarn } from '@element-plus/utils'
import { INPUT_EVENT, UPDATE_MODEL_EVENT } from '@element-plus/constants'

import type { ComputedRef, SetupContext } from 'vue'
import type { Dayjs } from 'dayjs'
import type { CalendarDateType, CalendarEmits, CalendarProps } from './calendar'
/** 相邻月份 ，传入的 starts是一周的开始，end是一周的结束*/
const adjacentMonth = (start: Dayjs, end: Dayjs): [Dayjs, Dayjs][] => {
  const firstMonthLastDay = start.endOf('month') // 开始时间所在月份的最后一天
  const lastMonthFirstDay = end.startOf('month') // 结束时间所在月份的第一天

  // Whether the last day of the first month and the first day of the last month is in the same week
  // 判断是否在同一周
  const isSameWeek = firstMonthLastDay.isSame(lastMonthFirstDay, 'week')
  //结束月份开始时间： 如果在同一周，结束月份的开始时间增加一周的日期，否则不增加
  const lastMonthStartDay = isSameWeek
    ? lastMonthFirstDay.add(1, 'week')
    : lastMonthFirstDay
  // 返回2个月份的数组
  const arr: [Dayjs, Dayjs][] = [
    [start, firstMonthLastDay], //开始时间到所在月份最后一天
    [lastMonthStartDay.startOf('week'), end], // 结束月份开始时间的周一到结束时间
  ]
  // new Date(2023, 6, 28), new Date(2023, 7, 2) 打印值： [[2023-07-23,2023-07-31],[2023-08-06, 2023-08-05]]
  //第二组数据在rows里面 currentMonthRange.length=0,其实只要出现是在同一周的情况，那么start和end就是头和尾，那么第二组数据的开始时间就是下个周一，比end大一天，
  // 因此 end.date() - start.date() + 1 === 0,所以 currentMonthRange.length= 0
  // console.log('adjacentMonth', arr)
  return arr
}
/** 根据起始时间，得到连续三个月 */
const threeConsecutiveMonth = (start: Dayjs, end: Dayjs): [Dayjs, Dayjs][] => {
  const firstMonthLastDay = start.endOf('month') // 开始时间所在月份最后一天
  const secondMonthFirstDay = start.add(1, 'month').startOf('month') // 开始时间下个月1号

  // Whether the last day of the first month and the second month is in the same week
  // 第二个月开始时间：第一个月最后一天跟第二个月第一天如果在同一周，取第二个月第一天加7天
  const secondMonthStartDay = firstMonthLastDay.isSame(
    secondMonthFirstDay,
    'week'
  )
    ? secondMonthFirstDay.add(1, 'week')
    : secondMonthFirstDay
  // 第二个月最后一天
  const secondMonthLastDay = secondMonthStartDay.endOf('month')
  const lastMonthFirstDay = end.startOf('month') //第三个月的第一天： 结束时间当月的第一天

  // Whether the last day of the second month and the last day of the last month is in the same week
  //第三个月开始时间： 第二个月最后一天跟第三个月第一天如果在同一周，取第三个月加7天
  const lastMonthStartDay = secondMonthLastDay.isSame(lastMonthFirstDay, 'week')
    ? lastMonthFirstDay.add(1, 'week')
    : lastMonthFirstDay

  return [
    [start, firstMonthLastDay], // 开始时间至第一个月最后一天
    [secondMonthStartDay.startOf('week'), secondMonthLastDay], // 第二个月开始时间的周一 至 第二个月最后一天
    [lastMonthStartDay.startOf('week'), end], // 最后一个月开始时间的周一 至最后一天
  ]
}

export const useCalendar = (
  props: CalendarProps,
  emit: SetupContext<CalendarEmits>['emit'],
  componentName: string
) => {
  const slots = useSlots()
  const { lang } = useLocale()

  const selectedDay = ref<Dayjs>()
  const now = dayjs().locale(lang.value)
  /** 真正选中值 */
  const realSelectedDay = computed<Dayjs | undefined>({
    get() {
      if (!props.modelValue) return selectedDay.value
      return date.value
    },
    set(val) {
      if (!val) return
      selectedDay.value = val
      const result = val.toDate()

      emit(INPUT_EVENT, result)
      emit(UPDATE_MODEL_EVENT, result)
    },
  })

  // if range is valid, we get a two-digit array
  const validatedRange = computed(() => {
    if (!props.range) return []
    const rangeArrDayjs = props.range.map((_) => dayjs(_).locale(lang.value))
    const [startDayjs, endDayjs] = rangeArrDayjs
    if (startDayjs.isAfter(endDayjs)) {
      debugWarn(componentName, 'end time should be greater than start time')
      return []
    }
    if (startDayjs.isSame(endDayjs, 'month')) {
      // same month
      return calculateValidatedDateRange(startDayjs, endDayjs)
    } else {
      // two months
      if (startDayjs.add(1, 'month').month() !== endDayjs.month()) {
        debugWarn(
          componentName,
          'start time and end time interval must not exceed two months'
        )
        return []
      }
      return calculateValidatedDateRange(startDayjs, endDayjs)
    }
  })
  /**  date几个可能值：1. 双向绑定得值：props.modelValue, 2.选中值： selectedDay 3. 现在 this.now 4. 验证过的范围值的开始值 */
  const date: ComputedRef<Dayjs> = computed(() => {
    if (!props.modelValue) {
      return (
        realSelectedDay.value ||
        (validatedRange.value.length ? validatedRange.value[0][0] : now)
      )
    } else {
      return dayjs(props.modelValue).locale(lang.value)
    }
  })
  const prevMonthDayjs = computed(() => date.value.subtract(1, 'month').date(1)) // 上个月1号
  const nextMonthDayjs = computed(() => date.value.add(1, 'month').date(1)) // 下个月1号
  const prevYearDayjs = computed(() => date.value.subtract(1, 'year').date(1)) // 上一年date.value的月份的1号
  const nextYearDayjs = computed(() => date.value.add(1, 'year').date(1)) // 下一年date.value的月份的1号

  // https://github.com/element-plus/element-plus/issues/3155
  // Calculate the validate date range according to the start and end dates 根据开始日期和结束日期计算验证日期范围
  const calculateValidatedDateRange = (
    startDayjs: Dayjs,
    endDayjs: Dayjs
  ): [Dayjs, Dayjs][] => {
    const firstDay = startDayjs.startOf('week') // 开始时间所在周的第一天,取决于国际化设置,查看 dayjs.localeData().firstDayOfWeek()
    const lastDay = endDayjs.endOf('week') // 结束时间所在周的最后一天, 取决于国际化设置
    const firstMonth = firstDay.get('month') //  开始时间所在周的第一天的月份
    const lastMonth = lastDay.get('month') // 结束时间所在周的最后一天的月份

    // Current mouth 如果是在同一个月，返回数组
    if (firstMonth === lastMonth) {
      return [[firstDay, lastDay]]
    }
    // Two adjacent months 如果是相邻两个月，返回调用相邻函数处理
    else if ((firstMonth + 1) % 12 === lastMonth) {
      return adjacentMonth(firstDay, lastDay)
    }
    // Three consecutive months (compatible: 2021-01-30 to 2021-02-28) 否则如果是三个月，返回调用三个月函数处理， 如: 11-12-1, 10-11-12
    else if (
      firstMonth + 2 === lastMonth ||
      (firstMonth + 1) % 11 === lastMonth
    ) {
      return threeConsecutiveMonth(firstDay, lastDay)
    }
    // Other cases
    else {
      debugWarn(
        componentName,
        'start time and end time interval must not exceed two months'
      )
      return []
    }
  }
  /** 选中日期回调 */
  const pickDay = (day: Dayjs) => {
    realSelectedDay.value = day
  }
  /** 选择日期函数 */
  const selectDate = (type: CalendarDateType) => {
    const dateMap: Record<CalendarDateType, Dayjs> = {
      'prev-month': prevMonthDayjs.value,
      'next-month': nextMonthDayjs.value,
      'prev-year': prevYearDayjs.value,
      'next-year': nextYearDayjs.value,
      today: now,
    }

    const day = dateMap[type]

    if (!day.isSame(date.value, 'day')) {
      pickDay(day)
    }
  }
  // 废弃提示
  useDeprecated(
    {
      from: '"dateCell"',
      replacement: '"date-cell"',
      scope: 'ElCalendar',
      version: '2.3.0',
      ref: 'https://element-plus.org/en-US/component/calendar.html#slots',
      type: 'Slot',
    },
    computed(() => !!slots.dateCell)
  )

  return {
    calculateValidatedDateRange,
    date,
    realSelectedDay,
    pickDay,
    selectDate,
    validatedRange,
  }
}
