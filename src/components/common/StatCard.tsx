import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: 'blue' | 'red' | 'emerald' | 'amber' | 'purple';
  trend?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'blue',
  trend
}) => {
  const getColorClasses = () => {
    switch (color) {
      case 'red':
        return {
          bg: 'bg-rose-50 text-bocs-red border-rose-200',
          iconBg: 'bg-bocs-red text-white dark:text-night-ink'
        };
      case 'emerald':
        return {
          bg: 'bg-emerald-50 dark:bg-night-positive-soft text-emerald-900 border-emerald-200 dark:border-night-positive-line',
          iconBg: 'bg-emerald-600 text-white dark:text-night-ink'
        };
      case 'amber':
        return {
          bg: 'bg-amber-50 text-amber-900 border-amber-200',
          iconBg: 'bg-amber-600 text-white dark:text-night-ink'
        };
      case 'purple':
        return {
          bg: 'bg-purple-50 text-purple-900 border-purple-200',
          iconBg: 'bg-purple-600 text-white dark:text-night-ink'
        };
      default:
        return {
          bg: 'bg-blue-50 dark:bg-night-accent-soft text-bocs-navy border-blue-200 dark:border-night-accent-line',
          iconBg: 'bg-bocs-navy text-white dark:text-night-ink'
        };
    }
  };

  const style = getColorClasses();

  return (
    <div className={`bocs-card p-5 border flex items-center justify-between ${style.bg}`}>
      <div>
        <p className="text-xs font-semibold text-slate-500 dark:text-night-ink-2 mb-1.5">
          {title}
        </p>
        <h3 className="text-2xl font-extrabold font-heading text-slate-900 dark:text-night-ink tracking-tight">
          {value}
        </h3>
        {subtitle && (
          <p className="text-sm text-slate-500 dark:text-night-ink-2 mt-1 font-medium">
            {subtitle}
          </p>
        )}
        {trend && (
          <span className="inline-block mt-2 text-xs font-bold text-emerald-600 dark:text-night-positive bg-emerald-100 px-2 py-0.5 rounded">
            {trend}
          </span>
        )}
      </div>
      <div className={`p-3 rounded-md shadow-md  ${style.iconBg}`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
  );
};
