// frontend/src/components/DateRangePicker.tsx
import { useState, useMemo } from 'react';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, subYears } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Button } from './ui/button';
import { CalendarIcon, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';

export type DateRangePreset = 
  | 'today' 
  | 'yesterday' 
  | 'last7days' 
  | 'thisMonth' 
  | 'lastMonth' 
  | 'last3months' 
  | 'thisYear' 
  | 'lastYear' 
  | 'custom';

export type Granularity = 'hour' | 'day' | 'week' | 'month';

export interface DateRange {
  from: Date;
  to: Date;
  preset?: DateRangePreset;
  granularity?: Granularity;
}

interface PresetConfig {
  label: string;
  value: DateRangePreset;
  getRange: () => { from: Date; to: Date };
  granularity: Granularity;
}

const PRESETS: PresetConfig[] = [
  {
    label: '今天',
    value: 'today',
    getRange: () => ({
      from: startOfDay(new Date()),
      to: endOfDay(new Date()),
    }),
    granularity: 'hour',
  },
  {
    label: '昨天',
    value: 'yesterday',
    getRange: () => {
      const yesterday = subDays(new Date(), 1);
      return {
        from: startOfDay(yesterday),
        to: endOfDay(yesterday),
      };
    },
    granularity: 'hour',
  },
  {
    label: '最近7天',
    value: 'last7days',
    getRange: () => ({
      from: startOfDay(subDays(new Date(), 6)),
      to: endOfDay(new Date()),
    }),
    granularity: 'day',
  },
  {
    label: '当前月份',
    value: 'thisMonth',
    getRange: () => ({
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    }),
    granularity: 'day',
  },
  {
    label: '上个月',
    value: 'lastMonth',
    getRange: () => {
      const lastMonth = subMonths(new Date(), 1);
      return {
        from: startOfMonth(lastMonth),
        to: endOfMonth(lastMonth),
      };
    },
    granularity: 'day',
  },
  {
    label: '最近3个月',
    value: 'last3months',
    getRange: () => ({
      from: startOfMonth(subMonths(new Date(), 2)),
      to: endOfMonth(new Date()),
    }),
    granularity: 'week',
  },
  {
    label: '今年',
    value: 'thisYear',
    getRange: () => ({
      from: startOfYear(new Date()),
      to: endOfYear(new Date()),
    }),
    granularity: 'month',
  },
  {
    label: '去年',
    value: 'lastYear',
    getRange: () => {
      const lastYear = subYears(new Date(), 1);
      return {
        from: startOfYear(lastYear),
        to: endOfYear(lastYear),
      };
    },
    granularity: 'month',
  },
];

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<DateRangePreset>(value.preset || 'last7days');
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});

  const displayText = useMemo(() => {
    if (value.preset && value.preset !== 'custom') {
      const preset = PRESETS.find(p => p.value === value.preset);
      return preset?.label || '自定义';
    }
    if (value.from && value.to) {
      return `${format(value.from, 'yyyy-MM-dd')} 至 ${format(value.to, 'yyyy-MM-dd')}`;
    }
    return '选择时间范围';
  }, [value]);

  const handlePresetSelect = (preset: PresetConfig) => {
    setSelectedPreset(preset.value);
    
    if (preset.value !== 'custom') {
      const range = preset.getRange();
      onChange({
        ...range,
        preset: preset.value,
        granularity: preset.granularity,
      });
      setIsOpen(false);
    }
  };

  const handleCustomRangeSelect = (range: { from?: Date; to?: Date }) => {
    setCustomRange(range);
    
    if (range.from && range.to) {
      onChange({
        from: range.from,
        to: range.to,
        preset: 'custom',
        granularity: 'day',
      });
      setIsOpen(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-[280px] justify-between text-left font-normal',
            !value.from && 'text-muted-foreground',
            className
          )}
        >
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            <span>{displayText}</span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          {/* 预设列表 */}
          <div className="border-r p-2 space-y-1 min-w-[140px]">
            <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
              快速选择
            </div>
            {PRESETS.map((preset) => (
              <Button
                key={preset.value}
                variant={selectedPreset === preset.value ? 'secondary' : 'ghost'}
                className="w-full justify-start text-sm"
                onClick={() => handlePresetSelect(preset)}
              >
                {preset.label}
              </Button>
            ))}
            <Button
              variant={selectedPreset === 'custom' ? 'secondary' : 'ghost'}
              className="w-full justify-start text-sm"
              onClick={() => setSelectedPreset('custom')}
            >
              自定义
            </Button>
          </div>
          
          {/* 自定义日历 */}
          {selectedPreset === 'custom' && (
            <div className="p-3">
              <Calendar
                mode="range"
                selected={{
                  from: customRange.from,
                  to: customRange.to,
                }}
                onSelect={handleCustomRangeSelect}
                numberOfMonths={2}
                locale={zhCN}
              />
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// 辅助函数：获取粒度显示文本
export function getGranularityLabel(granularity: Granularity): string {
  const labels: Record<Granularity, string> = {
    hour: '按小时',
    day: '按天',
    week: '按周',
    month: '按月',
  };
  return labels[granularity];
}

// 辅助函数：根据时间范围推断粒度
export function inferGranularity(from: Date, to: Date): Granularity {
  const days = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
  
  if (days <= 1) return 'hour';
  if (days <= 31) return 'day';
  if (days <= 90) return 'week';
  return 'month';
}
