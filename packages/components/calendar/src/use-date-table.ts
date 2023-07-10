import { computed } from 'vue'
import dayjs from 'dayjs'
import localeData from 'dayjs/plugin/localeData.js'
import { useLocale } from '@element-plus/hooks'
import { rangeArr } from '@element-plus/components/time-picker'
import { WEEK_DAYS } from '@element-plus/constants'
import { getMonthDays, getPrevMonthLastDays, toNestedArr } from './date-table'

import type { SetupContext } from 'vue'
import type { Dayjs } from 'dayjs'
import type {
  CalendarDateCell,
  CalendarDateCellType,
  DateTableEmits,
  DateTableProps,
} from './date-table'

export const useDateTable = (
  props: DateTableProps,
  emit: SetupContext<DateTableEmits>['emit']
) => {
  dayjs.extend(localeData)
  // https://day.js.org/docs/en/i18n/locale-data 获取国际化配置中，一周的第一天是周几，默认值是周日 0
  const firstDayOfWeek: number = dayjs.localeData().firstDayOfWeek()

  console.log('use-date-table firstDayOfWeek', firstDayOfWeek)
  const { t, lang } = useLocale()
  const now = dayjs().locale(lang.value) // 当前时间
  // 是否范围模式
  const isInRange = computed(() => !!props.range && !!props.range.length)
  // 二维单元格数组
  const rows = computed(() => {
    let days: CalendarDateCell[] = []
    if (isInRange.value) {
      // 如果是范围模式
      const [start, end] = props.range! // 取出开始和结束时间，得到当前月份的天数组
      const currentMonthRange: CalendarDateCell[] = rangeArr(
        end.date() - start.date() + 1
      ).map((index) => ({
        text: start.date() + index,
        type: 'current',
      }))

      let remaining = currentMonthRange.length % 7
      remaining = remaining === 0 ? 0 : 7 - remaining
      // 取7的余数，得到下个月需要渲染的天
      const nextMonthRange: CalendarDateCell[] = rangeArr(remaining).map(
        (_, index) => ({
          text: index + 1,
          type: 'next',
        })
      )
      days = currentMonthRange.concat(nextMonthRange)
    } else {
      // 否则不是范围模式
      const firstDay = props.date.startOf('month').day() // 获取绑定值的月份第一天是星期几
      const prevMonthDays: CalendarDateCell[] = getPrevMonthLastDays(
        props.date,
        (firstDay - firstDayOfWeek + 7) % 7
      ).map((day) => ({
        text: day,
        type: 'prev',
      }))
      // 获取当前月份的天数数组
      const currentMonthDays: CalendarDateCell[] = getMonthDays(props.date).map(
        (day) => ({
          text: day,
          type: 'current',
        })
      )
      days = [...prevMonthDays, ...currentMonthDays]
      const remaining = 7 - (days.length % 7 || 7) // 根据上个月和当月的天数的和,取7的余数，得到应该显示的下月日期
      const nextMonthDays: CalendarDateCell[] = rangeArr(remaining).map(
        (_, index) => ({
          text: index + 1,
          type: 'next',
        })
      )
      days = days.concat(nextMonthDays)
    }
    return toNestedArr(days)
  })
  // 表头部分
  const weekDays = computed(() => {
    const start = firstDayOfWeek
    if (start === 0) {
      return WEEK_DAYS.map((_) => t(`el.datepicker.weeks.${_}`))
    } else {
      return WEEK_DAYS.slice(start)
        .concat(WEEK_DAYS.slice(0, start))
        .map((_) => t(`el.datepicker.weeks.${_}`))
    }
  })
  /** 根据类型type= prev | current | next, 获取日期对象 */
  const getFormattedDate = (day: number, type: CalendarDateCellType): Dayjs => {
    switch (type) {
      case 'prev':
        return props.date.startOf('month').subtract(1, 'month').date(day)
      case 'next':
        return props.date.startOf('month').add(1, 'month').date(day)
      case 'current':
        return props.date.date(day)
    }
  }
  /** 选择单元格回调 */
  const handlePickDay = ({ text, type }: CalendarDateCell) => {
    const date = getFormattedDate(text, type)
    emit('pick', date)
  }
  /** 返回单元格插槽数据  */
  const getSlotData = ({ text, type }: CalendarDateCell) => {
    const day = getFormattedDate(text, type)
    return {
      isSelected: day.isSame(props.selectedDay),
      type: `${type}-month`,
      day: day.format('YYYY-MM-DD'),
      date: day.toDate(),
    }
  }

  return {
    now,
    isInRange,
    rows,
    weekDays,
    getFormattedDate,
    handlePickDay,
    getSlotData,
  }
}
