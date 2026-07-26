import type {
  FocusEvent,
  InputHTMLAttributes,
} from 'react'

import {
  sanitizeNumericInput,
  type NumericInputKind,
} from '../utils/numericInput'

interface NumericInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'inputMode' | 'onChange' | 'type' | 'value'
  > {
  decimalPlaces?: number
  kind?: NumericInputKind
  onValueChange: (value: string) => void
  selectOnFocus?: boolean
  value: string
}

export function NumericInput({
  className,
  decimalPlaces = 2,
  kind = 'integer',
  onBlur,
  onFocus,
  onValueChange,
  selectOnFocus = true,
  value,
  ...inputProps
}: NumericInputProps) {
  function handleFocus(event: FocusEvent<HTMLInputElement>) {
    onFocus?.(event)
    if (selectOnFocus && !event.defaultPrevented) {
      event.currentTarget.select()
    }
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    onBlur?.(event)
    if (value.endsWith('.')) {
      onValueChange(value.slice(0, -1))
    }
  }

  return (
    <input
      {...inputProps}
      autoComplete={inputProps.autoComplete ?? 'off'}
      className={`numeric-input${className ? ` ${className}` : ''}`}
      inputMode={kind === 'decimal' ? 'decimal' : 'numeric'}
      onBlur={handleBlur}
      onChange={(event) =>
        onValueChange(
          sanitizeNumericInput(event.target.value, {
            decimalPlaces,
            kind,
          }),
        )
      }
      onFocus={handleFocus}
      pattern={
        kind === 'decimal'
          ? `[0-9]*([.,][0-9]{0,${decimalPlaces}})?`
          : '[0-9]*'
      }
      type="text"
      value={value}
    />
  )
}
