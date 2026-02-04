
export enum SlotStatus {
  AVAILABLE = 'AVAILABLE',
  OCCUPIED = 'OCCUPIED',
  MAINTENANCE = 'MAINTENANCE'
}

// Entity: ParkingSlot
export interface ParkingSlot {
  id: string; // Primary Key
  number: string; // SlotNumber
  status: SlotStatus;
  currentCar?: CarEntry; // Relationship to Car (0..1)
}

// Entity: Car
export interface CarEntry {
  id: string; // Primary Key
  plateNumber: string; // PlateNumber
  driverName: string; // DriverName
  driverPhone: string; // PhoneNumber
  entryTime: string; 
  slotId: string; // Foreign Key to ParkingSlot
}

// Entity: ParkingRecord & Payment (Combined for practical React state, but logically separate)
export interface Transaction {
  id: string; // Primary Key
  // ParkingRecord Attributes
  plateNumber: string; 
  driverName: string;
  entryTime: string;
  exitTime: string;
  durationMinutes: number; // Duration
  // Payment Attributes
  totalFee: number; // AmountPaid
  paymentDate: string; // PaymentDate
  slotNumber: string;
}

export interface ParkStats {
  totalRevenue: number;
  totalEntries: number;
  availableSlots: number;
  occupiedSlots: number;
}
