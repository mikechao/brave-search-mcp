import type { ComponentProps } from 'react';
import { ArrowLeftSm, ArrowRightSm } from '@openai/apps-sdk-ui/components/Icon';

export interface PaginationButtonProps extends Omit<ComponentProps<'button'>, 'children'> {
  direction: 'previous' | 'next';
}

export function PaginationButton({
  direction,
  className,
  disabled,
  ...restProps
}: PaginationButtonProps) {
  const isPrevious = direction === 'previous';
  const label = isPrevious ? 'Previous' : 'Next';
  const stateClasses = disabled
    ? 'cursor-not-allowed border-[var(--color-border-disabled)] text-[var(--color-text-disabled)]'
    : 'hover:bg-[var(--color-background-secondary-outline-hover)] hover:text-[var(--color-text-secondary-outline-hover)] active:bg-[var(--color-background-secondary-outline-active)]';

  return (
    <button
      type="button"
      className={`inline-flex h-8 min-w-[88px] items-center justify-center gap-1.5 rounded-full border border-[var(--color-border-secondary-outline)] bg-transparent px-3 text-[13px] font-medium text-[var(--color-text-secondary-outline)] transition-colors duration-150 ease-out ${stateClasses}${className ? ` ${className}` : ''}`}
      disabled={disabled}
      {...restProps}
    >
      {isPrevious && <ArrowLeftSm width={14} height={14} />}
      {label}
      {!isPrevious && <ArrowRightSm width={14} height={14} />}
    </button>
  );
}
