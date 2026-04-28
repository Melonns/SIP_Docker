import React, { useState, useEffect, useRef, Fragment } from "react"; // Tambahkan Fragment
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  useMap,
  ZoomControl,
} from "react-leaflet";
import Webcam from "react-webcam";
import {
  Camera,
  MapPin,
  Clock,
  Smartphone,
  Loader2,
  RefreshCcw,
  ClipboardList,
  Lock,
  X,
  CheckCircle,
  AlertTriangle,
  Check
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import apiClient from "../../api/axiosConfig";
import { fetchSecureBlob } from '../../utils/secureFetch';
import { getSafeErrorMessage } from "../../utils/errorHandler";

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

const JAKARTA_TZ = "Asia/Jakarta";

const parseRadiusMeters = (value) => {
  if (value == null) return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  // Handle common locale formats for thousands/decimals, then parse as meters.
  let normalized = raw;
  const hasDot = normalized.includes(".");
  const hasComma = normalized.includes(",");

  if (hasDot && hasComma) {
    const lastDot = normalized.lastIndexOf(".");
    const lastComma = normalized.lastIndexOf(",");
    if (lastComma > lastDot) {
      // 1.234,56 -> 1234.56
      normalized = normalized.replace(/\./g, "").replace(/,/g, ".");
    } else {
      // 1,234.56 -> 1234.56
      normalized = normalized.replace(/,/g, "");
    }
  } else if (hasDot && /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(normalized)) {
    // 1.000 or 12.500,5 -> remove thousand separator dots first.
    normalized = normalized.replace(/\./g, "").replace(/,/g, ".");
  } else if (hasComma && /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(normalized)) {
    // 1,000 or 12,500.5 -> remove thousand separator commas.
    normalized = normalized.replace(/,/g, "");
  } else if (hasComma) {
    // 123,5 -> 123.5
    normalized = normalized.replace(/,/g, ".");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
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
    // Fallback: local date key
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
};

const parseServerDate = (value, baseDate = new Date()) => {
  if (value == null) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    const fromNumber = new Date(value);
    return Number.isNaN(fromNumber.getTime()) ? null : fromNumber;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  // HH:mm:ss -> assume Jakarta time for today.
  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) {
    const dateKey = getJakartaDateKey(baseDate);
    const parsed = new Date(`${dateKey}T${raw}+07:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  // YYYY-MM-DD HH:mm:ss -> treat as Jakarta time if timezone is absent.
  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(raw)) {
    const parsed = new Date(`${raw.replace(" ", "T")}+07:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

const extractAttendanceTimeFromResponse = (payload, mode, baseDate = new Date()) => {
  const inFields = [
    "jam_masuk",
    "jam_absen_masuk",
    "waktu_masuk",
    "clock_in_time",
    "check_in_time",
    "time_in",
    "masuk",
    "clock_in",
    "checkin_time",
  ];

  const outFields = [
    "jam_pulang",
    "jam_absen_pulang",
    "waktu_pulang",
    "clock_out_time",
    "check_out_time",
    "time_out",
    "pulang",
    "clock_out",
    "checkout_time",
  ];

  const genericFields = ["server_hour", "server_time", "timestamp", "created_at", "updated_at", "time"];
  const modeFields = mode === "out" ? outFields : inFields;

  const candidates = [
    payload,
    payload?.data,
    payload?.result,
    payload?.attendance,
    payload?.data?.attendance,
    payload?.data?.data,
  ].filter(Boolean);

  for (const obj of candidates) {
    for (const key of [...modeFields, ...genericFields]) {
      const parsed = parseServerDate(obj?.[key], baseDate);
      if (parsed) return parsed;
    }
  }

  return null;
};

// --- MAP CONTROL ---
function MapController({ center }) {
  const map = useMap();
  const [hasFlown, setHasFlown] = useState(false);
  useEffect(() => {
    if (center && !hasFlown) {
      map.setView(center, 16);
      setHasFlown(true);
    }
  }, [center, map, hasFlown]);
  return null;
}

export default function Presensi() {
  const [userLocation, setUserLocation] = useState(null);
  const [isLocationLoaded, setIsLocationLoaded] = useState(false);
  const [locationStatus, setLocationStatus] = useState({
    isInside: false,
    nearestOffice: null,
  });
  const [inStatus, setInStatus] = useState(false);
  const [outStatus, setOutStatus] = useState(false);
  const [isStatusLoading, setIsStatusLoading] = useState(true);

  // DATA KANTOR
  const [offices, setOffices] = useState([]);
  const [isOfficesLoaded, setIsOfficesLoaded] = useState(false);
  const [officesError, setOfficesError] = useState(null); // fetch errors (e.g., 403)

  // MODAL KAMERA & FOTO
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [photoIn, setPhotoIn] = useState(null);
  const [photoOut, setPhotoOut] = useState(null);

  // LOADING STATES
  const [isLoadingPhoto, setIsLoadingPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // MODAL STATES
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [isErrorOpen, setIsErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLateSubmission, setIsLateSubmission] = useState(false);

  // EARLY LEAVE STATES
  const [isEarlyModalOpen, setIsEarlyModalOpen] = useState(false);
  const [earlyRemark, setEarlyRemark] = useState("");
  const [earlyRemarkError, setEarlyRemarkError] = useState("");
  const [isRequestingEarly, setIsRequestingEarly] = useState(false);
  const [earlyFlag, setEarlyFlag] = useState(false);
  const [lastEarlyRemark, setLastEarlyRemark] = useState(null);
  const [clockOutFallbackTried, setClockOutFallbackTried] = useState(false);

  const [serverTime, setServerTime] = useState(new Date());
  const todayKey = getJakartaDateKey(serverTime);
  const [workStatus, setWorkStatus] = useState("idle");
  const defaultSchedule = { clockIn: "08:00", clockOut: "17:00", openTime: "07:00", tolerance: 10 };
  const [workingSchedule, setWorkingSchedule] = useState(defaultSchedule);
  const [workScheduleData, setWorkScheduleData] = useState(null);
  const webcamRef = useRef(null);
  const serverOffsetMsRef = useRef(0);
  const hasServerSyncRef = useRef(false);

  // --- 1. FETCH DATA KANTOR ---
  const loadSites = async () => {
    setIsOfficesLoaded(false);
    setOfficesError(null);
    try {
      // Use public sites endpoint
      const endpoints = ['/sites'];
      let loaded = false;

      for (const ep of endpoints) {
        try {
          const res = await apiClient.get(ep);
          const payload = res.data || {};
          const raw = payload.data || [];
          const items = (Array.isArray(raw) ? raw : (raw.data || []))
            .filter(s => {
              const v = s.is_active;
              // Only filter out when backend explicitly marks inactive (false, 0, '0')
              // undefined/null = field not returned by API → treat as active
              if (v === undefined || v === null) return true;
              return v !== false && v !== 0 && v !== '0';
            })
            .map(s => ({
              id: s.id_site ?? s.id,
              name: s.nama_site ?? s.name ?? '',
              address: s.alamat ?? s.address ?? '',
              lat: Number(s.latitude ?? s.lat ?? 0),
              lng: Number(s.longitude ?? s.lng ?? 0),
              radius: parseRadiusMeters(s.radius_meter ?? s.radius) ?? 300
            })).filter(it => !Number.isNaN(it.lat) && !Number.isNaN(it.lng));

          if (items.length > 0) {
            setOffices(items);
            loaded = true;
            break;
          }
        } catch (err) {
          console.warn(`Failed to fetch sites from ${ep}:`, err);
          // if 403, try next endpoint; otherwise continue to try next
          continue;
        }
      }

      if (!loaded) {
        setOffices([]);
        setOfficesError('Unable to load office locations (check permissions or try again).');
      }
    } catch (err) {
      console.error('Unexpected error loading sites:', err);
      setOffices([]);
      setOfficesError('Unable to load office locations.');
    } finally {
      setIsOfficesLoaded(true);
    }
  };

  useEffect(() => {
    loadSites();
  }, []);

  // --- FETCH WORKING SCHEDULE FROM PROFILE ---
  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const res = await apiClient.get('/profile');
        const data = res.data?.data || res.data || {};
        if (data.work_schedule) {
          setWorkScheduleData(data.work_schedule);
        }
      } catch (err) {
        console.warn("Failed to fetch schedule from profile:", err);
      }
    };
    fetchSchedule();
  }, []);

  // Update workingSchedule based on current day
  useEffect(() => {
    if (workScheduleData) {
      const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const todayName = dayNames[serverTime.getDay()];
      const todayDetails = workScheduleData.day_times?.[todayName];

      const clockIn = todayDetails?.start || workScheduleData.start_time || defaultSchedule.clockIn;
      const clockOut = todayDetails?.end || workScheduleData.end_time || defaultSchedule.clockOut;
      
      // Calculate openTime as 1 hour before clockIn if not explicitly provided
      let openTime = defaultSchedule.openTime;
      const clockInMin = timeToMinutes(clockIn);
      if (clockInMin) {
        openTime = minutesToHHMM(clockInMin - 60);
      }

      setWorkingSchedule({
        clockIn,
        clockOut,
        openTime,
        tolerance: workScheduleData.tolerance ?? defaultSchedule.tolerance
      });
    }
  }, [workScheduleData, serverTime.getDay()]);


  // Fallback only: use user-site when master data office locations are unavailable.
  useEffect(() => {
    const fetchUserSiteFallback = async () => {
      // Master data already exists, do not override/merge with user-site.
      if (offices.length > 0) return;

      try {
        const response = await apiClient.get("/absensi/user-site");
        const siteData = response.data?.data;

        const lat = parseFloat(siteData?.latitude ?? siteData?.lat ?? siteData?.site?.latitude);
        const lng = parseFloat(siteData?.longitude ?? siteData?.lng ?? siteData?.site?.longitude);

        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
          const userSite = {
            id: siteData?.id || siteData?.site?.id || 1,
            name: siteData?.nama_site || siteData?.name || siteData?.site?.nama_site || "Office",
            address: siteData?.alamat || siteData?.address || siteData?.site?.alamat || siteData?.site?.address || "",
            lat,
            lng,
            radius: parseRadiusMeters(siteData?.radius_meter ?? siteData?.radius ?? siteData?.site?.radius_meter ?? siteData?.site?.radius) ?? 300,
          };
          setOffices([userSite]);
        }
      } catch (error) {
        console.error("Failed to fetch fallback user-site data:", error);
      }
    };

    if (isOfficesLoaded && offices.length === 0) {
      fetchUserSiteFallback();
    }
  }, [isOfficesLoaded, offices.length]);

  // --- 2. TIMER ---
  // useEffect(() => {
  //   // TEMPORARY: Use local machine time for testing
  //   const timer = setInterval(() => {
  //     setServerTime(new Date());
  //   }, 1000);
  //   return () => clearInterval(timer);
  // }, []);


  // TIME SERVER: keep an offset from server and tick every second from that offset.
  useEffect(() => {
    const fetchServerTime = async () => {
      try {
        const res = await apiClient.get("/absensi/server-time");
        const payload = res?.data || {};
        const parsed = parseServerDate(payload.server_hour ?? payload.server_time ?? payload.timestamp, new Date());

        if (parsed) {
          hasServerSyncRef.current = true;
          serverOffsetMsRef.current = parsed.getTime() - Date.now();
          setServerTime(new Date(Date.now() + serverOffsetMsRef.current));
        } else if (!hasServerSyncRef.current) {
          // First load fallback if server payload is invalid.
          serverOffsetMsRef.current = 0;
          setServerTime(new Date());
        }
      } catch (error) {
        console.error("Failed to fetch server time:", error);
        if (!hasServerSyncRef.current) {
          serverOffsetMsRef.current = 0;
          setServerTime(new Date());
        }
      }
    };

    fetchServerTime();

    const tickTimer = setInterval(() => {
      setServerTime(new Date(Date.now() + serverOffsetMsRef.current));
    }, 1000);

    const syncTimer = setInterval(() => {
      fetchServerTime();
    }, 5 * 60 * 1000);

    return () => {
      clearInterval(tickTimer);
      clearInterval(syncTimer);
    };
  }, []);


  // --- 3. CEK STATUS SAAT LOAD ---
  // --- 3. CEK STATUS SAAT LOAD ---
  useEffect(() => {
    const fetchAttendanceStatus = async () => {
      const extractUserId = (payload) => {
        const direct = payload?.user_id ?? payload?.id;
        if (direct != null) return direct;
        const fromUser = payload?.user?.user_id ?? payload?.user?.id;
        if (fromUser != null) return fromUser;
        const fromData = payload?.data?.user_id ?? payload?.data?.id ?? payload?.data?.user?.user_id ?? payload?.data?.user?.id;
        if (fromData != null) return fromData;
        return null;
      };

      const isTruthy = (v) => v === true || v === 1 || v === '1';

      // Hydrate quickly from local cache so UI doesn't briefly offer wrong actions.
      try {
        const savedIn = localStorage.getItem("clockInStatus");
        const savedOut = localStorage.getItem("clockOutStatus");
        const savedInDate = localStorage.getItem('clockInStatusDateKey');
        const savedOutDate = localStorage.getItem('clockOutStatusDateKey');

        const cachedInForToday = savedInDate === todayKey ? isTruthy(JSON.parse(savedIn ?? 'false')) : false;
        const cachedOutForToday = savedOutDate === todayKey ? isTruthy(JSON.parse(savedOut ?? 'false')) : false;

        if (savedIn != null && savedInDate === todayKey) setInStatus(cachedInForToday);
        if (savedOut != null && savedOutDate === todayKey) setOutStatus(cachedOutForToday);
      } catch {
        // ignore
      }

      setIsStatusLoading(true);
      try {
        const res = await apiClient.get("/absensi/cek-status");
        const sudahAbsen = res.data.sudah_absen_masuk;
        const sudahPulang = res.data.sudah_absen_pulang;

        // If the API status is delayed/stale, keep today's optimistic cached status.
        const effectiveIn = isTruthy(sudahAbsen);
        const effectiveOut = isTruthy(sudahPulang);
        
        setInStatus(effectiveIn);
        setOutStatus(effectiveOut);

        // Update cache to match authoritative API status
        localStorage.setItem("clockInStatus", JSON.stringify(effectiveIn));
        localStorage.setItem("clockOutStatus", JSON.stringify(effectiveOut));
        if (effectiveIn) localStorage.setItem('clockInStatusDateKey', todayKey);
        else localStorage.removeItem('clockInStatusDateKey');
        if (effectiveOut) localStorage.setItem('clockOutStatusDateKey', todayKey);
        else localStorage.removeItem('clockOutStatusDateKey');

        // Status is now authoritative; unblock actions.
        setIsStatusLoading(false);

        // Restore early-clock-out info for today from localStorage as a fast, reliable fallback across refresh.
        if (effectiveOut) {
          try {
            const cached = localStorage.getItem("earlyClockOutInfo");
            if (cached) {
              const parsed = JSON.parse(cached);
              if (parsed?.dateKey === todayKey) {
                setEarlyFlag(true);
                setLastEarlyRemark(parsed?.reason || null);
              }
            }
          } catch {
            // ignore cache parse errors
          }
        } else {
          localStorage.removeItem("earlyClockOutInfo");
          setEarlyFlag(false);
          setLastEarlyRemark(null);
        }

        // Fetch latest history to detect if the last clock out was an Early Clock Out (but only if it happened today)
        if (effectiveOut) {
          try {
            // Grab several rows and pick today's latest clock-out row.
            const histRes = await apiClient.get('/absensi/riwayat', { params: { per_page: 10, limit: 10, pagination: 0 } });
            const raw = histRes.data?.data?.data || histRes.data?.data || [];
            const rows = Array.isArray(raw) ? raw : (raw ? [raw] : []);

            const extractDateKeyFromRecord = (rec) => {
              const candidates = [rec.tanggal, rec.tanggal_pulang, rec.server_date, rec.date, rec.date_time, rec.created_at];
              for (const c of candidates) {
                if (!c) continue;
                const s = String(c);
                const m = s.match(/\d{4}-\d{2}-\d{2}/);
                if (m) return m[0];
              }
              return null;
            };

            const parseMinutes = (timeLike) => {
              if (!timeLike) return null;
              const s = String(timeLike);
              const m = s.match(/(\d{1,2}):(\d{2})(?::\d{2})?/);
              if (!m) return null;
              const hh = Number(m[1]);
              const mm = Number(m[2]);
              if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
              return hh * 60 + mm;
            };

            const extractOutMinutes = (rec) => {
              const candidates = [
                rec.jam_pulang,
                rec.jam_absen_pulang,
                rec.waktu_pulang,
                rec.pulang,
                rec.check_out,
                rec.checkout,
                rec.jam_keluar,
                rec.time_out,
              ];
              for (const c of candidates) {
                const mins = parseMinutes(c);
                if (mins != null) return mins;
              }
              return null;
            };

            const extractReason = (rec) => rec.reason || rec.remark || rec.keterangan || rec.early_reason || rec.alasan || null;

            const isEarlyFlag = (rec) => {
              if (rec.early === true || rec.early === 1 || rec.early === '1') return true;
              if (rec.is_early === true || rec.is_early === 1 || rec.is_early === '1') return true;
              if (rec.early_clock_out === true || rec.early_clock_out === 1 || rec.early_clock_out === '1') return true;
              return false;
            };

            const todayRows = rows
              .map((r) => ({ rec: r, dateKey: extractDateKeyFromRecord(r) }))
              .filter((x) => x.dateKey === todayKey)
              .map((x) => x.rec);

            // Pick the most plausible clock-out row for today
            const scored = todayRows.map((rec) => {
              const outMins = extractOutMinutes(rec);
              const createdAt = rec.created_at ? new Date(String(rec.created_at).replace(' ', 'T') + (String(rec.created_at).includes('Z') || String(rec.created_at).includes('+') ? '' : '+07:00')) : null;
              const createdScore = createdAt && !isNaN(createdAt.getTime()) ? createdAt.getTime() : 0;
              return { rec, outMins, createdScore };
            });
            scored.sort((a, b) => (b.createdScore - a.createdScore) || ((b.outMins ?? -1) - (a.outMins ?? -1)));
            const best = scored[0]?.rec;

            if (best) {
              const outMins = extractOutMinutes(best);
              const hasEarly = isEarlyFlag(best) || (outMins != null && clockOutMinutes != null && outMins < clockOutMinutes);
              if (hasEarly) {
                const reason = extractReason(best);
                setEarlyFlag(true);
                setLastEarlyRemark(reason);
                localStorage.setItem("earlyClockOutInfo", JSON.stringify({ dateKey: todayKey, reason }));
              } else {
                // Not early today => clear cache (keeps UI consistent)
                localStorage.removeItem("earlyClockOutInfo");
                setEarlyFlag(false);
                setLastEarlyRemark(null);
              }
            }
          } catch (err) {
            console.warn('Failed to fetch latest attendance history for early flag:', err);
            // don't override existing early flag if fetching fails
          }
        }

        // Helper to fetch user ID if not already available
        let userId = null;
        try {
             const idRes = await apiClient.get("/user");
             userId = extractUserId(idRes?.data);
        } catch(e) { console.warn("Could not get user ID for photo fetch", e); }

        if (effectiveIn && userId) {
          setIsLoadingPhoto(true);
          const imgUrl = await fetchSecureBlob(`/absensi/foto-masuk/${userId}`);
          if (imgUrl) setPhotoIn(imgUrl);
        } else {
            setPhotoIn(null);
        }

        if (effectiveOut && userId) {
             setWorkStatus("done"); 
             // Fetch Clock Out Photo
             const imgUrlOut = await fetchSecureBlob(`/absensi/foto-pulang/${userId}`);
             if (imgUrlOut) setPhotoOut(imgUrlOut);
        } else {
             if (effectiveIn) setWorkStatus("working");
             setPhotoOut(null);
        }
        
        setIsLoadingPhoto(false);

      } catch (error) {
        console.error("Failed to check status", error);
        const savedStatus = localStorage.getItem("clockInStatus");
        const savedOut = localStorage.getItem("clockOutStatus");
        if (savedStatus) setInStatus(JSON.parse(savedStatus));
        if (savedOut) setOutStatus(JSON.parse(savedOut));
        setIsStatusLoading(false);
      }
    };
    fetchAttendanceStatus();
  }, [todayKey]);

  // --- LOGIKA WAKTU ---
  const formatTime = (date, withSeconds = false) =>
    date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      ...(withSeconds ? { second: "2-digit" } : {}),
      timeZone: "Asia/Jakarta",
    });

  const timeToMinutes = (timeStr) => {
    if (!timeStr || !timeStr.includes(":")) return null;
    const [h, m] = timeStr.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  };

  const minutesToHHMM = (minutes) => {
    const h = String(Math.floor(minutes / 60)).padStart(2, "0");
    const m = String(minutes % 60).padStart(2, "0");
    return `${h}:${m}`;
  };

  const timeStrJakarta = serverTime.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta"
  });
  const [hourStr, minuteStr] = timeStrJakarta.split(":");
  const nowMinutes = parseInt(hourStr, 10) * 60 + parseInt(minuteStr, 10);

  const clockInMinutes = timeToMinutes(workingSchedule.clockIn) ?? timeToMinutes(defaultSchedule.clockIn);
  const openMinutes = timeToMinutes(workingSchedule.openTime) ?? timeToMinutes(defaultSchedule.openTime);
  const clockOutMinutes = timeToMinutes(workingSchedule.clockOut) ?? timeToMinutes(defaultSchedule.clockOut);
  const toleranceMinutes = Number.isFinite(Number(workingSchedule.tolerance)) ? Number(workingSchedule.tolerance) : defaultSchedule.tolerance;
  const lateThreshold = (clockInMinutes ?? 480) + toleranceMinutes; // default 08:00 + tolerance

  // New: don't allow clock-in before scheduled clockIn time (ignore openTime fallback)
  const isBeforeClockIn = nowMinutes < (clockInMinutes ?? 480); // cannot clock-in before scheduled clockIn
  const isTooEarly = isBeforeClockIn;
  const isLate = nowMinutes > lateThreshold;
  const canClockOut = nowMinutes >= (clockOutMinutes ?? 1020); // default 17:00
  const checkoutTimeStr = workingSchedule.clockOut || defaultSchedule.clockOut;
  const clockInDisplay = workingSchedule.clockIn || (clockInMinutes != null ? minutesToHHMM(clockInMinutes) : defaultSchedule.clockIn);
  const openTimeDisplay = workingSchedule.openTime || (openMinutes != null ? minutesToHHMM(openMinutes) : defaultSchedule.openTime);
  const toleranceDisplay = `${toleranceMinutes}m`;

  // --- 4. GPS & RADIUS ---
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(successGPS, errorGPS, { enableHighAccuracy: true });
      const watchId = navigator.geolocation.watchPosition(successGPS, errorGPS, { enableHighAccuracy: true });
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  useEffect(() => {
    if (userLocation && offices.length > 0) {
      checkOfficeProximity(userLocation.lat, userLocation.lng);
    }
  }, [offices, userLocation]);

  const successGPS = (position) => {
    setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
    setIsLocationLoaded(true);
  };

  const errorGPS = (err) => console.error("GPS Error:", err);

  const checkOfficeProximity = (userLat, userLng) => {
    if (offices.length === 0) {
      setLocationStatus({ isInside: false, nearestOffice: null });
      return;
    }

    const officeDistances = offices.map((office) => {
      const dist = calculateDistance(userLat, userLng, office.lat, office.lng); // meters
      return {
        office,
        dist,
        radius: (typeof office.radius === 'number' && Number.isFinite(office.radius)) ? office.radius : 300,
      };
    });

    const nearestEntry = officeDistances.reduce((acc, curr) => (curr.dist < acc.dist ? curr : acc), officeDistances[0]);
    const insideCandidates = officeDistances.filter((entry) => entry.dist <= entry.radius);
    const selectedEntry = insideCandidates.length > 0
      ? insideCandidates.reduce((acc, curr) => (curr.dist < acc.dist ? curr : acc), insideCandidates[0])
      : nearestEntry;

    const isInside = insideCandidates.length > 0;
    const nearest = selectedEntry?.office || null;
    const nearestDist = selectedEntry?.dist ?? null;
    const radiusToUse = selectedEntry?.radius ?? 300;

    setLocationStatus({
      isInside,
      nearestOffice: nearest ? nearest.name : null,
      nearestOfficeId: nearest ? nearest.id : null,
      nearestDistance: nearest ? nearestDist : null,
      nearestRadius: radiusToUse
    });
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  // Compress a data URL (base64) to a JPEG Blob with max width and quality.
  const compressDataUrlToBlob = (dataUrl, maxWidth = 800, quality = 0.85) => new Promise((resolve, reject) => {
    if (!dataUrl) return reject(new Error('No dataUrl provided'));
    const img = new Image();
    img.onload = () => {
      try {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          const ratio = maxWidth / width;
          width = maxWidth;
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Compression to blob failed'));
        }, 'image/jpeg', quality);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = (e) => reject(e);
    img.src = dataUrl;
  });

  const capture = () => {
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;
    setIsLoadingPhoto(true);

    compressDataUrlToBlob(imageSrc, 800, 0.7)
      .then((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const compressedDataUrl = reader.result;
          if (!inStatus) setPhotoIn(compressedDataUrl);
          else {
            setPhotoOut(compressedDataUrl);
            // If this capture was triggered as part of Early Leave flow, open remark modal
            if (isRequestingEarly) {
              setIsEarlyModalOpen(true);
              setIsRequestingEarly(false);
            }
            // Normal clock out: just close camera, let user click Clock Out button
          }
          setIsCameraOpen(false);
        };
        reader.readAsDataURL(blob);
      })
      .catch((err) => {
        console.warn('Image compression failed, using original image', err);
        if (!inStatus) setPhotoIn(imageSrc);
        else {
          setPhotoOut(imageSrc);
          if (isRequestingEarly) {
            setIsEarlyModalOpen(true);
            setIsRequestingEarly(false);
          }
          // Normal clock out: just close camera, let user click Clock Out button
        }
        setIsCameraOpen(false);
      })
      .finally(() => setIsLoadingPhoto(false));
  };

  // --- HELPER: Convert DataURL to File ---
  const dataURLtoFile = (dataUrl, filename) => {
    // Extract the base64 content from "data:image/jpeg;base64,XXXX"
    const arr = dataUrl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  // --- 5. HANDLE CLOCK IN ---
  const handleClockIn = async () => {
    setIsSubmitting(true);
    setIsLateSubmission(false);

    try {
      if (!photoIn) throw new Error("Photo is required!");
      const file = await dataURLtoFile(photoIn, "selfie-in.jpg");

      const formData = new FormData();
      formData.append("latitude", userLocation.lat);
      formData.append("longitude", userLocation.lng);
      formData.append("foto", file);
      if (locationStatus.nearestOfficeId) formData.append('site_id', locationStatus.nearestOfficeId);
      if (locationStatus.nearestDistance != null) formData.append('distance', String(Math.round(locationStatus.nearestDistance)));

      const submitRes = await apiClient.post("/absensi/masuk", formData, { headers: { "Content-Type": "multipart/form-data" } });

      const authoritativeTime = extractAttendanceTimeFromResponse(submitRes?.data, "in", serverTime) || serverTime;
      const timeString = formatTime(authoritativeTime, true);
      const authoritativeMinutes = parseInt(formatTime(authoritativeTime).slice(0, 2), 10) * 60 + parseInt(formatTime(authoritativeTime).slice(3, 5), 10);
      const isLateSubmit = authoritativeMinutes > lateThreshold;

      if (isLateSubmit) {
        setSuccessMessage(`You are Late! Clocked in at ${timeString} WIB`);
        setIsLateSubmission(true);
      } else {
        setSuccessMessage(`Clock In Successful at ${timeString} WIB`);
        setIsLateSubmission(false);
      }

      setIsSuccessOpen(true);
      setWorkStatus("working");
      setInStatus(true);
      
      const effectiveIn = true;
      localStorage.setItem("clockInStatus", JSON.stringify(effectiveIn));
      localStorage.setItem('clockInStatusDateKey', getJakartaDateKey(serverTime));

    } catch (error) {
      const msg = String(error?.response?.data?.message || "").toLowerCase();
      if (!clockOutFallbackTried && (msg.includes('already') || msg.includes('sudah') || error?.response?.status === 409)) {
        setClockOutFallbackTried(true);
        try {
          await handleClockOut({ photoData: photoOut });
          setClockOutFallbackTried(false);
          return;
        } catch (e) {
          // proceed to show original error
          setClockOutFallbackTried(false);
        }
      }
      const safeMsg = getSafeErrorMessage(error, "Failed to clock in");
      setErrorMessage(safeMsg);
      setIsErrorOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- 6. HANDLE CLOCK OUT ---
  const handleClockOut = async (options = {}) => {
    const { early = false, remark = '', photoData = null } = options;
    setIsSubmitting(true);
    setIsLateSubmission(false);
    try {
      // Use passed photoData or fall back to state (prefer passed param to avoid race condition)
      const photoToSubmit = photoData || photoOut;
      if (!photoToSubmit) throw new Error("Photo is required!");
      const file = await dataURLtoFile(photoToSubmit, "selfie-out.jpg");

      const formData = new FormData();
      formData.append("latitude", userLocation.lat);
      formData.append("longitude", userLocation.lng);
      formData.append("foto", file);
      if (locationStatus.nearestOfficeId) formData.append('site_id', locationStatus.nearestOfficeId);
      if (locationStatus.nearestDistance != null) formData.append('distance', String(Math.round(locationStatus.nearestDistance)));
      // Early leave metadata
      if (early) {
        formData.append('early', '1');
        if (remark) {
          // Keep `remark` for backward compatibility, but include `reason` as the canonical field the API expects
          formData.append('remark', remark);
          formData.append('reason', remark);
        }
      }

      const submitRes = await apiClient.post("/absensi/pulang", formData, { headers: { "Content-Type": "multipart/form-data" } });

      const authoritativeTime = extractAttendanceTimeFromResponse(submitRes?.data, "out", serverTime) || serverTime;
      const timeString = formatTime(authoritativeTime, true);

      setSuccessMessage(early ? `Early Clock Out recorded at ${timeString} WIB` : `Clock Out Successful at ${timeString} WIB`);
      setIsSuccessOpen(true);
      setWorkStatus("done");
      setOutStatus(true);
      
      const effectiveOut = true;
      localStorage.setItem("clockOutStatus", JSON.stringify(effectiveOut));
      localStorage.setItem('clockOutStatusDateKey', getJakartaDateKey(serverTime));
      if (early) {
        setEarlyFlag(true);
        setLastEarlyRemark(remark || null);
        localStorage.setItem("earlyClockOutInfo", JSON.stringify({ dateKey: getJakartaDateKey(serverTime), reason: remark || null }));
      } else {
        localStorage.removeItem("earlyClockOutInfo");
      }
    } catch (error) {
      const msgFromServer = error.response?.data?.message || "";
      // If not early and server blocks until cutoff, keep existing message
      if (!early && (msgFromServer.includes("belum tersedia") || msgFromServer.includes("17:00"))) {
        setErrorMessage(`Clock Out is not available yet. Please wait until ${checkoutTimeStr} (Server Time).`);
      } else {
        const safeMsg = getSafeErrorMessage(error, "Failed to clock out. Please try again.");
        setErrorMessage(safeMsg);
      }
      setIsErrorOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Minimum requirements for early reason
  const MIN_REASON_WORDS = 3;
  const MIN_REASON_CHARS = 10;
  const isEarlyReasonValid = () => {
    const txt = (earlyRemark || '').trim();
    const words = txt.split(/\s+/).filter(Boolean).length;
    return txt.length >= MIN_REASON_CHARS && words >= MIN_REASON_WORDS;
  };

  // Confirm early action with validation
  const handleConfirmEarly = async () => {
    if (!isEarlyReasonValid()) {
      setEarlyRemarkError(`Please provide at least ${MIN_REASON_WORDS} words and ${MIN_REASON_CHARS} characters.`);
      return;
    }
    setEarlyRemarkError("");
    // Keep the modal open while submitting so user sees the loading state
    try {
      // Ensure submit UI shows immediately
      setIsSubmitting(true);
      // Capture photoOut here to avoid race condition with state reset
      const photoDataToSubmit = photoOut;
      await handleClockOut({ early: true, remark: earlyRemark.trim(), photoData: photoDataToSubmit });
      setLastEarlyRemark(earlyRemark.trim());
      // Close modal on success
      setIsEarlyModalOpen(false);
    } catch (err) {
      // Errors are handled in handleClockOut and will surface via isErrorOpen
    } finally {
      setEarlyRemark('');
      setIsRequestingEarly(false);
      setIsSubmitting(false);
    }
  };

  // --- STYLES ---
  const cardShadow = "shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)]";
  const disabledButtonStyle = "bg-slate-900 text-slate-400 border border-slate-700 cursor-not-allowed shadow-none";
  const activeButtonStyle = "bg-[#3B5998] hover:bg-[#2c4376] text-white shadow-lg";

  return (
    <div className="-ml-2 -mr-2 mb-2 -mt-1 md:-mt-1 max-w-screen-2xl mx-auto p-4 md:p-6 font-sans bg-[#F9FAFB] min-h-screen relative">

      {/* --- MODAL SUCCESS --- */}
      <AnimatePresence>
        {isSuccessOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8 text-center relative"
            >
              <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 ${isLateSubmission ? "bg-amber-100" : "bg-[#E8F8EA]"}`}>
                {isLateSubmission ? <AlertTriangle className="text-amber-500" size={48} strokeWidth={2.5} /> : <Check className="text-[#4CD964]" size={48} strokeWidth={3.5} />}
              </div>
              <h3 className={`text-2xl font-bold mb-2 ${isLateSubmission ? "text-amber-600" : "text-[#27345A]"}`}>
                {isLateSubmission ? "Late Attendance!" : "Success!"}
              </h3>
              <p className="text-slate-500 text-sm mb-8">{successMessage}</p>
              <button onClick={() => setIsSuccessOpen(false)} className={`w-full text-white py-3.5 rounded-xl font-bold text-sm shadow-lg transition-all active:scale-95 flex items-center justify-center ${isLateSubmission ? "bg-amber-500 hover:bg-amber-600 shadow-amber-200" : "bg-[#4CD964] hover:bg-[#42BD56] shadow-green-100"}`}>OK</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL ERROR --- */}
      <AnimatePresence>
        {isErrorOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setIsErrorOpen(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8 text-center relative">
              <button aria-label="Close" onClick={() => setIsErrorOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={20} /></button>
              <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6"><AlertTriangle className="text-red-500" size={48} strokeWidth={2.5} /></div>
              <h3 className="text-2xl font-bold text-[#27345A] mb-2">Failed!</h3>
              <p className="text-slate-500 text-sm mb-8">{errorMessage}</p>
              <button onClick={() => setIsErrorOpen(false)} className="w-full bg-[#354C8F] hover:bg-[#232E4D] text-white py-3.5 rounded-xl font-bold text-lg shadow-lg transition-all active:scale-95">OK</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL KAMERA --- */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><Camera size={20} className="text-[#3B5998]" /> Take Selfie</h3>
              <button onClick={() => setIsCameraOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20} className="text-slate-500" /></button>
            </div>
            <div className="relative aspect-video bg-black">
              <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" className="w-full h-full object-cover scale-x-[-1]" />
            </div>
            <div className="p-5 bg-white flex justify-center">
              <button onClick={capture} className="w-full py-3.5 bg-[#3B5998] hover:bg-[#2c4376] text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all">Capture Photo</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL EARLY REMARK --- */}
      <AnimatePresence>
        {isEarlyModalOpen && (
          <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4">
            <motion.div initial={{ scale:0.98, opacity:0 }} animate={{ scale:1, opacity:1 }} exit={{ scale:0.98, opacity:0 }} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
              <h3 className="text-lg font-bold mb-2">Confirm Early Clock Out</h3>
              <p className="text-sm text-slate-500 mb-4">You're attempting to clock out before {checkoutTimeStr}. This will be recorded as Early Clock Out.</p>
              <textarea value={earlyRemark} onChange={(e)=>{ setEarlyRemark(e.target.value); if (earlyRemarkError) setEarlyRemarkError(''); }} placeholder={isSubmitting ? 'Submitting...' : "Reason (required)"} className="w-full p-3 border rounded-xl mb-2 text-sm" disabled={isSubmitting} />
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-400">Minimum: {MIN_REASON_WORDS} words and {MIN_REASON_CHARS} characters.</p>
              </div>
              {earlyRemarkError && <p className="text-xs text-red-500 mb-2">{earlyRemarkError}</p>}
              <div className="flex gap-3">
                <button onClick={()=>{ setIsEarlyModalOpen(false); setEarlyRemark(''); setIsRequestingEarly(false); setEarlyRemarkError(''); }} disabled={isSubmitting} className={`flex-1 py-3.5 ${isSubmitting ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white border border-[#354C8F] text-[#354C8F]'} font-bold rounded-2xl`}>Cancel</button>
                <button
                  onClick={handleConfirmEarly}
                  disabled={isSubmitting || !isEarlyReasonValid()}
                  className={`flex-1 py-3.5 font-bold rounded-2xl flex items-center justify-center gap-2 whitespace-nowrap ${isSubmitting || !isEarlyReasonValid() ? disabledButtonStyle : activeButtonStyle}`}
                >
                  {isSubmitting ? (
                    <span className="inline-flex items-center gap-2 whitespace-nowrap">
                      <Loader2 size={18} className="animate-spin" />
                      <span>Processing...</span>
                    </span>
                  ) : (
                    <span>Confirm Clock Out</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* HEADER */}
      <div className="mt-0 md:-mt-8 mb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-3">
        <div>
          <h1 className="text-3xl font-bold text-[#27345A]">Attendance</h1>
          <p className="text-slate-500 mt-1">Clock In ({clockInDisplay}{toleranceMinutes > 0 ? ` + ${toleranceDisplay} tolerance` : ""}) & Clock Out ({checkoutTimeStr})</p>
        </div>
        <div className="bg-white px-3 py-3 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-2.5 bg-amber-100 text-amber-600 rounded-full"><Clock size={20} /></div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">SERVER TIME (WIB)</p>
            <p className="text-2xl font-extrabold text-slate-800 leading-none">{formatTime(serverTime, true)}</p>
          </div>
        </div>
      </div>

      {/* MAIN CARD CONTAINER */}
      <div className={`bg-white  rounded-[1rem] p-6 md:p-8 ${cardShadow} border border-slate-100`}>
        {/* 1. MAP SECTION */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-[#3B5998] p-1.5 rounded-lg text-white"><MapPin size={18} strokeWidth={3} /></div>
            <h3 className="font-bold text-lg text-[#27345A]">Location Attendance</h3>
          </div>

          <div className="mb-3 text-sm text-slate-500">Blue circles show admin-defined site radius. You will be allowed to clock in only when inside one of the circles.</div>

            <div className="w-full h-[280px] rounded-3xl overflow-hidden relative shadow-inner border border-slate-200 z-0 bg-slate-50">
            {!isLocationLoaded || !userLocation ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-4">
                <Loader2 className="animate-spin mb-3 text-[#3B5998]" size={40} />
                <p className="font-medium animate-pulse text-center">Loading Location & Maps...</p>
                <p className="text-[12px] mt-2 text-slate-400 text-center max-w-[250px]">Please ensure GPS is Active and you are using an HTTPS connection (SSL).</p>
              </div>
            ) : (
              <MapContainer center={[userLocation.lat, userLocation.lng]} zoom={16} scrollWheelZoom={true} className="w-full h-full z-0" zoomControl={false}>
                <TileLayer url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" subdomains={["mt0", "mt1", "mt2", "mt3"]} attribution="&copy; Google Maps" />
                <ZoomControl position="bottomright" />
                {offices.map((office) => (
                  // FIXED: Gunakan Fragment, JANGAN div di sini untuk menghindari crash
                  <Fragment key={office.id}>
                    <Circle center={[office.lat, office.lng]} radius={office.radius} pathOptions={{ color: "#3B5998", fillColor: "#3B5998", fillOpacity: 0.15, weight: 1 }} />
                    <Marker position={[office.lat, office.lng]}>
                      <Popup>
                        <div className="text-xs font-bold">{office.name}</div>
                        {office.address && <div className="text-xs text-slate-600">{office.address}</div>}
                        <div className="text-sm text-slate-500 mt-1">Radius: {Math.round(office.radius)} m</div>
                      </Popup>
                    </Marker>
                  </Fragment>
                ))}
                <Marker position={[userLocation.lat, userLocation.lng]}><Popup>Your Location</Popup></Marker>
                <MapController center={[userLocation.lat, userLocation.lng]} />
              </MapContainer>
            )}
          </div>
        </div>

        {/* 2. BOTTOM GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ----- LEFT: PHOTO CARD ----- */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="bg-[#3B5998] p-1.5 rounded-lg text-white"><Camera size={18} strokeWidth={3} /></div>
              <h3 className="font-bold text-lg text-[#27345A]">Photo Verification</h3>
            </div>

            <div className="-mt-2 text-sm text-slate-500">Face visible — retake if blurry.</div>

            <div className="w-full h-[220px] bg-slate-50 rounded-3xl border-2 border-dashed border-slate-300 flex-shrink-0 overflow-hidden flex items-center justify-center relative group">
              {!isLocationLoaded ? (
                <p className="text-sm text-slate-400 font-medium animate-pulse">Waiting GPS...</p>
              ) : isLoadingPhoto ? (
                <div className="flex flex-col items-center gap-2 text-slate-400"><Loader2 className="animate-spin text-[#3B5998]" size={32} /><p className="text-xs font-medium">Fetching photo...</p></div>
              ) : photoOut || photoIn ? (
                <img src={photoOut || photoIn} alt="Preview" className="w-full h-full object-cover rounded-3xl" />
              ) : (
                <div className="text-center p-4">
                  <div className="bg-white p-3 rounded-full inline-block shadow-sm mb-2"><Camera className="text-slate-400" size={32} /></div>
                  <p className="text-sm text-slate-500 font-medium">{canClockOut && inStatus ? "Take Selfie to Clock Out" : "No photo"}</p>
                </div>
              )}
              {(photoOut || photoIn) && !isLoadingPhoto && (
                <div className="absolute top-3 right-3 z-10 bg-emerald-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-md flex items-center gap-1"><CheckCircle size={14} /> Verified</div>
              )}
            </div>
            <div className="w-full">
              {outStatus ? (
                // Tombol Completed (Disabled Gelap)
                <button disabled className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 shadow-inner ${disabledButtonStyle}`}><CheckCircle size={20} className="text-slate-400" /><span className="text-lg">Completed</span></button>
              ) : isStatusLoading ? (
                <button disabled className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 shadow-inner ${disabledButtonStyle}`}>
                  <Loader2 size={20} className="animate-spin" />
                  <span className="text-lg">Checking status...</span>
                </button>
              ) : !inStatus ? (
                !photoIn ? (
                  // TOMBOL KAMERA (PERBAIKAN DI SINI)
                  <button
                    onClick={() => setIsCameraOpen(true)}
                    // Disabled jika: Loading GPS ATAU Di Luar Area ATAU Kepagian
                    disabled={isStatusLoading || !isLocationLoaded || !locationStatus.isInside || isTooEarly}

                    // LOGIKA STYLE:
                    // Jika ada error (Kepagian / Luar Area / Loading) -> Pakai disabledButtonStyle (Gelap)
                    // Jika Aman -> Pakai Style Putih/Biru
                    className={`w-full py-3.5 border-2 font-bold rounded-2xl flex items-center justify-center gap-2 transition-all 
                      ${(isTooEarly || !locationStatus.isInside || !isLocationLoaded)
                        ? disabledButtonStyle // <--- INI KUNCINYA (Semua kondisi error jadi Gelap)
                        : "bg-white border-[#3B5998] text-[#3B5998] hover:bg-indigo-50"
                      }`}
                  >
                    {/* LOGIKA KONTEN (ICON & TEKS) */}
                    {isBeforeClockIn ? (
                      // Kondisi 1: Belum waktunya (tampilkan jam mulai)
                      <>
                        <Lock size={20} />
                        <span>Start at {clockInDisplay}</span>
                      </>
                    ) : (!locationStatus.isInside || !isLocationLoaded) ? (
                      // Kondisi 2: Di Luar Area
                      <>
                        <MapPin size={20} />
                        <span>Outside Office Area</span>
                      </>
                    ) : (
                      // Kondisi 3: Aman (Bisa Buka Kamera)
                      <>
                        <Camera size={20} />
                        <span>Open Camera</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="flex gap-3">
                    {/* TOMBOL CLOCK IN (Saat sudah ada foto) */}
                    <button
                      onClick={handleClockIn}
                      disabled={isStatusLoading || !locationStatus.isInside || isSubmitting || isTooEarly}
                      className={`flex-1 py-3.5 font-bold rounded-2xl flex items-center justify-center gap-2 transition-all ${locationStatus.isInside && !isSubmitting && !isTooEarly ? activeButtonStyle : disabledButtonStyle}`}
                    >
                      {isSubmitting ? <><Loader2 size={20} className="animate-spin" /> Processing...</> : <>{isBeforeClockIn ? (
                        <Lock size={20} />
                      ) : locationStatus.isInside ? (
                        <Smartphone size={20} />
                      ) : (
                        <MapPin size={20} />
                      )}
                        {isBeforeClockIn ? `Start at ${clockInDisplay}` : locationStatus.isInside ? "Clock In Now" : "Outside Area"}
                      </>}
                    </button>
                    <button onClick={() => setPhotoIn(null)} disabled={isSubmitting} className="px-5 bg-white border-2 border-red-100 text-red-500 font-bold rounded-2xl hover:bg-red-50 disabled:opacity-50"><RefreshCcw size={20} /></button>
                  </div>
                )
              ) : (
                // After Clock In: primary action becomes Early Clock Out (before scheduled clock-out),
                // following the flow click -> take photo -> fill reason -> submit.
                <div>
                  {!photoOut ? (
                    <button
                      onClick={() => {
                        // Open camera for either normal or early clock out flow
                        if (canClockOut) {
                          // Normal clock out flow - time has reached scheduled clock out time
                          setIsRequestingEarly(false);
                        } else {
                          // Early clock out flow - time is before scheduled clock out time
                          setIsRequestingEarly(true);
                        }
                        setIsCameraOpen(true);
                      }}
                      disabled={isStatusLoading || !locationStatus.isInside || isSubmitting || !isLocationLoaded}
                      className={`w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 transition transform active:scale-95 ${(isStatusLoading || !locationStatus.isInside || isSubmitting || !isLocationLoaded)
                        ? disabledButtonStyle
                        : 'bg-white border border-[#354C8F] text-[#354C8F] font-bold hover:bg-[#EAF2FF] hover:shadow-sm'}`}
                    >
                      {canClockOut ? (
                        <>
                          <Smartphone size={18} />
                          <span>Clock Out</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={18} />
                          <span>Early Clock Out</span>
                        </>
                      )}
                    </button>
                  ) : canClockOut ? (
                    <div className="flex gap-3">
                      {/* TOMBOL CLOCK OUT */}
                      <button onClick={() => handleClockOut({ early: false, photoData: photoOut })} disabled={isStatusLoading || !locationStatus.isInside || isSubmitting} className={`flex-1 py-3.5 font-bold rounded-2xl flex items-center justify-center gap-2 transition-all ${locationStatus.isInside && !isSubmitting ? activeButtonStyle : disabledButtonStyle}`}>
                        {isSubmitting ? <><Loader2 size={20} className="animate-spin" /> Processing...</> : <>
                          {locationStatus.isInside ? <Smartphone size={20} /> : <MapPin size={20} />}
                          {locationStatus.isInside ? "Clock Out Now" : "Outside Area"}
                        </>}
                      </button>
                      <button onClick={() => setPhotoOut(null)} disabled={isSubmitting} className="px-5 bg-white border-2 border-red-100 text-red-500 font-bold rounded-2xl hover:bg-red-50 disabled:opacity-50"><RefreshCcw size={20} /></button>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      {/* Continue Early flow without forcing retake */}
                      <button
                        onClick={() => setIsEarlyModalOpen(true)}
                        disabled={isSubmitting}
                        className={`flex-1 py-3.5 rounded-2xl flex items-center justify-center gap-2 transition transform active:scale-95 ${isSubmitting ? disabledButtonStyle : 'bg-white border border-[#354C8F] text-[#354C8F] font-bold hover:bg-[#EAF2FF] hover:shadow-sm'}`}
                      >
                        <AlertTriangle size={18} />
                        <span>Early Clock Out</span>
                      </button>
                      <button onClick={() => setPhotoOut(null)} disabled={isSubmitting} className="px-5 bg-white border-2 border-red-100 text-red-500 font-bold rounded-2xl hover:bg-red-50 disabled:opacity-50"><RefreshCcw size={20} /></button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ----- RIGHT: STATUS CARDS ----- */}
          <div className="lg:col-span-6 flex flex-col gap-4 h-full">
            <div className="flex items-center gap-2 mb-1">
              <div className="bg-[#3B5998] p-1.5 rounded-lg text-white"><ClipboardList size={18} strokeWidth={3} /></div>
              <h3 className="font-bold text-lg text-[#27345A]">Attendance Status</h3>
            </div>

            <div className="-mt-2 text-sm text-slate-500">Nearest office, distance & clock status.</div>

            <div className="flex flex-col gap-4 flex-1">
              {/* Card 1: Status Lokasi */}
              <div className={`relative overflow-hidden rounded-3xl p-5 border-0 shadow-sm flex-1 flex flex-col justify-center transition-colors ${isLocationLoaded ? locationStatus.isInside ? "bg-[#ECFDF5]" : "bg-[#FFF1F2]" : "bg-slate-50"}`}>
                <div className={`absolute left-0 top-4 bottom-4 w-1.5 rounded-r-full ${isLocationLoaded ? locationStatus.isInside ? "bg-emerald-500" : "bg-red-500" : "bg-slate-300"}`}></div>
                <div className="pl-5 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-lg md:text-xl">{isLocationLoaded ? locationStatus.isInside ? "Inside Office Area" : "Outside Office Area" : "Locating..."}</h4>
                    {locationStatus.isInside && <p className="text-sm text-emerald-700 font-medium mt-1">{locationStatus.nearestOffice}</p>}
                    {userLocation && <div className="mt-2 text-sm text-slate-500 font-mono">Lat: {userLocation.lat.toFixed(6)}, Lng: {userLocation.lng.toFixed(6)}</div>}
                  </div>
                  <div className={`p-3 rounded-full ${locationStatus.isInside ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-500"}`}><MapPin size={24} /></div>
                </div>
              </div>

              {/* Card 2: Status Waktu */}
              <div className={`relative overflow-hidden rounded-3xl p-5 border-0 shadow-sm flex-1 flex flex-col justify-center transition-colors duration-300 ${outStatus ? "bg-slate-100" : !locationStatus.isInside ? "bg-[#FFF1F2]" : inStatus ? photoOut ? "bg-[#ECFDF5]" : "bg-[#EFF6FF]" : isTooEarly ? "bg-slate-50" : photoIn ? "bg-[#ECFDF5]" : isLate ? "bg-[#FFFBEB]" : "bg-[#ECFDF5]"}`}>
                <div className={`absolute left-0 top-4 bottom-4 w-1.5 rounded-r-full ${outStatus ? "bg-slate-500" : !locationStatus.isInside ? "bg-red-500" : inStatus ? photoOut ? "bg-emerald-500" : "bg-blue-500" : isTooEarly ? "bg-slate-400" : isLate && !photoIn ? "bg-amber-400" : "bg-emerald-500"}`}></div>

                <div className="pl-5 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-lg md:text-xl">
                      {isStatusLoading ? "Checking Attendance..."
                        : outStatus ? (earlyFlag ? "Early Clock Out" : "Done for Today")
                        : !locationStatus.isInside ? (inStatus ? "Cannot Clock Out" : "Cannot Clock In")
                        : inStatus ? photoOut ? "Ready to Clock Out!" : "Working Hours"
                          : isTooEarly ? "Clock In Not Open"
                            : photoIn ? "Ready to Clock In!"
                              : isLate ? "Late Arrival"
                                : "On Time"
                      }
                    </h4>
                    <p className="mt-1 text-sm md:text-sm text-slate-600">
                      {isStatusLoading ? "Please wait while we fetch your status."
                        : outStatus ? (earlyFlag ? `Reason: ${lastEarlyRemark || '-'} ` : "See you tomorrow!")
                        : !locationStatus.isInside ? "You are outside the office radius."
                        : inStatus ? photoOut ? "You can clock out now." : `Clock out at ${checkoutTimeStr}.`
                          : isBeforeClockIn ? `Clock In starts at ${clockInDisplay}.`
                            : photoIn ? "Press the button to confirm."
                              : isLate ? `You are past the ${clockInDisplay}${toleranceMinutes > 0 ? ` + ${toleranceDisplay}` : ""} limit.`
                                : "You are on schedule."
                      }
                    </p>
                  </div>

                  <div className={`p-3 rounded-full ${outStatus ? "bg-slate-200 text-slate-500" : !locationStatus.isInside ? "bg-red-100 text-red-500" : inStatus ? photoOut ? "bg-emerald-100 text-emerald-600" : "bg-blue-100 text-blue-600" : isTooEarly ? "bg-slate-100 text-slate-400" : isLate && !photoIn ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"}`}>
                    {outStatus ? <CheckCircle size={24} /> : !locationStatus.isInside ? <MapPin size={24} /> : (inStatus || photoIn) ? <Clock size={24} /> : isTooEarly ? <Lock size={24} /> : <Clock size={24} />}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}