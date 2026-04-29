import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  FileText,
  Activity,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  School,
  UserX,
  ArrowUpRight
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ComposedChart,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
  LabelList,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import apiClient from '../../api/axiosConfig';

// --- MOCK DATA (SUDAH NAMA LENGKAP) ---
const evaluationData = [
  { name: "Universitas Brawijaya", count: 45, Avg: 85, color: "#203266" },
  { name: "Institut Teknologi Sepuluh Nopember", count: 38, Avg: 85, color: "#263C79" },
  { name: "Universitas Airlangga", count: 30, Avg: 84, color: "#354C8F" },
  { name: "Universitas Gadjah Mada", count: 25, Avg: 90, color: "#4064CC" },
  { name: "Universitas Indonesia", count: 20, Avg: 86, color: "#5C7BD9" },
  { name: "Universitas Negeri Surabaya", count: 12, Avg: 82, color: "#7892E0" },
];


// --- FALLBACK DATA ---
const weeklyDataFallback = [
  { name: "Mon", OnTime: 0, Early: 0, Late: 0, OnLeave: 0, Sick: 0, Absent: 0 },
  { name: "Tue", OnTime: 0, Early: 0, Late: 0, OnLeave: 0, Sick: 0, Absent: 0 },
  { name: "Wed", OnTime: 0, Early: 0, Late: 0, OnLeave: 0, Sick: 0, Absent: 0 },
  { name: "Thu", OnTime: 0, Early: 0, Late: 0, OnLeave: 0, Sick: 0, Absent: 0 },
  { name: "Fri", OnTime: 0, Early: 0, Late: 0, OnLeave: 0, Sick: 0, Absent: 0 },
];

const monthlyDataFallback = [
  { name: "Jan", OnTime: 0, Early: 0, Late: 0, OnLeave: 0, Sick: 0, Absent: 0 },
  { name: "Feb", OnTime: 0, Early: 0, Late: 0, OnLeave: 0, Sick: 0, Absent: 0 },
  { name: "Mar", OnTime: 0, Early: 0, Late: 0, OnLeave: 0, Sick: 0, Absent: 0 },
];

const universityDataFallback = [
  { name: "Universitas Brawijaya", count: 0, color: "#203266" },
  { name: "Institut Teknologi Sepuluh Nopember", count: 0, color: "#263C79" },
];

const programDataFallback = [
  { name: "Teknik Informatika", count: 0, color: "#203266" },
];

// --- STYLES ---
const gradientMain = "bg-[linear-gradient(90deg,#203266_0%,#263C79_19%,#4064CC_100%)]";
const textDarkBlue = "text-[#203266]";
const btnSecondaryClass = `bg-[#354C8F] hover:bg-[#2a3c70] text-white py-3 px-4 md:px-6 rounded-xl font-bold text-[14px] shadow-md shadow-indigo-200 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`;

// --- COLORS ---
const UNI_COLOR_PALETTE = ["#203266", "#263C79", "#354C8F", "#4064CC", "#5C7BD9", "#7892E0", "#94A9E8", "#AFC0F0", "#CBD7F7", "#E6EDFC"];
const PROGRAM_COLORS = ["#203266", "#263C79", "#354C8F", "#4064CC", "#5C7BD9", "#7892E0"];
// Department-specific bright palette for distinct pie slices
const DEPARTMENT_COLOR_PALETTE = [
  '#FF7A59', // coral
  '#FFBB33', // amber
  '#4CC9F0', // cyan
  '#7B61FF', // violet
  '#10B981', // green
  '#FF6B9A', // pink
  '#F97316', // orange
  '#06B6D4', // teal
  '#EF4444', // red
  '#6366F1'  // indigo
];

// --- CHARTS ---

