
import React from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon, color }) => {
  return (
    <div className="bg-white p-5 sm:p-7 rounded-xl border border-[#E5E7EB] flex flex-col shadow-sm">
      <div className="flex items-center justify-between mb-4 sm:mb-5">
        <span className="text-[9px] sm:text-[10px] font-black text-[#6B7280] uppercase tracking-widest truncate mr-2">{title}</span>
        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center bg-[#F9FAFB] text-black border border-[#E5E7EB] shrink-0`}>
          <i className={`fas ${icon} text-[10px] sm:text-xs`}></i>
        </div>
      </div>
      <p className="text-2xl sm:text-3xl font-black text-[#111827] tracking-tighter tabular-nums truncate">{value}</p>
    </div>
  );
};

export default StatsCard;
