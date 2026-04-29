import React, { useState, useEffect, useRef } from "react";
import {
  Users,
  FileText,
  Clock,
  CalendarCheck,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from 'react-router-dom';
import apiClient from "../../api/axiosConfig";

// --- DATA DUMMY CHART (Tetap Sama) ---
const weeklyData = [
  { name: "Mon", OnTime: 8, Early: 0, Late: 1, OnLeave: 0, Sick: 0, Absent: 0 },
  { name: "Tue", OnTime: 7, Early: 0, Late: 0, OnLeave: 1, Sick: 1, Absent: 0 },
  { name: "Wed", OnTime: 9, Early: 0, Late: 0, OnLeave: 0, Sick: 0, Absent: 0 },
  { name: "Thu", OnTime: 8, Early: 0, Late: 1, OnLeave: 0, Sick: 0, Absent: 0 },
  { name: "Fri", OnTime: 8, Early: 0, Late: 0, OnLeave: 0, Sick: 0, Absent: 1 },
  { name: "Sat", OnTime: 0, Early: 0, Late: 0, OnLeave: 0, Sick: 0, Absent: 0 },
  { name: "Sun", OnTime: 0, Early: 0, Late: 0, OnLeave: 0, Sick: 0, Absent: 0 },
];

// --- STYLES ---
const gradientMain = "bg-[linear-gradient(90deg,#203266_0%,#263C79_19%,#4064CC_100%)]";
const textDarkBlue = "text-[#203266]";

// --- COMPONENTS ---

// 1. Custom Legend Chart
const CustomLegend = (props) => {
  const { payload } = props;
  return (
    <div className="flex flex-wrap justify-center gap-4 md:gap-6 mt-6 px-2">
      {payload.map((entry, index) => (
        <div key={`item-${index}`} className="flex items-center gap-2 cursor-pointer">
          <div className="flex items-center">
            <div className="w-1.5 h-[2px]" style={{ backgroundColor: entry.color }}></div>
            <div className="w-2.5 h-2.5 rounded-full border-[2px] bg-white" style={{ borderColor: entry.color }}></div>
            <div className="w-1.5 h-[2px]" style={{ backgroundColor: entry.color }}></div>
          </div>
          <span className="text-xs font-bold text-slate-600">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

// 2. Month Year Picker (Updated Style)
const MonthYearPicker = ({ value, onChange, placeholder = "Select Date", noInnerBox = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const [year, setYear] = useState(value ? parseInt(value.split("-")[0]) : new Date().getFullYear());
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (mIndex) => {
    const newDate = `${year}-${String(mIndex + 1).padStart(2, "0")}`;
    onChange(newDate);
    setIsOpen(false);
  };

  const displayValue = value
    ? new Date(value + "-01").toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase()
    : placeholder;

  return (
    <div className="relative w-full sm:w-40" ref={containerRef}>
      <div onClick={() => setIsOpen(!isOpen)} className={`w-full pl-3 pr-3 py-2.5 cursor-pointer select-none flex items-center justify-between transition-all duration-200 ${isOpen ? (noInnerBox ? "" : "border-[#354C8F] ring-2 ring-[#354C8F]/10 bg-white") : (noInnerBox ? "" : "border-slate-200 bg-white hover:border-slate-300")}`}>
        <div className="flex items-center gap-2 overflow-hidden">
          <Calendar size={16} className={isOpen ? "text-[#354C8F]" : "text-slate-400"} />
          <span className={`text-xs font-bold truncate ${value ? "text-slate-700" : "text-slate-400"}`}>{displayValue}</span>
        </div>
        <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute top-full mt-2 left-0 w-[240px] bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b border-slate-100 bg-slate-50/50">
              <button onClick={(e) => { e.stopPropagation(); setYear(year - 1); }} className="p-1 hover:bg-slate-200 rounded-lg text-slate-500"><ChevronLeft size={16} /></button>
              <span className="text-sm font-extrabold text-[#27345A]">{year}</span>
              <button onClick={(e) => { e.stopPropagation(); setYear(year + 1); }} className="p-1 hover:bg-slate-200 rounded-lg text-slate-500"><ChevronRight size={16} /></button>
            </div>
            <div className="p-2 grid grid-cols-4 gap-1">
              {months.map((m, idx) => (
                <button key={m} onClick={() => handleSelect(idx)} className={`py-2 px-1 text-[10px] font-bold rounded-lg transition-all ${value && parseInt(value.split("-")[1]) - 1 === idx && parseInt(value.split("-")[0]) === year ? "bg-[#354C8F] text-white shadow-sm" : "text-slate-600 hover:bg-indigo-50"}`}>{m}</button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// 3. Stat Card Component (Updated Icon Style: Rounded Square)

const StatCard = ({ icon, title, value }) => (
  <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
    
    <div className="flex items-center gap-3">
      
      <div className={`w-10 h-10 rounded-lg ${gradientMain} flex items-center justify-center text-white shrink-0 shadow-sm`}>
        {icon}
      </div>
      
      <div className="flex flex-col justify-center">
        {/* Hilangkan mb-1, ubah line-height agar lebih rapat */}
        <p className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider leading-tight">{title}</p>
        <span className={`text-xl sm:text-2xl font-extrabold leading-none mt-0.5 ${textDarkBlue}`}>{value}</span>
      </div>
    </div>
  </div>
);

// --- MAIN DASHBOARD ---
const DashboardMentor = () => {
  // Data State
  const [dashboard, setDashboard] = useState(null);

  // Filter State
  const [chartView, setChartView] = useState("Month");
  const now = new Date();
  const defaultStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Helper: add months to a YYYY-MM string
  const addMonthsToYearMonth = (yearMonth, months) => {
    const [y, m] = yearMonth.split("-").map(Number);
    const d = new Date(y, m - 1, 1);
    d.setMonth(d.getMonth() + months);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  const [startDate, setStartDate] = useState(defaultStart);
  // Default end is start + 5 months (inclusive range of 6 months)
  const [endDate, setEndDate] = useState(addMonthsToYearMonth(defaultStart, 5));

  // Ensure endDate stays at or after startDate (adjust to start + 5 months if user picks a later start)
  useEffect(() => {
    try {
      const start = new Date(startDate + "-01");
      const end = new Date(endDate + "-01");
      if (end < start) {
        setEndDate(addMonthsToYearMonth(startDate, 5));
      }
    } catch (e) {/* ignore malformed dates */ }
  }, [startDate]);

  const isFirstRender = useRef(true);

  // Fetch Dashboard Stats
  useEffect(() => {
    const fetchDashboard = async () => {
      // Clear previous dashboard while loading a new period to avoid showing stale numbers
      setDashboard(null);
      try {
        const response = await apiClient.get("/dashboard", {
          params: { start_date: startDate, end_date: endDate, role: 'mentor' },
        });
        setDashboard(response.data?.data ?? null);
      } catch (err) {
        setDashboard(null);
      }
    };

    if (isFirstRender.current) {
      isFirstRender.current = false;
      fetchDashboard();
      return;
    }

    const t = setTimeout(() => {
      fetchDashboard();
    }, 400);
    return () => clearTimeout(t);
  }, [startDate, endDate]);

  // Helper: Map Monthly Chart Data
  const monthlyChartData = React.useMemo(() => {
    if (!dashboard?.statistik_bulanan) return [];
    return Object.entries(dashboard.statistik_bulanan).map(([month, stats]) => {
      if (!stats) return { name: month, OnTime: 0, Early: 0, Late: 0, OnLeave: 0, Sick: 0, Absent: 0 };
      return {
        name: month,
        OnTime: stats.present ?? 0,
        Early: stats.early ?? 0,
        Late: stats.late ?? 0,
        OnLeave: stats.on_leave ?? 0,
        Sick: stats.sick ?? 0,
        Absent: stats.absent ?? 0,
      };
    });
  }, [dashboard]);

  // Derived Stats
  // If the entire selected period is in the future, show zeros (no data yet)
  const isEntirePeriodInFuture = (() => {
    try {
      const now = new Date();
      const start = new Date(startDate + "-01");
      const end = new Date(endDate + "-01");
      return start > now && end > now;
    } catch (e) {
      return false;
    }
  })();

  const total_intern = isEntirePeriodInFuture ? 0 : dashboard?.intern_bimbingan?.total ?? 0;
  const approved_logbook = isEntirePeriodInFuture ? 0 : dashboard?.logbooks_stats?.approved ?? 0;
  const draft_logbook = isEntirePeriodInFuture ? 0 : dashboard?.logbooks_stats?.draft ?? 0;
  const pending_logbook = isEntirePeriodInFuture ? 0 : dashboard?.logbooks_stats?.pending ?? 0;
  const pending_izin = isEntirePeriodInFuture ? 0 : dashboard?.pending_approval?.leave_requests ?? 0;
  const total_presence = isEntirePeriodInFuture ? 0 : dashboard?.intern_bimbingan?.sudah_absen_hari_ini ?? 0;

  const rawLogbookData = [
    { name: "Approved", value: Number(approved_logbook) || 0, color: "#00C49F" },
    { name: "Draft", value: Number(draft_logbook) || 0, color: "#8884d8" },
    { name: "Pending", value: Number(pending_logbook) || 0, color: "#FF8042" },
  ];

  // Safely prepare data for the donut so it renders without gaps
  const totalLogbook = rawLogbookData.reduce((s, d) => s + (d.value || 0), 0);
  let logbookData = rawLogbookData.filter(d => d.value > 0);

  // If everything is zero, show a single grey slice
  if (totalLogbook === 0) {
    logbookData = [{ name: "No Data", value: 1, color: "#E5E7EB" }];
  }

  // If exactly one category has data, ensure it fills the whole circle (avoid numerical gaps)
  const nonZeroSlices = logbookData.length;
  if (nonZeroSlices === 1 && totalLogbook > 0) {
    // Make that slice represent the whole (keeps its color)
    logbookData = [{ ...logbookData[0], value: totalLogbook }];
  }

  // No padding between slices to avoid visible gaps
  const paddingAngle = 0;

  // For single-slice cases, set start/end so rendering uses full circle and avoids tiny gaps
  const pieStartAngle = nonZeroSlices <= 1 ? 90 : 0;
  const pieEndAngle = nonZeroSlices <= 1 ? -270 : 360;

  // Ending soon (from dashboard.intern_bimbingan.ending_soon)
  const endingInterns = React.useMemo(() => {
    const ending = dashboard?.intern_bimbingan?.ending_soon?.data;
    if (ending && Array.isArray(ending) && ending.length > 0) {
      return ending
        .map((item) => {
          const name = item.nama_lengkap || item.name || item.nama || 'Unknown';
          const rawEnd = item.akhir_magang || item.end_date || item.endDate || item.tanggal_berakhir || null;
          if (!rawEnd) return null;
          const d = new Date(rawEnd);
          if (isNaN(d)) return null;
          const daysLeft = item.days_left ?? Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24));
          return { ...item, name, endDate: d.toISOString().split('T')[0], daysLeft };
        })
        .filter(Boolean)
        .sort((a, b) => a.daysLeft - b.daysLeft)
        .slice(0, 5);
    }
    return [];
  }, [dashboard]);

  // Animation Variants
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  // Navigation helper to open intern detail page
  const navigate = useNavigate();
  const goToInternDetail = (item) => {
    const id = item?.id_mahasiswa ?? item?.id ?? item?.user_id ?? item?.userId ?? item?.user?.id;
    if (!id) return;
    navigate(`/mentor/interns/${id}`, { state: { intern: item } });
  };

  return (
    <motion.div
      className="bg-[#F8FAFC] -ml-4 -mr-4 min-h-screen px-4 md:px-8 py-8 font-sans text-slate-800 -mt-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* 1. HEADER & FILTER */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold ${textDarkBlue}`}>Mentor Dashboard</h1>
          <p className="text-slate-500 text-sm">Monitor intern progress & attendance</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm">
            <MonthYearPicker value={startDate} onChange={setStartDate} placeholder="Start" noInnerBox />
            <span className="text-slate-300 font-bold">-</span>
            <MonthYearPicker value={endDate} onChange={setEndDate} placeholder="End" noInnerBox />
          </div>
        </div>
      </div>

      {/* 2. STAT CARDS (COMPACT UI) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard icon={<Users size={18} />} title="Total Interns" value={total_intern} />
        <StatCard icon={<FileText size={18} />} title="Pending Logbook" value={pending_logbook} />
        <StatCard icon={<Clock size={18} />} title="Pending Leave Request" value={pending_izin} />
        <StatCard icon={<CalendarCheck size={18} />} title="Today's Attendance" value={total_presence} />
      </div>

      {/* 3. CHARTS SECTION */}
      {/* Tambahkan 'items-stretch' pada parent grid agar anak-anaknya punya tinggi yang sama */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">

        {/* LEFT: ATTENDANCE TRENDS */}
        {/* Card ini menjadi penentu tinggi karena isinya lebih banyak */}
        <motion.div
          className="lg:col-span-2 bg-white rounded-[20px] shadow-sm border border-slate-100 p-6 md:p-8"
          variants={itemVariants}
        >
          <div className="-mt-2 flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div>
              <h2 className={`text-[18px] font-bold ${textDarkBlue}`}>Attendance Trends</h2>
              <p className="text-xs text-slate-400">Intern attendance overview</p>
            </div>
            <div className="flex bg-slate-50 p-1 rounded-lg border border-slate-100">
              {["Month"].map((view) => (
                <button
                  key={view}
                  onClick={() => setChartView(view)}
                  className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${chartView === view ? "bg-[#354C8F] text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}
                >
                  {view}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartView === "Week" ? weeklyData : monthlyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 11, fontWeight: 500 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 11, fontWeight: 500 }} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }} />
                <Legend content={<CustomLegend />} />

                <Line type="monotone" dataKey="OnTime" name="On Time" stroke="#10B981" strokeWidth={3} dot={{ r: 0 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="Early" name="Early" stroke="#FBBF24" strokeWidth={2} dot={{ r: 0 }} />
                <Line type="monotone" dataKey="Late" name="Late" stroke="#FF8042" strokeWidth={3} dot={{ r: 0 }} />
                <Line type="monotone" dataKey="OnLeave" name="On Leave" stroke="#9CA3AF" strokeWidth={3} dot={{ r: 0 }} />
                <Line type="monotone" dataKey="Sick" name="Sick" stroke="#3B82F6" strokeWidth={3} dot={{ r: 0 }} />
                <Line type="monotone" dataKey="Absent" name="Absent" stroke="#EF4444" strokeWidth={3} dot={{ r: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* RIGHT: LOGBOOK STATUS */}
        {/* PERUBAHAN DISINI: Tambahkan 'h-full' agar tingginya memaksa sama dengan sebelahnya */}
        <motion.div
          className="lg:col-span-1 bg-white rounded-[20px] shadow-sm border border-slate-100 p-6 flex flex-col h-full"
          variants={itemVariants}
        >
          <div className="mb-4 text-center ">
            <h2 className={`text-[18px] font-bold ${textDarkBlue}`}>Logbook Status</h2>
            <p className="text-xs text-slate-400">Approval overview</p>
          </div>

          {/* flex-1 akan membuat chart mengisi sisa ruang kosong agar seimbang */}
          <div className="flex-1 flex items-center justify-center relative min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={logbookData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={paddingAngle}
                  startAngle={pieStartAngle}
                  endAngle={pieEndAngle}
                  dataKey="value"
                  stroke="none"
                >
                  {logbookData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }} />
              </PieChart>
            </ResponsiveContainer>

            {/* Center Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-extrabold text-slate-800">
                {approved_logbook + draft_logbook + pending_logbook}
              </span>
              <span className="text-xs text-slate-400 font-medium">Total</span>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {logbookData.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className={`text-sm font-bold ${textDarkBlue}`}>{item.name}</span>
                </div>
                <span className={`text-sm font-extrabold ${textDarkBlue}`}>{item.value}</span>
              </div>
            ))}
          </div>

          {/* Ending Soon moved to full-width below */}

        </motion.div>

        {/* ENDING SOON - MOVED TO BELOW */}
        <motion.div className=" -mt-4 lg:col-span-3 bg-white rounded-[20px] shadow-sm border border-slate-100 p-6" variants={itemVariants}>
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className={`text-[18px] font-bold ${textDarkBlue}`}>Ending Soon</h3>
              <p className="text-xs text-slate-400">Interns with internship ending within 30 days will appear here.</p>

            </div>
            <div className="shrink-0">
              <button onClick={() => navigate('/mentor/ending-soon')} className="text-sm font-bold text-[#354C8F] hover:underline whitespace-nowrap">View All</button>
            </div>
          </div>

          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
            {endingInterns.length === 0 ? (
              <div>                    <p className="font-semibold text-sm text-slate-700 mb-1">No interns ending soon</p>
                <p className="text-xs text-slate-400">Interns with internship ending within 30 days will appear here.</p>
              </div>
            ) : (
              endingInterns.map((i) => (
                <div key={i.id || i.name} role="button" tabIndex={0} onClick={() => goToInternDetail(i)} onKeyDown={(e) => { if (e.key === 'Enter') goToInternDetail(i); }} className="group p-3 rounded-2xl border border-slate-100 bg-slate-50/30 hover:bg-white hover:border-slate-200 hover:shadow-md transition-all duration-200 cursor-pointer">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm leading-tight">{i.name}</h4>
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{i.university || i.universitas || i.instansi || '-'}</p>
                    </div>
                    <span className={`text-[10px] font-extrabold px-2 py-1 rounded-md border ${i.daysLeft <= 7 ? 'bg-red-50 text-red-600 border-red-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>
                      {i.daysLeft} Days
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-200/50">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                      <Calendar size={14} className="text-slate-400" />
                      <span>{new Date(i.endDate).toLocaleDateString('en-GB')}</span>
                    </div>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-slate-300 group-hover:text-[#354C8F] group-hover:bg-blue-50 transition-colors">
                      <ArrowUpRight size={14} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* View All moved to header as inline text */}
        </motion.div>

      </div>
    </motion.div>
  );
};

export default DashboardMentor;