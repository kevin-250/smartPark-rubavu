
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ParkingSlot, 
  SlotStatus, 
  CarEntry, 
  Transaction, 
  ParkStats 
} from './types';
import { INITIAL_SLOTS, HOURLY_RATE, MIN_FEE } from './constants';
import StatsCard from './components/StatsCard';
import ParkingSlotView from './components/ParkingSlotView';
import { LoginScreen } from './components/LoginScreen';
import { getParkingInsights } from './services/geminiService';
import { 
  AreaChart, Area, ResponsiveContainer, YAxis, XAxis, Tooltip, 
  BarChart, Bar, CartesianGrid, RadialBarChart, RadialBar,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';

// --- MAIN APP ---

type View = 'car' | 'parkingSlot' | 'parkingRecord' | 'payment' | 'reports' | 'analytics';

const NavItem: React.FC<{ icon: string; label: string; active: boolean; onClick: () => void }> = ({ 
  icon, label, active, onClick 
}) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
      active ? 'bg-black text-white shadow-lg' : 'text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#111827]'
    }`}
  >
    <div className={`w-6 h-6 rounded-md flex items-center justify-center ${active ? 'bg-white/10' : 'bg-[#F3F4F6]'}`}>
      <i className={`fas ${icon} text-[10px]`}></i>
    </div>
    <span className="text-[11px] font-bold uppercase tracking-wider">{label}</span>
  </button>
);

const App: React.FC = () => {
  // Session State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('pssms_session') === 'active';
  });

  const handleLogout = () => {
    localStorage.removeItem('pssms_session');
    setIsAuthenticated(false);
  };

  const STORAGE_KEY_SLOTS = 'pssms_slots_db';
  const STORAGE_KEY_TRANS = 'pssms_records_db';

  // Database Tables (Simulated)
  const [slots, setSlots] = useState<ParkingSlot[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_SLOTS);
    return saved ? JSON.parse(saved) : INITIAL_SLOTS;
  });
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_TRANS);
    return saved ? JSON.parse(saved) : [];
  });

  // UI State
  const [currentView, setCurrentView] = useState<View>('car');
  const [selectedSlot, setSelectedSlot] = useState<ParkingSlot | null>(null);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const [isAddSlotModalOpen, setIsAddSlotModalOpen] = useState(false);
  const [isEditRecordModalOpen, setIsEditRecordModalOpen] = useState(false);
  
  const [aiInsight, setAiInsight] = useState<string>("Click 'Generate Operations Report' to analyze facility performance.");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Forms & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [newSlotNumber, setNewSlotNumber] = useState('');
  
  // New Filter States
  const [recordSortOrder, setRecordSortOrder] = useState<'default' | 'asc' | 'desc'>('default');
  const [slotFilterStatus, setSlotFilterStatus] = useState<'ALL' | SlotStatus>('ALL');
  const [slotSearchQuery, setSlotSearchQuery] = useState('');

  // Edit Record State
  const [editingRecord, setEditingRecord] = useState<Transaction | null>(null);

  // Live Timer
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Persistence
  useEffect(() => localStorage.setItem(STORAGE_KEY_SLOTS, JSON.stringify(slots)), [slots]);
  useEffect(() => localStorage.setItem(STORAGE_KEY_TRANS, JSON.stringify(transactions)), [transactions]);

  // Mobile sidebar close
  useEffect(() => { setIsSidebarOpen(false); }, [currentView]);

  const stats: ParkStats = useMemo(() => {
    const totalRevenue = transactions.reduce((sum, t) => sum + t.totalFee, 0);
    const occupied = slots.filter(s => s.status === SlotStatus.OCCUPIED).length;
    return { 
      totalRevenue, 
      totalEntries: transactions.length + occupied, 
      availableSlots: slots.length - occupied, 
      occupiedSlots: occupied 
    };
  }, [slots, transactions]);

  // --- ANALYTICS DATA PREPARATION ---
  
  const analyticsData = useMemo(() => {
    // 1. Duration Distribution
    const durationRanges = [
      { name: '0-1h', count: 0 },
      { name: '1-3h', count: 0 },
      { name: '3-5h', count: 0 },
      { name: '5h+', count: 0 },
    ];
    
    transactions.forEach(t => {
      const h = t.durationMinutes / 60;
      if (h <= 1) durationRanges[0].count++;
      else if (h <= 3) durationRanges[1].count++;
      else if (h <= 5) durationRanges[2].count++;
      else durationRanges[3].count++;
    });

    // 2. Hourly Traffic (Peak Hours based on Entry Time)
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}:00`,
      entries: 0
    }));
    
    transactions.forEach(t => {
      const h = new Date(t.entryTime).getHours();
      hours[h].entries++;
    });
    // Add current occupied cars to traffic logic if needed, but for history we use transactions

    // 3. Daily Revenue Trend (Last 7 Days)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });

    const revenueTrend = last7Days.map(date => {
      const dailyTotal = transactions
        .filter(t => t.paymentDate.startsWith(date))
        .reduce((sum, t) => sum + t.totalFee, 0);
      return { date: new Date(date).toLocaleDateString('en-RW', { weekday: 'short' }), revenue: dailyTotal };
    });

    // 4. Current Utilization
    const utilization = [
      { name: 'Available', value: stats.availableSlots, color: '#E5E7EB' }, // Gray-200
      { name: 'Occupied', value: stats.occupiedSlots, color: '#000000' },   // Black
    ];

    return { durationRanges, hours, revenueTrend, utilization };
  }, [transactions, slots, stats]);

  const calculateLiveFee = (entryTime: string) => {
    const durationMs = currentTime.getTime() - new Date(entryTime).getTime();
    const durationHours = durationMs / (1000 * 60 * 60);
    // Requirement: Drivers should be charged 500Rwf per hour.
    // If parking duration is under one hour (implied MIN_FEE logic or standard rate applies)
    const rate = Math.ceil(durationHours) * HOURLY_RATE;
    return Math.max(MIN_FEE, rate);
  };

  const calculateDurationStr = (entryTime: string) => {
    const diff = Math.floor((currentTime.getTime() - new Date(entryTime).getTime()) / 1000);
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    return `${h}h ${m}m ${s}s`;
  };

  // --- CRUD OPERATIONS ---

  // 1. CAR: Insert (Entry)
  const handleEntry = (e: React.FormEvent) => {
    e.preventDefault();
    let slotToUse = selectedSlot || slots.find(s => s.status === SlotStatus.AVAILABLE);
    if (!slotToUse) { alert("No parking slots available."); return; }

    const newEntry: CarEntry = {
      id: crypto.randomUUID(),
      plateNumber: plateNumber.toUpperCase(), 
      driverName, driverPhone,
      entryTime: new Date().toISOString(),
      slotId: slotToUse.id
    };

    setSlots(prev => prev.map(s => s.id === slotToUse!.id ? { ...s, status: SlotStatus.OCCUPIED, currentCar: newEntry } : s));
    setPlateNumber(''); setDriverName(''); setDriverPhone('');
    setIsEntryModalOpen(false); setSelectedSlot(null);
  };

  // 2. PARKING SLOT: Insert (Add Slot)
  const handleAddSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSlotNumber) return;
    const newSlot: ParkingSlot = {
      id: crypto.randomUUID(),
      number: newSlotNumber.toUpperCase(),
      status: SlotStatus.AVAILABLE
    };
    setSlots(prev => [...prev, newSlot]);
    setNewSlotNumber('');
    setIsAddSlotModalOpen(false);
  };

  // 3. PAYMENT/RECORD: Insert (Checkout/Generate Bill)
  const processExit = () => {
    if (!selectedSlot || !selectedSlot.currentCar) return;
    const entry = selectedSlot.currentCar;
    const exitTime = new Date().toISOString();
    const fee = calculateLiveFee(entry.entryTime);
    const durationMins = Math.floor((new Date(exitTime).getTime() - new Date(entry.entryTime).getTime()) / 60000);

    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      plateNumber: entry.plateNumber,
      driverName: entry.driverName,
      entryTime: entry.entryTime,
      exitTime,
      durationMinutes: durationMins,
      totalFee: fee,
      paymentDate: exitTime, // Payment happens on exit
      slotNumber: selectedSlot.number
    };

    setTransactions(prev => [...prev, newTransaction]);
    setSlots(prev => prev.map(s => s.id === selectedSlot.id ? { ...s, status: SlotStatus.AVAILABLE, currentCar: undefined } : s));
    setIsExitModalOpen(false); setSelectedSlot(null);
  };

  // 4. PARKING RECORD: Update
  const handleUpdateRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    setTransactions(prev => prev.map(t => t.id === editingRecord.id ? editingRecord : t));
    setIsEditRecordModalOpen(false);
    setEditingRecord(null);
  };

  // 5. PARKING RECORD: Delete
  const handleDeleteRecord = (id: string) => {
    if (confirm('Are you sure you want to delete this record? This action is irreversible.')) {
      setTransactions(prev => prev.filter(t => t.id !== id));
    }
  };

  // --- REPORTING ---
  const handleAiInsight = async () => {
    setIsAiLoading(true);
    const insight = await getParkingInsights(transactions, stats);
    setAiInsight(insight || "Unable to generate insights.");
    setIsAiLoading(false);
  };

  const downloadDailyReport = () => {
    const today = new Date().toISOString().split('T')[0];
    const dailyTx = transactions.filter(t => t.exitTime.startsWith(today));
    
    if (dailyTx.length === 0) { alert("No transactions for today."); return; }

    const headers = ["PlateNumber", "EntryTime", "ExitTime", "Duration(min)", "AmountPaid(RWF)"];
    const rows = dailyTx.map(t => [
      `"${t.plateNumber}"`, 
      `"${new Date(t.entryTime).toLocaleTimeString()}"`, 
      `"${new Date(t.exitTime).toLocaleTimeString()}"`, 
      t.durationMinutes, 
      t.totalFee
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `PSSMS_Daily_Report_${today}.csv`;
    link.click();
  };

  // --- VIEWS ---
  
  if (!isAuthenticated) {
    return <LoginScreen onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="flex min-h-screen bg-[#FBFBFA]">
      {/* Sidebar */}
      <div 
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] transition-opacity lg:hidden ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsSidebarOpen(false)}
      />
      
      <aside className={`
        w-[280px] bg-white border-r border-[#E5E7EB] flex flex-col fixed h-full z-[70] transition-transform duration-300
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-black rounded-lg flex items-center justify-center text-white font-bold text-xs">SP</div>
            <div>
              <span className="font-bold text-sm tracking-tight block text-[#111827]">PSSMS</span>
              <span className="text-[10px] font-medium text-[#6B7280] uppercase tracking-widest text-nowrap">Rubavu Branch</span>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-[#9CA3AF] hover:text-black"><i className="fas fa-xmark"></i></button>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
          <NavItem icon="fa-car" label="Car (Vehicles)" active={currentView === 'car'} onClick={() => setCurrentView('car')} />
          <NavItem icon="fa-square-parking" label="Parking Slot" active={currentView === 'parkingSlot'} onClick={() => setCurrentView('parkingSlot')} />
          <NavItem icon="fa-clipboard-list" label="Parking Record" active={currentView === 'parkingRecord'} onClick={() => setCurrentView('parkingRecord')} />
          <NavItem icon="fa-money-bill-transfer" label="Payment" active={currentView === 'payment'} onClick={() => setCurrentView('payment')} />
          <NavItem icon="fa-chart-pie" label="Reports" active={currentView === 'reports'} onClick={() => setCurrentView('reports')} />
          <NavItem icon="fa-chart-line" label="Analytics" active={currentView === 'analytics'} onClick={() => setCurrentView('analytics')} />
          
          <div className="mt-8 border-t border-[#F3F4F6] pt-4">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-all"
            >
              <div className="w-6 h-6 rounded-md flex items-center justify-center bg-red-100">
                <i className="fas fa-right-from-bracket text-[10px]"></i>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider">Logout</span>
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-[280px] p-4 sm:p-6 md:p-10 lg:p-12 max-w-full overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between mb-8 lg:mb-12">
          <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden w-10 h-10 bg-white border border-[#E5E7EB] rounded-lg text-black"><i className="fas fa-bars"></i></button>
          
          <div className="hidden lg:block">
            <h1 className="text-3xl font-black text-[#111827] tracking-tight mb-2 uppercase">
              {currentView === 'car' && 'Car Management'}
              {currentView === 'parkingSlot' && 'Slot Management'}
              {currentView === 'parkingRecord' && 'Parking Records (CRUD)'}
              {currentView === 'payment' && 'Payment History'}
              {currentView === 'reports' && 'System Reports'}
              {currentView === 'analytics' && 'Business Analytics'}
            </h1>
            <p className="text-sm font-medium text-[#6B7280]">
              {currentTime.toLocaleDateString('en-RW', { weekday: 'long', month: 'long', day: 'numeric' })} • {currentTime.toLocaleTimeString()}
            </p>
          </div>
          
          <div className="bg-black text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest shadow-lg">
            Administrator
          </div>
        </header>

        {/* --- VIEW: CAR --- */}
        {currentView === 'car' && (
          <div className="space-y-6 animate-in fade-in">
             <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-sm">
               <div>
                 <h2 className="font-bold text-lg">Active Cars</h2>
                 <p className="text-sm text-[#6B7280]">Vehicles currently in facility</p>
               </div>
               <button onClick={() => setIsEntryModalOpen(true)} className="bg-black text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#222]">
                 <i className="fas fa-plus mr-2"></i> Register Car
               </button>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {slots.filter(s => s.status === SlotStatus.OCCUPIED).map(s => (
                 <div key={s.id} className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-sm">
                    <div className="flex justify-between mb-4">
                      <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg text-[10px] font-bold uppercase">Slot {s.number}</span>
                      <span className="text-xs font-bold">{new Date(s.currentCar!.entryTime).toLocaleTimeString()}</span>
                    </div>
                    <h3 className="text-xl font-black mb-1">{s.currentCar!.plateNumber}</h3>
                    <p className="text-sm text-[#6B7280] mb-4">{s.currentCar!.driverName}</p>
                    <div className="flex justify-between items-center pt-4 border-t border-[#F3F4F6]">
                      <span className="text-[10px] font-bold uppercase text-[#9CA3AF]">Current Bill</span>
                      <span className="text-lg font-black">{calculateLiveFee(s.currentCar!.entryTime).toLocaleString()} RWF</span>
                    </div>
                 </div>
               ))}
               {slots.filter(s => s.status === SlotStatus.OCCUPIED).length === 0 && (
                 <div className="col-span-full py-20 text-center text-[#9CA3AF]">No active cars found.</div>
               )}
             </div>
          </div>
        )}

        {/* --- VIEW: PARKING SLOT --- */}
        {currentView === 'parkingSlot' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-sm gap-4">
               <div>
                 <h2 className="font-bold text-lg">Parking Slots</h2>
                 <p className="text-sm text-[#6B7280]">Manage facility capacity (Insert/View)</p>
               </div>
               
               <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                 <input
                   type="text"
                   placeholder="Search Slot..."
                   value={slotSearchQuery}
                   onChange={e => setSlotSearchQuery(e.target.value)}
                   className="px-4 py-2 border border-[#E5E7EB] rounded-xl text-sm w-full sm:w-40 font-bold focus:outline-none focus:border-black transition-all"
                 />
                 
                 <div className="flex bg-[#F9FAFB] p-1 rounded-xl border border-[#E5E7EB]">
                    {(['ALL', SlotStatus.AVAILABLE, SlotStatus.OCCUPIED] as const).map(status => (
                      <button 
                        key={status}
                        onClick={() => setSlotFilterStatus(status)}
                        className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${slotFilterStatus === status ? 'bg-white shadow-sm text-black' : 'text-[#9CA3AF] hover:text-[#6B7280]'}`}
                      >
                        {status}
                      </button>
                    ))}
                 </div>

                 <button onClick={() => setIsAddSlotModalOpen(true)} className="bg-black text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#222] whitespace-nowrap w-full sm:w-auto">
                   <i className="fas fa-plus mr-2"></i> Add Slot
                 </button>
               </div>
             </div>
             
             <div className="bg-white p-8 rounded-2xl border border-[#E5E7EB] shadow-sm">
               <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                 {slots
                   .filter(slot => {
                     const matchesStatus = slotFilterStatus === 'ALL' || slot.status === slotFilterStatus;
                     const matchesSearch = slot.number.toLowerCase().includes(slotSearchQuery.toLowerCase());
                     return matchesStatus && matchesSearch;
                   })
                   .map(slot => (
                     <ParkingSlotView key={slot.id} slot={slot} onSelect={(s) => {
                       setSelectedSlot(s);
                       if (s.status === SlotStatus.OCCUPIED) setIsExitModalOpen(true);
                       else setIsEntryModalOpen(true);
                     }} />
                 ))}
                 {slots.filter(slot => (slotFilterStatus === 'ALL' || slot.status === slotFilterStatus) && slot.number.toLowerCase().includes(slotSearchQuery.toLowerCase())).length === 0 && (
                   <div className="col-span-full py-12 text-center text-[#9CA3AF] font-medium text-sm">
                     No slots found matching criteria.
                   </div>
                 )}
               </div>
             </div>
          </div>
        )}

        {/* --- VIEW: PARKING RECORD (CRUD) --- */}
        {currentView === 'parkingRecord' && (
          <div className="space-y-6 animate-in fade-in">
             <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-sm">
               <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                 <div>
                   <h2 className="font-bold text-lg">Parking Records (Ledger)</h2>
                   <p className="text-sm text-[#6B7280]">Full CRUD Operations on history</p>
                 </div>
                 
                 <div className="flex gap-4 w-full md:w-auto">
                   <select 
                      value={recordSortOrder}
                      onChange={(e) => setRecordSortOrder(e.target.value as any)}
                      className="px-4 py-2 border border-[#E5E7EB] rounded-xl text-sm font-bold text-[#6B7280] focus:outline-none focus:border-black"
                   >
                     <option value="default">Sort by Default</option>
                     <option value="asc">Duration: Shortest First</option>
                     <option value="desc">Duration: Longest First</option>
                   </select>

                   <input 
                     type="text" 
                     placeholder="Search..." 
                     value={searchQuery}
                     onChange={e => setSearchQuery(e.target.value)}
                     className="px-4 py-2 border border-[#E5E7EB] rounded-xl text-sm w-full md:w-64"
                   />
                 </div>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                   <thead className="bg-[#F9FAFB] text-[10px] uppercase font-black text-[#6B7280]">
                     <tr>
                       <th className="px-6 py-4">Plate</th>
                       <th className="px-6 py-4">Driver</th>
                       <th className="px-6 py-4">Entry</th>
                       <th className="px-6 py-4">Exit</th>
                       <th className="px-6 py-4 text-center">Duration</th>
                       <th className="px-6 py-4 text-right">Fee (RWF)</th>
                       <th className="px-6 py-4 text-center">Actions</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-[#F3F4F6] text-sm">
                     {transactions
                       .filter(t => t.plateNumber.includes(searchQuery.toUpperCase()) || t.driverName.toLowerCase().includes(searchQuery.toLowerCase()))
                       .sort((a, b) => {
                          if (recordSortOrder === 'asc') return a.durationMinutes - b.durationMinutes;
                          if (recordSortOrder === 'desc') return b.durationMinutes - a.durationMinutes;
                          return 0;
                       })
                       .map(t => (
                       <tr key={t.id} className="hover:bg-[#FBFBFA]">
                         <td className="px-6 py-4 font-bold">{t.plateNumber}</td>
                         <td className="px-6 py-4">{t.driverName}</td>
                         <td className="px-6 py-4 text-xs">{new Date(t.entryTime).toLocaleString()}</td>
                         <td className="px-6 py-4 text-xs">{new Date(t.exitTime).toLocaleString()}</td>
                         <td className="px-6 py-4 text-center font-mono text-xs">{t.durationMinutes}m</td>
                         <td className="px-6 py-4 text-right font-bold">{t.totalFee.toLocaleString()}</td>
                         <td className="px-6 py-4 flex justify-center gap-2">
                           <button onClick={() => { setEditingRecord(t); setIsEditRecordModalOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                             <i className="fas fa-pen"></i>
                           </button>
                           <button onClick={() => handleDeleteRecord(t.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                             <i className="fas fa-trash"></i>
                           </button>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             </div>
          </div>
        )}

        {/* --- VIEW: PAYMENT --- */}
        {currentView === 'payment' && (
          <div className="space-y-6 animate-in fade-in">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               <StatsCard title="Total Revenue" value={stats.totalRevenue.toLocaleString()} icon="fa-coins" color="bg-green-50" />
               <StatsCard title="Avg Transaction" value={(transactions.length ? Math.round(stats.totalRevenue / transactions.length) : 0).toLocaleString()} icon="fa-calculator" color="bg-blue-50" />
             </div>
             
             <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-sm">
               <h2 className="font-bold text-lg mb-6">Payment Transactions</h2>
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                   <thead className="bg-[#F9FAFB] text-[10px] uppercase font-black text-[#6B7280]">
                     <tr>
                       <th className="px-6 py-4">Transaction ID</th>
                       <th className="px-6 py-4">Payment Date</th>
                       <th className="px-6 py-4">Payer</th>
                       <th className="px-6 py-4 text-right">Amount Paid</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-[#F3F4F6] text-sm">
                     {transactions.map(t => (
                       <tr key={t.id}>
                         <td className="px-6 py-4 font-mono text-xs text-[#6B7280]">{t.id.slice(0, 8)}...</td>
                         <td className="px-6 py-4">{new Date(t.paymentDate).toLocaleString()}</td>
                         <td className="px-6 py-4">{t.driverName} ({t.plateNumber})</td>
                         <td className="px-6 py-4 text-right font-black">{t.totalFee.toLocaleString()} RWF</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             </div>
          </div>
        )}

        {/* --- VIEW: REPORTS --- */}
        {currentView === 'reports' && (
          <div className="space-y-6 animate-in fade-in">
             <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
               <div>
                 <h2 className="font-bold text-lg">Daily Parking Payment Report</h2>
                 <p className="text-sm text-[#6B7280]">Generate report for: {new Date().toLocaleDateString()}</p>
               </div>
               <button onClick={downloadDailyReport} className="bg-black text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#222]">
                 <i className="fas fa-file-csv mr-2"></i> Export Daily Report
               </button>
             </div>

             <div className="grid grid-cols-1 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-sm">
                   <h3 className="font-bold text-sm uppercase mb-4">Performance Summary (Gemini)</h3>
                   <div className="bg-[#F9FAFB] p-4 rounded-xl text-sm italic border border-[#F3F4F6] min-h-[100px]">
                     "{aiInsight}"
                   </div>
                   <button onClick={handleAiInsight} disabled={isAiLoading} className="mt-4 text-xs font-bold text-black uppercase tracking-wider hover:underline">
                     {isAiLoading ? 'Analyzing...' : 'Refresh AI Analysis'}
                   </button>
                </div>
             </div>
          </div>
        )}

        {/* --- VIEW: ANALYTICS (NEW) --- */}
        {currentView === 'analytics' && (
           <div className="space-y-6 animate-in fade-in">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               
               {/* 1. Revenue Trend (Area Chart) */}
               <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-sm">
                 <h3 className="font-bold text-sm uppercase mb-6 flex items-center gap-2">
                   <i className="fas fa-chart-line"></i> Revenue Trend (Last 7 Days)
                 </h3>
                 <div className="h-[250px] w-full">
                   <ResponsiveContainer width="100%" height="100%">
                     <AreaChart data={analyticsData.revenueTrend}>
                       <defs>
                         <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#000" stopOpacity={0.1}/>
                           <stop offset="95%" stopColor="#000" stopOpacity={0}/>
                         </linearGradient>
                       </defs>
                       <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} />
                       <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} tickFormatter={(val) => `${val/1000}k`} />
                       <CartesianGrid vertical={false} stroke="#f3f4f6" />
                       <Tooltip 
                          contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} 
                          labelStyle={{fontWeight: 'bold', fontSize: '12px'}}
                       />
                       <Area type="monotone" dataKey="revenue" stroke="#000" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                     </AreaChart>
                   </ResponsiveContainer>
                 </div>
               </div>

               {/* 2. Occupancy Rate (Pie Chart) */}
               <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-sm flex flex-col">
                 <h3 className="font-bold text-sm uppercase mb-6 flex items-center gap-2">
                    <i className="fas fa-chart-pie"></i> Real-time Utilization
                 </h3>
                 <div className="h-[250px] w-full flex-1 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analyticsData.utilization}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {analyticsData.utilization.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="text-center">
                        <span className="block text-3xl font-black">{stats.occupiedSlots}</span>
                        <span className="text-[10px] uppercase text-gray-400 font-bold">Occupied</span>
                      </div>
                    </div>
                 </div>
               </div>

               {/* 3. Peak Hours (Bar Chart) */}
               <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-sm">
                 <h3 className="font-bold text-sm uppercase mb-6 flex items-center gap-2">
                    <i className="fas fa-clock"></i> Traffic Peak Hours
                 </h3>
                 <div className="h-[250px] w-full">
                   <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={analyticsData.hours}>
                       <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fontSize: 10}} interval={3} />
                       <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                       <Tooltip cursor={{fill: '#F9FAFB'}} contentStyle={{borderRadius: '8px', border: 'none'}} />
                       <Bar dataKey="entries" fill="#000" radius={[4, 4, 0, 0]} barSize={20} />
                     </BarChart>
                   </ResponsiveContainer>
                 </div>
               </div>

               {/* 4. Duration Distribution (Bar Chart) */}
               <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-sm">
                 <h3 className="font-bold text-sm uppercase mb-6 flex items-center gap-2">
                    <i className="fas fa-hourglass-half"></i> Parking Duration
                 </h3>
                 <div className="h-[250px] w-full">
                   <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={analyticsData.durationRanges} layout="vertical">
                       <XAxis type="number" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                       <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} width={50} />
                       <Tooltip cursor={{fill: '#F9FAFB'}} contentStyle={{borderRadius: '8px', border: 'none'}} />
                       <Bar dataKey="count" fill="#374151" radius={[0, 4, 4, 0]} barSize={20} />
                     </BarChart>
                   </ResponsiveContainer>
                 </div>
               </div>
             </div>
           </div>
        )}

      </main>

      {/* --- MODALS --- */}

      {/* 1. CAR ENTRY MODAL */}
      {isEntryModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl">
            <h3 className="text-xl font-black mb-6">Register Car Entry</h3>
            <form onSubmit={handleEntry} className="space-y-4">
              <input required autoFocus value={plateNumber} onChange={e => setPlateNumber(e.target.value)} placeholder="Plate Number (e.g. RAE 123 A)" className="w-full border p-3 rounded-xl font-bold" />
              <input required value={driverName} onChange={e => setDriverName(e.target.value)} placeholder="Driver Name" className="w-full border p-3 rounded-xl" />
              <input required value={driverPhone} onChange={e => setDriverPhone(e.target.value)} placeholder="Phone Number" className="w-full border p-3 rounded-xl" />
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsEntryModalOpen(false)} className="flex-1 py-3 text-sm font-bold border rounded-xl">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-black text-white text-sm font-bold rounded-xl uppercase">Register</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. ADD SLOT MODAL */}
      {isAddSlotModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-8 shadow-2xl">
            <h3 className="text-xl font-black mb-6">Add Parking Slot</h3>
            <form onSubmit={handleAddSlot} className="space-y-4">
              <input required autoFocus value={newSlotNumber} onChange={e => setNewSlotNumber(e.target.value)} placeholder="Slot Number (e.g. A25)" className="w-full border p-3 rounded-xl font-bold" />
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsAddSlotModalOpen(false)} className="flex-1 py-3 text-sm font-bold border rounded-xl">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-black text-white text-sm font-bold rounded-xl uppercase">Insert Slot</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. CHECKOUT/BILL MODAL */}
      {isExitModalOpen && selectedSlot?.currentCar && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl text-center">
            <h3 className="text-xl font-black mb-2">Generate Bill</h3>
            <p className="text-sm text-[#6B7280] mb-8">PSSMS Invoice Generation</p>
            
            <div className="bg-[#F9FAFB] p-6 rounded-2xl border border-[#F3F4F6] mb-8 text-left space-y-3">
              <div className="flex justify-between text-sm"><span className="text-[#6B7280] font-bold">Plate:</span> <span className="font-bold">{selectedSlot.currentCar.plateNumber}</span></div>
              <div className="flex justify-between text-sm"><span className="text-[#6B7280] font-bold">Entry:</span> <span>{new Date(selectedSlot.currentCar.entryTime).toLocaleTimeString()}</span></div>
              <div className="flex justify-between text-sm"><span className="text-[#6B7280] font-bold">Duration:</span> <span>{calculateDurationStr(selectedSlot.currentCar.entryTime)}</span></div>
              <div className="border-t border-dashed border-gray-300 my-2"></div>
              <div className="flex justify-between text-lg"><span className="font-black">Total Due:</span> <span className="font-black">{calculateLiveFee(selectedSlot.currentCar.entryTime).toLocaleString()} RWF</span></div>
            </div>

            <div className="flex gap-4">
              <button onClick={() => setIsExitModalOpen(false)} className="flex-1 py-3 text-sm font-bold border rounded-xl">Cancel</button>
              <button onClick={processExit} className="flex-1 py-3 bg-black text-white text-sm font-bold rounded-xl uppercase">Pay & Exit</button>
            </div>
          </div>
        </div>
      )}

      {/* 4. EDIT RECORD MODAL */}
      {isEditRecordModalOpen && editingRecord && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl">
            <h3 className="text-xl font-black mb-6">Edit Record</h3>
            <form onSubmit={handleUpdateRecord} className="space-y-4">
              <div>
                 <label className="text-[10px] font-bold uppercase text-gray-500">Driver Name</label>
                 <input value={editingRecord.driverName} onChange={e => setEditingRecord({...editingRecord, driverName: e.target.value})} className="w-full border p-2 rounded-lg font-bold" />
              </div>
              <div>
                 <label className="text-[10px] font-bold uppercase text-gray-500">Plate Number</label>
                 <input value={editingRecord.plateNumber} onChange={e => setEditingRecord({...editingRecord, plateNumber: e.target.value})} className="w-full border p-2 rounded-lg font-bold" />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsEditRecordModalOpen(false)} className="flex-1 py-3 text-sm font-bold border rounded-xl">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-black text-white text-sm font-bold rounded-xl uppercase">Update</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
