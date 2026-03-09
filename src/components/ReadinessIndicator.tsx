import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ReadinessIndicatorProps {
  score: number;
  level: 'good' | 'mid' | 'low';
  size?: 'sm' | 'md' | 'lg';
  showScore?: boolean;
  className?: string;
}

export function ReadinessIndicator({ 
  score, 
  level, 
  size = 'md', 
  showScore = true,
  className 
}: ReadinessIndicatorProps) {
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-20 h-20',
    lg: 'w-28 h-28',
  };
  
  const strokeWidth = size === 'sm' ? 4 : size === 'md' ? 5 : 6;
  const radius = size === 'sm' ? 20 : size === 'md' ? 35 : 50;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const colorClass = {
    good: 'text-success',
    mid: 'text-warning',
    low: 'text-destructive',
  }[level];

  const labelText = {
    good: 'Ready',
    mid: 'Moderate',
    low: 'Low',
  }[level];

  return (
    <div className={cn('relative flex items-center justify-center', sizeClasses[size], className)}>
      <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${(radius + strokeWidth) * 2} ${(radius + strokeWidth) * 2}`}>
        <circle
          cx={radius + strokeWidth}
          cy={radius + strokeWidth}
          r={radius}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={radius + strokeWidth}
          cy={radius + strokeWidth}
          r={radius}
          fill="none"
          className={cn('stroke-current', colorClass)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      {showScore && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('font-bold', size === 'sm' ? 'text-sm' : size === 'md' ? 'text-xl' : 'text-3xl')}>
            {score}
          </span>
          {size !== 'sm' && (
            <span className={cn('text-muted-foreground', size === 'md' ? 'text-[10px]' : 'text-xs')}>
              {labelText}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
