import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Filter,
  X,
  Eye,
  Edit,
  ChevronLeft,
  ChevronRight,
  Clock,
  Calendar,
  Check,
  AlertTriangle,
  AlertCircle,
  Loader2,
  Download, // Tambah Icon Download
  MapPin,
  BarChart3,
  FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";
import apiClient from "../../api/axiosConfig";
import { useParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import SecureImage from "../../components/SecureImage";

// --- STYLES CONSTANTS ---
const btnPrimaryClass =
  "bg-[#354C8F] hover:bg-[#2a3c70] text-white py-3.5 px-6 rounded-xl font-bold text-sm shadow-md shadow-indigo-200 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
const btnSecondaryClass =
  "bg-white border border-slate-300 text-slate-700 py-3.5 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition-all active:scale-95";
const btnPrimarySmall =
  "bg-[#354C8F] text-white px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 hover:bg-[#2a3c70]";
const btnSuccessClass = "bg-[#22C55E] hover:bg-[#16A34A] text-white py-3.5 px-6 rounded-xl font-bold text-sm shadow-md shadow-green-200 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
const btnRejectClass = "bg-white border border-red-500 text-red-600 hover:bg-red-50 py-3.5 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
const textDarkBlue = "text-[#203266]";

// --- FIX ICON LEAFLET ---
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// --- SMALL HELPERS / COMPONENTS ---
const formatTimestamp = (value) => {
  if (!value) return '';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return String(value);
  }
};

const formatCoord = (n) => {
  const num = Number(n);
  if (Number.isNaN(num)) return '-';
  return num.toFixed(6);
};

