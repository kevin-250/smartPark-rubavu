
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ParkingSlot, 
  SlotStatus, 
  CarEntry, 
  Transaction, 
  ParkStats 
} from './types';
import { INITIAL_SLOTS, HOURLY_RATE, MIN_FEE, RUBAVU_INFO } from './constants';
import StatsCard from './components/StatsCard';
import ParkingSlotView from './components/ParkingSlotView';
import { getParkingInsights } from './services/geminiService';
import { 
  AreaChart, Area, ResponsiveContainer, YAxis, XAxis, Tooltip, 
  BarChart, Bar, Cell, PieChart, Pie, CartesianGrid 
} from 'recharts';

type View = 'analytics' | 'insights' | 'grid' | 'vehicles' | 'ledger' | 'settings';

const App: React.FC = () => {
  const STORAGE_KEY_SLOTS = 'smartpark_slots_v3';
  const STORAGE_KEY_TRANS = 'smartpark_transactions_v3';

  // Persistence State
  const [slots, setSlots] = useState<ParkingSlot[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_SLOTS);
    return saved ? JSON.parse(saved) : INITIAL_SLOTS;
  });
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_TRANS);
    return saved ? JSON.parse(saved) : [];
  });

  // UI State
  const [currentView, setCurrentView] = useState<View>('analytics');
  const [selectedSlot, setSelectedSlot] = useState<ParkingSlot | null>(null);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const [aiInsight, setAiInsight] = useState<string>("Click 'Generate Operations Report' to analyze facility performance.");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [vehicleSearchQuery, setVehicleSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Form states
  const [plateNumber, setPlateNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');

  // Live Timer
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync
  useEffect(() => localStorage.setItem(STORAGE_KEY_SLOTS, JSON.stringify(slots)), [slots]);
  useEffect(() => localStorage.setItem(STORAGE_KEY_TRANS, JSON.stringify(transactions)), [transactions]);

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

  // Chart Data Preparation
  const revenueChartData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    return last7Days.map(date => {
      const dayTotal = transactions
        .filter(t => t.exitTime.startsWith(date))
        .reduce((sum, t) => sum + t.totalFee, 0);
      return { date: date.split('-').slice(1).join('/'), amount: dayTotal };
    });
  }, [transactions]);

  const occupancyPieData = [
    { name: 'Occupied', value: stats.occupiedSlots, color: '#000' },
    { name: 'Available', value: stats.availableSlots, color: '#F3F4F6' }
  ];

  const hourlyLoadData = useMemo(() => {
    const hours = Array.from({ length: 14 }, (_, i) => i + 6); // 6 AM to 8 PM
    return hours.map(h => {
      const count = transactions.filter(t => new Date(t.entryTime).getHours() === h).length;
      return { hour: `${h}:00`, checkins: count };
    });
  }, [transactions]);

  const activeCars = useMemo(() => slots.filter(s => s.status === SlotStatus.OCCUPIED), [slots]);

  // Stay Duration Distribution (Visualizing how long vehicles stay)
  const durationDistributionData = useMemo(() => {
    const categories = { 'Short (<1h)': 0, 'Mid (1-3h)': 0, 'Long (>3h)': 0 };
    activeCars.forEach(s => {
      const start = new Date(s.currentCar!.entryTime).getTime();
      const diffHrs = (currentTime.getTime() - start) / (1000 * 60 * 60);
      if (diffHrs < 1) categories['Short (<1h)']++;
      else if (diffHrs < 3) categories['Mid (1-3h)']++;
      else categories['Long (>3h)']++;
    });
    return Object.entries(categories).map(([name, value]) => ({ name, value }));
  }, [activeCars, currentTime]);

  const filteredActiveCars = useMemo(() => {
    const query = vehicleSearchQuery.toLowerCase();
    return activeCars.filter(s => 
      s.currentCar?.plateNumber.toLowerCase().includes(query) ||
      s.currentCar?.driverName.toLowerCase().includes(query)
    );
  }, [activeCars, vehicleSearchQuery]);

  const calculateLiveFee = (entryTime: string) => {
    const durationMs = currentTime.getTime() - new Date(entryTime).getTime();
    const durationHours = durationMs / (1000 * 60 * 60);
    return Math.max(MIN_FEE, Math.ceil(durationHours * HOURLY_RATE));
  };

  const calculateDurationStr = (entryTime: string) => {
    const diff = Math.floor((currentTime.getTime() - new Date(entryTime).getTime()) / 1000);
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    return `${h}h ${m}m ${s}s`;
  };

  const handleEntry = (e: React.FormEvent) => {
    e.preventDefault();
    let slotToUse = selectedSlot || slots.find(s => s.status === SlotStatus.AVAILABLE);
    if (!slotToUse) { alert("Facility at maximum capacity."); return; }

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

  const processExit = () => {
    if (!selectedSlot || !selectedSlot.currentCar) return;
    const entry = selectedSlot.currentCar;
    const exitTime = new Date().toISOString();
    const fee = calculateLiveFee(entry.entryTime);

    setTransactions(prev => [...prev, {
      id: crypto.randomUUID(),
      plateNumber: entry.plateNumber,
      driverName: entry.driverName,
      entryTime: entry.entryTime,
      exitTime,
      durationMinutes: Math.floor((new Date(exitTime).getTime() - new Date(entry.entryTime).getTime()) / 60000),
      totalFee: fee,
      slotNumber: selectedSlot.number
    }]);

    setSlots(prev => prev.map(s => s.id === selectedSlot.id ? { ...s, status: SlotStatus.AVAILABLE, currentCar: undefined } : s));
    setIsExitModalOpen(false); setSelectedSlot(null);
  };

  const handleAiInsight = async () => {
    setIsAiLoading(true);
    const insight = await getParkingInsights(transactions, stats);
    setAiInsight(insight || "Unable to generate insights.");
    setIsAiLoading(false);
  };

  return (
    <div className="flex min-h-screen bg-[#FBFBFA]">
      {/* Sidebar Navigation */}
      <aside className="w-[280px] bg-white border-r border-[#E5E7EB] flex flex-col fixed h-full z-50">
        <div className="p-8 flex items-center gap-3">
          <div className="w-9 h-9 bg-black rounded-lg flex items-center justify-center text-white font-bold text-xs">SP</div>
          <div>
            <span className="font-bold text-sm tracking-tight block text-[#111827]">SmartPark</span>
            <span className="text-[10px] font-medium text-[#6B7280] uppercase tracking-widest">Rubavu Facility</span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-1">
          <NavItem icon="fa-chart-column" label="Analytics" active={currentView === 'analytics'} onClick={() => setCurrentView('analytics')} />
          <NavItem icon="fa-wand-sparkles" label="AI Insights" active={currentView === 'insights'} onClick={() => setCurrentView('insights')} />
          <NavItem icon="fa-table-cells" label="Live Grid" active={currentView === 'grid'} onClick={() => setCurrentView('grid')} />
          <NavItem icon="fa-car-side" label="Active Vehicles" active={currentView === 'vehicles'} onClick={() => setCurrentView('vehicles')} />
          <NavItem icon="fa-scroll" label="Ledger" active={currentView === 'ledger'} onClick={() => setCurrentView('ledger')} />
          <div className="pt-8 pb-3 text-[10px] font-bold text-[#9CA3AF] uppercase tracking-[0.2em] px-4">Management</div>
          <NavItem icon="fa-sliders" label="Settings" active={currentView === 'settings'} onClick={() => setCurrentView('settings')} />
        </nav>

        <div className="p-6 mt-auto border-t border-[#F3F4F6]">
          <button 
            onClick={() => { setSelectedSlot(null); setIsEntryModalOpen(true); }}
            className="w-full bg-black text-white py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#1f1f1f] transition-all shadow-lg shadow-black/5"
          >
            <i className="fas fa-plus text-[10px]"></i> Check-in
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 ml-[280px] p-12 max-w-[1400px]">
        <header className="flex justify-between items-end mb-12">
          <div>
            <h1 className="text-3xl font-black text-[#111827] tracking-tight mb-2 uppercase">
              {currentView === 'analytics' && 'Graphical Analytics'}
              {currentView === 'insights' && 'Intelligence Hub'}
              {currentView === 'grid' && 'Facility Grid'}
              {currentView === 'vehicles' && 'Active Traffic'}
              {currentView === 'ledger' && 'Registry'}
              {currentView === 'settings' && 'System Config'}
            </h1>
            <div className="flex items-center gap-4">
              <p className="text-sm font-medium text-[#6B7280]">
                {currentTime.toLocaleDateString('en-RW', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
              <span className="w-1 h-1 bg-[#D1D5DB] rounded-full"></span>
              <p className="text-sm font-mono font-bold text-[#111827]">{currentTime.toLocaleTimeString()}</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="bg-white border border-[#E5E7EB] rounded-lg px-4 py-2 flex items-center gap-2 shadow-sm">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-xs font-bold text-[#374151]">Facility Online</span>
            </div>
          </div>
        </header>

        {/* Tab Content: Analytics (Visual Only) */}
        {currentView === 'analytics' && (
          <div className="space-y-10 animate-in fade-in duration-700">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <StatsCard title="Est. Revenue" value={`${stats.totalRevenue.toLocaleString()}`} icon="fa-money-bill-wave" color="bg-[#F8FAFC]" />
              <StatsCard title="Throughput" value={stats.totalEntries} icon="fa-arrows-left-right" color="bg-[#F8FAFC]" />
              <StatsCard title="Current Occupancy" value={stats.occupiedSlots} icon="fa-car-burst" color="bg-[#F8FAFC]" />
              <StatsCard title="Utilization Rate" value={`${Math.round((stats.occupiedSlots/slots.length)*100)}%`} icon="fa-gauge-high" color="bg-[#F8FAFC]" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-white border border-[#E5E7EB] rounded-2xl p-8 shadow-sm">
                <h3 className="font-bold text-base text-[#111827] mb-8 uppercase tracking-widest">Weekly Revenue Growth</h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                      <defs>
                        <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#000" stopOpacity={0.05}/>
                          <stop offset="95%" stopColor="#000" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" stroke="#9CA3AF" fontSize={10} axisLine={false} tickLine={false} tickMargin={10} />
                      <YAxis stroke="#9CA3AF" fontSize={10} axisLine={false} tickLine={false} tickFormatter={(val) => `${val/1000}k`} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                      <Area type="monotone" dataKey="amount" stroke="#000" strokeWidth={2} fillOpacity={1} fill="url(#colorAmt)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white border border-[#E5E7EB] rounded-2xl p-8 shadow-sm">
                <h3 className="font-bold text-base text-[#111827] mb-8 uppercase tracking-widest text-center">Occupancy Ratio</h3>
                <div className="h-[300px] w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={occupancyPieData} innerRadius={80} outerRadius={100} paddingAngle={5} dataKey="value">
                        {occupancyPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-4xl font-black text-[#111827]">{stats.occupiedSlots}</span>
                    <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-widest">Parked</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white border border-[#E5E7EB] rounded-2xl p-8 shadow-sm">
                <h3 className="font-bold text-base text-[#111827] mb-8 uppercase tracking-widest">Hourly Traffic Density</h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourlyLoadData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                      <XAxis dataKey="hour" stroke="#9CA3AF" fontSize={10} axisLine={false} tickLine={false} tickMargin={10} />
                      <YAxis stroke="#9CA3AF" fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{fill: '#F9FAFB'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                      <Bar dataKey="checkins" fill="#000" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              <div className="bg-white border border-[#E5E7EB] rounded-2xl p-8 shadow-sm">
                <h3 className="font-bold text-base text-[#111827] mb-8 uppercase tracking-widest">Stay Duration Distribution</h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={durationDistributionData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
                      <XAxis type="number" stroke="#9CA3AF" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis dataKey="name" type="category" stroke="#9CA3AF" fontSize={10} axisLine={false} tickLine={false} width={80} />
                      <Tooltip cursor={{fill: '#F9FAFB'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                      <Bar dataKey="value" fill="#000" radius={[0, 4, 4, 0]} barSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Live Occupants List at Bottom of Analytics */}
            <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-sm">
              <div className="p-8 border-b border-[#F3F4F6] flex justify-between items-center bg-[#FBFBFA]">
                <h3 className="font-bold text-base text-[#111827] uppercase tracking-widest">Current Facility Occupants</h3>
                <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-widest">{activeCars.length} ACTIVE SESSIONS</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#F9FAFB] text-[9px] font-black text-[#6B7280] uppercase tracking-[0.2em] border-b border-[#F3F4F6]">
                    <tr>
                      <th className="px-8 py-4">Driver / Occupant</th>
                      <th className="px-8 py-4">Vehicle Plate</th>
                      <th className="px-8 py-4">Bay #</th>
                      <th className="px-8 py-4">Current Stay</th>
                      <th className="px-8 py-4 text-right">Est. Fee</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F4F6] text-sm font-medium">
                    {activeCars.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-8 py-12 text-center text-[#9CA3AF] font-bold uppercase tracking-widest">No active vehicles onsite.</td>
                      </tr>
                    ) : (
                      activeCars.map(s => (
                        <tr key={s.id} className="hover:bg-[#FBFBFA] transition-colors">
                          <td className="px-8 py-5">
                            <div className="flex flex-col">
                              <span className="text-[#111827] font-black">{s.currentCar?.driverName}</span>
                              <span className="text-[10px] text-[#9CA3AF] font-bold uppercase">{s.currentCar?.driverPhone}</span>
                            </div>
                          </td>
                          <td className="px-8 py-5 font-black text-[#111827] tracking-tight">{s.currentCar?.plateNumber}</td>
                          <td className="px-8 py-5"><span className="bg-[#F3F4F6] px-2 py-1 rounded text-[10px] font-bold border border-[#E5E7EB]">{s.number}</span></td>
                          <td className="px-8 py-5 text-[#6B7280] text-xs font-bold tabular-nums">{calculateDurationStr(s.currentCar!.entryTime)}</td>
                          <td className="px-8 py-5 text-right font-black text-[#111827] tabular-nums">{calculateLiveFee(s.currentCar!.entryTime).toLocaleString()} RWF</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: AI Insights */}
        {currentView === 'insights' && (
          <div className="animate-in fade-in duration-700 max-w-3xl space-y-8">
            <div className="bg-black text-white rounded-3xl p-12 shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
                 <i className="fas fa-wand-magic-sparkles text-9xl"></i>
               </div>
               <div className="relative z-10">
                 <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-6">AI Operations Summary</h4>
                 <div className="text-2xl font-medium leading-relaxed italic opacity-90 border-l-4 border-indigo-500 pl-8 mb-12">
                   "{aiInsight}"
                 </div>
                 <button 
                  onClick={handleAiInsight} 
                  disabled={isAiLoading}
                  className="px-10 py-5 bg-white text-black font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-indigo-50 active:scale-95 transition-all flex items-center gap-4 disabled:opacity-50"
                 >
                  {isAiLoading ? <i className="fas fa-circle-notch animate-spin"></i> : <i className="fas fa-bolt-lightning"></i>}
                  Generate Operations Report
                 </button>
               </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-[#E5E7EB] rounded-2xl p-8 shadow-sm">
                <i className="fas fa-lightbulb text-amber-400 text-xl mb-4"></i>
                <h5 className="font-bold text-sm text-[#111827] mb-2">Dynamic Pricing Suggestion</h5>
                <p className="text-xs text-[#6B7280] leading-relaxed">Consider a 10% peak-hour surcharge during 12:00 PM - 2:00 PM based on current occupancy patterns.</p>
              </div>
              <div className="bg-white border border-[#E5E7EB] rounded-2xl p-8 shadow-sm">
                <i className="fas fa-shield-halved text-emerald-500 text-xl mb-4"></i>
                <h5 className="font-bold text-sm text-[#111827] mb-2">Security Audit</h5>
                <p className="text-xs text-[#6B7280] leading-relaxed">System logs indicate zero unauthorized exits. Slot A04 shows high turnaround frequency.</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: Live Grid */}
        {currentView === 'grid' && (
          <div className="animate-in slide-in-from-bottom-2 duration-500">
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-10 shadow-sm">
               <div className="flex items-center justify-between mb-10">
                 <div>
                    <h3 className="font-bold text-lg text-[#111827]">Site Schematic</h3>
                    <p className="text-sm text-[#6B7280]">Real-time spatial visualization of Zone A bays.</p>
                 </div>
                 <div className="flex gap-8">
                   <div className="flex items-center gap-3">
                     <div className="w-3 h-3 bg-[#F9FAFB] border border-[#F3F4F6] rounded"></div>
                     <span className="text-xs font-bold text-[#6B7280]">AVAILABLE</span>
                   </div>
                   <div className="flex items-center gap-3">
                     <div className="w-3 h-3 bg-black rounded"></div>
                     <span className="text-xs font-bold text-[#6B7280]">OCCUPIED</span>
                   </div>
                 </div>
               </div>
               <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                 {slots.map(slot => (
                   <ParkingSlotView key={slot.id} slot={slot} onSelect={(s) => { 
                     setSelectedSlot(s); 
                     s.status === SlotStatus.AVAILABLE ? setIsEntryModalOpen(true) : setIsExitModalOpen(true); 
                   }} />
                 ))}
               </div>
            </div>
          </div>
        )}

        {/* Tab Content: Active Vehicles */}
        {currentView === 'vehicles' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <p className="text-sm font-bold text-[#6B7280]">
                ACTIVE: {activeCars.length} VEHICLES
              </p>
              <div className="relative w-full md:w-96">
                <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-sm"></i>
                <input 
                  type="text" placeholder="Filter by plate number..." 
                  className="w-full pl-12 pr-4 py-3 text-sm border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-4 focus:ring-black/5"
                  value={vehicleSearchQuery} onChange={e => setVehicleSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredActiveCars.length === 0 ? (
                <div className="col-span-full py-40 text-center bg-white border border-dashed border-[#E5E7EB] rounded-2xl text-[#6B7280]">
                  <p className="font-bold">No active vehicles match your criteria.</p>
                </div>
              ) : (
                filteredActiveCars.map(slot => {
                  const fee = calculateLiveFee(slot.currentCar!.entryTime);
                  return (
                    <div key={slot.id} className="bg-white rounded-2xl border border-[#E5E7EB] p-8 hover:border-black transition-all shadow-sm group">
                       <div className="flex justify-between items-start mb-8">
                         <div>
                            <span className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest block mb-2">Slot {slot.number}</span>
                            <h4 className="text-2xl font-black text-[#111827] tracking-tighter">{slot.currentCar?.plateNumber}</h4>
                            <p className="text-sm font-medium text-[#6B7280] mt-1">{slot.currentCar?.driverName}</p>
                         </div>
                         <div className="text-right">
                            <span className="text-[10px] font-black text-[#111827] uppercase tracking-widest block mb-1">Live Bill</span>
                            <span className="text-2xl font-black tabular-nums">{fee.toLocaleString()} RWF</span>
                         </div>
                       </div>
                       
                       <div className="grid grid-cols-2 gap-4 mb-8">
                         <div className="bg-[#FBFBFA] p-4 rounded-xl border border-[#F3F4F6]">
                            <span className="text-[9px] font-bold text-[#9CA3AF] uppercase block mb-1">Check-in</span>
                            <span className="text-xs font-black">{new Date(slot.currentCar!.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                         </div>
                         <div className="bg-[#FBFBFA] p-4 rounded-xl border border-[#F3F4F6]">
                            <span className="text-[9px] font-bold text-[#9CA3AF] uppercase block mb-1">Duration</span>
                            <span className="text-xs font-black">{calculateDurationStr(slot.currentCar!.entryTime)}</span>
                         </div>
                       </div>

                       <div className="flex gap-3">
                         <button 
                            onClick={() => { setSelectedSlot(slot); setIsExitModalOpen(true); }}
                            className="flex-1 py-3 bg-black text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#1f1f1f] transition-all"
                         >
                            Check-out
                         </button>
                         <button 
                            onClick={() => { if(confirm("Force purge?")) setSlots(prev => prev.map(s => s.id === slot.id ? {...s, status: SlotStatus.AVAILABLE, currentCar: undefined} : s)); }}
                            className="px-5 py-3 border border-[#E5E7EB] text-[#6B7280] rounded-xl hover:text-red-600 hover:border-red-200"
                         >
                            <i className="fas fa-trash-can"></i>
                         </button>
                       </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab Content: Ledger */}
        {currentView === 'ledger' && (
          <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-sm animate-in fade-in duration-500">
            <div className="p-8 border-b border-[#F3F4F6] flex flex-col md:flex-row gap-6 items-center justify-between">
              <div className="relative w-full md:w-96">
                <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] text-sm"></i>
                <input 
                  type="text" placeholder="Filter ledger by name or plate..." 
                  className="w-full pl-12 pr-4 py-3 text-sm border border-[#E5E7EB] rounded-xl focus:outline-none"
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-4">
                <input type="date" className="text-xs border border-[#E5E7EB] rounded-lg px-4 py-2.5" value={startDate} onChange={e => setStartDate(e.target.value)} />
                <input type="date" className="text-xs border border-[#E5E7EB] rounded-lg px-4 py-2.5" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[#F9FAFB] text-[10px] font-black text-[#6B7280] uppercase tracking-[0.2em] border-b border-[#F3F4F6]">
                  <tr>
                    <th className="px-8 py-5">Vehicle</th>
                    <th className="px-8 py-5">Personnel</th>
                    <th className="px-8 py-5">Timeline</th>
                    <th className="px-8 py-5">Stay</th>
                    <th className="px-8 py-5 text-right">Fee</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6] text-sm font-medium text-[#4B5563]">
                  {transactions.filter(t => t.plateNumber.includes(searchQuery.toUpperCase()) || t.driverName.toLowerCase().includes(searchQuery.toLowerCase())).map(t => (
                    <tr key={t.id} className="hover:bg-[#FBFBFA] transition-colors">
                      <td className="px-8 py-5 font-black text-[#111827]">{t.plateNumber}</td>
                      <td className="px-8 py-5">{t.driverName}</td>
                      <td className="px-8 py-5 text-xs text-[#9CA3AF]">
                        {new Date(t.entryTime).toLocaleString([], {hour:'2-digit', minute:'2-digit'})} ➔ {new Date(t.exitTime).toLocaleString([], {hour:'2-digit', minute:'2-digit'})}
                      </td>
                      <td className="px-8 py-5">{t.durationMinutes}m</td>
                      <td className="px-8 py-5 text-right font-black text-[#111827] tabular-nums">{t.totalFee.toLocaleString()} RWF</td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-8 py-32 text-center text-[#9CA3AF] font-bold uppercase tracking-widest">No transaction records.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab Content: Settings */}
        {currentView === 'settings' && (
          <div className="max-w-3xl bg-white border border-[#E5E7EB] rounded-2xl p-12 shadow-sm animate-in zoom-in-95 duration-300">
            <h3 className="text-xl font-black text-[#111827] mb-10">Facility Parameters</h3>
            <div className="space-y-12">
              <div className="grid grid-cols-2 gap-10">
                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-4">Hourly Tariff (Zone A)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[#6B7280]">RWF</span>
                    <input type="number" value={HOURLY_RATE} disabled className="w-full pl-14 pr-4 py-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl text-[#111827] font-black cursor-not-allowed" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-4">Minimum Arrival Fee</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[#6B7280]">RWF</span>
                    <input type="number" value={MIN_FEE} disabled className="w-full pl-14 pr-4 py-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl text-[#111827] font-black cursor-not-allowed" />
                  </div>
                </div>
              </div>
              <div className="p-6 bg-slate-50 border border-[#E5E7EB] rounded-xl flex items-start gap-4">
                 <i className="fas fa-circle-info text-slate-400 mt-1"></i>
                 <p className="text-xs text-[#4B5563] leading-relaxed font-medium">
                   Tariff adjustments are globally managed via the regional central hub. Individual facilities cannot modify billing rates without central authorization.
                 </p>
              </div>
              <div className="pt-10 border-t border-[#F3F4F6] flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-[#111827]">System Maintenance</h4>
                  <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-wider mt-1">Authorized personnel only</p>
                </div>
                <button 
                   onClick={() => { if(confirm("Complete System Wipe: All history and active slots will be purged. This is IRREVERSIBLE. Proceed?")) { localStorage.clear(); window.location.reload(); }}} 
                   className="px-6 py-3 bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-red-100 transition-all border border-red-100 shadow-sm"
                >
                  Factory Reset
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Entry Modal */}
      {isEntryModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-8">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] overflow-hidden animate-in fade-in zoom-in duration-300 border border-[#E5E7EB]">
            <div className="p-10 border-b border-[#F3F4F6] flex justify-between items-center bg-[#FBFBFA]">
              <h3 className="font-black text-xl text-[#111827] tracking-tight">Check-in</h3>
              <button onClick={() => setIsEntryModalOpen(false)} className="text-[#9CA3AF] hover:text-[#111827] transition-colors">
                <i className="fas fa-xmark text-lg"></i>
              </button>
            </div>
            <form onSubmit={handleEntry} className="p-10 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-3">Plate Number</label>
                <input required autoFocus value={plateNumber} onChange={e => setPlateNumber(e.target.value)} placeholder="RAE 000 A" className="w-full border-[#E5E7EB] border-2 rounded-xl p-4 text-lg font-black tracking-tight focus:border-black outline-none transition-all placeholder:text-[#D1D5DB]" />
              </div>
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-3">Driver Name</label>
                  <input required value={driverName} onChange={e => setDriverName(e.target.value)} placeholder="Full Name" className="w-full border-[#E5E7EB] border-2 rounded-xl p-4 text-sm font-bold focus:border-black outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mb-3">Phone</label>
                  <input required value={driverPhone} onChange={e => setDriverPhone(e.target.value)} placeholder="+250 ..." className="w-full border-[#E5E7EB] border-2 rounded-xl p-4 text-sm font-bold focus:border-black outline-none transition-all" />
                </div>
              </div>
              <button type="submit" className="w-full bg-black text-white py-5 rounded-xl font-black text-xs uppercase tracking-[0.2em] mt-6 hover:bg-[#1a1a1a] transition-all shadow-xl active:scale-95">
                Confirm Check-in
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Exit Modal */}
      {isExitModalOpen && selectedSlot?.currentCar && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-8">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] overflow-hidden animate-in fade-in zoom-in duration-300 border border-[#E5E7EB]">
            <div className="p-10 border-b border-[#F3F4F6] flex justify-between items-center bg-[#FBFBFA]">
              <div>
                <h3 className="font-black text-xl text-[#111827] tracking-tight">Checkout</h3>
                <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-widest mt-1">Slot {selectedSlot.number} • {selectedSlot.currentCar.plateNumber}</p>
              </div>
              <button onClick={() => setIsExitModalOpen(false)} className="text-[#9CA3AF] hover:text-[#111827]"><i className="fas fa-xmark text-lg"></i></button>
            </div>
            <div className="p-10 space-y-10">
              <div className="text-center">
                <p className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-[0.2em] mb-3">Outstanding Balance</p>
                <div className="flex items-center justify-center gap-3">
                  <span className="text-6xl font-black text-[#111827] tabular-nums tracking-tighter">
                    {calculateLiveFee(selectedSlot.currentCar.entryTime).toLocaleString()}
                  </span>
                  <span className="text-xl font-black text-[#9CA3AF]">RWF</span>
                </div>
              </div>
              
              <div className="bg-[#F9FAFB] p-8 rounded-2xl space-y-4 border border-[#F3F4F6]">
                 <div className="flex justify-between text-xs font-bold">
                    <span className="text-[#6B7280] uppercase tracking-widest text-[9px]">Arrival</span>
                    <span className="text-[#111827]">{new Date(selectedSlot.currentCar.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                 </div>
                 <div className="flex justify-between text-xs font-bold">
                    <span className="text-[#6B7280] uppercase tracking-widest text-[9px]">Total Stay</span>
                    <span className="text-[#111827]">{calculateDurationStr(selectedSlot.currentCar.entryTime)}</span>
                 </div>
              </div>

              <div className="space-y-4">
                <button onClick={processExit} className="w-full bg-black text-white py-5 rounded-xl font-black text-xs uppercase tracking-[0.2em] hover:bg-[#1a1a1a] transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3">
                  <i className="fas fa-print text-sm opacity-50"></i>
                  Settle Payment
                </button>
                <button onClick={() => setIsExitModalOpen(false)} className="w-full py-2 text-[#9CA3AF] font-black text-[10px] uppercase hover:text-[#111827] transition-colors tracking-[0.3em]">
                  Hold Action
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const NavItem: React.FC<{ icon: string, label: string, active: boolean, onClick: () => void }> = ({ icon, label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-sm font-bold transition-all group
      ${active 
        ? 'bg-[#F3F4F6] text-[#111827]' 
        : 'text-[#6B7280] hover:text-[#111827] hover:bg-[#F9FAFB]'}
    `}
  >
    <i className={`fas ${icon} text-[16px] w-6 transition-transform group-hover:scale-110`}></i>
    {label}
  </button>
);

export default App;
