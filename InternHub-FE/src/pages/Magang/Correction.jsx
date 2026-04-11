
import React, { useState, useRef, useEffect, useMemo } from "react";
import imageCompression from "browser-image-compression";
import apiClient from "../../api/axiosConfig";
import { getSafeErrorMessage } from "../../utils/errorHandler";
import {
  Search,
  Filter,
  Plus,
  Eye,
  X,
  UploadCloud,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertTriangle,
  AlertCircle,
  Clock,
  Calendar,
  Loader2,
  Download,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const btnPrimaryClass =
  "bg-[#354C8F] hover:bg-[#1F2B4D] text-white py-3.5 px-6 rounded-xl active:scale-95 transition-all font-bold text-sm shadow-md shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none";
const btnSecondaryClass =
  "bg-white border border-slate-300 text-slate-700 py-3.5 px-6 rounded-xl active:scale-95 transition-all font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed";
const btnConfirmClass =
  "bg-[#22C55E] hover:bg-[#16A34A] text-white py-3.5 px-6 rounded-xl font-bold text-sm shadow-md shadow-green-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";

const CorrectionPage = () => {
  // --- HELPERS ---
  const formatDateDMY = (isoString) => {
    if (!isoString) return "-";
    const d = new Date(isoString);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatDateForDisplay = (dateStr) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return "-";
    return timeStr.split(":").slice(0, 2).join(":");
  };

  const formatClockValue = (value) => {
    if (!value) return "-";
    const s = String(value);
    if (s.includes("T")) {
      const t = s.split("T")[1] || "";
      return formatTime(t);
    }
    if (s.includes(" ")) {
      const last = s.split(" ").pop() || "";
      if (last.includes(":")) return formatTime(last);
    }
    return formatTime(s);
  };

  const formatDateTime = (iso) => {
    if (!iso) return "-";
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso);
      return d.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return String(iso);
    }
  };

  const getCleanFileName = (path) => {
    if (!path) return "File";
    let baseName = String(path).split('/').pop();
    const match = baseName.match(/^[a-zA-Z0-9]+_\d+_\d+_[a-f0-9]+_(.+)$/i);
    if (match) return match[1];
    const match2 = baseName.match(/^[a-zA-Z0-9]+_\d+_\d+_[a-f0-9]+(?:\.(.+))?$/i);
    if (match2) return `lampiran${match2[1] ? '.' + match2[1] : ''}`;
    return baseName;
  };

  const findTimestampForRole = (obj, role) => {
    if (!obj) return null;
    const tries = [
      `approved_at_${role}`,
      `rejected_at_${role}`,
      `approved_at`,
      `rejected_at`,
      `approvedAt${role}`,
      `rejectedAt${role}`,
    ];
    for (const k of tries) if (obj[k]) return obj[k];
    const key = Object.keys(obj).find(
      (k) =>
        k.toLowerCase().includes(role) &&
        (k.toLowerCase().includes("approved") || k.toLowerCase().includes("rejected"))
    );
    if (key) return obj[key];
    return null;
  };

  // --- STATES ---
  const [errorMessage, setErrorMessage] = useState("");
  const [isErrorOpen, setIsErrorOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isConfirmSubmitOpen, setIsConfirmSubmitOpen] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);

  const [downloadingFileId, setDownloadingFileId] = useState(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedPermission, setSelectedPermission] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingViewId, setLoadingViewId] = useState(null);

  // Data & Pagination
  const [rawCorrections, setRawCorrections] = useState([]);
  const [isLoadingCorrections, setIsLoadingCorrections] = useState(true);
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    total: 0,
    from: 0,
    to: 0,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilters, setActiveFilters] = useState({ type: [], status: [] });
  const [tempFilters, setTempFilters] = useState({ type: [], status: [] });

  // --- API CALLS ---
  const fetchCorrections = async (page = 1, search = "", filters = { type: [], status: [] }) => {
    setIsLoadingCorrections(true);
    try {
      const params = { page, per_page: itemsPerPage };
      if (search) params.q = search;

      if (filters.type && filters.type.length > 0) {
        const mappedTypes = filters.type.map((t) => {
          if (t === "Clock In") return "lupa_absen_masuk";
          if (t === "Clock Out") return "lupa_absen_pulang";
          return t;
        });
        params.jenis_koreksi = mappedTypes;
      }

      if (filters.status && filters.status.length > 0) {
        params.status = filters.status.map((s) => s.toLowerCase());
      }

      const res = await apiClient.get(`/koreksi`, { params });

      let items = [];
      let meta = { current_page: 1, last_page: 1, total: 0, from: 0, to: 0 };

      if (res.data?.data?.data) {
        items = res.data.data.data;
        meta = {
          current_page: res.data.data.current_page,
          last_page: res.data.data.last_page,
          total: res.data.data.total,
          from: res.data.data.from,
          to: res.data.data.to,
        };
      } else if (Array.isArray(res.data?.data)) {
        items = res.data.data;
      } else if (Array.isArray(res.data)) {
        items = res.data;
      }

      if (items.length > 0 && Array.isArray(items[0].items)) {
        items = items.flatMap(group => group.items || []);
      }

      setRawCorrections(items);
      setPagination(meta);
    } catch (err) {
      setRawCorrections([]);
      setPagination({ current_page: 1, last_page: 1, total: 0, from: 0, to: 0 });
    } finally {
      setIsLoadingCorrections(false);
    }
  };

  useEffect(() => {
    fetchCorrections(currentPage, searchTerm, activeFilters);
  }, [currentPage, activeFilters, itemsPerPage]);

  // --- DATA PROCESSING (Fixed useMemo) ---
  const currentItems = useMemo(() => {
    // Normalize raw items first
    const normalized = rawCorrections.map((item) => {
      const sMentor = item.status_mentor ? String(item.status_mentor).toLowerCase() : "pending";
      const sAdmin = item.status_admin ? String(item.status_admin).toLowerCase() : "pending";
      let finalStatusUI = "Pending";
      if (sMentor === "rejected" || sAdmin === "rejected") finalStatusUI = "Rejected";
      else if (sMentor === "approved" && sAdmin === "approved") finalStatusUI = "Approved";

      let jamKoreksiDisplay = "-";
      if (item.jenis_koreksi === "lupa_absen_full") {
        const jm = item.jam_koreksi_masuk ? formatTime(item.jam_koreksi_masuk) : "-";
        const jp = item.jam_koreksi_pulang ? formatTime(item.jam_koreksi_pulang) : "-";
        jamKoreksiDisplay = `${jm} - ${jp}`;
      } else {
        jamKoreksiDisplay = item.jam_koreksi ? formatTime(item.jam_koreksi) : "-";
      }

      const waktuAsliDisplay = item.waktu_asli
        ? item.jenis_koreksi === "lupa_absen_full"
          ? `${item.waktu_asli_masuk ? formatTime(item.waktu_asli_masuk) : "-"} - ${item.waktu_asli_pulang ? formatTime(item.waktu_asli_pulang) : "-"
          }`
          : formatTime(item.waktu_asli)
        : "-";

      let attachmentFiles = [];
      if (item.lampiran) {
        try {
          attachmentFiles = JSON.parse(item.lampiran);
        } catch {
          attachmentFiles = Array.isArray(item.lampiran) ? item.lampiran : [];
        }
      }

      return {
        ...item,
        id_koreksi: item.id_koreksi || item.id,
        dateKey: item.tanggal ? String(item.tanggal).slice(0, 10) : null,
        typeLabel:
          item.jenis_koreksi === "lupa_absen_masuk"
            ? "Clock In"
            : item.jenis_koreksi === "lupa_absen_pulang"
              ? "Clock Out"
              : item.jenis_koreksi === "lupa_absen_full"
                ? "Full Day"
                : "-",
        statusLabel: finalStatusUI,
        jamKoreksiDisplay,
        waktuAsliDisplay,
        attachmentFiles,
      };
    });

    // Sort by date desc
    normalized.sort((a, b) => (a.dateKey < b.dateKey ? 1 : a.dateKey > b.dateKey ? -1 : 0));

    return normalized;
  }, [rawCorrections]);

  // --- EVENT HANDLERS ---

  const handlePageChange = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= pagination.last_page) {
      setCurrentPage(pageNumber);
    }
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      setCurrentPage(1);
      fetchCorrections(1, searchTerm, activeFilters);
    }
  };

  const openFilterModal = () => {
    setTempFilters(activeFilters);
    setIsFilterOpen(true);
  };

  const handleTempFilterChange = (category, value) => {
    setTempFilters((prev) => {
      const currentList = prev[category] || [];
      if (currentList.includes(value)) {
        return { ...prev, [category]: currentList.filter((item) => item !== value) };
      } else {
        return { ...prev, [category]: [...currentList, value] };
      }
    });
  };

  const applyFilter = () => {
    setCurrentPage(1);
    setActiveFilters(tempFilters);
    setIsFilterOpen(false);
  };

  const resetFilter = () => {
    setTempFilters({ type: [], status: [] });
    setActiveFilters({ type: [], status: [] });
    setIsFilterOpen(false);
  };

  // --- FORM LOGIC ---
  const [correctionTypes, setCorrectionTypes] = useState(["Clock In"]);
  const [fileError, setFileError] = useState("");
  const [formData, setFormData] = useState({ clockInTime: "", clockOutTime: "", date: "", reason: "" });
  const [files, setFiles] = useState([]);
  const fileInputRef = useRef(null);
  const [attendanceDates, setAttendanceDates] = useState(new Set());
  const [attendanceInfoByDate, setAttendanceInfoByDate] = useState({});
  const [isLoadingAttendanceDates, setIsLoadingAttendanceDates] = useState(false);
  const lastAttendanceCalendarRef = useRef(null);

  const toggleCorrectionType = (type) => {
    setCorrectionTypes((prev) => {
      if (prev.includes(type)) {
        return prev.filter((t) => t !== type);
      }
      return [...prev, type];
    });
  };

  const fetchAttendanceDates = async (bulan = null, tahun = null) => {
    setIsLoadingAttendanceDates(true);
    try {
      const now = new Date();
      const month = bulan || now.getMonth() + 1;
      const year = tahun || now.getFullYear();
      const params = { bulan: month, tahun: year };

      const response = await apiClient.get("/absensi/calendar-dates", { params });
      const dates = new Set();
      const infoByDate = {};
      const payload = response.data || {};

      const pushDateEntry = (dateKey, item) => {
        if (!dateKey) return;
        const dateStr = String(dateKey).slice(0, 10);
        if (!dateStr || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(dateStr)) return;

        let statusVal =
          item?.status ??
          item?.keterangan ??
          item?.status_absen ??
          item?.keterangan_absensi ??
          item?.status_name ??
          item?.note ??
          item?.reason ??
          null;

        if (!statusVal && item && typeof item === "object") {
          const key = Object.keys(item).find((k) =>
            /status|keterangan|note|reason|leave|sakit|cuti|izin/i.test(k)
          );
          if (key) statusVal = item[key];
        }

        infoByDate[dateStr] = {
          hasAttendance: Boolean(item?.has_attendance ?? item?.hasAttendance ?? item?.has_attendance === 1),
          clockIn: item?.masuk ?? item?.clock_in ?? item?.clockIn ?? item?.in ?? null,
          clockOut: item?.pulang ?? item?.clock_out ?? item?.clockOut ?? item?.out ?? null,
          status: statusVal ?? null,
          can_correct: item?.can_correct ?? true,
        };
        dates.add(dateStr);
      };

      if (payload.attendance_dates && typeof payload.attendance_dates === "object" && !Array.isArray(payload.attendance_dates)) {
        Object.keys(payload.attendance_dates).forEach((dateKey) => {
          pushDateEntry(dateKey, payload.attendance_dates[dateKey]);
        });
      } else if (Array.isArray(payload.attendance_dates)) {
        payload.attendance_dates.forEach((it) => {
          const key = it.tanggal || it.date || it.tanggal_arsip || null;
          if (key) pushDateEntry(key, it);
        });
      } else if (Array.isArray(payload.data)) {
        payload.data.forEach((it) => {
          const key = it.tanggal || it.date || null;
          if (key) pushDateEntry(key, it);
        });
      }

      setAttendanceDates(dates);
      setAttendanceInfoByDate(infoByDate);
      lastAttendanceCalendarRef.current = `${year}-${String(month).padStart(2, "0")}`;
    } catch (error) {
      console.error("Error fetching attendance dates:", error);
      const now = new Date();
      const dates = new Set();
      dates.add(now.toISOString().split("T")[0]);
      setAttendanceDates(dates);
    } finally {
      setIsLoadingAttendanceDates(false);
    }
  };

  const isClockInSelected = correctionTypes.includes("Clock In");
  const isClockOutSelected = correctionTypes.includes("Clock Out");
  const isFullDaySelected = isClockInSelected && isClockOutSelected;

  const isDateSelectable = (date) => {
    if (!date) return false;
    const info = attendanceInfoByDate?.[date];
    if (info) {
      const parts = [];
      if (info.status !== undefined && info.status !== null)
        parts.push(typeof info.status === "string" ? info.status : JSON.stringify(info.status));
      if (info.statusName) parts.push(String(info.statusName));
      if (info.keterangan) parts.push(String(info.keterangan));
      if (info.note) parts.push(String(info.note));

      const combined = parts.join(" ").toLowerCase();
      const blocked = ["cuti", "sakit", "leave", "sick", "izin", "sick leave"];
      if (blocked.some((kw) => combined.includes(kw))) return false;
    }
    return attendanceDates.has(date) || (attendanceInfoByDate && Object.prototype.hasOwnProperty.call(attendanceInfoByDate, date));
  };

  const isFormValid =
    formData.date !== "" &&
    isDateSelectable(formData.date) &&
    formData.reason.trim() !== "" &&
    files.length > 0 &&
    correctionTypes.length > 0 &&
    (!isClockInSelected || formData.clockInTime !== "") &&
    (!isClockOutSelected || formData.clockOutTime !== "");

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === "date" && value) {
      const [y, m] = value.split("-");
      const calKey = `${y}-${m}`;
      if (calKey && calKey !== lastAttendanceCalendarRef.current) {
        fetchAttendanceDates(Number(m), Number(y));
      }
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleFileChange = async (e) => {
    setFileError("");
    const selectedFiles = Array.from(e.target.files);
    const validMimeTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
    const validExtensions = [".jpg", ".jpeg", ".png", ".pdf"];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (selectedFiles.length === 0) return;
    const processedFiles = [];

    for (const file of selectedFiles) {
      const fileExt = "." + file.name.split(".").pop().toLowerCase();
      const isValidType = validMimeTypes.includes(file.type) || validExtensions.includes(fileExt);

      if (!isValidType) {
        setFileError(`File "${file.name}" invalid. Only JPG, PNG, or PDF allowed.`);
        continue;
      }
      if (file.size > maxSize) {
        setFileError(`File "${file.name}" is too large (Max 5MB).`);
        continue;
      }

      try {
        let finalFile = file;
        if (file.type.startsWith("image/")) {
          const options = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true };
          try {
            const compressed = await imageCompression(file, options);
            finalFile = new File([compressed], file.name, { type: file.type, lastModified: Date.now() });
          } catch (compErr) {
            console.error("Compression skipped", compErr);
          }
        }
        processedFiles.push({
          id: Date.now() + Math.random(),
          fileObj: finalFile,
          name: finalFile.name,
          size: finalFile.size,
          type: finalFile.type,
          sizeFormatted: formatFileSize(finalFile.size),
          progress: 0,
          status: "uploading",
        });
      } catch (err) {
        setFileError("Error processing file.");
      }
    }

    if (processedFiles.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setFiles((prev) => [...prev, ...processedFiles]);
    processedFiles.forEach((fObj) => {
      const interval = setInterval(() => {
        setFiles((curr) =>
          curr.map((f) => {
            if (f.id === fObj.id) {
              const nextProg = f.progress + 20;
              if (nextProg >= 100) {
                clearInterval(interval);
                return { ...f, progress: 100, status: "completed" };
              }
              return { ...f, progress: nextProg };
            }
            return f;
          })
        );
      }, 150);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (id) => {
    setFiles(files.filter((f) => f.id !== id));
    setFileError("");
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setFiles([]);
    setFileError("");
    setCorrectionTypes(["Clock In"]);
    setFormData({ clockInTime: "", clockOutTime: "", date: "", reason: "" });
    setAttendanceDates(new Set());
    setAttendanceInfoByDate({});
    lastAttendanceCalendarRef.current = null;
  };

  const handleInitialSubmit = (e) => {
    e.preventDefault();
    if (isFormValid) setIsConfirmSubmitOpen(true);
  };

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    try {
      const payload = new FormData();
      if (isFullDaySelected) {
        payload.append("koreksi[0][jenis_koreksi]", "lupa_absen_masuk");
        payload.append("koreksi[0][tanggal]", formData.date);
        payload.append("koreksi[0][jam_koreksi]", formData.clockInTime);
        payload.append("koreksi[0][alasan]", formData.reason);

        payload.append("koreksi[1][jenis_koreksi]", "lupa_absen_pulang");
        payload.append("koreksi[1][tanggal]", formData.date);
        payload.append("koreksi[1][jam_koreksi]", formData.clockOutTime);
        payload.append("koreksi[1][alasan]", formData.reason);

        const originalIn = attendanceInfoByDate?.[formData.date]?.clockIn;
        const originalOut = attendanceInfoByDate?.[formData.date]?.clockOut;
        if (originalIn) payload.append("waktu_asli_masuk", String(originalIn));
        if (originalOut) payload.append("waktu_asli_pulang", String(originalOut));
      } else if (isClockInSelected) {
        payload.append("jenis_koreksi", "lupa_absen_masuk");
        payload.append("jam_koreksi", formData.clockInTime);
        const waktuAsli = attendanceInfoByDate?.[formData.date]?.clockIn;
        if (waktuAsli) payload.append("waktu_asli", String(waktuAsli));
      } else if (isClockOutSelected) {
        payload.append("jenis_koreksi", "lupa_absen_pulang");
        payload.append("jam_koreksi", formData.clockOutTime);
        const waktuAsli = attendanceInfoByDate?.[formData.date]?.clockOut;
        if (waktuAsli) payload.append("waktu_asli", String(waktuAsli));
      }

      payload.append("tanggal", formData.date);
      payload.append("alasan", formData.reason);
      files.forEach((f) => payload.append("lampiran[]", f.fileObj));

      const response = await apiClient.post("/koreksi/", payload);
      if (response.data && response.data.success) {
        setIsConfirmSubmitOpen(false);
        closeForm();
        setIsSuccessOpen(true);
        await fetchCorrections(1, searchTerm, activeFilters);
      } else {
        const safeMsg = getSafeErrorMessage({ response: { data: response.data } }, "Failed to submit correction.");
        setErrorMessage(safeMsg);
        setIsErrorOpen(true);
        setIsConfirmSubmitOpen(false);
      }
    } catch (error) {
      console.error("Submit Error:", error);
      const safeMsg = getSafeErrorMessage(error, "Failed to submit correction.");
      setErrorMessage(safeMsg);
      setIsErrorOpen(true);
      setIsConfirmSubmitOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewClick = (payload) => {
    setLoadingViewId(null);
    const items = payload.items ? payload.items : [payload];
    const itemsDetails = items.map((it) => {
      const jenis = String(it.jenis_koreksi || "").toLowerCase();
      let jamKoreksiDisplay = it.jamKoreksiDisplay || "-";
      let waktuAsliDisplay = it.waktuAsliDisplay || "-";
      const isForgotClock = jenis === "lupa_absen_masuk" || jenis === "lupa_absen_pulang";
      if (isForgotClock) {
        if (waktuAsliDisplay === "-" || waktuAsliDisplay === jamKoreksiDisplay) waktuAsliDisplay = "-";
      }

      return {
        id_koreksi: it.id_koreksi,
        jenis_koreksi: it.jenis_koreksi,
        typeLabel: it.typeLabel,
        jamKoreksi: jamKoreksiDisplay,
        waktuAsli: waktuAsliDisplay,
        alasan: it.alasan || "-",
        statusLabel: it.statusLabel,
        mentorTimestamp: findTimestampForRole(it, "mentor"),
        adminTimestamp: findTimestampForRole(it, "admin"),
      };
    });

    const mainItem =
      items.find((it) => String(it.jenis_koreksi).toLowerCase() === "lupa_absen_masuk") || items[0];

    setSelectedPermission({
      date: payload.date
        ? formatDateDMY(payload.date)
        : items[0]?.tanggal
          ? formatDateDMY(items[0].tanggal)
          : "-",
      files: mainItem?.attachmentFiles || [],
      itemsDetails,
      reason: mainItem?.alasan || "-",
      status: payload.combinedStatus || itemsDetails.map((d) => d.statusLabel).join(", "),
      statusMentorRaw: mainItem?.status_mentor,
      statusAdminRaw: mainItem?.status_admin,
      mentorTimestamp: mainItem ? findTimestampForRole(mainItem, "mentor") : null,
      adminTimestamp: mainItem ? findTimestampForRole(mainItem, "admin") : null,
      id_koreksi: mainItem?.id_koreksi,
    });
    setIsViewOpen(true);
  };

  const handleFileAction = async (fileUrl, fileIndex, actionType = "preview", idKoreksi = null) => {
    const fileId = `file-${fileIndex}`;
    if (actionType === "preview") {
      const fullUrl = fileUrl.startsWith("http")
        ? fileUrl
        : `${import.meta.env.VITE_STORAGE_BASE_URL}${fileUrl}`;
      window.open(fullUrl, "_blank");
      return;
    }
    if (actionType === "download") {
      setDownloadingFileId(fileId);
      try {
        const koreksiId = idKoreksi || selectedPermission.id_koreksi;
        const response = await apiClient.get(
          `/koreksi/${koreksiId}/download-lampiran/${fileIndex}`,
          { responseType: "blob" }
        );
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement("a");
        link.href = url;
        let fileName = "attachment";
        if (typeof fileUrl === "string") fileName = getCleanFileName(fileUrl);
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } catch (error) {
        setErrorMessage("Gagal mendownload file.");
        setIsErrorOpen(true);
      } finally {
        setDownloadingFileId(null);
      }
    }
  };

  const handleViewLampiran = (index, idKoreksi = null) => {
    const koreksiId = idKoreksi || selectedPermission?.id_koreksi;
    if (!koreksiId) {
      setErrorMessage("ID koreksi tidak ditemukan.");
      setIsErrorOpen(true);
      return;
    }
    const url = `${window.location.origin}/koreksi/view/${koreksiId}/${index}`;
    window.open(url, "_blank");
  };

  const getFileIcon = (fileNameOrType) => {
    const lower = String(fileNameOrType).toLowerCase();
    if (lower.includes("pdf")) {
      return (
        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm shrink-0 border border-slate-100">
          <div className="bg-red-500 text-white text-[9px] font-bold px-1 rounded-sm">PDF</div>
        </div>
      );
    } else {
      return (
        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm shrink-0 border border-slate-100">
          <div className="bg-blue-500 text-white text-[9px] font-bold px-1 rounded-sm">IMG</div>
        </div>
      );
    }
  };

  const getStatusBadge = (status) => {
    const s = String(status).toLowerCase();
    if (s === "approved") {
      return <span className="inline-flex items-center justify-center w-[120px] h-[34px] px-2 rounded-lg text-[13px] font-bold border whitespace-nowrap bg-green-100 text-green-600 border-green-200">Approved</span>;
    } else if (s === "rejected") {
      return <span className="inline-flex items-center justify-center w-[120px] h-[34px] px-2 rounded-lg text-[13px] font-bold border whitespace-nowrap bg-red-100 text-red-600 border-red-200">Rejected</span>;
    }
    return <span className="inline-flex items-center justify-center w-[120px] h-[34px] px-2 rounded-lg text-[13px] font-bold border whitespace-nowrap bg-[#FFF8E1] text-[#F59E0B] border-[#FFE0B2]">Pending</span>;
  };


  return (
    <div className="bg-slate-50 -ml-2 -mr-2 mt-2 min-h-screen px-4 md:px-6 py-8 font-sans text-slate-800">
      {/* ERROR MODAL */}
      <AnimatePresence>
        {isErrorOpen && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={() => setIsErrorOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-8 text-center max-w-sm w-full shadow-2xl relative"
            >
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="text-red-500" size={40} strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-bold text-[#27345A] mb-2">Error</h3>
              <p className="text-slate-500 text-sm mb-6 leading-relaxed">{errorMessage}</p>
              <button onClick={() => setIsErrorOpen(false)} className={`${btnPrimaryClass} w-full`}>
                OK
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="mb-8 -mt-8">
        <h1 className="text-3xl font-bold text-[#27345A] mb-2">Attendance Correction</h1>
        <p className="text-slate-500 max-w-3xl leading-relaxed text-sm">
          Submit a correction request if you forgot to clock in or missed attendance.
        </p>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
        <div className="flex flex-row w-full md:w-auto gap-3">
          <div className="relative flex-1 md:w-80">
            <input
              type="text"
              placeholder="Search by reason.."
              value={searchTerm}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
              className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 text-sm shadow-sm transition-all"
            />
            <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
          </div>
          <div className="w-auto">
            {/* BUTTON FILTER DENGAN INDIKATOR MERAH */}
            <button onClick={openFilterModal} className={`${btnPrimaryClass} !px-4 md:!px-6`}>
              <Filter size={18} />
              <span className="hidden md:inline">Filter</span>
              {(activeFilters.type.length > 0 || activeFilters.status.length > 0) && (
                <div className="w-2 h-2 bg-red-400 rounded-full ml-1 animate-pulse"></div>
              )}
            </button>
          </div>
        </div>
        <div className="w-full md:w-auto">
          <button
            onClick={() => {
              setIsFormOpen(true);
              fetchAttendanceDates();
            }}
            className={`${btnPrimaryClass} w-full md:w-auto`}
          >
            <Plus size={18} /> Add New
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-sm font-bold text-slate-900 bg-slate-50/50">
                <th className="px-3 py-2 w-16 text-center">No</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Correction Date</th>
                <th className="px-3 py-2">Brief Reason</th>
                <th className="px-3 py-2 text-center">Status</th>
                <th className="px-3 py-2 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-600">
              {isLoadingCorrections ? (
                <tr>
                  <td colSpan="6" className="py-6 px-3 text-center">
                    <Loader2 size={32} className="animate-spin text-[#354C8F] mx-auto" />
                    <p className="mt-2 text-slate-400">Loading data...</p>
                  </td>
                </tr>
              ) : currentItems.length > 0 ? (
                currentItems.map((item, index) => (
                  <tr
                    key={item.id_koreksi || index}
                    className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-3 py-2 font-medium text-center">
                      {pagination.from ? pagination.from + index : index + 1}
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-sm font-semibold text-[#203266]">
                        {item.typeLabel}
                      </div>
                    </td>
                    <td className="px-3 py-2">{item.tanggal ? formatDateDMY(item.tanggal) : "-"}</td>
                    <td className="px-3 py-2 truncate max-w-xs">{item.alasan || "-"}</td>
                    <td className="px-3 py-2 text-center">{getStatusBadge(item.statusLabel)}</td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => handleViewClick(item)}
                        className="inline-flex items-center justify-center w-9 h-9 rounded-lg transition-colors active:scale-95 shadow-sm text-white bg-[#354C8F] hover:bg-[#2a3c70] shadow-indigo-100"
                        title="View Detail"
                        aria-label="View Detail"
                      >
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="py-6 px-3 text-center text-slate-400">
                    No data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {!isLoadingCorrections && currentItems.length > 0 && (
          <div className="flex flex-col md:flex-row justify-between items-center p-3 border-t border-slate-100 text-sm text-slate-500 gap-4">
            <p className="order-2 md:order-1">
              Showing {pagination.from || 0} to {pagination.to || 0} of {pagination.total || 0} entries
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
                  onClick={() => handlePageChange(pagination.current_page - 1)}
                  disabled={pagination.current_page === 1}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 border border-slate-200"
                >
                  <ChevronLeft size={18} />
                </button>
                {(() => {
                  const total = pagination.last_page || 1;
                  const getPageItems = (current, total, sibling = 1) => {
                    const totalNumbers = sibling * 2 + 5;
                    if (total <= totalNumbers) return Array.from({ length: total }, (_, i) => i + 1);
                    const left = Math.max(2, current - sibling);
                    const right = Math.min(total - 1, current + sibling);
                    const pages = [1];
                    if (left > 2) pages.push("left-ellipsis");
                    for (let i = left; i <= right; i++) pages.push(i);
                    if (right < total - 1) pages.push("right-ellipsis");
                    pages.push(total);
                    return pages;
                  };
                  return getPageItems(pagination.current_page, total, 1).map((p, idx) => {
                    if (p === "left-ellipsis" || p === "right-ellipsis")
                      return (
                        <div
                          key={`${p}-${idx}`}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold text-slate-400"
                        >
                          ...
                        </div>
                      );
                    return (
                      <button
                        key={p}
                        onClick={() => handlePageChange(p)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-colors ${pagination.current_page === p
                          ? "bg-slate-100 text-[#27345A]"
                          : "text-slate-500 hover:bg-slate-50 border border-transparent"
                          }`}
                      >
                        {p}
                      </button>
                    );
                  });
                })()}
                <button
                  onClick={() => handlePageChange(pagination.current_page + 1)}
                  disabled={pagination.current_page === pagination.last_page}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 border border-slate-200"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- MODALS --- */}
      {/* FILTER MODAL (MULTI SELECT) */}
      <AnimatePresence>
        {isFilterOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-[18px] font-bold text-[#27345A]">Correction Filter</h3>
                <button onClick={() => setIsFilterOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>
              <div className="space-y-6 mb-8">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Type</label>
                  <div className="flex gap-2">
                    {["Clock In", "Clock Out"].map((type) => (
                      <button
                        key={type}
                        onClick={() => handleTempFilterChange("type", type)}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${(tempFilters.type || []).includes(type)
                          ? "bg-[#354C8F] text-white border-[#354C8F] shadow-md"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Status</label>
                  <div className="flex flex-wrap gap-2">
                    {["Approved", "Pending", "Rejected"].map((status) => (
                      <button
                        key={status}
                        onClick={() => handleTempFilterChange("status", status)}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${(tempFilters.status || []).includes(status)
                          ? "bg-[#354C8F] text-white border-[#354C8F] shadow-md"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={resetFilter} className={btnSecondaryClass}>
                  Reset
                </button>
                <button onClick={applyFilter} className={btnPrimaryClass}>
                  Apply
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FORM MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg relative animate-scale-up flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <h3 className="text-xl font-bold text-[#27345A]">Attendance Correction Form</h3>
              <button onClick={closeForm} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <form onSubmit={handleInitialSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    Date <span className="text-red-500">*</span>{" "}
                    <span className="text-xs font-normal text-slate-500">(DD/MM/YYYY)</span>
                  </label>
                  <p className="text-xs text-slate-500 font-semibold mb-2">
                    Use this form to correct a missed Clock In/Clock Out or to adjust attendance times (e.g., late
                    or recorded incorrectly). Select a date first to view the original times, then choose the
                    correction type and enter the corrected time.
                  </p>
                  <div className="relative">
                    <input
                      type="date"
                      name="date"
                      value={formData.date}
                      onChange={handleInputChange}
                      onClick={(e) => !isLoadingAttendanceDates && e.target.showPicker()}
                      disabled={isLoadingAttendanceDates}
                      className={`w-full pl-10 pr-3 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 cursor-pointer ${isLoadingAttendanceDates
                        ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                        : formData.date && !isDateSelectable(formData.date)
                          ? "border-red-200 bg-red-50"
                          : "border-slate-200"
                        }`}
                    />
                    <Calendar
                      className={`absolute left-3 top-3 pointer-events-none ${isLoadingAttendanceDates ? "text-slate-300" : "text-slate-400"
                        }`}
                      size={18}
                    />
                    {isLoadingAttendanceDates && (
                      <Loader2 className="absolute right-3 top-3 animate-spin text-slate-400" size={18} />
                    )}
                  </div>
                  {isLoadingAttendanceDates && (
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <Loader2 size={14} className="animate-spin" /> Loading attendance dates...
                    </p>
                  )}
                  {attendanceDates.size === 0 && !isLoadingAttendanceDates && (
                    <p className="text-xs text-amber-600 mt-1">No dates available</p>
                  )}
                  {formData.date && !isDateSelectable(formData.date) && (() => {
                    const info = attendanceInfoByDate?.[formData.date];
                    const cannotCorrect = info && (info.can_correct === false || info.canCorrect === false);
                    let label = "";
                    if (info) {
                      if (info.title) label = info.title;
                      else if (info.status) label = String(info.status).replace(/_/g, " ");
                    }
                    const reason = info?.reason ? ` — ${info.reason}` : "";
                    const message = cannotCorrect
                      ? "This date cannot be corrected"
                      : label
                        ? `Date is marked as ${label}${reason}`
                        : "Date selected is not available on the calendar";
                    return (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle size={14} />
                        {message}
                      </p>
                    );
                  })()}
                </div>

                {formData.date && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-extrabold text-slate-700 mb-3">
                      Attendance Info ({formatDateForDisplay(formData.date)})
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs font-bold text-slate-500 uppercase mb-1">Original Clock In</div>
                        <div className="text-sm font-bold text-slate-800">
                          {formatClockValue(attendanceInfoByDate?.[formData.date]?.clockIn)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-500 uppercase mb-1">Original Clock Out</div>
                        <div className="text-sm font-bold text-slate-800">
                          {formatClockValue(attendanceInfoByDate?.[formData.date]?.clockOut)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className={!formData.date || !isDateSelectable(formData.date) ? "opacity-60" : ""}>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Correction Type <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!formData.date || !isDateSelectable(formData.date)}
                      onClick={() => toggleCorrectionType("Clock In")}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${isClockInSelected
                        ? "bg-[#354C8F] text-white shadow-md"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                    >
                      Clock In
                    </button>
                    <button
                      type="button"
                      disabled={!formData.date || !isDateSelectable(formData.date)}
                      onClick={() => toggleCorrectionType("Clock Out")}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${isClockOutSelected
                        ? "bg-[#354C8F] text-white shadow-md"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                    >
                      Clock Out
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      className={`block text-sm font-bold mb-1.5 ${isClockInSelected && formData.date && isDateSelectable(formData.date)
                        ? "text-slate-700"
                        : "text-slate-400"
                        }`}
                    >
                      Clock In {isClockInSelected && <span className="text-red-500">*</span>}
                    </label>
                    <div className="relative">
                      <input
                        type="time"
                        name="clockInTime"
                        value={formData.clockInTime}
                        onChange={handleInputChange}
                        disabled={!formData.date || !isDateSelectable(formData.date) || !isClockInSelected}
                        onClick={(e) =>
                          formData.date &&
                          isDateSelectable(formData.date) &&
                          isClockInSelected &&
                          e.target.showPicker()
                        }
                        className={`w-full pl-10 pr-3 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden ${formData.date && isDateSelectable(formData.date) && isClockInSelected
                          ? "border-slate-200 bg-white"
                          : "border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed"
                          }`}
                      />
                      <Clock
                        className={`absolute left-3 top-3 ${formData.date && isDateSelectable(formData.date) && isClockInSelected
                          ? "text-slate-400"
                          : "text-slate-300"
                          }`}
                        size={18}
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      className={`block text-sm font-bold mb-1.5 ${isClockOutSelected && formData.date && isDateSelectable(formData.date)
                        ? "text-slate-700"
                        : "text-slate-400"
                        }`}
                    >
                      Clock Out {isClockOutSelected && <span className="text-red-500">*</span>}
                    </label>
                    <div className="relative">
                      <input
                        type="time"
                        name="clockOutTime"
                        value={formData.clockOutTime}
                        onChange={handleInputChange}
                        disabled={!formData.date || !isDateSelectable(formData.date) || !isClockOutSelected}
                        onClick={(e) =>
                          formData.date &&
                          isDateSelectable(formData.date) &&
                          isClockOutSelected &&
                          e.target.showPicker()
                        }
                        className={`w-full pl-10 pr-3 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden ${formData.date && isDateSelectable(formData.date) && isClockOutSelected
                          ? "border-slate-200 bg-white"
                          : "border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed"
                          }`}
                      />
                      <Clock
                        className={`absolute left-3 top-3 ${formData.date && isDateSelectable(formData.date) && isClockOutSelected
                          ? "text-slate-400"
                          : "text-slate-300"
                          }`}
                        size={18}
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows="3"
                    name="reason"
                    value={formData.reason}
                    onChange={handleInputChange}
                    placeholder="Fill your reason..."
                    className="w-full p-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 resize-none bg-slate-50"
                  ></textarea>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Attachments <span className="text-red-500">*</span>
                  </label>
                  <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center hover:bg-slate-50 transition-colors">
                    <div onClick={() => fileInputRef.current.click()} className="cursor-pointer">
                      <UploadCloud className="mx-auto text-slate-400 mb-2" size={32} />
                      <p className="text-sm font-bold text-slate-700">Choose a file or drag & drop it here</p>
                      <p className="text-xs text-slate-400 mt-1">JPEG, PNG, PDF formats, up to 5MB</p>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".jpg,.jpeg,.png,.pdf"
                        className="hidden"
                        multiple
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current.click()}
                      className="mt-3 px-4 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Browse File
                    </button>
                  </div>
                  {fileError && (
                    <div className="flex items-center gap-2 text-red-500 text-sm mt-3 bg-red-50 p-2 rounded-lg border border-red-100 animate-pulse">
                      <AlertCircle size={16} /> <span>{fileError}</span>
                    </div>
                  )}
                  <div className="space-y-3 mt-3">
                    {files.map((file) => (
                      <div
                        key={file.id}
                        className="bg-[#EFF4FF] rounded-xl p-3 flex items-center gap-3 border border-slate-100 relative overflow-hidden"
                      >
                        {file.status === "uploading" && (
                          <div
                            className="absolute bottom-0 left-0 h-1 bg-blue-500 transition-all duration-300 ease-out"
                            style={{ width: `${file.progress}%` }}
                          ></div>
                        )}
                        {getFileIcon(file.type)}
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-bold text-slate-700 truncate">{file.name}</span>
                            <button
                              type="button"
                              onClick={() => removeFile(file.id)}
                              className="text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span>{file.sizeFormatted}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                            {file.status === "uploading" ? (
                              <span className="text-blue-600 font-medium flex items-center gap-1">
                                <Loader2 size={10} className="animate-spin" /> Uploading {file.progress}%
                              </span>
                            ) : (
                              <span className="text-green-600 font-medium flex items-center gap-1">
                                <Check size={10} /> Completed
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </form>
            </div>
            <div className="p-6 border-t border-slate-100 flex gap-3 justify-end">
              <button
                type="button"
                onClick={closeForm}
                disabled={isSubmitting}
                className={`${btnSecondaryClass} min-w-[140px]`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInitialSubmit}
                disabled={!isFormValid || isSubmitting}
                className={`${btnPrimaryClass} min-w-[140px]`}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {isConfirmSubmitOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center animate-scale-up relative">
            <div className="w-24 h-24 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="text-yellow-500" size={48} strokeWidth={2.5} />
            </div>
            <h3 className="text-2xl font-bold text-[#27345A] mb-2">Submit Request?</h3>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">
              Once submitted, you cannot edit or delete this request. Are you sure you want to proceed?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setIsConfirmSubmitOpen(false)}
                disabled={isSubmitting}
                className={`${btnSecondaryClass} w-full`}
              >
                Cancel
              </button>
              <button
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                className={`${btnConfirmClass} w-full`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Processing...
                  </>
                ) : (
                  "Yes, Submit"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {isSuccessOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8 text-center animate-bounce-in relative">
            <div className="w-24 h-24 bg-[#E8F8EA] rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="text-[#4CD964]" size={48} strokeWidth={3.5} />
            </div>
            <h3 className="text-2xl font-bold text-[#27345A] mb-2">Request Success!</h3>
            <p className="text-slate-500 text-sm mb-8">
              Your correction request has been submitted successfully.
            </p>
            <button
              onClick={() => setIsSuccessOpen(false)}
              className="w-full bg-[#4CD964] hover:bg-[#42BD56] text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-green-100 transition-all active:scale-95 flex items-center justify-center"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* VIEW DETAIL MODAL */}
      <AnimatePresence>
        {isViewOpen && selectedPermission && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
            
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
                <h3 className="text-xl font-bold text-[#27345A]">Request Detail</h3>
                <button onClick={() => setIsViewOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>
              <div className="p-8 overflow-y-auto custom-scrollbar flex-1 -mt-2">
                <div className="space-y-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">Type</p>
                      <div className="text-[14px] font-semibold text-[#203266]">
                        {selectedPermission.itemsDetails
                          ? selectedPermission.itemsDetails.map((d) => d.typeLabel).join(" & ")
                          : "-"}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">
                        Status
                      </p>
                      {getStatusBadge(selectedPermission.status)}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <p className="text-xs text-slate-400 font-bold uppercase mb-1">Date</p>
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-[#354C8F] shadow-sm">
                          <Calendar size={16} />
                        </div>
                        {selectedPermission.date}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-bold uppercase mb-1">Reason</p>
                      <p className="text-sm text-slate-600 leading-relaxed bg-white p-3 rounded-lg border border-slate-100">
                        {selectedPermission.reason}
                      </p>
                    </div>

                    {/* Time Correction Fields (per-type) */}
                    <div className="space-y-3">
                      {selectedPermission.itemsDetails &&
                        selectedPermission.itemsDetails.map((d) => (
                          <div key={d.id_koreksi} className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs text-slate-400 font-bold uppercase mb-1">
                                Original Time <span className="text-[11px] text-slate-500 ml-2">({d.typeLabel})</span>
                              </p>
                              <div className="flex items-center gap-2 text-sm font-medium text-slate-700 bg-white p-2 rounded-lg border border-slate-100">
                                <Clock size={16} className="text-slate-400" />
                                {d.waktuAsli}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400 font-bold uppercase mb-1">
                                Correction Time <span className="text-[11px] text-slate-500 ml-2">({d.typeLabel})</span>
                              </p>
                              <div className="flex items-center gap-2 text-sm font-medium text-slate-700 bg-white p-2 rounded-lg border border-slate-100">
                                <Clock size={16} className="text-blue-500" />
                                {d.jamKoreksi}
                              </div>
                            </div>

                          </div>
                        ))}
                    </div>

                    {/* Approval timestamps (Mentor & Admin) */}
                    <div>
                      <p className="text-xs text-slate-400 font-bold uppercase mb-1">Mentor</p>
                      <p className="text-sm text-slate-700">
                        {selectedPermission.statusMentorRaw &&
                          selectedPermission.statusMentorRaw.toLowerCase().includes("rejected")
                          ? `Rejected by Mentor${selectedPermission.mentorTimestamp
                            ? " at " + formatDateTime(selectedPermission.mentorTimestamp)
                            : ""
                          }`
                          : (selectedPermission.statusMentorRaw &&
                            selectedPermission.statusMentorRaw.toLowerCase().includes("approved")) ||
                            selectedPermission.mentorTimestamp
                            ? `Approved by Mentor${selectedPermission.mentorTimestamp
                              ? " at " + formatDateTime(selectedPermission.mentorTimestamp)
                              : ""
                            }`
                            : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-bold uppercase mb-1">Admin</p>
                      <p className="text-sm text-slate-700">
                        {selectedPermission.statusAdminRaw &&
                          selectedPermission.statusAdminRaw.toLowerCase().includes("rejected")
                          ? `Rejected by Admin${selectedPermission.adminTimestamp
                            ? " at " + formatDateTime(selectedPermission.adminTimestamp)
                            : ""
                          }`
                          : (selectedPermission.statusAdminRaw &&
                            selectedPermission.statusAdminRaw.toLowerCase().includes("approved")) ||
                            selectedPermission.adminTimestamp
                            ? `Approved by Admin${selectedPermission.adminTimestamp
                              ? " at " + formatDateTime(selectedPermission.adminTimestamp)
                              : ""
                            }`
                            : "-"}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-bold uppercase mb-3">Attachments</p>
                    {selectedPermission.files && selectedPermission.files.length > 0 ? (
                      <div className="space-y-3">
                        {selectedPermission.files.map((fileUrl, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl group hover:border-[#354C8F]/30 transition-all"
                          >
                            <div
                              className="flex items-center gap-3 overflow-hidden cursor-pointer flex-1"
                              onClick={() =>
                                handleViewLampiran(idx, selectedPermission?.id_koreksi)
                              }
                            >
                              {getFileIcon(fileUrl)}
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-700 truncate group-hover:text-[#354C8F] transition-colors">
                                  {getCleanFileName(fileUrl)}
                                </p>
                                <p className="text-[10px] text-slate-400">Click to preview</p>
                              </div>
                            </div>
                            <button
                              onClick={() =>
                                handleFileAction(
                                  fileUrl,
                                  idx,
                                  "download",
                                  selectedPermission?.id_koreksi
                                )
                              }
                              disabled={downloadingFileId === `file-${idx}`}
                              className="p-2 text-slate-400 hover:text-[#354C8F] hover:bg-slate-50 rounded-lg transition-all"
                              title="Download"
                            >
                              {downloadingFileId === `file-${idx}` ? (
                                <Loader2 size={18} className="animate-spin text-[#354C8F]" />
                              ) : (
                                <Download size={18} />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center p-6 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-400 text-sm">
                        No attachments.
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3 sticky bottom-0 z-10">
                <button onClick={() => setIsViewOpen(false)} className={btnSecondaryClass}>
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CorrectionPage;