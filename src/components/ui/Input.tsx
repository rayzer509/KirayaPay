import { cn } from '@/lib/utils';
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-navy">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={cn(
            'px-3 py-2.5 rounded-lg border bg-surface text-navy text-sm placeholder:text-slate/50',
            'focus:outline-none focus:ring-2 focus:ring-saffron/30 focus:border-saffron',
            'disabled:bg-slate-light disabled:cursor-not-allowed',
            error ? 'border-coral focus:ring-coral/30 focus:border-coral' : 'border-border',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-coral">{error}</p>}
        {hint && !error && <p className="text-xs text-slate">{hint}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={textareaId} className="text-sm font-medium text-navy">
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          ref={ref}
          className={cn(
            'px-3 py-2.5 rounded-lg border bg-surface text-navy text-sm placeholder:text-slate/50',
            'focus:outline-none focus:ring-2 focus:ring-saffron/30 focus:border-saffron resize-y min-h-[80px]',
            error ? 'border-coral' : 'border-border',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-coral">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';
