
import React from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon, color }) => {
  return (
    <div className="bg-white p-7 rounded-xl border border-[#E5E7EB] flex flex-col shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-widest">{title}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-[#F9FAFB] text-black border border-[#E5E7EB]`}>
          <i className={`fas ${icon} text-xs`}></i>
        </div>
      </div>
      <p className="text-3xl font-black text-[#111827] tracking-tighter tabular-nums">{value}</p>
    </div>
  );
};

export default StatsCard;
