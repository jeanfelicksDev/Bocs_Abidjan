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
          iconBg: 'bg-bocs-red text-white'
        };
      case 'emerald':
        return {
          bg: 'bg-emerald-50 text-emerald-900 border-emerald-200',
          iconBg: 'bg-emerald-600 text-white'
        };
      case 'amber':
        return {
          bg: 'bg-amber-50 text-amber-900 border-amber-200',
          iconBg: 'bg-amber-600 text-white'
        };
      case 'purple':
        return {
          bg: 'bg-purple-50 text-purple-900 border-purple-200',
          iconBg: 'bg-purple-600 text-white'
        };
      default:
        return {
          bg: 'bg-blue-50 text-bocs-navy border-blue-200',
          iconBg: 'bg-bocs-navy text-white'
        };
    }
  };

  const style = getColorClasses();

  return (
    <div className={`bocs-card p-5 border flex items-center justify-between ${style.bg}`}>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
          {title}
        </p>
        <h3 className="text-2xl font-extrabold font-heading text-slate-900">
          {value}
        </h3>
        {subtitle && (
          <p className="text-xs text-slate-500 mt-1 font-medium">
            {subtitle}
          </p>
        )}
        {trend && (
          <span className="inline-block mt-2 text-[11px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded">
            {trend}
          </span>
        )}
      </div>
      <div className={`p-3 rounded-xl shadow-md ${style.iconBg}`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
  );
};
