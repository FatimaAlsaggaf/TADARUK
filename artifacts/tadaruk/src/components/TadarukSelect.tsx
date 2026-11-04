import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type TadarukSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type TadarukSelectProps = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: readonly TadarukSelectOption[];
  ariaLabel: string;
  dir: 'rtl' | 'ltr';
  name?: string;
  testId?: string;
  required?: boolean;
  placeholder?: string;
  triggerClassName?: string;
  contentClassName?: string;
};

const EMPTY_OPTION = '__tadaruk_empty_option__';

export function TadarukSelect({
  value,
  defaultValue,
  onValueChange,
  options,
  ariaLabel,
  dir,
  name,
  testId,
  required,
  placeholder,
  triggerClassName,
  contentClassName,
}: TadarukSelectProps) {
  const hasEmptyOption = options.some((option) => option.value === '');
  const toRadixValue = (rawValue: string | undefined) => rawValue === ''
    ? hasEmptyOption ? EMPTY_OPTION : undefined
    : rawValue;

  return (
    <Select
      dir={dir}
      value={value === undefined ? undefined : toRadixValue(value)}
      defaultValue={value === undefined ? toRadixValue(defaultValue) : undefined}
      name={name}
      required={required}
      onValueChange={(nextValue) => onValueChange?.(nextValue === EMPTY_OPTION ? '' : nextValue)}
    >
      <SelectTrigger
        className={cn('tadaruk-select-trigger', triggerClassName)}
        aria-label={ariaLabel}
        data-testid={testId}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent
        align="start"
        side="bottom"
        sideOffset={6}
        collisionPadding={12}
        dir={dir}
        className={cn('tadaruk-dropdown-surface tadaruk-select-content', contentClassName)}
      >
        {options.map((option) => (
          <SelectItem
            key={option.value || EMPTY_OPTION}
            value={option.value || EMPTY_OPTION}
            textValue={option.label}
            disabled={option.disabled}
            className="tadaruk-select-item"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