const downloadLink = (id, url, filename) => {
  if (!url) return;
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'download';
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const StatusBadge = ({ status }) => {
  const s = String(status || "").toLowerCase();
  let styles = "text-[13px] bg-gray-100 text-gray-500 border-gray-200";
  
  // Logbook status mapping
  if (s.includes("approved")) {
    styles = "text-[13px] bg-green-50 text-green-600 border-green-200";
  } else if (s.includes("pending")) {
    styles = "text-[13px] bg-yellow-100 text-yellow-600 border-yellow-200";
  } else if (s.includes("revision")) {
    styles = "text-[13px] bg-red-50 text-red-600 border-red-200";
  } else if (s.includes("not yet")) {
    styles = "text-[13px] bg-slate-100 text-slate-600 border-slate-200";
  } else if (s.includes("not submitted") || s.includes("no logbook") || s.includes("can't submit")) {
    styles = "text-[13px] bg-red-50 text-red-600 border-red-200";
  } else if (s.includes("absent")) {
    styles = "text-[13px] bg-red-50 text-red-600 border-red-200";
  } else if (s.includes("rejected")) {
    styles = "text-[13px] bg-red-50 text-red-500 border-red-200";
  }
  
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[140px] h-[34px] px-3 rounded-lg text-xs font-bold border whitespace-nowrap ${styles}`}
    >
      {status}
    </span>
  );
};

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
    }, 200);
  }, [map]);
  return null;
}



// Helper: format date with 3-letter month (e.g., "15 Jan")
const formatShortDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  } catch (e) {
    return dateStr;
  }
};

// Helper: format date with day, short month and year (e.g., "15 Jan 2026")
const formatShortDateWithYear = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch (e) {
    return dateStr;
  }
};

// --- NEW COMPONENT: InternProfile (uses provided figma image by default) ---
export function InternProfile({ intern = {}, className = "", onViewAttendance, onProfileImageClick }) {
  const name = intern.name || "-";
  const id = intern.id || "-";
  const counts = intern.counts || { absent: 0, onLeave: 0, sick: 0, late: 0 };
  const attendanceCount = intern.attendanceCount ?? 0;

  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border border-slate-100 p-8 h-full w-full flex flex-col ${className}`}
    >
      {/* Profile Image */}
      <div className="flex justify-center mb-4">
        <div 
          className={`w-[120px] h-[120px] rounded-full overflow-hidden shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] bg-slate-100 flex items-center justify-center ${intern.profileImage ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
          onClick={() => {
            if (intern.profileImage && onProfileImageClick) {
              onProfileImageClick(intern.profileImage, name);
            }
          }}
        >
          {intern.profileImage ? (
            <SecureImage src={intern.profileImage} alt={name} className="w-full h-full object-cover" />
          ) : (
            <div className="text-slate-400">No photo</div>
          )}
        </div>
      </div>

      {/* Name and ID */}
      <div className="text-center mb-6">
        <p className="text-[18px] font-bold text-black">{name}</p>
        <p className="text-[14px] text-slate-600">{intern.jobPosition || intern.site || id || '-'}</p>
      </div>

      {/* Attendance accumulation info (moved under profile) */}
      <div className="w-full space-y-4">
        <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 to-white p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-slate-500">Attendance (Accumulation)</div>
            <button
              type="button"
              onClick={onViewAttendance}
              className="text-xs font-bold text-[#354C8F] hover:text-[#2a3c70] transition"
            >
              View &gt;
            </button>
          </div>
          <div className="font-bold text-slate-800 text-2xl">
            {intern.attendanceCount ?? 0} / {intern.totalWorkdays ?? 0}{" "}
            <span className="text-base text-slate-500 font-medium">({intern.totalWorkdays ? Math.round(((intern.attendanceCount ?? 0) / intern.totalWorkdays) * 100) : 0}%)</span>
          </div>

          {(() => {
            const total = Number(intern.totalWorkdays ?? 0);
            const present = Number(intern.attendanceCount ?? 0);
            const percent = total ? Math.round((present / total) * 100) : 0;

            return (
              <div className="mt-3 mb-4">
                <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full bg-[#354C8F]"
                    style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                  />
                </div>
              </div>
            );
          })()}

          <div className="grid grid-cols-2 gap-3">
            {(() => {
              const counts = intern.counts || { absent: 0, onLeave: 0, sick: 0, late: 0, earlyOut: 0, early_out: 0 };
              const attendanceTotal = Number(intern.attendanceCount ?? 0);
              const late = Number(counts.late ?? 0);
              const onTime = Math.max(0, attendanceTotal - late);
              const earlyOut = Number(counts.earlyOut ?? counts.early_out ?? 0);

              const leftCol = [
                { k: 'On Time', v: onTime, c: 'border-emerald-400 text-emerald-700 bg-emerald-50' },
                { k: 'Late', v: late, c: 'border-orange-400 text-orange-700 bg-orange-50' },
                { k: 'Early Out', v: earlyOut, c: 'border-amber-400 text-amber-700 bg-amber-50' },
              ];
              const rightCol = [
                { k: 'Sick', v: Number(counts.sick ?? 0), c: 'border-sky-400 text-sky-700 bg-sky-50' },
                { k: 'On Leave', v: Number(counts.onLeave ?? 0), c: 'border-slate-300 text-slate-600 bg-slate-50' },
                { k: 'Absent', v: Number(counts.absent ?? 0), c: 'border-red-400 text-red-700 bg-red-50' },
              ];

              return [leftCol, rightCol].map((col, colIdx) => (
                <div key={colIdx} className="flex flex-col gap-2">
                  {col.map((it, i) => (
                    <div
                      key={i}
                      className={`rounded-xl border px-3 py-2 flex items-center justify-between ${it.c}`}
                    >
                      <div className="text-[11px] font-bold uppercase tracking-wide">{it.k}</div>
                      <div className="text-lg font-black">{it.v}</div>
                    </div>
                  ))}
                </div>
              ));
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- NEW COMPONENT: LocationToday (stylized placeholder) ---
export function LocationToday({ location = null }) {
  return (
    <div className="bg-white rounded-[16px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] p-6 h-full">
      {/* Title */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-10 h-10 bg-[#2b277f] rounded-[10px] flex items-center justify-center">
          <MapPin className="w-5 h-5 text-white" />
        </div>
        <h3 className="text-[18px] font-bold text-[#2b277f]">Location Today</h3>
      </div>

      {/* Map Placeholder */}
      <div className="w-full h-[200px] bg-gray-200 rounded-[12px] overflow-hidden relative">
        {/* Simple map-like visualization */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-blue-50">
          {/* Road lines */}
          <div className="absolute top-[40%] left-0 right-0 h-px bg-gray-300"></div>
          <div className="absolute top-0 bottom-0 left-[60%] w-px bg-gray-300"></div>

          {/* Location marker */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="w-16 h-16 bg-[#2b277f] bg-opacity-30 rounded-full flex items-center justify-center">
              <div className="w-8 h-8 bg-[#2b277f] rounded-full flex items-center justify-center">
                <MapPin className="w-4 h-4 text-white" />
              </div>
            </div>
          </div>

          {/* Grid overlay for map effect */}
          <div className="absolute inset-0 opacity-10">
            <svg className="w-full h-full">
              <defs>
                <pattern
                  id="grid"
                  width="40"
                  height="40"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 40 0 L 0 0 0 40"
                    fill="none"
                    stroke="gray"
                    strokeWidth="0.5"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- NEW COMPONENT: LogbookChart ---
const LogbookSummary = ({ summary = null, loading = false, rows = [], intern = {} }) => {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-[#354C8F]" size={32} />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 h-full flex items-center justify-center">
        <div className="text-slate-400">No summary available</div>
      </div>
    );
  }

  // compute summary values in component scope so they are available in JSX below
  const safeRows = Array.isArray(rows) ? rows : [];

  const pending = Number(summary.pending ?? 0);
  const verified = Number(summary.verified ?? summary.approved ?? 0);
  const revisionNeeded = Number(summary.revision_needed ?? summary.revision ?? 0);
  const notYet = summary.not_yet != null ? Number(summary.not_yet) : safeRows.filter((r) => Boolean(r?.isNotYet)).length;
  const notSubmit = summary.not_submit != null ? Number(summary.not_submit) : safeRows.filter((r) => Boolean(r?.isNotSubmit)).length;

  const absent = Number(intern.counts?.absent ?? 0);
  const sick = Number(intern.counts?.sick ?? 0);
  const onLeave = Number(intern.counts?.onLeave ?? 0);

  const totalDays = Number(summary.total ?? intern.totalWorkdays ?? (pending + verified + revisionNeeded + notYet + notSubmit)) || 0;
  const attendanceExcused = absent + sick + onLeave;
  // Prefer explicit attendance excused counts; fallback to summary.not_submit if attendance counts are not provided
  const excused = attendanceExcused > 0 ? attendanceExcused : (notSubmit || 0);
  const actionable = Math.max(0, totalDays - excused);
  // Completion percentage: prefer API-provided `summary.completion_rate` if available;
  // otherwise compute as Verified / Total Days (do NOT subtract excused).
  const completionPercent = summary.completion_rate != null
    ? Number(summary.completion_rate)
    : (totalDays > 0 ? (verified / totalDays) * 100 : 0);

  const realMax = Math.max(pending, verified, revisionNeeded, notYet, actionable, 0);
  const step = Math.ceil((realMax || 1) / 4);
  const axisMax = step * 4;

  const data = [
    { label: 'Pending', value: pending, color: 'bg-[#EAB308]', textColor: 'text-[#EAB308]' },
    { label: 'Verified', value: verified, color: 'bg-[#10b981]', textColor: 'text-[#10b981]' },
    { label: 'Revision', value: revisionNeeded, color: 'bg-[#EF4444]', textColor: 'text-[#EF4444]' },
    { label: 'Not Yet', value: notYet, color: 'bg-slate-300', textColor: 'text-slate-700' },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-8">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2b277f] to-[#2e5ecb] flex items-center justify-center shadow">
          <BarChart3 size={14} className="text-white" />
        </div>
        <div>
          <div className="text-[13px] font-bold text-[#203266]">Logbook Summary</div>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {realMax === 0 && notYet === 0 && pending === 0 && verified === 0 && revisionNeeded === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-400">No logbook entries</div>
        ) : (
          <div className="mt-auto pt-4 pb-2">
            <div className="w-full h-[300px] relative mb-6">
              <div className="absolute inset-x-0 bottom-0 top-0 z-0">
                {[0, 1, 2, 3, 4].map((i) => {
                  const percentage = (i / 4) * 100;
                  return (
                    <div
                      key={i}
                      className="absolute w-full border-t border-dashed border-slate-200"
                      style={{ bottom: `${percentage}%` }}
                    ></div>
                  );
                })}
              </div>

              <div className="absolute left-0 top-0 bottom-0 w-8 pointer-events-none z-10">
                {[0, 1, 2, 3, 4].map((i) => {
                  const val = step * i;
                  const percentage = (i / 4) * 100;
                  return (
                    <div
                      key={i}
                      className="absolute right-0 w-full flex items-center justify-end"
                      style={{ bottom: `${percentage}%`, transform: 'translateY(50%)' }}
                    >
                     <span className="text-[11px] text-slate-400 px-2 text-right bg-white">{val}</span>
                    </div>
                  );
                })}
              </div>

              <div className="h-full ml-10 mr-2 flex items-end justify-center gap-6 relative z-20">
                {data.map((item, idx) => {
                  const heightPercent = (item.value / axisMax) * 100;
                  return (
                    <div key={idx} className="relative h-full w-14 flex flex-col justify-end group">
                      <div
                        className={`w-full ${item.color} rounded-t-md shadow-sm transition-all duration-300 relative cursor-pointer hover:brightness-110 hover:shadow-md`}
                        style={{ height: `${heightPercent}%`, minHeight: '1px' }}
                      >
                         <div className={`absolute -top-6 left-1/2 -translate-x-1/2 text-sm font-bold ${item.textColor}`}>
                            {item.value}
                         </div>
                      </div>

                      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs font-semibold text-slate-500 whitespace-nowrap">
                        {item.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="text-left border-t border-slate-100 pt-3">
          <p className="text-xs text-slate-500">
            <strong>Total Days:</strong> <span className="font-bold text-slate-800">{totalDays}</span> &nbsp;|&nbsp; <strong>Actionable:</strong> <span className="font-bold text-slate-800">{actionable}</span> &nbsp;|&nbsp; <strong>Excused (Sick/Leave/Absent):</strong> <span className="font-bold text-slate-800">{excused}</span>
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Completion: <span className="font-bold text-slate-800">{totalDays > 0 ? `${completionPercent.toFixed(1)}%` : '0%'}</span>
          </p>
        </div>
      </div>
    </div>
  );
};

const LogbookChart = ({ chartData = null, loading = false, intern = {} }) => {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-[#354C8F]" size={32} />
      </div>
    );
  }

  // Render attendance summary similar to the Dashboard card
  const attendanceTotal = Number(intern.attendanceCount ?? 0);
  const absent = Number(intern.counts?.absent ?? 0);
  const sick = Number(intern.counts?.sick ?? 0);
  const onLeave = Number(intern.counts?.onLeave ?? 0);
  const total = Number(intern.totalWorkdays ?? (attendanceTotal + absent + sick + onLeave)) || 0;
  const monthName = new Date().toLocaleString('en-US', { month: 'long' });
  const percent = total ? Math.round((attendanceTotal / total) * 100) : 0;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-full flex flex-col justify-between">
      {/* Full intern information */}
      <div>
        <div className="mb-8 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2b277f] to-[#2e5ecb] flex items-center justify-center shadow">
            <BarChart3 size={14} className="text-white" />
          </div>
          <h3 className="text-[13px] font-bold text-[#203266]">Intern Information</h3>
        </div>
        <div className="grid grid-cols-1 gap-2 -mt-1">
          <div>
            <div className="text-[11px] text-slate-500">Institution</div>
            <div className="text-sm font-bold text-slate-800">{intern.university || '-'}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500">Major</div>
            <div className="text-sm font-bold text-slate-800">{intern.jurusan || '-'}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500">Division</div>
            <div className="text-sm font-bold text-slate-800">{intern.division || intern.divisi || '-'}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500">Site</div>
            <div className="text-sm font-bold text-slate-800">{intern.site || '-'}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500">Job Position</div>
            <div className="text-sm font-bold text-slate-800">{intern.jobPosition || '-'}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500">Internship Period</div>
            <div className="text-sm font-bold text-slate-800">{intern.mulaiMagang ? `${formatShortDateWithYear(intern.mulaiMagang)} — ${intern.akhirMagang ? formatShortDateWithYear(intern.akhirMagang) : ''}` : '-'}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500">Email</div>
            <div className="text-sm font-bold text-slate-800">{intern.email || '-'}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500">Phone</div>
            <div className="text-sm font-bold text-slate-800">{intern.phone || '-'}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500">Emergency Contact</div>
            <div className="text-sm font-bold text-slate-800">{intern.emergencyContactName || '-'}</div>
            {intern.emergencyContactPhone && <div className="text-xs text-slate-500 mt-1">{intern.emergencyContactPhone}</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

const DetailInternAdmin = () => {
  // Dev-only toggle to preview absent UI when data is empty.
  const DEBUG_DUMMY_ABSENT = false;
  // Demo/mock state - replace with API calls later
  const [intern, setIntern] = useState({
    name: "",
    id: "",
    profileImage: null,
    attendanceCount: 0,
    counts: { absent: 0, onLeave: 0, sick: 0, late: 0 },
  });
  const [evidence, setEvidence] = useState({
    clockIn: null,
    clockOut: null,
    clockInTime: null,
    clockOutTime: null,
  });
  // Separate locations for clock-in and clock-out maps (null until available)
  const [clockInLocation, setClockInLocation] = useState(null);
  const [clockOutLocation, setClockOutLocation] = useState(null);

  // Logbook chart state
  const [logbookChartData, setLogbookChartData] = useState(null);
  const [logbookChartLoading, setLogbookChartLoading] = useState(false);
  const [logbookSummary, setLogbookSummary] = useState(null);

  const resolveAbsensiPhotoUrl = (type, raw) => {
    if (!raw) return null;
    const rawStr = String(raw);
    const fileName = rawStr.split('?')[0].split('/').pop();
    if (!fileName) return null;
    return `/absensi/${type}/${encodeURIComponent(fileName)}`;
  };

  // Fetch logbook chart data
  const fetchLogbookChart = async () => {
    const id = params?.id;
    if (!id) return;
    setLogbookChartLoading(true);
    try {
      const res = await apiClient.get(`/admin/interns/${id}/logbook-chart`);
      const payload = res.data || {};
      const data = payload.data || {};
      
      // store summary fields (pending, verified, revision_needed, total, completion_rate)
      setLogbookSummary(data || null);

      if (data.chart_data && data.chart_data.datasets && data.chart_data.datasets.length > 0) {
        const dataset = data.chart_data.datasets[0];
        setLogbookChartData({
          labels: data.chart_data.labels || [],
          data: dataset.data || [],
          colors: dataset.backgroundColor || ["#FFA500", "#4CAF50", "#FF6B6B"],
        });
      } else {
        setLogbookChartData(null);
      }
    } catch (err) {
      console.error('Failed to fetch logbook chart:', err);
      setLogbookChartData(null);
    } finally {
      setLogbookChartLoading(false);
    }
  };

  // Fetch admin profile details (universitas, divisi, job position, mulai/akhir magang)
  // const fetchAdminProfile = async () => {
  //   const id = params?.id;
  //   if (!id) return;
  //   try {
  //     const res = await apiClient.get(`/admin/interns/${id}/profile`);
  //     const payload = res.data || {};
  //     const data = payload.data || {};
  //     const internData = data.intern || {};
  //     const mahasiswa = data.mahasiswa || {};

  //     setIntern((prev) => ({
  //       ...prev,
        
  //     }));
  //   } catch (err) {
  //     console.error('Failed to fetch admin profile:', err);
  //   }
  // }; 

  // Attendance summary is loaded from GET /admin/interns/:id; removed redundant helper to avoid duplicate fetches
  // (previously implemented in fetchAttendanceAccumulation)

  // Fetch attendance detail from endpoint
  const fetchAttendanceDetail = async (page = 1) => {
    const id = params?.id;
    if (!id) return;

    setAttendanceDetailLoading(true);
    try {
      const params_obj = new URLSearchParams();
      
      // Add pagination with dynamic per_page
      params_obj.append('page', page);
      params_obj.append('per_page', attendanceDetailPerPage);

      // Add date filters if using month picker
      if (attendanceMonth) {
        params_obj.append('start_date', `${attendanceMonth}-01`);
        // Calculate end date for the month
        const [year, month] = attendanceMonth.split('-');
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        params_obj.append('end_date', `${attendanceMonth}-${lastDay}`);
      }

      const res = await apiClient.get(`/admin/interns/${id}/attendance-detail?${params_obj.toString()}`);
      const payload = res.data || {};
      
      if (payload.success && payload.data) {
        setAttendanceDetailData(payload.data.attendance_records || []);
        setAttendanceDetailPagination(payload.data.pagination || null);
      } else {
        setAttendanceDetailData([]);
      }
    } catch (err) {
      console.error('Failed to fetch attendance detail:', err);
      setAttendanceDetailData([]);
    } finally {
      setAttendanceDetailLoading(false);
    }
  };

  // Router params & intern fetch state
  const params = useParams();
  const [internLoading, setInternLoading] = useState(false);

  // Table state
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  // Local input (typed) and applied query (used for fetching)
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [modalStatus, setModalStatus] = useState([]);
  // Applied filters (persist after Apply) — used to indicate active filters
  const [appliedStatus, setAppliedStatus] = useState([]);
  // Date filter state
  const [modalStartDate, setModalStartDate] = useState("");
  const [modalEndDate, setModalEndDate] = useState("");
  const [appliedStartDate, setAppliedStartDate] = useState("");
  const [appliedEndDate, setAppliedEndDate] = useState("");
  // Refs for date inputs so the calendar icon can open the native picker
  const modalStartDateRef = useRef(null);
  const modalEndDateRef = useRef(null);

  // Helper to open the native date picker across browsers
  const openDatePicker = (ref, options = {}) => {
    if (!ref || !ref.current) return;
    const { allowClickFallback = true } = options;
    try {
      // Preferred API (Chromium)
      if (typeof ref.current.showPicker === 'function') {
        ref.current.showPicker();
        return;
      }
      // Fallback: click the input (works on many browsers)
      if (allowClickFallback && typeof ref.current.click === 'function') {
        ref.current.click();
        return;
      }
      // Last resort: focus
      ref.current.focus();
    } catch (e) {
      console.warn('openDatePicker fallback failed', e);
      try { ref.current.focus(); } catch (_) {}
    }
  };

  // Log detail modal state and handlers
  const [isLogDetailOpen, setIsLogDetailOpen] = useState(false);
  const [selectedLogDetail, setSelectedLogDetail] = useState(null);
  const [feedbackInput, setFeedbackInput] = useState("");

  const [isAttendanceSummaryOpen, setIsAttendanceSummaryOpen] = useState(false);
  const now = new Date();
  const defaultAttendanceMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [attendanceMonth, setAttendanceMonth] = useState(defaultAttendanceMonth);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [attendancePickerYear, setAttendancePickerYear] = useState(now.getFullYear());
  
  // Attendance detail state from endpoint
  const [attendanceDetailData, setAttendanceDetailData] = useState(null);
  const [attendanceDetailLoading, setAttendanceDetailLoading] = useState(false);
  const [attendanceDetailPage, setAttendanceDetailPage] = useState(1);
  const [attendanceDetailPagination, setAttendanceDetailPagination] = useState(null);
  const [attendanceDetailPerPage, setAttendanceDetailPerPage] = useState(10);
  
  // Image preview state
  const [previewImageUrl, setPreviewImageUrl] = useState(null);
  const [previewImageLabel, setPreviewImageLabel] = useState('');
  
  // Ref used to skip the next effect-triggered fetch when we already triggered a manual fetch
  const skipNextFetchRef = useRef(false);
  
  const handleOpenDetail = (log) => { 
    setSelectedLogDetail(log); 
    setFeedbackInput(log.feedback || ""); 
    setIsLogDetailOpen(true); 
  };
  
  const handleCloseDetail = () => { 
    setSelectedLogDetail(null); 
    setFeedbackInput(""); 
    setIsLogDetailOpen(false); 
  };

  // Attendance detail modal state
  const [isAttendanceDetailOpen, setIsAttendanceDetailOpen] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState(null);
  const handleOpenAttendanceDetail = (att) => { setSelectedAttendance(att); setIsAttendanceDetailOpen(true); };
  const handleCloseAttendanceDetail = () => { setSelectedAttendance(null); setIsAttendanceDetailOpen(false); };

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);
  const [showingFrom, setShowingFrom] = useState(0);
  const [showingTo, setShowingTo] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Attendance pagination
  const [attendanceCurrentPage, setAttendanceCurrentPage] = useState(1);
  const [attendanceTotalPages, setAttendanceTotalPages] = useState(1);
  const itemsPerPageAttendance = 5;

  // Helper: format duration from start/end times (e.g., "08:00:00" -> "4 Hours")
  const formatDuration = (start, end) => {
    if (!start || !end) return "-";
    try {
      const [sh, sm] = start.split(":");
      const [eh, em] = end.split(":");
      const startMs = (parseInt(sh, 10) || 0) * 3600 * 1000 + (parseInt(sm, 10) || 0) * 60 * 1000;
      const endMs = (parseInt(eh, 10) || 0) * 3600 * 1000 + (parseInt(em, 10) || 0) * 60 * 1000;
      let diff = endMs - startMs;
      if (diff < 0) diff = 0; // Guard: do not show negative
      const minutes = Math.round(diff / 60000);
      if (minutes % 60 === 0) return `${Math.round(minutes / 60)} Hours`;
      return `${(minutes / 60).toFixed(1).replace(/\.0$/, "")} Hours`;
    } catch (e) {
      return "-";
    }
  };

  // Helper: get status badge for attendance detail from endpoint
  const getAttendanceStatusBadge = (record) => {
    if (!record) return { label: 'Unknown', badgeClass: 'bg-gray-50 text-gray-600 border-gray-200' };

    const status = String(record.attendance_status || '').toLowerCase();
    const lateMinutes = record.clock_in?.lama_telat || 0;
    const isEarly = record.clock_out?.early === true;
    
    // Prioritize Early over Late
    if (isEarly) {
      return { label: 'Early Out', badgeClass: 'bg-yellow-50 text-yellow-700 border-yellow-200' };
    }
    
    if (status === 'ontime') {
      return { label: 'On Time', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    } else if (status === 'late') {
      const label = lateMinutes > 0 ? `Late ${lateMinutes}m` : 'Late';
      return { label, badgeClass: 'bg-orange-50 text-orange-700 border-orange-200' };
    } else if (status === 'incomplete') {
      return { label: 'Absent', badgeClass: 'bg-red-50 text-red-700 border-red-200' };
    } else if (status === 'absent') {
      return { label: 'Absent', badgeClass: 'bg-red-50 text-red-700 border-red-200' };
    } else if (status === 'sick') {
      return { label: 'Sick', badgeClass: 'bg-sky-50 text-sky-700 border-sky-200' };
    } else if (status === 'on_leave') {
      return { label: 'On Leave', badgeClass: 'bg-slate-50 text-slate-600 border-slate-200' };
    } else if (status === 'corrected') {
      // Check if corrected is ontime or late
      if (lateMinutes > 0) {
        const label = `Late ${lateMinutes}m`;
        return { label, badgeClass: 'bg-orange-50 text-orange-700 border-orange-200' };
      }
      return { label: 'On Time', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    } else if (status === 'weekend') {
      return { label: 'Weekend', badgeClass: 'bg-indigo-50 text-indigo-600 border-indigo-200' };
    } else if (status === 'holiday') {
      return { label: 'Holiday', badgeClass: 'bg-pink-50 text-pink-700 border-pink-200' };
    }
    
    return { label: 'Not Submitted', badgeClass: 'bg-gray-50 text-gray-600 border-gray-200' };
  };

  // Helper: get reason text for attendance
  const getAttendanceReason = (record) => {
    if (!record) return '-';

    // Check if only clock_in exists (no clock_out) = absent
    if (record.clock_in && !record.clock_out && record.attendance_status !== 'holiday' && record.attendance_status !== 'weekend') {
      return 'Absent (No Clock Out)';
    }

    // Check if there's a sick leave or permission (izin)
    if (record.izin) {
      return `${record.izin.jenis} - ${record.izin.keterangan || '-'}`;
    }

    // Check if there's a correction (koreksi)
    if (record.koreksi) {
      return `Koreksi - ${record.koreksi.alasan || '-'}`;
    }

    // Return explicit early out remark from response
    if (record.clock_out && record.clock_out.remark) {
      return record.clock_out.remark;
    }

    return '-';
  };

  // Map UI status labels to API status_verifikasi values for logbook
  const mapStatusForLogbookApi = (statuses = []) => {
    const map = {
      'Approved': 'verified',
      'Pending': 'pending',
      'Revision': 'revision_needed',
      'Not Yet': 'not_yet',
    };
    const mapped = statuses.map(s => map[s] || String(s).toLowerCase()).filter(Boolean);
    return Array.from(new Set(mapped));
  };

  // Format work hours from HH:MM to hours and minutes object
  const formatWorkHours = (timeStr) => {
    if (!timeStr) return { hours: 0, minutes: 0 };
    const parts = String(timeStr).split(':');
    if (parts.length !== 2) return { hours: 0, minutes: 0 };
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (isNaN(hours) || isNaN(minutes)) return { hours: 0, minutes: 0 };
    
    return { hours, minutes };
  };

  // Fetch daily summary (logbook + attendance combined)
  const fetchDailySummary = async (page = 1, statusFilters = appliedStatus, query = undefined, startDate = appliedStartDate, endDate = appliedEndDate) => {
    const id = params?.id;
    if (!id) return;
    setLoading(true);
    try {
      const paramsObj = { page, per_page: itemsPerPage };
      const q = String(query !== undefined ? query : searchQuery || '').trim();
      if (q) {
        paramsObj.q = q;
        paramsObj.search = q;
      }
      if (statusFilters && statusFilters.length > 0) {
        const mapped = mapStatusForLogbookApi(statusFilters);
        if (mapped.length > 0) paramsObj.status_verifikasi = mapped.join(',');
      }
      // Add date range parameters
      if (startDate) paramsObj.start_date = startDate;
      if (endDate) paramsObj.end_date = endDate;

      const res = await apiClient.get(`/admin/interns/${id}/daily-summary`, { params: paramsObj });
      const payload = res.data || {};

      // DEBUG: Log payload and params for troubleshooting pagination
      try {
        console.debug("[DetailInternAdmin] fetchDailySummary - params:", paramsObj, "page:", page, "itemsPerPage:", itemsPerPage);
        console.debug("[DetailInternAdmin] fetchDailySummary - payload keys:", Object.keys(payload), payload.data ? { daily_summary_length: (payload.data.daily_summary || []).length, pagination: payload.data.pagination } : { daily_summary_length: (payload.daily_summary || []).length, pagination: payload.pagination });
      } catch (e) {
        console.debug("[DetailInternAdmin] fetchDailySummary - debug log failed", e);
      }
      
      // Handle both possible response structures
      let dailySummary = [];
      let paginationData = {};
      
      // Check if response has nested data.daily_summary structure
      if (payload.data && Array.isArray(payload.data.daily_summary)) {
        dailySummary = payload.data.daily_summary;
        paginationData = payload.data.pagination || {};
      }
      // Or if it has direct daily_summary at root level
      else if (Array.isArray(payload.daily_summary)) {
        dailySummary = payload.daily_summary;
        paginationData = payload.pagination || {};
      }

      let mapped = (dailySummary || []).map((item, idx) => {
        // Extract attendance data from attendance object
        const attendance = item.attendance || {};
        const logbook = item.logbooks || {};
        const startTime = attendance.jam_masuk || '-';
        const endTime = attendance.jam_pulang || '-';
        
        // Use durasi_kerja from attendance if available (format: "HH:MM"), else calculate
        let duration = '-';
        if (attendance.durasi_kerja) {
          duration = attendance.durasi_kerja;
        } else if (attendance.durasi_kerja_menit) {
          const totalMinutes = attendance.durasi_kerja_menit;
          const hours = Math.floor(totalMinutes / 60);
          const minutes = totalMinutes % 60;
          duration = minutes > 0 ? `${hours}:${String(minutes).padStart(2, '0')}` : `${hours}:00`;
        }

        // Get logbook status if available - check flags first, then status_verifikasi
        let logbookStatus = '-';
        // Priority 1: Check if_not_yet and is_not_submit flags
        if (item.is_not_yet) {
          logbookStatus = 'Not Yet';
        } else if (item.is_not_submit) {
          // Differentiate between absent and sick/leave
          const dayStatus = String(item.status || '').toLowerCase();
          if (dayStatus === 'absent') {
            logbookStatus = 'No logbook submitted';
          } else if (dayStatus === 'sick' || item.leave_requests) {
            logbookStatus = "Can't submit logbook";
          } else {
            logbookStatus = 'Not Submitted';
          }
        } else if (logbook.status_verifikasi) {
          // Priority 2: Check logbook status_verifikasi
          const status = String(logbook.status_verifikasi).toLowerCase();
          if (status === 'verified') logbookStatus = 'Approved';
          else if (status === 'pending') logbookStatus = 'Pending';
          else if (status === 'revision_needed' || status === 'revision') logbookStatus = 'Revision';
          else if (status === 'not_yet') logbookStatus = 'Not Yet';
          else logbookStatus = logbook.status_verifikasi;
        }
        const clockInWithMinutesLate = startTime !== '-' && attendance.minutes_late > 0 ? `${startTime} (+${attendance.minutes_late}m late)` : startTime;

        return {
          id: logbook.logbooks_id || `${item.tanggal}-${startTime}`,
          logbookId: logbook.logbooks_id, // ID for API actions
          raw_day_status: item.status ?? null,
          attendanceRaw: attendance,
          izinRaw: item.leave_requests || null,
          koreksiRaw: item.koreksi || null,
          logbookRaw: logbook,
          isNotSubmit: item.is_not_submit || false,
          isNotYet: item.is_not_yet || false,
          date: item.tanggal ? new Date(item.tanggal).toLocaleDateString('en-GB') : "-",
          dateRaw: item.tanggal,
          desc: logbook.deskripsi_kegiatan || `Attendance - ${item.status}` || "-",
          duration: duration,
          clockInTime: clockInWithMinutesLate,
          clockOutTime: endTime,
          status: logbookStatus !== '-' ? logbookStatus : (item.status === 'ontime' ? 'Approved' : item.status === 'late' ? 'Pending' : item.status),
          // EVIDENCE FILES MAPPING
          evidenceFiles: Array.isArray(logbook.bukti_kegiatan) ? logbook.bukti_kegiatan : (logbook.bukti_kegiatan ? [logbook.bukti_kegiatan] : []),
          feedback: logbook.feedback || "",
          submittedAt: logbook.submitted_at || logbook.created_at,
          updatedAt: logbook.updated_at,
          // Timestamps for timeline (API-provided timestamp fields)
          created_at: logbook.created_at || null,
          submitted_at: logbook.submitted_at || null,
          verified_at: logbook.verified_at || null,
          revision_at: logbook.revision_at || null,
          
          // Attendance data
          jam_masuk: attendance.jam_masuk,
          jam_pulang: attendance.jam_pulang,
          durasi_kerja: attendance.durasi_kerja,
          foto_masuk: attendance.foto_masuk ? `absensi/foto-masuk/${attendance.foto_masuk.split('/').pop()}` : null,
          foto_pulang: attendance.foto_pulang ? `absensi/foto-pulang/${attendance.foto_pulang.split('/').pop()}` : null,
          attendance_status: item.status,
          late_minutes: attendance.minutes_late || null,
          early_minutes: attendance.early || null,
          attendance_reason: item.koreksi?.alasan || null,
          latitude_masuk: attendance.lat_masuk || null,
          longitude_masuk: attendance.lon_masuk || null,
          latitude_pulang: attendance.lat_pulang || null,
          longitude_pulang: attendance.lon_pulang || null,
        };
      });

      setLogs(mapped);
      // Ensure numeric pagination values (use server pagination when available)
      const newCurrent = Number(paginationData.current_page ?? page) || Number(page);
      const newTotal = Number(paginationData.last_page ?? Math.max(1, Math.ceil((paginationData.total ?? mapped.length) / itemsPerPage))) || 1;
      setCurrentPage(newCurrent);
      setTotalPages(newTotal);
      setTotalEntries(Number(paginationData.total ?? mapped.length) || mapped.length);
      setShowingFrom(Number(paginationData.from ?? (mapped.length ? (newCurrent - 1) * itemsPerPage + 1 : 0)) || 0);
      setShowingTo(Number(paginationData.to ?? (mapped.length ? (newCurrent - 1) * itemsPerPage + mapped.length : 0)) || 0);
    } catch (err) {
      console.error('Failed to fetch daily summary:', err);
      setLogs([]);
      setTotalEntries(0);
      setTotalPages(1);
      setShowingFrom(0);
      setShowingTo(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // fetch when intern id, page, applied filters or query changes
    // Pass applied filters explicitly to avoid relying on default closure values
    if (skipNextFetchRef.current) {
      // A manual fetch has already been triggered; skip this one
      skipNextFetchRef.current = false;
      return;
    }
    fetchDailySummary(currentPage, appliedStatus, undefined, appliedStartDate, appliedEndDate);
  }, [params?.id, currentPage, searchQuery, itemsPerPage, appliedStatus, appliedStartDate, appliedEndDate]);

  useEffect(() => {
    const buildMonthKeys = () => {
      const startRaw = intern.mulaiMagang;
      const endRaw = intern.akhirMagang || new Date().toISOString();
      const startDate = startRaw ? new Date(startRaw) : null;
      const endDate = endRaw ? new Date(endRaw) : null;

      if (startDate && endDate && !Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())) {
        const months = [];
        const cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        while (cur <= end) {
          months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
          cur.setMonth(cur.getMonth() + 1);
        }
        return months;
      }

      const logMonths = Array.from(
        new Set(
          (logs || [])
            .map((r) => r.dateRaw)
            .filter(Boolean)
            .map((d) => {
              const dt = new Date(d);
              if (Number.isNaN(dt.getTime())) return null;
              return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
            })
            .filter(Boolean)
        )
      );
      return logMonths.length > 0 ? logMonths : [defaultAttendanceMonth];
    };

    const months = buildMonthKeys();
    if (!months.includes(attendanceMonth)) {
      setAttendanceMonth(months[0]);
      const [y] = months[0].split("-");
      setAttendancePickerYear(Number(y));
    }
  }, [intern.mulaiMagang, intern.akhirMagang, logs, attendanceMonth, defaultAttendanceMonth]);

  useEffect(() => {
    // fetch logbook chart when intern id changes
    fetchLogbookChart();
    // Profile & attendance are included in GET /admin/interns/:id (handled by the main fetch below)
  }, [params?.id]);

  // Fetch attendance detail when attendance summary is opened
  useEffect(() => {
    if (isAttendanceSummaryOpen) {
      setAttendanceDetailPage(1);
      fetchAttendanceDetail(1);
    }
  }, [isAttendanceSummaryOpen]);

  // Fetch attendance detail when month changes
  useEffect(() => {
    if (isAttendanceSummaryOpen && attendanceDetailData) {
      setAttendanceDetailPage(1);
      fetchAttendanceDetail(1);
    }
  }, [attendanceMonth]);

  // Fetch intern details when route param changes
  useEffect(() => {
    const id = params?.id;
    if (!id) return;

    setInternLoading(true);
    apiClient
      .get(`/admin/interns/${id}`)
      .then((res) => {
        const payload = res.data || {};
        const d = payload.data || {};
        const user = d.user || {};
        const summary = d.attendance_summary || {};
        const today = d.today || {};

        const absent = Number(summary.total_absent ?? 0);
        const onLeave = Number(summary.total_on_leave ?? 0);
        const sick = Number(summary.total_sick ?? 0);
        const attendanceVal = Number(summary.total_attendance ?? 0);
        let totalWorkdaysVal = Number(summary.total_workdays ?? summary.total_hari_kerja ?? summary.total_work_days ?? summary.total_days ?? 0);
        if (totalWorkdaysVal === 0) {
          totalWorkdaysVal = attendanceVal + absent + onLeave + sick;
        }

        setIntern((prev) => ({
          ...prev,
          name: user.nama || user.nama_lengkap || user.name || prev.name,
          id: user.student_id || user.identifier || user.user_id || prev.id,
          profileImage: (user.foto || user.profile_image || (d.mahasiswa && d.mahasiswa.foto)) 
            ? `/mahasiswa/${id}/foto` 
            : null,
          university: user.universitas || (d.mahasiswa && d.mahasiswa.universitas) || prev.university,
          jurusan: user.jurusan || (d.mahasiswa && d.mahasiswa.jurusan) || prev.jurusan,
          division: user.division || user.divisi || (d.mahasiswa && d.mahasiswa.division) || prev.division,
          jobPosition: user.job_position || (d.mahasiswa && d.mahasiswa.job_position) || prev.jobPosition,
          site: typeof user.site === 'string' ? user.site : (user.site && user.site.nama_site) || (d.site && d.site.nama_site) || prev.site,
          email: user.email || prev.email,
          phone: user.no_telp || user.nomor_telp || prev.phone,
          emergencyContactName: user.nama_kontak_darurat || (d.mahasiswa && d.mahasiswa.nama_kontak_darurat) || prev.emergencyContactName,
          emergencyContactPhone: user.nomor_darurat || (d.mahasiswa && d.mahasiswa.nomor_darurat) || prev.emergencyContactPhone,
          mulaiMagang: user.mulai_magang || prev.mulaiMagang,
          akhirMagang: user.akhir_magang || prev.akhirMagang,
          attendanceCount: attendanceVal,
          totalWorkdays: totalWorkdaysVal,
          counts: {
            absent: absent,
            onLeave: onLeave,
            sick: sick,
            late: Number(summary.total_late ?? 0),
          },
        }));

        setEvidence((prev) => ({
          clockIn: resolveAbsensiPhotoUrl('foto-masuk', today?.masuk?.foto || today?.masuk?.photo) || prev.clockIn,
          clockOut: resolveAbsensiPhotoUrl('foto-pulang', today?.pulang?.foto || today?.pulang?.photo) || prev.clockOut,
          // Times (try multiple possible field names returned by backend)
          clockInTime: today?.masuk?.jam_masuk || today?.masuk?.jam || today?.masuk?.time || today?.masuk?.waktu || null,
          clockOutTime: today?.pulang?.jam_pulang || today?.pulang?.jam || today?.pulang?.time || today?.pulang?.waktu || null,
        }));

        // Locations (try several possible field names)
        const tryParse = (v) => (v !== undefined && v !== null ? parseFloat(v) : null);
        if (d.latitude_masuk && d.longitude_masuk) {
          setClockInLocation({ lat: tryParse(d.latitude_masuk), lng: tryParse(d.longitude_masuk) });
        } else if (d.lat && d.lng) {
          setClockInLocation({ lat: tryParse(d.lat), lng: tryParse(d.lng) });
        } else if (today?.masuk && today.masuk.latitude && today.masuk.longitude) {
          setClockInLocation({ lat: tryParse(today.masuk.latitude), lng: tryParse(today.masuk.longitude) });
        }

        if (d.latitude_pulang && d.longitude_pulang) {
          setClockOutLocation({ lat: tryParse(d.latitude_pulang), lng: tryParse(d.longitude_pulang) });
        } else if (d.lat_pulang && d.lng_pulang) {
          setClockOutLocation({ lat: tryParse(d.lat_pulang), lng: tryParse(d.lng_pulang) });
        } else if (today?.pulang && today.pulang.latitude && today.pulang.longitude) {
          setClockOutLocation({ lat: tryParse(today.pulang.latitude), lng: tryParse(today.pulang.longitude) });
        }
      })
      .catch((err) => {
        console.error('Failed to fetch intern details:', err);
      })
      .finally(() => setInternLoading(false));
  }, [params?.id]);

  const toggleModalStatus = (s) => {
    if (modalStatus.includes(s))
      setModalStatus(modalStatus.filter((x) => x !== s));
    else setModalStatus([...modalStatus, s]);
  };

  // When opening the Filter modal, preload the modal controls with the currently applied filters
  useEffect(() => {
    if (isFilterOpen) {
      setModalStatus(Array.isArray(appliedStatus) ? appliedStatus : []);
      setModalStartDate(appliedStartDate || "");
      setModalEndDate(appliedEndDate || "");
    }
  }, [isFilterOpen]);

  const resetModalFilters = () => {
    // Clear modal selections and applied filters (remove active dot) and reset to first page
    setModalStatus([]);
    setAppliedStatus([]);
    setModalStartDate("");
    setModalEndDate("");
    setAppliedStartDate("");
    setAppliedEndDate("");
    setIsFilterOpen(false);
    setSearchInput("");
    setSearchQuery("");
    // Reset paging and trigger a single fetch immediately
    setCurrentPage(1);

    // Prevent the effect from double-fetching — mark skip and manually fetch once
    skipNextFetchRef.current = true;
    fetchDailySummary(1, [], undefined, "", "");
  };
  const applyModalFilters = () => {
    // Persist applied filters, close modal and reset to first page.
    // Trigger a single fetch immediately and skip the effect's fetch to avoid double requests.
    setAppliedStatus(modalStatus);
    setAppliedStartDate(modalStartDate);
    setAppliedEndDate(modalEndDate);
    setIsFilterOpen(false);
    setCurrentPage(1);

    skipNextFetchRef.current = true;
    fetchDailySummary(1, modalStatus, undefined, modalStartDate, modalEndDate);
  };

  const handleViewFile = (logbookId, fileUrl, displayName) => {
    // If fileUrl is already a full URL from API, use it directly
    const isFullUrl = fileUrl && (fileUrl.startsWith('http://') || fileUrl.startsWith('https://'));
    const urlToUse = isFullUrl ? fileUrl : `/logbook/${logbookId}/file/${encodeURIComponent(String(fileUrl).split('/').pop())}`;
    const rawName = String(fileUrl).split('/').pop();
    const viewerUrl = `/admin/file-viewer?url=${encodeURIComponent(urlToUse)}&name=${encodeURIComponent(displayName || rawName)}`;
    window.open(viewerUrl, '_blank');
  };

  const handleDownloadFile = async (logbookId, fileUrl, displayName) => {
    try {
      const rawName = String(fileUrl).split('/').pop();
      const downloadName = displayName || rawName;
      
      // Always use apiClient to avoid CORS issues
      // apiClient will handle auth headers and CORS properly
      const res = await apiClient.get(fileUrl, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Error downloading file:', err);
    }
  };

  if (isAttendanceSummaryOpen) {
    const monthKeys = (() => {
      const startRaw = intern.mulaiMagang;
      const endRaw = intern.akhirMagang || new Date().toISOString();
      const startDate = startRaw ? new Date(startRaw) : null;
      const endDate = endRaw ? new Date(endRaw) : null;

      if (startDate && endDate && !Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())) {
        const months = [];
        const cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        while (cur <= end) {
          months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
          cur.setMonth(cur.getMonth() + 1);
        }
        return months;
      }

      // Fallback: generate months from attendanceDetailData if available
      const attendanceMonths = Array.from(
        new Set(
          (attendanceDetailData || [])
            .map((r) => r.tanggal)
            .filter(Boolean)
            .map((d) => {
              const dt = new Date(d);
              if (Number.isNaN(dt.getTime())) return null;
              return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
            })
            .filter(Boolean)
        )
      );
      return attendanceMonths.length > 0 ? attendanceMonths : [defaultAttendanceMonth];
    })();

    const monthLabel = (key) => {
      const [y, mm] = key.split("-");
      return new Date(Number(y), Number(mm) - 1, 1).toLocaleString("en-US", {
        month: "long",
        year: "numeric",
      });
    };

    const yearMin = Math.min(...monthKeys.map((m) => Number(m.split("-")[0])));
    const yearMax = Math.max(...monthKeys.map((m) => Number(m.split("-")[0])));
    const monthShort = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    return (
      <div className="pt-8 pb-8 pl-2 w-full bg-[#F8FAFC] min-h-screen font-sans text-slate-800 -mt-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsAttendanceSummaryOpen(false)}
                className="w-10 h-10 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-center hover:bg-slate-50 transition"
                aria-label="Back"
              >
                <ChevronLeft size={18} className="text-slate-700" />
              </button>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Attendance Detail</h2>
                <div className="text-xs text-slate-500">Monthly view</div>
              </div>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsMonthPickerOpen((v) => !v)}
                className="flex items-center gap-3 px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white shadow-sm hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 min-w-[220px] justify-between"
              >
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-slate-500" />
                  <span className="uppercase tracking-wide">{monthLabel(attendanceMonth)}</span>
                </div>
                <ChevronRight size={16} className={`text-slate-500 transition ${isMonthPickerOpen ? "-rotate-90" : "rotate-90"}`} />
              </button>

              {isMonthPickerOpen && (
                <div className="absolute right-0 mt-2 w-[320px] bg-white rounded-2xl shadow-xl border border-slate-100 p-4 z-20">
                  <div className="grid grid-cols-3 gap-2 mb-4 pb-4 border-b border-slate-100">
                    {monthShort.map((m, idx) => {
                      const key = `${attendancePickerYear}-${String(idx + 1).padStart(2, "0")}`;
                      const isEnabled = monthKeys.includes(key);
                      const isActive = key === attendanceMonth;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            if (!isEnabled) return;
                            setAttendanceMonth(key);
                            setIsMonthPickerOpen(false);
                          }}
                          className={`py-2 rounded-lg text-xs font-semibold transition ${
                            isActive
                              ? "bg-[#354C8F] text-white"
                              : isEnabled
                                ? "bg-white text-slate-600 border border-transparent hover:border-slate-200"
                                : "text-slate-300 cursor-not-allowed"
                          }`}
                          disabled={!isEnabled}
                        >
                          {m}
                        </button>
                      );
                    })}
                  </div>
                  {/* Show available years */}
                  {monthKeys.length > 0 && (
                    <div className="flex flex-wrap gap-2 justify-center">
                      {Array.from(new Set(monthKeys.map(m => m.split('-')[0]))).sort().map((year) => (
                        <button
                          key={year}
                          type="button"
                          onClick={() => setAttendancePickerYear(parseInt(year, 10))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                            parseInt(year, 10) === attendancePickerYear
                              ? "bg-[#354C8F] text-white border-[#354C8F]"
                              : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          {year}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[860px]">
              <thead>
                <tr className="text-xs font-bold text-slate-700 border-b border-slate-100 bg-slate-50/60">
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Clock In</th>
                  <th className="px-3 py-3">Clock Out</th>
                  <th className="px-3 py-3">Work Duration</th>
                  <th className="px-3 py-3 text-center">Status</th>
                  <th className="px-3 py-3">Reason</th>
                </tr>
              </thead>
              <tbody className="text-sm text-slate-600">
                {attendanceDetailLoading ? (
                  <tr>
                    <td colSpan="6" className="px-3 py-8 text-center">
                      <Loader2 className="animate-spin text-[#354C8F] mb-2 inline" size={24} />
                      <div>Loading attendance data...</div>
                    </td>
                  </tr>
                ) : (attendanceDetailData && attendanceDetailData.length > 0) ? (
                  attendanceDetailData.map((record, idx) => {
                    const { label, badgeClass } = getAttendanceStatusBadge(record);
                    const reason = getAttendanceReason(record);
                    const dateStr = record.tanggal ? new Date(record.tanggal).toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '-';
                    const clockInTime = record.clock_in?.waktu || '-';
                    const clockOutTime = record.clock_out?.waktu || '-';
                    const workDuration = record.work_duration?.formatted || '-';

                    return (
                      <tr key={`${record.tanggal}-${idx}`} className="border-b border-slate-50 last:border-none">
                        <td className="px-3 py-3 whitespace-nowrap text-sm font-medium">{dateStr} ({record.hari || '-'})</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-slate-700">{clockInTime}</div>
                            {record.clock_in?.foto && (
                              <button
                                type="button"
                                onClick={() => handleOpenAttendanceDetail({
                                  type: 'in',
                                  tanggal: record.tanggal,
                                  jam_masuk: record.clock_in?.waktu,
                                  jam_pulang: record.clock_out?.waktu,
                                  durasi_kerja: record.work_duration?.formatted,
                                  foto_masuk: record.clock_in?.foto,
                                  foto_pulang: record.clock_out?.foto,
                                  latitude_masuk: record.clock_in?.latitude,
                                  longitude_masuk: record.clock_in?.longitude,
                                  latitude_pulang: record.clock_out?.latitude,
                                  longitude_pulang: record.clock_out?.longitude,
                                })}
                                className="w-6 h-6 rounded-full overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-[#354C8F] transition"
                                title="View clock-in photo"
                              >
                                <SecureImage src={record.clock_in.foto} alt="Clock In" className="w-full h-full object-cover" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-slate-700">{clockOutTime}</div>
                            {record.clock_out?.foto && (
                              <button
                                type="button"
                                onClick={() => handleOpenAttendanceDetail({
                                  type: 'out',
                                  tanggal: record.tanggal,
                                  jam_masuk: record.clock_in?.waktu,
                                  jam_pulang: record.clock_out?.waktu,
                                  durasi_kerja: record.work_duration?.formatted,
                                  foto_masuk: record.clock_in?.foto,
                                  foto_pulang: record.clock_out?.foto,
                                  latitude_masuk: record.clock_in?.latitude,
                                  longitude_masuk: record.clock_in?.longitude,
                                  latitude_pulang: record.clock_out?.latitude,
                                  longitude_pulang: record.clock_out?.longitude,
                                })}
                                className="w-6 h-6 rounded-full overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-[#354C8F] transition"
                                title="View clock-out photo"
                              >
                                <SecureImage src={record.clock_out.foto} alt="Clock Out" className="w-full h-full object-cover"
                                />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm font-medium">{workDuration}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex items-center justify-center px-4 py-2 rounded-lg border text-xs font-bold whitespace-nowrap min-w-[100px] ${badgeClass}`}>
                            {label}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-sm text-slate-600 max-w-xs truncate" title={reason}>
                          {reason}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {!attendanceDetailLoading && (!attendanceDetailData || attendanceDetailData.length === 0) && (
            <div className="text-sm text-slate-400 text-center py-6">No attendance data</div>
          )}

          {/* Pagination Controls */}
          {attendanceDetailPagination && (
            <div className="p-4 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0 border-t border-slate-100">
              {/* Showing info */}
              <div className="text-sm text-slate-500 text-center md:text-left order-2 md:order-1">
                Showing {attendanceDetailPagination.from} to {attendanceDetailPagination.to} of {attendanceDetailPagination.total} entries
              </div>

              {/* Pagination controls and per-page selector */}
              <div className="flex items-center gap-4 order-1 md:order-2">
                {/* Per page selector */}
                <div className="flex items-center gap-2">
                  <label className="text-xs md:text-sm font-medium text-slate-600 whitespace-nowrap">Per page:</label>
                  <select
                    value={attendanceDetailPerPage}
                    onChange={(e) => {
                      const newPerPage = parseInt(e.target.value, 10);
                      setAttendanceDetailPerPage(newPerPage);
                      setAttendanceDetailPage(1);
                      fetchAttendanceDetail(1);
                    }}
                    className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs md:text-sm font-medium text-slate-700 bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 cursor-pointer transition-all"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                  </select>
                </div>

                {/* Pagination buttons */}
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  {/* Previous button */}
                  <button
                    onClick={() => {
                      if (attendanceDetailPage > 1) {
                        const newPage = attendanceDetailPage - 1;
                        setAttendanceDetailPage(newPage);
                        fetchAttendanceDetail(newPage);
                      }
                    }}
                    disabled={attendanceDetailPage === 1}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-slate-200"
                    title="Previous page"
                  >
                    <ChevronLeft size={18} />
                  </button>

                  {/* Page numbers */}
                  {(() => {
                    const currentPage = attendanceDetailPage;
                    const lastPage = attendanceDetailPagination.last_page;
                    const pages = [];

                    // Always show first page
                    pages.push(1);

                    // Show pages around current page
                    const start = Math.max(2, currentPage - 1);
                    const end = Math.min(lastPage - 1, currentPage + 1);

                    if (start > 2) pages.push('...');
                    for (let i = start; i <= end; i++) pages.push(i);
                    if (end < lastPage - 1) pages.push('...');

                    // Always show last page if > 1
                    if (lastPage > 1) pages.push(lastPage);

                    return pages.map((p, idx) =>
                      p === '...' ? (
                        <div key={`dots-${idx}`} className="w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold text-slate-400 shrink-0">
                          ...
                        </div>
                      ) : (
                        <button
                          key={p}
                          onClick={() => {
                            setAttendanceDetailPage(p);
                            fetchAttendanceDetail(p);
                          }}
                          className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-colors shrink-0 ${
                            p === currentPage
                              ? 'bg-slate-100 text-[#27345A] border border-slate-200'
                              : 'text-slate-500 hover:bg-slate-50 border border-transparent'
                          }`}
                        >
                          {p}
                        </button>
                      )
                    );
                  })()}

                  {/* Next button */}
                  <button
                    onClick={() => {
                      if (attendanceDetailPage < attendanceDetailPagination.last_page) {
                        const newPage = attendanceDetailPage + 1;
                        setAttendanceDetailPage(newPage);
                        fetchAttendanceDetail(newPage);
                      }
                    }}
                    disabled={attendanceDetailPage === attendanceDetailPagination.last_page}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-slate-200"
                    title="Next page"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Inline Attendance Detail Preview Overlay (renders above Attendance Detail page) */}
          <AnimatePresence>
            {isAttendanceDetailOpen && selectedAttendance && (() => {
              const focusLabel = selectedAttendance.type === 'out' ? 'Clock Out' : 'Clock In';
              const rawLat = selectedAttendance.type === 'out'
                ? selectedAttendance.latitude_pulang
                : selectedAttendance.latitude_masuk;
              const rawLng = selectedAttendance.type === 'out'
                ? selectedAttendance.longitude_pulang
                : selectedAttendance.longitude_masuk;
              const activeLat = rawLat === null || rawLat === undefined || rawLat === '' ? NaN : Number(rawLat);
              const activeLng = rawLng === null || rawLng === undefined || rawLng === '' ? NaN : Number(rawLng);
              const hasMap = Number.isFinite(activeLat) && Number.isFinite(activeLng);
              const center = hasMap ? [activeLat, activeLng] : [-6.200000, 106.816666];
              const displayDate = selectedAttendance.tanggal
                ? new Date(selectedAttendance.tanggal).toLocaleDateString('en-GB')
                : '-';

              const stop = (e) => e.stopPropagation();

              return (
                <motion.div
                  className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={handleCloseAttendanceDetail}
                >
                  <div className="absolute inset-0 bg-black/50" />
                  <motion.div
                    className="relative w-[94vw] sm:w-[95vw] max-w-4xl bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden max-h-[88vh] flex flex-col"
                    initial={{ opacity: 0, y: 16, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 16, scale: 0.98 }}
                    onClick={stop}
                  >
                    <div className="flex items-center justify-between px-4 sm:px-4 py-3 sm:py-3 border-b border-slate-100 bg-slate-50/60">
                      <div>
                        <div className="text-sm font-extrabold text-[#27345A]">{focusLabel} Photo & Location</div>
                        <div className="text-xs text-slate-500 font-semibold">{displayDate}</div>
                      </div>
                      <button
                        type="button"
                        onClick={handleCloseAttendanceDetail}
                        className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition shrink-0"
                        aria-label="Close"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <div className="flex-1 p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 overflow-y-auto">
                      {/* Photo preview */}
                      <div className="rounded-2xl border border-slate-100 overflow-hidden bg-white">
                        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                          <div className="text-sm font-extrabold text-slate-700">Preview</div>
                          <div className="text-xs text-slate-500 font-semibold">{focusLabel}</div>
                        </div>
                        <div className="p-3 sm:p-4">
                          {selectedAttendance.type === 'in' && selectedAttendance.foto_masuk ? (
                            <div className="h-[220px] sm:h-[280px] lg:h-[320px] rounded-xl bg-slate-50 overflow-hidden flex items-center justify-center">
                              <SecureImage src={selectedAttendance.foto_masuk} alt="Clock In Photo" className="w-full max-h-full object-contain" />
                            </div>
                          ) : selectedAttendance.type === 'out' && selectedAttendance.foto_pulang ? (
                            <div className="h-[220px] sm:h-[280px] lg:h-[320px] rounded-xl bg-slate-50 overflow-hidden flex items-center justify-center">
                              <SecureImage src={selectedAttendance.foto_pulang} alt="Clock Out Photo" className="w-full max-h-full object-contain" />
                            </div>
                          ) : (
                            <div className="w-full h-[220px] sm:h-[280px] lg:h-[320px] rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 font-semibold">
                              No photo
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Map */}
                      <div className="rounded-2xl border border-slate-100 overflow-hidden bg-white">
                        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
                          <div className="text-sm font-extrabold text-slate-700">Map</div>
                          {hasMap ? (
                            <div className="flex items-center gap-2 sm:gap-3">
                              <div className="hidden sm:block text-xs text-slate-500 font-semibold whitespace-nowrap">
                                {formatCoord(activeLat)}, {formatCoord(activeLng)}
                              </div>
                              <a
                                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-extrabold text-[#354C8F] hover:bg-white hover:border-slate-300 transition whitespace-nowrap"
                                href={`https://www.google.com/maps?q=${activeLat},${activeLng}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Open Google Maps
                              </a>
                            </div>
                          ) : (
                            <div className="text-xs text-slate-500 font-semibold whitespace-nowrap">No coordinates</div>
                          )}
                        </div>
                        <div className="p-3 sm:p-4">
                          {hasMap ? (
                            <div className="h-[220px] sm:h-[280px] lg:h-[320px] rounded-xl overflow-hidden border border-slate-100">
                              <MapContainer
                                center={center}
                                zoom={16}
                                style={{ height: '100%', width: '100%' }}
                                scrollWheelZoom={false}
                              >
                                <TileLayer
                                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                />
                                <Marker position={[activeLat, activeLng]}>
                                  <Popup>
                                    <div className="text-xs font-semibold">{focusLabel}</div>
                                    <div className="text-xs">{formatCoord(activeLat)}, {formatCoord(activeLng)}</div>
                                  </Popup>
                                </Marker>
                              </MapContainer>
                            </div>
                          ) : (
                            <div className="h-[220px] sm:h-[280px] lg:h-[320px] rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 font-semibold">
                              No latitude/longitude data for {focusLabel}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              );
            })()}
          </AnimatePresence>

        </div>
      </div>
    );
  }

  return (
    <div className="pt-8 pb-8 pl-2 w-full bg-[#F8FAFC] min-h-screen font-sans text-slate-800 -mt-8">
      <div className="grid grid-cols-1 lg:grid-cols-8 gap-6">
        {/* Left: Profile Card (replaced with InternProfile) */}
        <div className="lg:col-span-3 flex">
          <div className="w-full">
            <InternProfile
              intern={intern}
              className="w-full"
              onViewAttendance={() => setIsAttendanceSummaryOpen(true)}
              onProfileImageClick={(src, label) => {
                setPreviewImageUrl(src);
                setPreviewImageLabel(label);
              }}
            />
          </div>
        </div>

        {/* Right: Attendance & Logbook Summary (two columns on lg, stacked on mobile) */}
        <div className="lg:col-span-5 grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          <div className="col-span-1 lg:col-span-5 h-full min-h-[260px]">
            <LogbookChart chartData={logbookChartData} loading={logbookChartLoading} intern={intern} />
          </div>
          <div className="col-span-1 lg:col-span-7 h-full min-h-[260px]">
            <LogbookSummary summary={logbookSummary} loading={logbookChartLoading} rows={logs} intern={intern} />
          </div>
        </div>

        {/* Full width search + filter area */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
            <div className="flex flex-row gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-80">
                <input
                  type="text"
                  placeholder="Search Description"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { setSearchQuery(searchInput); setCurrentPage(1); } }}
                  className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 text-sm shadow-sm transition-all"
                />
                <button type="button" onClick={() => { setSearchQuery(searchInput); setCurrentPage(1); }} aria-label="Search" className="absolute left-3 top-3.5 text-slate-400 hover:text-slate-600">
                  <Search size={18} />
                </button>
              </div>
              <button onClick={() => setIsFilterOpen(true)} className={`${btnPrimaryClass} !px-6`}>
                <Filter size={18} />
                <span className="hidden md:inline">Filter</span>
                {appliedStatus && appliedStatus.length > 0 && (
                  <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse ml-2"></div>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="lg:col-span-8 bg-white rounded-2xl p-4 shadow-sm border border-slate-100 -mt-8">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-0">
              <thead>
                <tr className="text-sm font-bold text-slate-900 border-b border-slate-100 bg-slate-50/30">
                  <th className="px-2 py-4 w-16 text-center">No</th>
                  <th className="px-2 py-4">Date</th>
                  <th className="px-2 py-4 w-[40%]">Description</th>
                  <th className="px-2 py-4 pl-6">Clock In</th>
                  <th className="px-2 py-4">Clock Out</th>
                  <th className="px-2 py-4 w-[110px]">Work Hours</th>
                  <th className="px-2 py-4 text-center">Status</th>
                  <th className="px-2 py-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="text-sm text-slate-600">
                {loading ? (
                  <tr>
                    <td colSpan="9" className="px-2 py-8 text-center">
                      <Loader2
                        className="animate-spin text-[#354C8F] mb-2"
                        size={24}
                      />
                      <div>Loading...</div>
                    </td>
                  </tr>
                ) : logs && logs.length > 0 ? (
                  logs.map((r, i) => {
                    const attStatusLower = String(r.attendance_status || r.attendance_reason || '').toLowerCase();
                    const isExcusedRow = attStatusLower.includes('sick') || attStatusLower.includes('sakit') || attStatusLower.includes('leave') || attStatusLower.includes('izin') || attStatusLower.includes('on leave');
                    const statusLower = String(r.status || '').toLowerCase();
                    const isAbsentRow = statusLower.includes('no logbook') || statusLower.includes("can't submit") || statusLower === 'absent' || (!r.jam_masuk && !r.jam_pulang && !r.logbookId && !isExcusedRow);
                return (
                      <tr
                        key={r.id}
                        className={`${isAbsentRow ? 'bg-red-50 border-b border-red-100' : 'hover:bg-slate-50 border-b border-slate-50'} transition-colors last:border-none`}
                      >
                        <td className="px-2 py-4 font-medium text-slate-800 text-center">
                          {showingFrom + i}
                        </td>
                        <td className="px-2 py-4 whitespace-nowrap">{r.date}</td>
                        <td className="px-2 py-4 whitespace-normal max-w-[320px] text-justify">
                          {r.desc}
                        </td>
                        <td className="px-2 py-4 pl-6">
                          {r.jam_masuk ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{r.jam_masuk}</span>
                              {r.foto_masuk && (
                                <button
                                  onClick={() => handleOpenAttendanceDetail({
                                    type: 'in',
                                    tanggal: r.dateRaw,
                                    jam_masuk: r.jam_masuk,
                                    jam_pulang: r.jam_pulang,
                                    durasi_kerja: r.durasi_kerja,
                                    foto_masuk: r.foto_masuk,
                                    foto_pulang: r.foto_pulang,
                                    latitude_masuk: r.latitude_masuk,
                                    longitude_masuk: r.longitude_masuk,
                                    latitude_pulang: r.latitude_pulang,
                                    longitude_pulang: r.longitude_pulang,
                                  })}
                                  className="w-7 h-7 rounded-full overflow-hidden border border-slate-200 hover:border-[#354C8F] transition-all flex items-center justify-center bg-white cursor-pointer"
                                  title="Preview clock-in photo"
                                >
                                  <SecureImage src={r.foto_masuk} alt="Clock In" className="w-full h-full object-cover" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-2 py-4">
                          {r.jam_pulang ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{r.jam_pulang}</span>
                              {r.foto_pulang && (
                                <button
                                  onClick={() => handleOpenAttendanceDetail({
                                    type: 'out',
                                    tanggal: r.dateRaw,
                                    jam_masuk: r.jam_masuk,
                                    jam_pulang: r.jam_pulang,
                                    durasi_kerja: r.durasi_kerja,
                                    foto_masuk: r.foto_masuk,
                                    foto_pulang: r.foto_pulang,
                                    latitude_masuk: r.latitude_masuk,
                                    longitude_masuk: r.longitude_masuk,
                                    latitude_pulang: r.latitude_pulang,
                                    longitude_pulang: r.longitude_pulang,
                                  })}
                                  className="w-7 h-7 rounded-full overflow-hidden border border-slate-200 hover:border-[#354C8F] transition-all flex items-center justify-center bg-white cursor-pointer"
                                  title="Preview clock-out photo"
                                >
                                  <SecureImage src={r.foto_pulang} alt="Clock Out" className="w-full h-full object-cover" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-2 py-4">
                          {r.durasi_kerja ? (
                            (() => {
                              const { hours, minutes } = formatWorkHours(r.durasi_kerja);
                              return (
                                <div className="text-sm font-medium">
                                  <div>{hours} hours</div>
                                  <div>{minutes} minutes</div>
                                </div>
                              );
                            })()
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-2 py-4 text-center">
                          {(r.status === 'No logbook submitted' || r.status === "Can't submit logbook") ? (
                            <div className="text-sm font-bold text-red-600">{r.status}</div>
                          ) : (
                            <StatusBadge status={r.status} />
                          )}
                        </td>
                        <td className="px-2 py-4 text-center">
                          {!isAbsentRow && (
                            <button
                              onClick={() => handleOpenDetail(r)}
                              className="inline-flex items-center justify-center h-[34px] w-[34px] bg-[#354C8F] text-white rounded-lg hover:bg-[#2a3c70] transition-colors shadow-sm shadow-indigo-100 active:scale-95 group"
                              title="View Details"
                            >
                              <Eye size={16} className="group-hover:scale-110 transition-transform" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="9" className="px-2 py-8 text-center text-slate-400">
                      No records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Container */}
          <div className="p-4 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0">

            {/* Info Text */}
            <div className="text-sm text-slate-500 text-center md:text-left order-2 md:order-1">
              Showing {showingFrom} to {showingTo} of {totalEntries} entries
            </div>

            {/* Per Page Selector + Pagination Buttons */}
            <div className="flex items-center gap-4 order-1 md:order-2">
              {/* Per Page Selector */}
              <div className="flex items-center gap-2">
                <label className="text-xs md:text-sm font-medium text-slate-600">Per page:</label>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs md:text-sm font-medium text-slate-700 bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 cursor-pointer transition-all"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                </select>
              </div>

              {/* Pagination Buttons */}
              <div className="flex items-center gap-2 flex-wrap justify-center">

              {/* Prev Button */}
              <button
                onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 border border-slate-200"
              >
                <ChevronLeft size={18} />
              </button>

              {/* Page Numbers Logic */}
              {(() => {
                const pageCurrent = currentPage;
                const pageTotal = totalPages;

                // Ensure valid page numbers
                if (!pageTotal || pageTotal <= 0) {
                  return null;
                }

                const getPageItems = (current, total) => {
                  const currentPageNum = Number(current) || 1;
                  const totalNum = Number(total) || 1;

                  // If small, show all
                  if (totalNum <= 7) {
                    return Array.from({ length: totalNum }, (_, i) => i + 1);
                  }

                  // If near beginning
                  if (currentPageNum <= 4) {
                    return [1,2,3,4,5,'...', totalNum];
                  }

                  // If near end
                  if (currentPageNum >= totalNum - 3) {
                    return [1,'...', totalNum-4, totalNum-3, totalNum-2, totalNum-1, totalNum];
                  }

                  // Middle
                  return [1,'...', currentPageNum - 1, currentPageNum, currentPageNum + 1, '...', totalNum];
                };

                // DEBUG: log pagination inputs
                try { console.debug("[DetailInternAdmin] Pagination render - pageCurrent:", pageCurrent, "pageTotal:", pageTotal); } catch(e){}
                const pageItems = getPageItems(pageCurrent, pageTotal);
                try { console.debug("[DetailInternAdmin] Pagination render - pageItems:", pageItems); } catch(e){}
                if (!pageItems || pageItems.length === 0) {
                  return null;
                }

                return pageItems.map((p, idx) => {
                  if (p === '...') {
                    return (
                      <div key={`ellipsis-${idx}`} className="w-8 h-8 flex items-center justify-center text-slate-400 text-xs font-bold">
                        ...
                      </div>
                    );
                  }
                  const pageNum = Number(p);
                  const isActive = pageCurrent === pageNum;
                  return (
                    <button
                      key={`page-${pageNum}`}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                        isActive
                          ? "bg-slate-100 text-[#27345A]"
                          : "text-slate-500 hover:bg-slate-50 border border-transparent"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                });
              })()}

              {/* Next Button */}
              <button
                onClick={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 border border-slate-200"
              >
                <ChevronRight size={18} />
              </button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Log Detail Modal */}
      {isLogDetailOpen && selectedLogDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl relative max-h-[90vh] flex flex-col">
            {/* Header (Fixed) */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-white rounded-t-2xl z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                  <FileText className="text-[#354C8F]" size={20} />
                </div>
                <div>
                  <h3 className="text-[18px] font-bold text-[#203266]">Logbook Detail</h3>
                  <p className="text-xs text-slate-500">{selectedLogDetail.date}</p>
                </div>
              </div>
              <button onClick={handleCloseDetail} className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors">
                <X size={18} />
              </button>
            </div>
            
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Description */}
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-2">Activity Description</label>
                <div className="p-4 bg-slate-50 rounded-xl text-sm text-slate-600 leading-relaxed border border-slate-100">
                  {selectedLogDetail.desc}
                </div>
              </div>

              {/* Attachments */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-bold text-slate-800">Attachments</label>
                  <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                    {selectedLogDetail.evidenceFiles?.length || 0} Files
                  </span>
                </div>
                
                {selectedLogDetail.evidenceFiles && selectedLogDetail.evidenceFiles.length > 0 ? (
                  <div className="space-y-3">
                    {selectedLogDetail.evidenceFiles.map((file, idx) => {
                      const rawName = typeof file === "string" ? file.split("/").pop() : (file?.url || file?.path || "").split("/").pop();
                      const cleanName = (rawName || `File ${idx + 1}`).replace(/^([\da-fA-F]+_){1,2}/, '');
                      const ext = cleanName.split('.').pop().toLowerCase();
                      const extLabel = ext.toUpperCase();
                      const isPdf = ext === 'pdf';
                      const isImage = ['png', 'jpg', 'jpeg'].includes(ext);
                      const badgeLabel = isPdf ? 'PDF' : (isImage ? 'IMG' : extLabel || 'FILE');
                      const badgeClasses = isPdf
                        ? 'bg-red-500 text-white'
                        : isImage
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-300 text-slate-700';
                      const fileUrl = typeof file === "string" ? file : file?.url || file?.path || "";

                      return (
                        <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl group hover:border-[#354C8F] hover:shadow-md transition-all">
                          <div
                            className="flex items-center gap-4 overflow-hidden cursor-pointer flex-1"
                            onClick={() => handleViewFile(selectedLogDetail.id, fileUrl, cleanName)}
                          >
                            <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shrink-0 border border-slate-200 shadow-sm">
                              <div className={`text-[10px] font-extrabold px-2 py-1 rounded ${badgeClasses}`}>
                                {badgeLabel}
                              </div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-slate-700 truncate group-hover:text-[#354C8F] transition-colors mb-0.5" title={cleanName}>
                                {cleanName}
                              </p>
                              <p className="text-[11px] text-slate-400 flex items-center gap-1">
                                Click to preview
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDownloadFile(selectedLogDetail.id, fileUrl, cleanName)}
                            className="p-2.5 text-slate-400 hover:text-[#354C8F] hover:bg-slate-50 rounded-lg transition-all"
                            title="Download"
                          >
                            <Download size={20} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-slate-400 italic">No attachment provided.</div>
                )}
              </div>

              {/* Feedback Input */}
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-2">Feedback</label>
                <textarea
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm bg-slate-50 focus:outline-none transition-colors h-24 resize-none cursor-not-allowed"
                  placeholder="No feedback provided."
                  value={feedbackInput}
                  readOnly
                  disabled
                ></textarea>
              </div>
              
              {/* Evidence Timeline */}
              <div className="grid grid-cols-1 gap-3 p-4 bg-white rounded-xl border border-slate-100">
                <p className="text-xs text-slate-400 font-bold uppercase">Evidence Timeline</p>
                
                {/* Created */}
                {selectedLogDetail.created_at && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Created</span>
                    <span className="text-slate-700 font-medium">{formatTimestamp(selectedLogDetail.created_at) || '-'}</span>
                  </div>
                )}
                
                {/* Submitted */}
                {selectedLogDetail.submitted_at && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Submitted</span>
                    <span className="text-slate-700 font-medium">{formatTimestamp(selectedLogDetail.submitted_at) || '-'}</span>
                  </div>
                )}
                
                {/* Revision Requested */}
                {(selectedLogDetail.status === 'Revision' || selectedLogDetail.status === 'revision_needed') && selectedLogDetail.revision_at && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Revision Requested</span>
                    <span className="text-slate-700 font-medium">{formatTimestamp(selectedLogDetail.revision_at) || '-'}</span>
                  </div>
                )}
                
                {/* Verified */}
                {(selectedLogDetail.status === 'Approved' || selectedLogDetail.status === 'verified') && selectedLogDetail.verified_at && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Verified (Mentor)</span>
                    <span className="text-slate-700 font-medium">{formatTimestamp(selectedLogDetail.verified_at) || '-'}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer (Fixed) */}
            <div className="p-6 border-t border-slate-100 bg-white rounded-b-2xl z-10 flex gap-3 justify-end">
              <div className="w-full flex items-center justify-between">
                <div className="text-sm text-slate-500 font-medium">Status: <span className="font-bold text-[#354C8F]">{selectedLogDetail.status}</span></div>
                <button onClick={handleCloseDetail} className={btnSecondaryClass + " w-32"}>Close</button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Filter Modal */}
      {isFilterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h3 className="text-[18px] font-bold">Filter Logbook</h3>
              <button
                onClick={() => setIsFilterOpen(false)}
                className="text-slate-400"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-bold mb-2">Status</label>
                <div className="flex flex-wrap gap-2">
                  {["Pending", "Approved", "Revision", "Not Yet"].map((s) => (
                    <button
                      key={s}
                      onClick={() => toggleModalStatus(s)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${modalStatus.includes(s) ? "bg-[#354C8F] text-white border-[#354C8F] shadow-md" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Range Filter */}
              <div>
                <label className="block text-sm font-bold mb-3">Date Range</label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-600 mb-2 font-medium">Start Date</label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => openDatePicker(modalStartDateRef)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 p-1 z-30 cursor-pointer"
                        aria-label="Open start date picker"
                        title="Open start date picker"
                      >
                        <Calendar size={16} />
                      </button>
                      <input
                        ref={modalStartDateRef}
                        type="date"
                        value={modalStartDate}
                        onChange={(e) => setModalStartDate(e.target.value)}
                        onFocus={() => openDatePicker(modalStartDateRef, { allowClickFallback: false })}
                        onClick={() => openDatePicker(modalStartDateRef, { allowClickFallback: false })}
                        className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 transition-all appearance-none [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:hidden"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-2 font-medium">End Date</label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => openDatePicker(modalEndDateRef)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 p-1 z-30 cursor-pointer"
                        aria-label="Open end date picker"
                        title="Open end date picker"
                      >
                        <Calendar size={16} />
                      </button>
                      <input
                        ref={modalEndDateRef}
                        type="date"
                        value={modalEndDate}
                        onChange={(e) => setModalEndDate(e.target.value)}
                        onFocus={() => openDatePicker(modalEndDateRef, { allowClickFallback: false })}
                        onClick={() => openDatePicker(modalEndDateRef, { allowClickFallback: false })}
                        className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 transition-all appearance-none [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:hidden"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 flex justify-end gap-3 border-t border-slate-100 bg-slate-50">
              <button onClick={resetModalFilters} className={btnSecondaryClass}>
                Reset
              </button>
              <button onClick={applyModalFilters} className={btnPrimaryClass}>
                Apply Filter
              </button>
            </div>
          </div>
        </div>
      )}






      {/* Attendance Detail Modal */}
      <AnimatePresence>
        {isAttendanceDetailOpen && selectedAttendance && (() => {
          const focusLabel = selectedAttendance.type === 'out' ? 'Clock Out' : 'Clock In';
          const rawLat = selectedAttendance.type === 'out'
            ? selectedAttendance.latitude_pulang
            : selectedAttendance.latitude_masuk;
          const rawLng = selectedAttendance.type === 'out'
            ? selectedAttendance.longitude_pulang
            : selectedAttendance.longitude_masuk;
          const activeLat = rawLat === null || rawLat === undefined || rawLat === '' ? NaN : Number(rawLat);
          const activeLng = rawLng === null || rawLng === undefined || rawLng === '' ? NaN : Number(rawLng);
          const hasMap = Number.isFinite(activeLat) && Number.isFinite(activeLng);
          const center = hasMap ? [activeLat, activeLng] : [-6.200000, 106.816666];
          const displayDate = selectedAttendance.tanggal
            ? new Date(selectedAttendance.tanggal).toLocaleDateString('en-GB')
            : '-';

          const stop = (e) => e.stopPropagation();

          return (
            <motion.div
              className="fixed inset-0 z-[100] flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseAttendanceDetail}
            >
              <div className="absolute inset-0 bg-black/50" />
              <motion.div
                className="relative w-[94vw] sm:w-[90vw] md:w-[92vw] lg:w-[90vw] max-w-4xl bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden max-h-[88vh] flex flex-col"
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                onClick={stop}
              >
                <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-b border-slate-100 bg-slate-50/60 shrink-0">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-extrabold text-[#27345A] truncate">{focusLabel} Photo & Location</div>
                    <div className="text-xs text-slate-500 font-semibold">{displayDate}</div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseAttendanceDetail}
                    className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition shrink-0 ml-2"
                    aria-label="Close"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 sm:p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 auto-rows-max">
                    {/* Photo preview */}
                    <div className="rounded-2xl border border-slate-100 overflow-hidden bg-white">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                      <div className="text-sm font-extrabold text-slate-700">Preview</div>
                      <div className="text-xs text-slate-500 font-semibold">{focusLabel}</div>
                    </div>
                    <div className="p-3 sm:p-4">
                      {selectedAttendance.type === 'in' && selectedAttendance.foto_masuk ? (
                        <div className="h-[180px] sm:h-[240px] md:h-[280px] lg:h-[320px] rounded-xl bg-slate-50 overflow-hidden flex items-center justify-center">
                          <SecureImage src={selectedAttendance.foto_masuk} alt="Clock In Photo" className="w-full max-h-full object-contain" />
                        </div>
                      ) : selectedAttendance.type === 'out' && selectedAttendance.foto_pulang ? (
                        <div className="h-[180px] sm:h-[240px] md:h-[280px] lg:h-[320px] rounded-xl bg-slate-50 overflow-hidden flex items-center justify-center">
                          <SecureImage src={selectedAttendance.foto_pulang} alt="Clock Out Photo" className="w-full max-h-full object-contain" />
                        </div>
                      ) : (
                        <div className="w-full h-[180px] sm:h-[240px] md:h-[280px] lg:h-[320px] rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 font-semibold">
                          No photo
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Map */}
                  <div className="rounded-2xl border border-slate-100 overflow-hidden bg-white">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
                      <div className="text-sm font-extrabold text-slate-700">Map</div>
                      {hasMap ? (
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="hidden sm:block text-xs text-slate-500 font-semibold whitespace-nowrap">
                            {formatCoord(activeLat)}, {formatCoord(activeLng)}
                          </div>
                          <a
                            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-extrabold text-[#354C8F] hover:bg-white hover:border-slate-300 transition whitespace-nowrap"
                            href={`https://www.google.com/maps?q=${activeLat},${activeLng}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open Google Maps
                          </a>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 font-semibold whitespace-nowrap">No coordinates</div>
                      )}
                    </div>
                    <div className="p-3 sm:p-4">
                      {hasMap ? (
                        <div className="h-[180px] sm:h-[240px] md:h-[280px] lg:h-[320px] rounded-xl overflow-hidden border border-slate-100">
                          <MapContainer
                            center={center}
                            zoom={16}
                            style={{ height: '100%', width: '100%' }}
                            scrollWheelZoom={false}
                          >
                            <TileLayer
                              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            <Marker position={[activeLat, activeLng]}>
                              <Popup>
                                <div className="text-xs font-semibold">{focusLabel}</div>
                                <div className="text-xs">{formatCoord(activeLat)}, {formatCoord(activeLng)}</div>
                              </Popup>
                            </Marker>
                          </MapContainer>
                        </div>
                      ) : (
                        <div className="h-[180px] sm:h-[240px] md:h-[280px] lg:h-[320px] rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 font-semibold">
                          No latitude/longitude data for {focusLabel}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* IMAGE PREVIEW MODAL */}
      {previewImageUrl && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white w-[95%] md:w-full max-w-2xl rounded-2xl shadow-2xl p-6 relative"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="flex justify-between items-center w-full mb-2">
                <h3 className="text-lg font-bold text-[#27345A]">{previewImageLabel}</h3>
                <button
                  onClick={() => setPreviewImageUrl(null)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X size={22} className="text-slate-500" />
                </button>
              </div>
              <div className="w-full max-h-[70vh] bg-slate-100 rounded-xl overflow-auto flex items-center justify-center">
                <SecureImage
                  src={previewImageUrl}
                  alt={previewImageLabel}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <button
                onClick={() => setPreviewImageUrl(null)}
                className="bg-white border border-slate-300 text-slate-700 py-3 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition-all w-full"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default DetailInternAdmin;
