import { cn } from '@/lib/utils';
import { SessionType } from '@/lib/types';
import { getSessionTypeInfo } from '@/lib/training-logic';

interface SessionBadgeProps {
  type: SessionType;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function SessionBadge({ type, size = 'md', showLabel = false, className }: SessionBadgeProps) {
  const info = getSessionTypeInfo(type);
  
  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          'flex items-center justify-center rounded-lg border font-bold font-mono',
          sizeClasses[size],
          info.color
        )}
      >
        {type}
      </div>
      {showLabel && (
        <div className="flex flex-col">
          <span className="text-sm font-semibold">{info.label}</span>
          <span className="text-xs text-muted-foreground">{info.description}</span>
        </div>
      )}
    </div>
  );
}
