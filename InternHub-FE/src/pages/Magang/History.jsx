
import React, { useState, useEffect, useRef } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Calendar,
    Loader2,
    X,
    MapPin
} from 'lucide-react';
import {
    MapContainer,
    TileLayer,
    Marker,
    Popup
} from 'react-leaflet';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import apiClient from '../../api/axiosConfig';

// --- CONFIGURATION ---
const textDarkBlue = "text-[#203266]";
const JAKARTA_TZ = "Asia/Jakarta";

// --- FIX ICON LEAFLET (same approach as Attendance) ---
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

const getApiOrigin = () => {
    const baseURL = apiClient?.defaults?.baseURL;
    if (!baseURL) return '';

    // baseURL can be absolute ('http://localhost:8000/api') or relative ('/api').
    // For absolute, strip the trailing '/api' so we can address '/storage' directly.
    // For relative, return '' and rely on Vite proxy for '/storage' in dev.
    const s = String(baseURL).trim();
    if (!/^https?:\/\//i.test(s)) return '';

    let cleaned = s.replace(/\/+$/, '');
    cleaned = cleaned.replace(/\/api$/i, '');
    cleaned = cleaned.replace(/\/+$/, '');
    return cleaned;
};

const resolvePhotoUrl = (photoPath) => {
    if (!photoPath) return null;
    const s = String(photoPath).trim();

    // Treat common placeholders as "no photo" (avoid 404 spam like /storage/.../dummy.jpg)
    if (!s || s === '-' || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') return null;
    if (/dummy\.(jpg|jpeg|png|webp)$/i.test(s) || /\bdummy\b/i.test(s)) return null;
    
    // If already absolute URL (http/https), return as-is
    if (/^https?:\/\//i.test(s)) return s;
    
    // If data URL, return as-is
    if (/^data:/i.test(s)) return s;
    
    const origin = getApiOrigin();
    // If origin is empty (e.g. apiClient baseURL is '/api'), we return relative '/storage/...'
    // and expect Vite devServer proxy to forward '/storage' to backend.

    // Normalize path: remove leading slash
    let normalized = s.startsWith('/') ? s.slice(1) : s;
    
    // Common patterns for photo paths:
    // 1. "absensi/foto/..." → need storage prefix
    // 2. "storage/absensi/foto/..." → use as-is
    // 3. "absensi\/foto/..." (escaped slash from DB) → normalize to forward slash
    
    // Handle escaped backslashes from DB
    normalized = normalized.replace(/\\\//g, '/');
    
    // If already has storage/ prefix
    if (/^storage\//i.test(normalized)) {
        return origin ? `${origin}/${normalized}` : `/${normalized}`;
    }

    // DB sometimes stores: 'absensi/foto/<filename>.jpg' (without 'storage' prefix)
    // Public URL is typically: '/storage/absensi/foto/<filename>.jpg'
    if (/^absensi\/foto\//i.test(normalized)) {
        const filename = normalized.replace(/^absensi\/foto\//i, '');
        const storagePath = `storage/absensi/foto/${filename}`;
        return origin ? `${origin}/${storagePath}` : `/${storagePath}`;
    }

    // Default: assume file is under /storage/<normalized>
    const storagePath = `storage/${normalized}`;
    return origin ? `${origin}/${storagePath}` : `/${storagePath}`;
};

const formatCoord = (n) => {
    const num = Number(n);
    if (Number.isNaN(num)) return '-';
    return num.toFixed(6);
};

const getJakartaDateKey = (date) => {
    try {
        return new Intl.DateTimeFormat("en-CA", {
            timeZone: JAKARTA_TZ,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).format(date);
    } catch {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    }
};

const formatDDMMYYYYFromKey = (dateKey) => {
    if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return '-';
    const [yyyy, mm, dd] = dateKey.split('-');
    return `${dd}/${mm}/${yyyy}`;
};

const getCachedEarlyReasonForDate = (dateKey) => {
    try {
        const cached = localStorage.getItem('earlyClockOutInfo');
        if (!cached) return null;
        const parsed = JSON.parse(cached);
        if (parsed?.dateKey !== dateKey) return null;
        const reason = (parsed?.reason ?? '').toString().trim();
        return reason || null;
    } catch {
        return null;
    }
};

// --- HELPERS ---
const calculateDuration = (startTime, endTime) => {
    // Validasi input: Jika salah satu tidak ada atau '-', return '-'
    if (!startTime || !endTime || startTime === '-' || endTime === '-') return '-';

    // Ambil jam:menit saja (abaikan detik jika ada)
    const cleanStart = startTime.includes(':') ? startTime.split(':').slice(0, 2).join(':') : startTime;
    const cleanEnd = endTime.includes(':') ? endTime.split(':').slice(0, 2).join(':') : endTime;

    const [startH, startM] = cleanStart.split(':').map(Number);
    const [endH, endM] = cleanEnd.split(':').map(Number);

    let diffM = (endH * 60 + endM) - (startH * 60 + startM);
    if (diffM < 0) return '-'; // Jika jam pulang lebih awal dari jam masuk (error data)

    const hours = Math.floor(diffM / 60);
    const minutes = diffM % 60;

    return `${hours}h ${minutes}m`;
};

// --- FETCH HELPER ---
const fetchAllHistory = async (url) => {
    try {
        const params = {
            per_page: 1000,
            limit: 1000,
            pagination: 0
        };

        const res = await apiClient.get(url, { params });

        if (res.data?.data?.data && Array.isArray(res.data.data.data)) return res.data.data.data;
        if (res.data?.data && Array.isArray(res.data.data)) return res.data.data;
        return [];
    } catch (error) {
        console.error(`Error fetching ${url}:`, error);
        return [];
    }
};

// --- COMPONENTS ---
const CustomLegend = (props) => {
    const { payload } = props;
    return (
        <div className="flex flex-wrap justify-center gap-4 md:gap-6 mt-6 px-2">
            {payload.map((entry, index) => (
                <div key={`item-${index}`} className="flex items-center gap-2 cursor-pointer">
                    <div className="flex items-center">
                        <div className="w-1.5 md:w-2 h-[2px]" style={{ backgroundColor: entry.color }}></div>
                        <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full border-[2px] bg-white" style={{ borderColor: entry.color }}></div>
                        <div className="w-1.5 md:w-2 h-[2px]" style={{ backgroundColor: entry.color }}></div>
                    </div>
                    <span className="text-xs md:text-sm font-bold text-slate-600">
                        {entry.value === 'OnTime'
                            ? 'On Time'
                            : (entry.value === 'OnLeave'
                                ? 'On Leave'
                                : (entry.value === 'Early'
                                    ? 'Early Out'
                                    : entry.value))}
                    </span>
                </div>
            ))}
        </div>
    );
};

const PhotoBubbleButton = ({ photo, alt, onClick }) => {
    const [srcUrl, setSrcUrl] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        let createdUrl = null;
        let isMounted = true;

        const cleanup = () => {
            if (createdUrl) {
                try { URL.revokeObjectURL(createdUrl); } catch (e) {}
                createdUrl = null;
            }
        };

        const prepare = async () => {
            if (!photo) return isMounted && setSrcUrl(null);

            setIsLoading(true);

            try {
                // If string
                if (typeof photo === 'string') {
                    if (photo.startsWith('data:')) {
                        return isMounted && setSrcUrl(photo);
                    }

                    // Try to resolve to API URL and fetch as blob
                    const resolved = resolvePhotoUrl(photo);
                    if (!resolved) {
                        return isMounted && setSrcUrl(null);
                    }

                    // Fetch image as blob from resolved URL (use plain fetch, not apiClient)
                    try {
                        const res = await fetch(resolved, {
                            method: 'GET',
                            headers: {
                                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
                            }
                        });
                        if (res.ok) {
                            const blob = await res.blob();
                            createdUrl = URL.createObjectURL(blob);
                            return isMounted && setSrcUrl(createdUrl);
                        }
                    } catch (fetchErr) {
                        console.warn('Failed to fetch photo as blob:', fetchErr);
                        // Fallback to direct URL
                        return isMounted && setSrcUrl(resolved);
                    }
                }

                // If it's a Blob/File
                if (typeof Blob !== 'undefined' && photo instanceof Blob) {
                    createdUrl = URL.createObjectURL(photo);
                    return isMounted && setSrcUrl(createdUrl);
                }

                // If it's an ArrayBuffer or TypedArray
                if (photo && (photo instanceof ArrayBuffer || ArrayBuffer.isView(photo))) {
                    const blob = new Blob([photo], { type: 'image/jpeg' });
                    createdUrl = URL.createObjectURL(blob);
                    return isMounted && setSrcUrl(createdUrl);
                }

                // If it's an object with base64 data
                if (photo && typeof photo === 'object') {
                    const maybe = photo.data ?? photo.base64 ?? photo.b64 ?? null;
                    if (typeof maybe === 'string') {
                        if (maybe.startsWith('data:')) return isMounted && setSrcUrl(maybe);
                        return isMounted && setSrcUrl(`data:image/jpeg;base64,${maybe}`);
                    }
                    // If object contains path/url
                    const path = photo.url ?? photo.path ?? photo.file ?? null;
                    if (typeof path === 'string') {
                        const resolved = resolvePhotoUrl(path);
                        return isMounted && setSrcUrl(resolved);
                    }
                }

                isMounted && setSrcUrl(null);
            } finally {
                isMounted && setIsLoading(false);
            }
        };

        prepare();
        return () => {
            isMounted = false;
            cleanup();
        };
    }, [photo]);

    if (!srcUrl) return null;

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={isLoading}
            className="shrink-0 w-7 h-7 rounded-full border border-slate-200 bg-white overflow-hidden hover:shadow-sm hover:border-slate-300 transition disabled:opacity-50"
            aria-label={alt}
            title={alt}
        >
            <img
                src={srcUrl}
                alt={alt}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={() => setSrcUrl(null)}
            />
        </button>
    );
};

const PhotoMapModal = ({ isOpen, onClose, item, focus }) => {
    const hasItem = Boolean(item);
    const focusLabel = focus === 'pulang' ? 'Clock Out' : 'Clock In';

    const [photoMasukUrl, setPhotoMasukUrl] = useState(null);
    const [photoPulangUrl, setPhotoPulangUrl] = useState(null);

    useEffect(() => {
        let created = [];
        let isMounted = true;

        const cleanup = () => {
            created.forEach(u => {
                try { URL.revokeObjectURL(u); } catch (e) {}
            });
            created = [];
        };

        const normalize = async (val) => {
            if (!val) return null;

            // If string
            if (typeof val === 'string') {
                if (val.startsWith('data:')) return val;

                // Try to resolve to API URL and fetch as blob
                const resolved = resolvePhotoUrl(val);
                if (!resolved) return null;

                try {
                    const res = await fetch(resolved, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
                        }
                    });
                    if (res.ok) {
                        const blob = await res.blob();
                        const u = URL.createObjectURL(blob);
                        created.push(u);
                        return u;
                    }
                } catch (fetchErr) {
                    console.warn('Failed to fetch photo from API:', fetchErr);
                    // Fallback to direct URL (might work if CORS allows)
                    return resolved;
                }
            }

            // If it's a Blob/File
            if (typeof Blob !== 'undefined' && val instanceof Blob) {
                const u = URL.createObjectURL(val);
                created.push(u);
                return u;
            }

            // If it's an ArrayBuffer or TypedArray
            if (val && (val instanceof ArrayBuffer || ArrayBuffer.isView(val))) {
                const blob = new Blob([val], { type: 'image/jpeg' });
                const u = URL.createObjectURL(blob);
                created.push(u);
                return u;
            }

            // If it's an object with base64 data
            if (val && typeof val === 'object') {
                const maybe = val.data ?? val.base64 ?? val.b64 ?? null;
                if (typeof maybe === 'string') {
                    if (maybe.startsWith('data:')) return maybe;
                    return `data:image/jpeg;base64,${maybe}`;
                }
                const path = val.url ?? val.path ?? val.file ?? null;
                if (typeof path === 'string') return resolvePhotoUrl(path);
            }

            return null;
        };

        if (hasItem && isOpen) {
            (async () => {
                const masuk = await normalize(item.photoMasuk);
                const pulang = await normalize(item.photoPulang);
                if (isMounted) {
                    setPhotoMasukUrl(masuk);
                    setPhotoPulangUrl(pulang);
                }
            })();
        }

        return () => {
            isMounted = false;
            cleanup();
        };
    }, [item, isOpen]);

    const activePhotoUrl = focus === 'pulang' ? photoPulangUrl : photoMasukUrl;

    const latMasuk = hasItem ? item.latitudeMasuk : null;
    const lngMasuk = hasItem ? item.longitudeMasuk : null;
    const latPulang = hasItem ? item.latitudePulang : null;
    const lngPulang = hasItem ? item.longitudePulang : null;

    // Focus-specific location (Clock In modal shows Clock In coords only; Clock Out shows Clock Out only)
    const activeLat = focus === 'pulang' ? latPulang : latMasuk;
    const activeLng = focus === 'pulang' ? lngPulang : lngMasuk;
    const hasMap = Number.isFinite(activeLat) && Number.isFinite(activeLng);
    const center = hasMap ? [activeLat, activeLng] : [-6.200000, 106.816666];

    const stop = (e) => e.stopPropagation();

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                >
                    <div className="absolute inset-0 bg-black/50" />
                    <motion.div
                        className="relative w-[94vw] sm:w-[95vw] max-w-4xl bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden max-h-[88vh]"
                        initial={{ opacity: 0, y: 16, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 16, scale: 0.98 }}
                        onClick={stop}
                    >

                        <div className="flex items-center justify-between px-4 sm:px-4 py-3 sm:py-3 border-b border-slate-100 bg-slate-50/60">
                            <div>
                                <div className="text-sm font-extrabold text-[#27345A]">{focusLabel} Photo & Location</div>
                                <div className="text-xs text-slate-500 font-semibold">{item?.displayDate ?? '-'}</div>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition shrink-0"
                                aria-label="Close"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 overflow-y-auto">
                            {/* Photo preview */}
                            <div className="rounded-2xl border border-slate-100 overflow-hidden bg-white">
                                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                                    <div className="text-sm font-extrabold text-slate-700">Preview</div>
                                    <div className="text-xs text-slate-500 font-semibold">{focusLabel}</div>
                                </div>
                                <div className="p-3 sm:p-4">
                                    {activePhotoUrl ? (
                                        <div className="h-[220px] sm:h-[280px] lg:h-[320px] rounded-xl bg-slate-50 overflow-hidden flex items-center justify-center">
                                            <img
                                                src={activePhotoUrl}
                                                alt={`${focusLabel} photo`}
                                                className="w-full max-h-full object-contain"
                                            />
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
            )}
        </AnimatePresence>
    );
};

