
export enum SlotStatus {
  AVAILABLE = 'AVAILABLE',
  OCCUPIED = 'OCCUPIED',
  MAINTENANCE = 'MAINTENANCE'
}

export interface ParkingSlot {
  id: string;
  number: string;
  status: SlotStatus;
  currentCar?: CarEntry;
}

export interface CarEntry {
  id: string;
  plateNumber: string;
  driverName: string;
  driverPhone: string;
  entryTime: string; // ISO String
  slotId: string;
}

export interface Transaction {
  id: string;
  plateNumber: string;
  driverName: string;
  entryTime: string;
  exitTime: string;
  durationMinutes: number;
  totalFee: number;
  slotNumber: string;
}

export interface ParkStats {
  totalRevenue: number;
  totalEntries: number;
  availableSlots: number;
  occupiedSlots: number;
}