const AttendanceChart = memo(({ monthlyData, weeklyData, view }) => {
  const data = view === 'Week' ? weeklyData : monthlyData;
  return (
    <div className="h-full w-full min-h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 10, fontWeight: 500 }} dy={10} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 10, fontWeight: 500 }} />
          <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)", fontSize: "12px" }} />
          <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
          <Line type="monotone" dataKey="OnTime" name="On Time" stroke="#10B981" strokeWidth={3} dot={{ r: 0 }} activeDot={{ r: 6 }} />
          <Line type="monotone" dataKey="Early" name="Early" stroke="#FBBF24" strokeWidth={2} dot={{ r: 0 }} />
          <Line type="monotone" dataKey="Late" name="Late" stroke="#FF8042" strokeWidth={3} dot={{ r: 0 }} />
          <Line type="monotone" dataKey="OnLeave" name="On Leave" stroke="#9CA3AF" strokeWidth={3} dot={{ r: 0 }} />
          <Line type="monotone" dataKey="Sick" name="Sick" stroke="#3B82F6" strokeWidth={3} dot={{ r: 0 }} />
          <Line type="monotone" dataKey="Absent" name="Absent" stroke="#EF4444" strokeWidth={3} dot={{ r: 0 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

const UniversityChart = memo(({ topUniversities }) => (
  <div className="h-[220px] w-full mb-4">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={topUniversities} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }} barSize={20}>
        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E2E8F0" />
        <XAxis type="number" hide />
        <YAxis 
            type="category" 
            dataKey="name" 
            width={160} 
            tickFormatter={(val) => val.length > 20 ? `${val.substring(0, 20)}...` : val} // Truncate text panjang
            tick={{ fill: "#64748B", fontSize: 10, fontWeight: 600 }} 
            tickLine={false} 
            axisLine={false} 
        />
        <Tooltip formatter={(value, name, props) => [`${value}`, name]} cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)", fontSize: "12px" }} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          <LabelList dataKey="count" position="right" fontSize={10} fill="#64748B" />
          {topUniversities.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
));

// [REVISI] Evaluation Chart: Menangani Nama Kampus Panjang
const EvaluationChart = memo(({ data }) => (
  <div className="h-[250px] w-full mt-2">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 8, left: -20, bottom: 0 }} barGap={8}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tickFormatter={(value) => {
            if (value.includes("Institut Teknologi Sepuluh")) return "ITS";
            if (value.includes("Gadjah Mada")) return "UGM";
            return value.replace("Universitas", "Univ.").substring(0, 12);
          }}
          tick={{ fill: "#64748B", fontSize: 10, fontWeight: 600 }}
          dy={10}
        />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 10 }} />
        <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)", fontSize: "12px" }} />
        <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '11px' }} />

        {/* Count bars (varied color per university) */}
        <Bar dataKey="count" name="Interns" barSize={18} radius={[6,6,0,0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-count-${index}`} fill={entry.color ?? UNI_COLOR_PALETTE[index % UNI_COLOR_PALETTE.length]} />
          ))}
        </Bar>

        {/* Avg bars (single color) */}
        <Bar dataKey="Avg" name="Avg Eval" barSize={10} radius={[6,6,0,0]} fill="#FF8042" />
      </BarChart>
    </ResponsiveContainer>
  </div>
));

const DepartmentChart = memo(({ data }) => {
  const isSmall = (typeof window !== 'undefined' && window.innerWidth < 768);
  const [showLegend, setShowLegend] = useState(false);
  const total = data.reduce((a, b) => a + b.count, 0);
  const cxValue = isSmall ? '50%' : (showLegend ? '40%' : '50%');
  const innerRadius = isSmall ? 34 : (showLegend ? 48 : 56);
  const outerRadius = isSmall ? 54 : (showLegend ? 66 : 78);

  return (
    <div className="h-[220px] w-full flex flex-col items-center justify-center relative overflow-visible">
      {/* Toggle legend button */}
      <button
        onClick={() => setShowLegend(s => !s)}
        aria-pressed={showLegend}
        className="absolute right-3 top-3 z-20 bg-white border border-slate-100 rounded-full p-2 shadow-sm text-slate-600 hover:bg-slate-50"
        title={showLegend ? 'Hide legend' : 'Show legend'}
      >
        <ChevronDown size={14} className={`${showLegend ? 'rotate-180' : ''} transition-transform`} />
      </button>

      {!showLegend && (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ left: isSmall ? 0 : 40, right: isSmall ? 0 : 40 }}>
            <Pie
              data={data}
              cx={cxValue}
              cy="50%"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              paddingAngle={4}
              dataKey="count"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
              ))}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)", fontSize: "12px" }} />
          </PieChart>
        </ResponsiveContainer>
      )}

      {/* Legend panel when opened: right-side on desktop, below on mobile */}
      {showLegend && !isSmall && (
        <div className="absolute inset-y-0 right-3 flex items-center z-10">
          <div className="bg-white rounded-lg p-3 shadow-md border border-slate-100 max-w-[220px]">
            {data.map((d, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-slate-700 mb-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></span>
                <span className="font-medium truncate">{d.name}</span>
                <span className="ml-auto text-xs text-slate-400">{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Center total */}
      <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none" style={{ left: isSmall ? '50%' : cxValue }}>
        <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Total</span>
        <span className="text-xl font-extrabold text-[#203266]">{total}</span>
      </div>

      {/* Small-screen legend rendered below when opened */}
      {isSmall && showLegend && (
        <div className="mt-2 w-full px-3">
          <div className="grid grid-cols-1 gap-2">
            {data.map((d, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-slate-700">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></span>
                <span className="font-medium truncate">{d.name}</span>
                <span className="ml-auto text-xs text-slate-400">{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

// --- COMPONENTS ---
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
    <div className="relative w-full sm:w-36" ref={containerRef}>
      <div onClick={() => setIsOpen(!isOpen)} className={`w-full px-3 py-3 cursor-pointer select-none flex items-center justify-between transition-all duration-200 ${isOpen ? (noInnerBox ? "" : "border-[#354C8F] ring-2 ring-[#354C8F]/10 bg-white") : (noInnerBox ? "" : "border-slate-200 bg-white hover:border-slate-300")}`}>
        <div className="flex items-center gap-2 overflow-hidden">
          <Calendar size={14} className={isOpen ? "text-[#354C8F]" : "text-slate-400"} />
          <span className={`text-xs font-bold truncate ${value ? "text-slate-700" : "text-slate-400"}`}>{displayValue}</span>
        </div>
        <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute top-full mt-1 left-0 w-[240px] bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden">
            <div className="flex items-center justify-between p-2 border-b border-slate-100 bg-slate-50/50">
              <button onClick={(e) => { e.stopPropagation(); setYear(year - 1); }} className="p-1 hover:bg-slate-200 rounded-lg text-slate-500"><ChevronLeft size={14} /></button>
              <span className="text-xs font-extrabold text-[#27345A]">{year}</span>
              <button onClick={(e) => { e.stopPropagation(); setYear(year + 1); }} className="p-1 hover:bg-slate-200 rounded-lg text-slate-500"><ChevronRight size={14} /></button>
            </div>
            <div className="p-2 grid grid-cols-4 gap-1">
              {months.map((m, idx) => (
                <button key={m} onClick={() => handleSelect(idx)} className={`py-1.5 px-1 text-[10px] font-bold rounded-lg transition-all ${value && parseInt(value.split("-")[1]) - 1 === idx && parseInt(value.split("-")[0]) === year ? "bg-[#354C8F] text-white shadow-sm" : "text-slate-600 hover:bg-indigo-50"}`}>{m}</button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const StatCard = ({ icon, title, value }) => (
  <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl ${gradientMain} flex items-center justify-center text-white shrink-0 shadow-md`}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{title}</p>
        <span className={`text-xl font-extrabold ${textDarkBlue}`}>{value}</span>
      </div>
    </div>
  </div>
);

