
import React from 'react';
import { ParkingSlot, SlotStatus } from '../types';

interface ParkingSlotViewProps {
  slot: ParkingSlot;
  onSelect: (slot: ParkingSlot) => void;
}

const ParkingSlotView: React.FC<ParkingSlotViewProps> = ({ slot, onSelect }) => {
  const isOccupied = slot.status === SlotStatus.OCCUPIED;
  
  return (
    <button
      onClick={() => onSelect(slot)}
      className={`relative p-4 rounded-md border transition-all flex flex-col items-center justify-center min-h-[90px] group
        ${isOccupied 
          ? 'bg-white border-[#E5E7EB] shadow-sm ring-1 ring-black/[0.02]' 
          : 'bg-[#F9FAFB] border-[#F3F4F6] hover:border-[#D1D5DB] hover:bg-white'}
      `}
    >
      <span className="text-[9px] font-bold text-[#9CA3AF] mb-1 uppercase tracking-wider">{slot.number}</span>
      
      {isOccupied ? (
        <div className="flex flex-col items-center">
          <i className="fas fa-car text-black text-lg"></i>
          <span className="text-[7px] font-black text-white bg-black px-1.5 py-0.5 rounded-full mt-2 scale-90">BUSY</span>
        </div>
      ) : (
        <div className="flex flex-col items-center opacity-30 group-hover:opacity-100 transition-opacity">
          <i className="fas fa-plus text-[#D1D5DB] group-hover:text-black"></i>
          <span className="text-[7px] font-bold text-[#9CA3AF] mt-2 group-hover:text-black">OPEN</span>
        </div>
      )}
    </button>
  );
};

export default ParkingSlotView;