const MonthYearPicker = ({ value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);
    const [year, setYear] = useState(value ? value.getFullYear() : new Date().getFullYear());
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) setIsOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (mIndex) => {
        const newDate = new Date(year, mIndex, 1);
        onChange(newDate);
        setIsOpen(false);
    };

    return (
        <div className="relative w-full sm:w-64" ref={containerRef}>
            <div onClick={() => setIsOpen(!isOpen)} className={`w-full pl-12 pr-10 py-2.5 rounded-xl border cursor-pointer select-none flex items-center justify-between transition-all duration-200 ${isOpen ? 'border-[#354C8F] ring-2 ring-[#354C8F]/10 bg-white' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                <div className="absolute left-4 text-slate-400"><Calendar size={18} className={isOpen ? 'text-[#354C8F]' : ''} /></div>
                <span className={`text-sm font-bold truncate ${value ? 'text-slate-700' : 'text-slate-400'}`}>{value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()}</span>
                <div className="absolute right-4 text-slate-400 flex items-center"><ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} /></div>
            </div>
            <AnimatePresence>
                {isOpen && (
                    <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute top-full mt-2 left-0 w-full sm:w-[280px] bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
                            <button onClick={() => setYear(year - 1)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"><ChevronLeft size={18} /></button>
                            <span className="text-base font-extrabold text-[#27345A]">{year}</span>
                            <button onClick={() => setYear(year + 1)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"><ChevronRight size={18} /></button>
                        </div>
                        <div className="p-3 grid grid-cols-3 gap-2">
                            {months.map((m, idx) => {
                                const isSelected = value && value.getMonth() === idx && value.getFullYear() === year;
                                return (
                                    <button key={m} onClick={() => handleSelect(idx)} className={`py-2 px-1 text-xs font-bold rounded-lg transition-all ${isSelected ? 'bg-[#354C8F] text-white shadow-md' : 'text-slate-600 hover:bg-indigo-50 hover:text-[#354C8F]'}`}>{m.substring(0, 3)}</button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// --- MAIN PAGE ---
const HistoryPage = () => {
    const [chartView, setChartView] = useState('Month');
    const [selectedDate, setSelectedDate] = useState(new Date());

    const [allHistoryData, setAllHistoryData] = useState([]);
    const [filteredMonthData, setFilteredMonthData] = useState([]);

    const [chartData, setChartData] = useState([]);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const [photoModal, setPhotoModal] = useState({ isOpen: false, item: null, focus: 'masuk' });

    // --- Helper: parsing jam masuk & cutoff dummy jadwal ---
    const parseTimeToMinutes = (timeStr) => {
        if (!timeStr) return null;
        const parts = String(timeStr).split(':');
        if (parts.length < 2) return null;
        const [h, m] = parts.map(Number);
        if (Number.isNaN(h) || Number.isNaN(m)) return null;
        return h * 60 + m;
    };

    const getDayKeyFromDateKey = (dateKey) => {
        if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey))) return null;
        // Use fixed Jakarta offset to avoid UTC shifting when parsing.
        const d = new Date(`${dateKey}T00:00:00+07:00`);
        if (Number.isNaN(d.getTime())) return null;
        const dayIdx = d.getDay();
        const map = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        return map[dayIdx] ?? null;
    };

    const getWorkScheduleTimes = (dateKey) => {
        const ws = userData?.work_schedule;
        if (!ws) return null;
        const dayKey = getDayKeyFromDateKey(dateKey);
        const dayTimes = (dayKey && ws?.day_times && ws.day_times[dayKey]) ? ws.day_times[dayKey] : null;
        const start = dayTimes?.start ?? ws?.start_time ?? null;
        const end = dayTimes?.end ?? ws?.end_time ?? null;
        const tolerance = Number(ws?.tolerance ?? 0);
        return { start, end, tolerance: Number.isFinite(tolerance) ? tolerance : 0 };
    };

    const getCutoffMinutes = (dateKey) => {
        const ws = getWorkScheduleTimes(dateKey);
        const startMinutes = ws?.start ? parseTimeToMinutes(ws.start) : null;
        if (startMinutes !== null) return startMinutes + (ws?.tolerance ?? 0);

        // Fallback (legacy) if schedule is missing
        const d = new Date(String(dateKey));
        if (Number.isNaN(d.getTime())) return 8 * 60 + 10;
        const day = d.getDay();
        return day === 5 ? 7 * 60 + 10 : 8 * 60 + 10;
    };

    const getExpectedEndMinutes = (dateKey) => {
        const ws = getWorkScheduleTimes(dateKey);
        const endMinutes = ws?.end ? parseTimeToMinutes(ws.end) : null;
        if (endMinutes !== null) return endMinutes;
        return 17 * 60; // fallback
    };

    // --- 1. FORMATTER DATA (LOGIC FIX) ---
    const formatData = (items) => {
        // Expand ranged entries (sick/izin that specify a start/end date) into per-day entries
        const expanded = [];

        (items || []).forEach(original => {
            // Handle case: multiple izin entries provided as an array -> expand each izin separately
            if (Array.isArray(original.izin) && original.izin.length > 0) {
                original.izin.forEach(iz => {
                    const startRawI = iz.tanggal_mulai ?? iz.start_date ?? iz.start ?? iz.tanggal_dari ?? iz.from ?? iz.tgl_mulai ?? null;
                    const endRawI = iz.tanggal_selesai ?? iz.end_date ?? iz.end ?? iz.tanggal_ke ?? iz.to ?? iz.tgl_selesai ?? null;

                    // If a clear range is present, expand each day
                    if (startRawI && endRawI) {
                        const s = new Date(String(startRawI));
                        const e = new Date(String(endRawI));
                        if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime()) && s <= e) {
                            for (let cur = new Date(s.getFullYear(), s.getMonth(), s.getDate()); cur <= e; cur.setDate(cur.getDate() + 1)) {
                                const dateKey = getJakartaDateKey(cur);
                                const copy = { ...original };
                                // Attach the specific izin object and normalize tanggal to single day
                                copy.izin = iz;
                                copy.tanggal = `${dateKey}T00:00:00+07:00`;
                                copy.keterangan = iz.keterangan ?? copy.keterangan;
                                copy.status = copy.status ?? (iz.jenis_izin ? 'approved' : 'approved');
                                copy._generatedFromRange = true;
                                expanded.push(copy);
                            }
                            return;
                        }
                    }

                    // If izin item contains a single date, push one entry
                    const singleDate = iz.tanggal ?? iz.date ?? iz.tanggal_mulai ?? iz.start_date ?? null;
                    if (singleDate) {
                        const d = new Date(String(singleDate));
                        if (!Number.isNaN(d.getTime())) {
                            const dateKey = getJakartaDateKey(d);
                            const copy = { ...original };
                            copy.izin = iz;
                            copy.tanggal = `${dateKey}T00:00:00+07:00`;
                            copy.keterangan = iz.keterangan ?? copy.keterangan;
                            copy.status = copy.status ?? (iz.jenis_izin ? 'approved' : 'approved');
                            copy._generatedFromRange = true;
                            expanded.push(copy);
                            return;
                        }
                    }

                    // Fallback: if izin item doesn't contain dates, ignore here and let top-level processing handle original
                });
                return;
            }

            // Detect common range fields
            const startRaw = original.tanggal_mulai ?? original.start_date ?? original.start ?? original.tanggal_dari ?? original.from ?? null;
            const endRaw = original.tanggal_selesai ?? original.end_date ?? original.end ?? original.tanggal_ke ?? original.to ?? null;

            // Also detect if the single `date`/`tanggal` contains two dates (e.g. "2024-08-08/2024-08-12")
            const dateField = original.tanggal ?? original.date ?? null;
            let detectedRange = null;
            if (typeof dateField === 'string') {
                const matches = dateField.match(/(\d{4}-\d{2}-\d{2}).*(\d{4}-\d{2}-\d{2})/);
                if (matches) detectedRange = { start: matches[1], end: matches[2] };
            }

            if (startRaw && endRaw) {
                const s = new Date(String(startRaw));
                const e = new Date(String(endRaw));
                if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime()) && s <= e) {
                    // Determine whether this range is a Sick or Leave by looking for keywords
                    const joined = `${original.status ?? ''} ${original.type ?? ''} ${original.keterangan ?? ''} ${original.remark ?? ''}`;
                    const isSick = /sick|sakit/i.test(joined);
                    const isLeave = /izin|cuti|leave/i.test(joined);

                    // Iterate each day in range (inclusive) and push a synthetic single-day entry
                    for (let cur = new Date(s.getFullYear(), s.getMonth(), s.getDate()); cur <= e; cur.setDate(cur.getDate() + 1)) {
                        const dateKey = getJakartaDateKey(cur);
                        const copy = { ...original };
                        // Set a Jakarta midnight timestamp so downstream parsing yields the exact date
                        copy.tanggal = `${dateKey}T00:00:00+07:00`;
                        // Ensure status reflects sick/leave for charting/labels if not already explicit
                        if (isSick) copy.status = copy.status ?? 'sick';
                        if (isLeave) copy.status = copy.status ?? 'approved';
                        copy._generatedFromRange = true;
                        expanded.push(copy);
                    }
                    return;
                }
            }

            if (detectedRange) {
                const s = new Date(`${detectedRange.start}T00:00:00+07:00`);
                const e = new Date(`${detectedRange.end}T00:00:00+07:00`);
                if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime()) && s <= e) {
                    const joined = `${original.status ?? ''} ${original.type ?? ''} ${original.keterangan ?? ''} ${original.remark ?? ''}`;
                    const isSick = /sick|sakit/i.test(joined);
                    const isLeave = /izin|cuti|leave/i.test(joined);
                    for (let cur = new Date(s.getFullYear(), s.getMonth(), s.getDate()); cur <= e; cur.setDate(cur.getDate() + 1)) {
                        const dateKey = getJakartaDateKey(cur);
                        const copy = { ...original };
                        copy.tanggal = `${dateKey}T00:00:00+07:00`;
                        if (isSick) copy.status = copy.status ?? 'sick';
                        if (isLeave) copy.status = copy.status ?? 'approved';
                        copy._generatedFromRange = true;
                        expanded.push(copy);
                    }
                    return;
                }
            }

            // If no range detected, keep original
            expanded.push(original);
        });

        return expanded.map(item => {
            // Use Jakarta day key so it matches Attendance + server-side day (avoids UTC shift).
            let dateKey = null;
            const rawTanggal = item.tanggal || item.date || item.server_date || item.created_at;
            if (rawTanggal) {
                const d = new Date(String(rawTanggal));
                if (!Number.isNaN(d.getTime())) dateKey = getJakartaDateKey(d);
            }
            if (!dateKey) {
                const s = String(rawTanggal || '');
                const m = s.match(/\d{4}-\d{2}-\d{2}/);
                dateKey = m ? m[0] : null;
            }
            const dateObj = rawTanggal ? new Date(String(rawTanggal)) : (dateKey ? new Date(`${dateKey}T00:00:00+07:00`) : null);

            // Format Jam
            let inTime = item.jam_masuk ? item.jam_masuk.substring(0, 5) : '-';
            let outTime = item.jam_pulang ? item.jam_pulang.substring(0, 5) : '-';

            // Photo + coordinates from backend (supports multiple possible keys)
            const photoMasuk = item.photo_masuk ?? item.foto_masuk ?? item.photoMasuk ?? item.photo_in ?? item.photoIn ?? null;
            const photoPulang = item.photo_pulang ?? item.foto_pulang ?? item.photoPulang ?? item.photo_out ?? item.photoOut ?? null;

            const latitudeMasukRaw = item.latitude_masuk ?? item.lat_masuk ?? item.latitudeMasuk ?? item.latMasuk ?? null;
            const longitudeMasukRaw = item.longitude_masuk ?? item.lng_masuk ?? item.longitudeMasuk ?? item.lngMasuk ?? null;
            const latitudePulangRaw = item.latitude_pulang ?? item.lat_pulang ?? item.latitudePulang ?? item.latPulang ?? null;
            const longitudePulangRaw = item.longitude_pulang ?? item.lng_pulang ?? item.longitudePulang ?? item.lngPulang ?? null;

            const latitudeMasuk = Number(latitudeMasukRaw);
            const longitudeMasuk = Number(longitudeMasukRaw);
            const latitudePulang = Number(latitudePulangRaw);
            const longitudePulang = Number(longitudePulangRaw);
            // Reason can come from different backend keys; also fallback to cached early reason for the same day.
            let reason = item.reason ?? item.remark ?? item.keterangan ?? item.alasan ?? item.early_reason ?? null;
            if (reason == null || String(reason).trim() === '') {
                reason = dateKey ? getCachedEarlyReasonForDate(dateKey) : null;
            }
            reason = (reason == null || String(reason).trim() === '') ? '-' : String(reason);

            // Logic Status & Label
            let rawStatus = 'Absent';
            let statusLabel = 'Absent';

            const minutesLateNum = Number(item.minutes_late ?? item.minutesLate ?? item.late_minutes ?? NaN);
            const hasMinutesLate = Number.isFinite(minutesLateNum);

            // Detect early clock out markers (server might send item.early, item.status='early', item.remark, item.reason, or item.type containing 'early')
            const isEarly =
                item.early === true ||
                item.early === '1' ||
                (item.status && String(item.status).toLowerCase().includes('early')) ||
                (item.remark && String(item.remark).toLowerCase().includes('early')) ||
                (item.reason && String(item.reason).toLowerCase().includes('early')) ||
                (item.type && String(item.type).toLowerCase().includes('early'));


            const isCorrection = ['correction', 'koreksi'].some(keyword =>
                (item.status && String(item.status).toLowerCase().includes(keyword)) ||
                (item.type && String(item.type).toLowerCase().includes(keyword))
            );

            if (isCorrection) {
                // After correction approval, backend may send status 'correction' with updated times.
                // Prefer backend minutes_late if available; fallback to simple cutoff-based calc.
                const clockInMinutes = parseTimeToMinutes(item.jam_masuk);
                const lateBy = hasMinutesLate
                    ? minutesLateNum
                    : (clockInMinutes !== null ? (clockInMinutes - getCutoffMinutes(dateKey)) : null);

                if (lateBy !== null && lateBy > 0) {
                    rawStatus = 'Late';
                    statusLabel = `Late (${lateBy}m)`;
                } else if (clockInMinutes !== null || (hasMinutesLate && minutesLateNum === 0)) {
                    rawStatus = 'OnTime';
                    statusLabel = 'On Time';
                } else {
                    rawStatus = 'Absent';
                    statusLabel = 'Absent';
                }

            } else if (item.status === 'ontime') {
                rawStatus = 'OnTime';
                statusLabel = 'On Time';
            } else if (item.status === 'late') {
                rawStatus = 'Late';
                statusLabel = `Late (${item.minutes_late || 0}m)`;
            } else if (item.status === 'sick') {
                rawStatus = 'Sick';
                statusLabel = 'Sick';
            } else if (item.status === 'approved' || item.status === 'on_leave' || item.type === 'izin' || item.izin) {
                // Treat explicit on_leave status or presence of an izin object as On Leave
                rawStatus = 'OnLeave';
                statusLabel = 'On Leave';
            } else if (item.status === 'absent') {
                // Backend sometimes keeps status 'absent' even though times exist.
                // If both Clock In + Clock Out exist, derive On Time / Late from Clock In.
                if (item.jam_masuk && item.jam_pulang) {
                    const clockInMinutes = parseTimeToMinutes(item.jam_masuk);
                    const lateBy = hasMinutesLate
                        ? minutesLateNum
                        : (clockInMinutes !== null ? (clockInMinutes - getCutoffMinutes(dateKey)) : null);
                    if (lateBy !== null && lateBy > 0) {
                        rawStatus = 'Late';
                        statusLabel = `Late (${lateBy}m)`;
                    } else {
                        rawStatus = 'OnTime';
                        statusLabel = 'On Time';
                    }
                } else {
                    // Handle Kasus Lupa Clock Out (Absent tapi ada jam masuk)
                    rawStatus = 'Absent';
                    statusLabel = 'Absent';
                }
            }

            // If this record was an Early Clock Out, show label and mark rawStatus as 'Early' for charting.
            // For approved corrections, backend may still send `early: true` even after clock-out is corrected.
            // In that case, derive early/out from the corrected clock-out time.
            if (isEarly) {
                if (isCorrection) {
                    const clockOutMinutes = parseTimeToMinutes(item.jam_pulang);
                    const expectedEndMinutes = getExpectedEndMinutes(dateKey);
                    const stillEarly = clockOutMinutes !== null ? (clockOutMinutes < expectedEndMinutes) : true;
                    if (stillEarly) {
                        statusLabel = 'Early Out';
                        rawStatus = 'Early';
                    }
                } else {
                    statusLabel = 'Early Out';
                    rawStatus = 'Early';
                }
            }

            // --- FIX LOGIC TAMPILAN JAM ---
            // Jika ada jam masuk ATAU jam pulang, tampilkan jamnya.
            // Jangan hide jam masuk meskipun statusnya 'Absent' (karena lupa clock out)
            const hasClockActivity = inTime !== '-' || outTime !== '-';
            const durationCalc = calculateDuration(inTime, outTime);

            return {
                date: dateKey,
                dateObj: dateObj,
                displayDate: dateKey ? formatDDMMYYYYFromKey(dateKey) : '-',
                inTime: inTime,
                outTime: outTime,
                duration: durationCalc,
                status: statusLabel,
                rawStatus: rawStatus,
                reason: reason,
                photoMasuk: photoMasuk,
                photoPulang: photoPulang,
                latitudeMasuk: Number.isFinite(latitudeMasuk) ? latitudeMasuk : null,
                longitudeMasuk: Number.isFinite(longitudeMasuk) ? longitudeMasuk : null,
                latitudePulang: Number.isFinite(latitudePulang) ? latitudePulang : null,
                longitudePulang: Number.isFinite(longitudePulang) ? longitudePulang : null,
                photo: item.photo
            };
        }).sort((a, b) => {
            const bt = b?.dateObj?.getTime ? b.dateObj.getTime() : 0;
            const at = a?.dateObj?.getTime ? a.dateObj.getTime() : 0;
            return bt - at;
        });
    };

    // --- 2. INITIAL FETCH ---
    useEffect(() => {
        const initData = async () => {
            setLoading(true);
            try {
                const userRes = await apiClient.get('/user');
                if (userRes.data.success) {
                    setUserData(userRes.data.user);
                }

                const rawItems = await fetchAllHistory('/absensi/riwayat');
                const formatted = formatData(rawItems);
                setAllHistoryData(formatted);
            } catch (error) {
                console.error("Error loading initial data:", error);
            } finally {
                setLoading(false);
            }
        };
        initData();
    }, []);

    // --- 3. FILTER DATA BULANAN ---
    useEffect(() => {
        if (!allHistoryData.length) {
            setFilteredMonthData([]);
            return;
        }

        const targetMonth = selectedDate.getMonth();
        const targetYear = selectedDate.getFullYear();

        const filtered = allHistoryData.filter(item => {
            if (!item.dateObj) return false;
            return item.dateObj.getMonth() === targetMonth && item.dateObj.getFullYear() === targetYear;
        });

        setFilteredMonthData(filtered);
        setCurrentPage(1);

    }, [selectedDate, allHistoryData]);

    // --- 4. CHART GENERATOR ---
    useEffect(() => {
        const increment = (item, status) => {
            if (status === 'OnTime') item.OnTime += 1;
            else if (status === 'Late') item.Late += 1;
            else if (status === 'Sick') item.Sick += 1;
            else if (status === 'OnLeave') item.OnLeave += 1;
            else if (status === 'Early') item.Early += 1;
            else if (status === 'Absent') item.Absent += 1;
        };

        if (chartView === 'Month') {
            let chartItems = [];

            if (userData && userData.mulai_magang && userData.akhir_magang) {
                const start = new Date(userData.mulai_magang);
                const end = new Date(userData.akhir_magang);
                let currentLoop = new Date(start.getFullYear(), start.getMonth(), 1);

                while (currentLoop <= end) {
                    const monthLabel = currentLoop.toLocaleString('en-US', { month: 'short' });
                    const loopYear = currentLoop.getFullYear();
                    const loopMonth = currentLoop.getMonth();

                    const chartItem = { name: monthLabel, OnTime: 0, Late: 0, Early: 0, OnLeave: 0, Sick: 0, Absent: 0 };

                    allHistoryData.forEach(hist => {
                        if (hist.dateObj &&
                            hist.dateObj.getMonth() === loopMonth &&
                            hist.dateObj.getFullYear() === loopYear) {
                            increment(chartItem, hist.rawStatus);
                        }
                    });

                    chartItems.push(chartItem);
                    currentLoop.setMonth(currentLoop.getMonth() + 1);
                }
            } else {
                const groups = {};
                allHistoryData.forEach(item => {
                    if (item.dateObj) {
                        const label = item.dateObj.toLocaleString('en-US', { month: 'short' });
                        if (!groups[label]) groups[label] = { name: label, OnTime: 0, Late: 0, Early: 0, OnLeave: 0, Sick: 0, Absent: 0 };
                        increment(groups[label], item.rawStatus);
                    }
                });
                chartItems = Object.values(groups).reverse();
            }
            setChartData(chartItems);

        } else if (chartView === 'Week') {
            const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
            const aggData = {};

            daysOrder.forEach(day => {
                aggData[day] = { name: day.substring(0, 3), OnTime: 0, Late: 0, Early: 0, OnLeave: 0, Sick: 0, Absent: 0 };
            });

            filteredMonthData.forEach(item => {
                if (item.dateObj) {
                    const dayName = item.dateObj.toLocaleDateString('en-US', { weekday: 'long' });
                    if (aggData[dayName]) {
                        increment(aggData[dayName], item.rawStatus);
                    }
                }
            });

            const finalChartData = daysOrder.map(d => aggData[d]);
            setChartData(finalChartData);
        }
    }, [chartView, allHistoryData, filteredMonthData, userData]);

    // --- 5. PAGINATION ---
    const totalPages = Math.ceil(filteredMonthData.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentTableData = filteredMonthData.slice(indexOfFirstItem, indexOfLastItem);

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) setCurrentPage(page);
    };

    // const handlePrevMonth = () => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1));
    // const handleNextMonth = () => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1));

    const StatusBadge = ({ status }) => {
        let styles = "bg-gray-100 text-gray-500 border-gray-200";
        let label = status;
        if (status && status.includes('On Time')) styles = "bg-green-100 text-green-600 border-green-200";
        else if (status && status.includes('Late')) styles = "bg-[#FFF4E5] text-orange-500 border-orange-200";
        else if (status === 'Sick') styles = "bg-blue-50 text-blue-600 border-blue-200";
        else if (status && status.includes('Absent')) styles = "bg-red-50 text-red-500 border-red-200"; // Mencakup "Absent (No Clock Out)"
        else if (status === 'On Leave') styles = "bg-slate-50 text-slate-600 border-slate-200";
        else if (status && status.includes('Early')) styles = "bg-yellow-50 text-yellow-700 border-yellow-200";

        return (
            <span className={`inline-flex items-center justify-center w-[100px] h-[34px] px-2 rounded-lg text-[13px] font-bold border whitespace-nowrap ${styles}`}>
                {label}
            </span>
        );
    };

    const openPhotoModal = (item, focus) => {
        setPhotoModal({ isOpen: true, item, focus });
    };

    return (
        <div className="bg-slate-50 -ml-3 -mr-3 min-h-screen px-4 md:px-8 py-8 font-sans text-slate-800 -mt-8">

            <PhotoMapModal
                isOpen={photoModal.isOpen}
                onClose={() => setPhotoModal({ isOpen: false, item: null, focus: 'masuk' })}
                item={photoModal.item}
                focus={photoModal.focus}
            />

            <div className="mb-8">
                <h1 className={`text-3xl font-bold ${textDarkBlue} mb-2 mt-2`}>Weekly & Monthly Attendance History</h1>
                <p className="text-slate-500 text-sm lg:text-base">Monitor the status of your attendance and correct your absence here</p>
            </div>

            {/* CHART SECTION */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 mb-8">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                    <h2 className={`text-xl font-bold ${textDarkBlue}`}>
                        {chartView === 'Week' ? 'Weekly Frequency' : 'Internship Trends'}
                    </h2>
                    <div className="flex bg-slate-50 p-1.5 rounded-xl border border-slate-100 shadow-sm w-full sm:w-auto">
                        <button onClick={() => setChartView('Week')} className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-xs font-bold transition-all ${chartView === 'Week' ? `bg-[#354C8F] text-white shadow-md` : 'bg-transparent text-slate-500 hover:bg-white'}`}>Week</button>
                        <button onClick={() => setChartView('Month')} className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-xs font-bold transition-all ${chartView === 'Month' ? `bg-[#354C8F] text-white shadow-md` : 'bg-transparent text-slate-500 hover:bg-white'}`}>Month</button>
                    </div>
                </div>
                <div className="h-[350px] w-full overflow-x-auto">
                    <div className="min-w-[500px] h-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={true} stroke="#E2E8F0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} allowDecimals={false} />
                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                <Legend content={<CustomLegend />} />
                                <Line type="monotone" dataKey="OnTime" stroke="#16a34a" name="On Time" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: 'white' }} />
                                <Line type="monotone" dataKey="Late" stroke="#f97316" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: 'white' }} />
                                <Line type="monotone" dataKey="Early" stroke="#eab308" name="Early" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: 'white' }} />
                                <Line type="monotone" dataKey="OnLeave" stroke="#475569" name="On Leave" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: 'white' }} />
                                <Line type="monotone" dataKey="Sick" stroke="#2563eb" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: 'white' }} />
                                <Line type="monotone" dataKey="Absent" stroke="#ef4444" name="Absent" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: 'white' }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* TABLE SECTION */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-visible">
                <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-row justify-between items-center gap-3">
                    {/* Month Picker: Ukuran otomatis mengikuti komponen */}
                    <div className="shrink-0">
                        <MonthYearPicker value={selectedDate} onChange={setSelectedDate} />
                    </div>

                    {/* Tombol Navigasi: Tetap di kanan
                    <div className="flex gap-2 shrink-0">
                        <button
                            onClick={handlePrevMonth}
                            className="p-2 sm:p-2.5 hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-500 hover:text-[#27345A] transition-colors"
                        >
                            <ChevronLeft size={18} className="sm:w-[20px] sm:h-[20px]" />
                        </button>
                        <button
                            onClick={handleNextMonth}
                            className="p-2 sm:p-2.5 hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-500 hover:text-[#27345A] transition-colors"
                        >
                            <ChevronRight size={18} className="sm:w-[20px] sm:h-[20px]" />
                        </button>
                    </div> */}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="border-b border-slate-100 text-sm font-bold text-slate-900 bg-slate-50/50">
                                <th className="pl-6 pr-3 py-2 w-16 text-center">No</th>
                                <th className="px-3 py-2">Date</th>
                                <th className="px-3 py-2 text-center">Clock In</th>
                                <th className="px-3 py-2 text-center">Clock Out</th>
                                <th className="px-3 py-2 text-center">Duration</th>
                                <th className="px-3 py-2 text-center">Status</th>
                                <th className="px-3 py-2">Reason</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm text-slate-600">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="px-3 py-6 text-center">
                                        <div className="flex flex-col items-center justify-center text-slate-400">
                                            <Loader2 className="animate-spin mb-2 text-[#354C8F]" size={32} />
                                            <p>Loading history...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : currentTableData.length > 0 ? (
                                currentTableData.map((item, index) => (
                                    <tr key={index} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                        <td className="pl-6 pr-3 py-2 font-medium text-center">{indexOfFirstItem + index + 1}</td>
                                        <td className="px-3 py-2 text-slate-700">{item.displayDate}</td>
                                        <td className="px-3 py-2 text-center">
                                            <div className="inline-flex items-center justify-center gap-2">
                                                <span className="font-semibold text-slate-700">{item.inTime}</span>
                                                <PhotoBubbleButton
                                                    photo={item.photoMasuk ?? item.photo}
                                                    alt="Clock In photo"
                                                    onClick={() => openPhotoModal(item, 'masuk')}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            <div className="inline-flex items-center justify-center gap-2">
                                                <span className="font-semibold text-slate-700">{item.outTime}</span>
                                                <PhotoBubbleButton
                                                    photo={item.photoPulang ?? item.photo}
                                                    alt="Clock Out photo"
                                                    onClick={() => openPhotoModal(item, 'pulang')}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-center">{item.duration}</td>
                                        <td className="px-3 py-2 text-center"><StatusBadge status={item.status} /></td>
                                        <td className="px-3 py-2 truncate max-w-xs">{item.reason}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="7" className="p-12 text-center">
                                        <div className="flex flex-col items-center justify-center text-slate-400">
                                            <p className="font-semibold">No attendance data found for {selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* PAGINATION BUTTONS */}
                {!loading && filteredMonthData.length > 0 && (
                    <div className="flex flex-col md:flex-row justify-between items-center p-5 border-t border-slate-100 text-sm text-slate-500 gap-4">
                        <p className="order-2 md:order-1">
                            {`Showing ${indexOfFirstItem + 1} to ${Math.min(indexOfLastItem, filteredMonthData.length)} of ${filteredMonthData.length} entries`}
                        </p>
                        <div className="flex items-center gap-4 order-1 md:order-2">
                            <div className="flex items-center gap-2">
                                <label className="text-sm md:text-sm font-medium text-slate-600">Per page:</label>
                                <select
                                    value={itemsPerPage}
                                    onChange={(e) => {
                                        setItemsPerPage(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                    className="px-2 py-1.5 rounded-lg border border-slate-200 text-sm md:text-sm font-medium text-slate-700 bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 cursor-pointer transition-all"
                                >
                                    <option value={5}>5</option>
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                            <button
                                disabled={currentPage === 1}
                                onClick={() => handlePageChange(currentPage - 1)}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 border border-slate-200 disabled:cursor-not-allowed">
                                <ChevronLeft size={18} />
                            </button>

                            {(() => {
                                const pageCurrent = (typeof pagination !== 'undefined' && pagination.current_page) ? pagination.current_page : currentPage;
                                const pageTotal = (typeof pagination !== 'undefined' && pagination.last_page) ? pagination.last_page : totalPages;
                                const getPageItems = (current, total, sibling = 1) => {
                                    const totalNumbers = sibling * 2 + 5;
                                    if (total <= totalNumbers) return Array.from({ length: total }, (_, i) => i + 1);
                                    const left = Math.max(2, current - sibling);
                                    const right = Math.min(total - 1, current + sibling);
                                    const pages = [1];
                                    if (left > 2) pages.push('left-ellipsis');
                                    for (let i = left; i <= right; i++) pages.push(i);
                                    if (right < total - 1) pages.push('right-ellipsis');
                                    pages.push(total);
                                    return pages;
                                };
                                return getPageItems(pageCurrent, pageTotal, 1).map((p, idx) => {
                                    if (p === 'left-ellipsis' || p === 'right-ellipsis') return <div key={`${p}-${idx}`} className="w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold text-slate-400">...</div>;
                                    return <button key={p} onClick={() => handlePageChange(p)} className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-colors ${pageCurrent === p ? "bg-slate-100 text-[#27345A]" : "text-slate-500 hover:bg-slate-50 border border-transparent"}`} disabled={pageCurrent === p}>{p}</button>;
                                });
                            })()} 

                            <button
                                disabled={currentPage === totalPages}
                                onClick={() => handlePageChange(currentPage + 1)}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 border border-slate-200 disabled:cursor-not-allowed">
                                <ChevronRight size={18} />
                            </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HistoryPage;