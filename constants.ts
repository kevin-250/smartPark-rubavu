
import { SlotStatus, ParkingSlot } from './types';

export const HOURLY_RATE = 500; // Rwandan Francs (RWF)
export const MIN_FEE = 300;

export const INITIAL_SLOTS: ParkingSlot[] = Array.from({ length: 24 }, (_, i) => ({
  id: `slot-${i + 1}`,
  number: `A${(i + 1).toString().padStart(2, '0')}`,
  status: SlotStatus.AVAILABLE,
}));

export const RUBAVU_INFO = {
  name: "SmartPark Rubavu",
  district: "Rubavu",
  province: "Western Province",
  country: "Rwanda",
  contact: "+250 788 000 000"
};