// --- MAIN DASHBOARD ---
const DashboardAdmin = () => {
  const navigate = useNavigate();

  const [startDate, setStartDate] = useState("2026-01");
  const [endDate, setEndDate] = useState("2026-06");
  const [attendanceView, setAttendanceView] = useState("Month");
  const [evalYear, setEvalYear] = useState(new Date().getFullYear());

  // State untuk collapsible list
  const [showAllUniversities, setShowAllUniversities] = useState(false);

  // Dashboard data
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [activeInternsCount, setActiveInternsCount] = useState(null);
  const [totalUniversities, setTotalUniversities] = useState(null);
  const [endingSoonCount, setEndingSoonCount] = useState(null);
  const [activeNowCount, setActiveNowCount] = useState(null);
  const [endingInterns, setEndingInterns] = useState([]);
  const [chartMonthlyData, setChartMonthlyData] = useState(monthlyDataFallback);
  const [exporting, setExporting] = useState(false);

  const getLastDayOfMonth = (ym) => {
    if (!ym) return null;
    const [y, m] = ym.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    return `${ym}-${String(last).padStart(2, '0')}`;
  };

  const exportRef = useRef(null);
  const exportContentRef = useRef(null);

  const handleExport = useCallback(async () => {
    try {
      setExporting(true);
      const typeToUse = 'excel';
      const role = localStorage.getItem('role') || 'admin';
      const start_date = startDate ? `${startDate}-01` : undefined;
      const end_date = endDate ? getLastDayOfMonth(endDate) : undefined;
      const params = { role, start_date, end_date, type: typeToUse };
      const res = await apiClient.get('/admin/dashboard/export/package', { params, responseType: 'arraybuffer' });
      const cd = res.headers && (res.headers['content-disposition'] || res.headers['Content-Disposition']);
      let filename = `dashboard_export_${startDate}_${endDate}_${typeToUse}.xlsx`;
      if (cd) {
        const match = /filename\*=UTF-8''([^;\n]+)|filename="?([^";]+)"?/i.exec(cd);
        if (match) filename = decodeURIComponent(match[1] || match[2]).replace(/^"|"$/g, '');
      }
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Server export failed', err);
    } finally {
      setExporting(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const role = localStorage.getItem('role') || 'admin';
        const start_date = startDate ? `${startDate}-01` : undefined;
        const end_date = endDate ? getLastDayOfMonth(endDate) : undefined;
        const res = await apiClient.get('/dashboard', { params: { role, start_date, end_date } });
        const payload = res.data?.data;
        if (res.data?.success && payload) {
          setDashboard(payload);
          if (payload.filter_period?.start) setStartDate(payload.filter_period.start.slice(0, 7));
          if (payload.filter_period?.end) setEndDate(payload.filter_period.end.slice(0, 7));

          setActiveInternsCount(payload.interns?.active_count ?? payload.users?.intern ?? 0);
          setTotalUniversities(payload.interns?.universitas_available_count ?? 0);
          setEndingSoonCount(payload.interns?.ending_soon?.count ?? 0);
          setActiveNowCount(payload.users?.aktif ?? 0);

          const rawEnding = payload.interns?.ending_soon?.data ?? [];
          const ending = rawEnding
            .map((i) => {
              const name = i.nama_lengkap || i.nama || i.name || 'Unknown';
              const university = i.universitas || i.university || i.instansi || '';
              const endDate = i.akhir_magang || i.end_date || i.endDate || i.tanggal_berakhir || null;
              let daysLeft = typeof i.days_left === 'number' ? i.days_left : (i.days_left ? Number(i.days_left) : null);
              if ((daysLeft === null || Number.isNaN(daysLeft)) && endDate) {
                const d = new Date(endDate);
                if (!isNaN(d)) {
                  daysLeft = Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24));
                }
              }
              return {
                id: i.user_id ?? i.id_mahasiswa ?? i.id ?? null,
                userId: i.user_id ?? i.userId ?? null,
                studentId: i.id_mahasiswa ?? i.idMahasiswa ?? i.mahasiswa_id ?? null,
                name,
                university,
                endDate,
                daysLeft,
              };
            })
            .filter((x) => x && typeof x.daysLeft === 'number' && x.daysLeft >= 0 && x.daysLeft <= 30)
            .sort((a, b) => a.daysLeft - b.daysLeft)
            .slice(0, 5);

          setEndingInterns(ending);

          const indoMonths = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
          const monthAbbr = { 'Januari': 'Jan', 'Februari': 'Feb', 'Maret': 'Mar', 'April': 'Apr', 'Mei': 'May', 'Juni': 'Jun', 'Juli': 'Jul', 'Agustus': 'Aug', 'September': 'Sep', 'Oktober': 'Oct', 'November': 'Nov', 'Desember': 'Dec' };
          const stat = payload.statistik_bulanan || {};

          const buildMonthRange = (startIso, endIso) => {
            if (!startIso || !endIso) return [];
            const start = new Date(startIso);
            const end = new Date(endIso);
            const months = [];
            const cur = new Date(start.getFullYear(), start.getMonth(), 1);
            const last = new Date(end.getFullYear(), end.getMonth(), 1);
            while (cur <= last) {
              const mIdx = cur.getMonth() + 1; // 1-12
              const year = cur.getFullYear();
              months.push(`${year}-${String(mIdx).padStart(2, '0')}`);
              cur.setMonth(cur.getMonth() + 1);
            }
            return months;
          };

          const startIso = payload.filter_period?.start || (startDate ? `${startDate}-01` : null);
          const endIso = payload.filter_period?.end || (endDate ? getLastDayOfMonth(endDate) : null);
          const monthKeys = buildMonthRange(startIso, endIso);

          const chart = monthKeys.map(m => {
            const d = stat[m]; // Key is "YYYY-MM"
            const [year, month] = m.split('-');
            const mIdx = parseInt(month, 10) - 1;
            const mName = indoMonths[mIdx] || '';
            const shortMonth = monthAbbr[mName] ?? mName.slice(0, 3);
            const shortYear = `'${year.slice(-2)}`;
            return {
              name: `${shortMonth} ${shortYear}`.trim(),
              OnTime: d?.present ?? 0,
              Early: d?.early ?? 0,
              Absent: d?.absent ?? 0,
              Late: d?.late ?? 0,
              OnLeave: d?.on_leave ?? 0,
              Sick: d?.sick ?? 0
            };
          });

          setChartMonthlyData(chart);
        }
      } catch (err) {
        console.error('Failed to fetch dashboard', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [startDate, endDate]);

  const totalInterns = useMemo(() => dashboard?.interns?.active_count ?? activeInternsCount ?? 0, [dashboard, activeInternsCount]);
  const uniDistributionObj = dashboard?.interns?.universitas_distribution || null;

  const universitiesFromApi = useMemo(() => {
    if (uniDistributionObj) {
      return Object.entries(uniDistributionObj).map(([name, count], idx) => ({
        name,
        count,
        pct: totalInterns ? Math.round((count / totalInterns) * 100) : 0,
        color: universityDataFallback.find(u => u.name === name)?.color ?? UNI_COLOR_PALETTE[idx % UNI_COLOR_PALETTE.length]
      }));
    }
    const available = dashboard?.interns?.universitas_available || universityDataFallback.map(u => u.name);
    return available.map((name, idx) => {
      const count = dashboard?.interns?.universitas_available_count ? 1 : (universityDataFallback.find(u => u.name === name)?.count ?? 1);
      return {
        name,
        count,
        pct: totalInterns ? Math.round((count / totalInterns) * 100) : 0,
        color: universityDataFallback.find(u => u.name === name)?.color ?? UNI_COLOR_PALETTE[idx % UNI_COLOR_PALETTE.length]
      };
    });
  }, [uniDistributionObj, dashboard?.interns?.universitas_available, dashboard?.interns?.universitas_available_count, totalInterns]);

  const topUniversities = useMemo(() => universitiesFromApi.slice(0, 5), [universitiesFromApi]);
  const otherUniversities = useMemo(() => universitiesFromApi.slice(5), [universitiesFromApi]);

  const programDistribution = useMemo(() => {
    if (dashboard?.interns?.jurusan_distribution) {
      return Object.entries(dashboard.interns.jurusan_distribution)
        .map(([name, count], idx) => ({ name, count, pct: totalInterns ? Math.round((count / totalInterns) * 100) : 0, color: PROGRAM_COLORS[idx % PROGRAM_COLORS.length] }))
        .sort((a, b) => b.count - a.count);
    }
    return programDataFallback.map((p, idx) => ({ ...p, pct: totalInterns ? Math.round((p.count / (totalInterns || 1)) * 100) : 0 }));
  }, [dashboard?.interns?.jurusan_distribution, totalInterns]);

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  // Department / Division data from API
  const departmentDataMemo = useMemo(() => {
    // Check for both Indonesian and English keys for division distribution
    const dist = dashboard?.interns?.divisi_distribution || dashboard?.interns?.division_distribution || null;
    
    const colorMap = {
      Finance: '#F97316',
      'Human Capital': '#10B981',
      'IT Development': '#6366F1',
      Marketing: '#FB7185',
      Operations: '#06B6D4',
    };

    if (dist && Object.keys(dist).length > 0) {
      return Object.entries(dist).map(([_name, _count], idx) => {
        const name = _name;
        const count = Number(_count) || 0;
        return {
          name,
          count,
          color: colorMap[name] ?? DEPARTMENT_COLOR_PALETTE[idx % DEPARTMENT_COLOR_PALETTE.length],
        };
      });
    }

    // If no data from API, return empty array to show 0 as requested by user
    return [];
  }, [dashboard]);

  // Evaluation years options: fixed range starting 2025 up to current year
  const yearOptions = useMemo(() => {
    const start = 2025;
    const end = new Date().getFullYear();
    const years = [];
    for (let y = start; y <= end; y++) years.push(y);
    return years.reverse();
  }, []);

  useEffect(() => {
    if (!yearOptions.includes(evalYear)) setEvalYear(yearOptions[0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearOptions]);

  const evaluationDataMemo = useMemo(() => {
    const ev = dashboard?.interns?.evaluation || [];
    const filtered = ev.filter((e) => Number(e.year) === Number(evalYear));
    if (!filtered || filtered.length === 0) return [];
    return filtered.map((e, idx) => ({
      name: e.universitas,
      count: Number(e.intern_count) || 0,
      Avg: Math.round(Number(e.average_score) || 0),
      color: universityDataFallback.find((u) => u.name === e.universitas)?.color ?? UNI_COLOR_PALETTE[idx % UNI_COLOR_PALETTE.length],
    }));
  }, [dashboard, evalYear]);

  const evaluationGlobalAvg = useMemo(() => {
    const globals = dashboard?.interns?.evaluation_global || [];
    const matched = globals.find((g) => Number(g.year) === Number(evalYear));
    if (matched && matched.average_score !== undefined && matched.average_score !== null) {
      return Number(matched.average_score).toFixed(1);
    }
    if (!evaluationDataMemo || evaluationDataMemo.length === 0) return 'No data';
    const sum = evaluationDataMemo.reduce((s, x) => s + (Number(x.Avg) || 0), 0);
    return (sum / evaluationDataMemo.length).toFixed(1);
  }, [dashboard, evaluationDataMemo, evalYear]);

  return (
    <motion.div
      className="bg-[#F8FAFC] min-h-screen px-4 md:px-6 py-6 font-sans text-slate-800 -mt-8 -ml-4 -mr-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      ref={exportRef}
    >
      {/* 1. HEADER & FILTER */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 mt-4 ">
        <div>
          <h1 className={`text-[22px] font-bold ${textDarkBlue}`}>Admin Dashboard</h1>
          <p className="text-slate-500 text-xs">Monitoring kinerja dan sebaran peserta magang</p>
        </div>
        <div className="flex w-full md:w-auto items-center gap-2">
          <div className="flex flex-1 md:flex-none items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            <div className="w-full max-[768px]:w-1/2 sm:w-auto">
              <MonthYearPicker value={startDate} onChange={setStartDate} noInnerBox />
            </div>
            <span className="text-slate-300 font-bold text-xs">-</span>
            <div className="w-full max-[768px]:w-1/2 sm:w-auto">
              <MonthYearPicker value={endDate} onChange={setEndDate} noInnerBox />
            </div>
          </div>

          <button
            onClick={handleExport}
            disabled={exporting}
            aria-busy={exporting}
            aria-label="Export Data"
            className={`md:hidden w-11 h-11 rounded-xl bg-[#354C8F] hover:bg-[#2a3c70] text-white flex items-center justify-center shadow-md shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${exporting ? 'opacity-60 pointer-events-none' : ''}`}
          >
            <FileText size={18} />
          </button>

          <div className="hidden md:flex items-center gap-2">
            <button onClick={handleExport} disabled={exporting} aria-busy={exporting} className={`${btnSecondaryClass} ${exporting ? 'opacity-60 pointer-events-none' : ''}`}>
              <FileText size={16} />
              <span>{exporting ? 'Export' : 'Export Data'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. STAT CARDS */}
      <div ref={exportContentRef}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <StatCard icon={<Users size={20} />} title="Total Interns" value={activeInternsCount ?? '—'} />
          <StatCard icon={<School size={20} />} title="Institutions" value={totalUniversities ?? '—'} />
          <StatCard icon={<UserX size={20} />} title="Ending Soon" value={endingSoonCount ?? '—'} />
          <StatCard icon={<Activity size={20} />} title="Active Now" value={activeNowCount ?? '—'} />
        </div>

        {/* 3. MAIN GRID LAYOUT */}
        
        {/* ROW 1: ATTENDANCE (Left 8) & ENDING SOON (Right 4) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-6 lg:h-[420px]">
          
          {/* Attendance Chart */}
          <motion.div className="lg:col-span-8 bg-white rounded-[20px] shadow-sm border border-slate-100 p-5 flex flex-col h-full" variants={itemVariants}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4 shrink-0">
              <div>
                <h2 className={`text-[16px] font-bold ${textDarkBlue}`}>Overall Attendance Trends</h2>
                <p className="text-xs text-slate-400">Monitoring presence stats</p>
              </div>
              <div className="flex bg-slate-50 p-1 rounded-lg border border-slate-100">
                {["Month"].map((view) => (
                  <button
                    key={view}
                    onClick={() => setAttendanceView(view)}
                    className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${attendanceView === view ? "bg-[#203266] text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    {view}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 min-h-0">
                {chartMonthlyData && chartMonthlyData.length > 0 ? (
                    <AttendanceChart monthlyData={chartMonthlyData} weeklyData={weeklyDataFallback} view={attendanceView} />
                ) : (
                    <div className="h-full w-full flex items-center justify-center text-slate-400 text-xs">Loading chart...</div>
                )}
            </div>
          </motion.div>

          {/* Ending Soon List */}
          <motion.div className="lg:col-span-4 bg-white rounded-[20px] shadow-sm border border-slate-100 p-5 flex flex-col h-full overflow-hidden" variants={itemVariants}>
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div>
                        <h2 className={`text-[16px] font-bold ${textDarkBlue}`}>Ending Soon (All interns)</h2>
                        <p className="text-xs text-slate-400">Internships ending soon — not filtered by period</p>
              </div>
              <div className="flex items-center gap-3 -mt-8">
                <span onClick={() => navigate('/admin/ending-soon')} className="text-sm font-bold text-[#354C8F] hover:underline cursor-pointer whitespace-nowrap">View All</span>
                {/* <div className="w-7 h-7 rounded-full bg-orange-50 flex items-center justify-center text-orange-500">
                  <UserX size={14} />
                </div> */}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar">
              {endingInterns && endingInterns.length > 0 ? (
                endingInterns.map((intern) => (
                  <div
                    key={intern.id ?? intern.userId ?? intern.studentId}
                    onClick={() => {
                      const targetId = intern.studentId ?? intern.userId ?? intern.id;
                      navigate(`/admin/interns/${targetId}`);
                    }}
                    className="group p-3 rounded-xl border border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm transition-all duration-200 cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm leading-tight">{intern.name}</h4>
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{intern.university}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${intern.daysLeft <= 7 ? 'bg-red-50 text-red-600 border-red-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>
                        {intern.daysLeft} Days
                      </span>
                    </div>
                    
                    <div className="border-t border-slate-50 my-2"></div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                        <Calendar size={12} className="text-slate-400" />
                        <span>{intern.endDate ? new Date(intern.endDate).toLocaleDateString('en-GB') : '-'}</span>
                      </div>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-slate-300 bg-slate-50 group-hover:bg-[#203266] group-hover:text-white transition-all">
                        <ArrowUpRight size={12} />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-full w-full flex items-center justify-center text-slate-400 text-center p-6">
                  <div>
                    <p className="font-semibold text-sm text-slate-700 mb-1">No interns ending soon</p>
                    <p className="text-xs text-slate-400">Interns with internship ending within 30 days will appear here.</p>
                  </div>
                </div>
              )}
            </div>

            {/* 'View All' moved to header as clickable text; bottom button removed */}
          </motion.div>
        </div>

        {/* ROW 2: UNIVERSITIES & MAJORS (8:4 Split) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-6">
            {/* University Distribution */}
          <motion.div className="lg:col-span-8 bg-white rounded-[20px] shadow-sm border border-slate-100 p-5" variants={itemVariants}>
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className={`text-[16px] font-bold ${textDarkBlue}`}>Institution Distribution</h2>
                        <p className="text-xs text-slate-400">Top institutions by student count</p>
                    </div>
                </div>

                {topUniversities && topUniversities.length > 0 ? (
                    <UniversityChart topUniversities={topUniversities} />
                ) : (
                    <div className="h-[220px] w-full flex items-center justify-center text-slate-400 text-xs">No university data</div>
                )}

                <div className="border-t border-slate-100 pt-3">
                    <div className="flex justify-between items-center cursor-pointer p-1.5 hover:bg-slate-50 rounded-lg transition-colors" onClick={() => setShowAllUniversities(!showAllUniversities)}>
                        <span className="text-xs font-bold text-slate-600">Other Universities ({otherUniversities.length})</span>
                        <ChevronDown size={14} className={`text-slate-400 transition-transform duration-300 ${showAllUniversities ? "rotate-180" : ""}`} />
                    </div>
                    
                    <AnimatePresence>
                        {showAllUniversities && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2 pl-1">
                                    {otherUniversities.map((univ, index) => (
                                        <div key={index} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg border border-slate-100">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-[#203266] font-bold text-[10px] shadow-sm border border-slate-100 shrink-0">
                                                    {univ.name.substring(0, 2).toUpperCase()}
                                                </div>
                                                <span className="text-xs font-semibold text-slate-700 truncate" title={univ.name}>{univ.name}</span>
                                            </div>
                                            <span className="text-[10px] font-bold text-[#4064CC] bg-blue-50 px-1.5 py-0.5 rounded shrink-0">{univ.count}</span>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>

            {/* Major Distribution */}
            <motion.div className="lg:col-span-4 bg-white rounded-[20px] shadow-sm border border-slate-100 p-5" variants={itemVariants}>
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className={`text-[16px] font-bold ${textDarkBlue}`}>Major Distribution</h2>
                        <p className="text-xs text-slate-400">Top study programs by intern count</p>
                    </div>
                </div>

                <div className="space-y-2.5">
                    {programDistribution.map((p, i) => (
                        <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: p.color }}>
                                    {p.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-slate-700">{p.name}</p>
                                    <p className="text-[10px] text-slate-400">{p.count} interns · {p.pct ?? 0}%</p>
                                </div>
                            </div>
                            <div className="w-40">
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-1.5 rounded-full" style={{ width: `${Math.min((p.count / (totalInterns || 1)) * 100, 100)}%`, backgroundColor: p.color }}></div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>

        {/* ROW 3: EVALUATION & DEPARTMENT (8:4 Split) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            {/* Evaluation Chart (Span 8) */}
            <motion.div className="lg:col-span-8 bg-white rounded-[20px] shadow-sm border border-slate-100 p-5 h-full" variants={itemVariants}>
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <h3 className={`text-[16px] font-bold ${textDarkBlue}`}>Annual Evaluation</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Performance Comparison by Institution ({evalYear})</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <select value={evalYear} onChange={(e) => setEvalYear(Number(e.target.value))} className="text-xs border border-slate-200 rounded px-2 py-1 bg-white">
                        {yearOptions.map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                      <div className="text-right">
                        <span className="block text-[10px] text-slate-400 mb-0.5">Global Avg</span>
                        <div className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-bold border border-blue-100">
                          {evaluationGlobalAvg}
                        </div>
                      </div>
                    </div>
                </div>
                {evaluationDataMemo && evaluationDataMemo.length > 0 ? (
                  <EvaluationChart data={evaluationDataMemo} />
                ) : (
                  <div className="h-[250px] w-full flex items-center justify-center text-slate-400 text-sm">No evaluations yet</div>
                )}
            </motion.div>

            {/* Department Chart (Span 4) */}
            <motion.div className="lg:col-span-4 bg-white rounded-[20px] shadow-sm border border-slate-100 p-5 h-full" variants={itemVariants}>
                <div className="mb-2">
                    <h2 className={`text-[16px] font-bold ${textDarkBlue}`}>Division</h2>
                    <p className="text-xs text-slate-400">Interns by department</p>
                </div>
                <DepartmentChart data={departmentDataMemo} />
            </motion.div>
        </div>

      </div>
    </motion.div>
  );
};

export default DashboardAdmin;