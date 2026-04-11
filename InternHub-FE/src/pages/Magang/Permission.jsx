import React, { useState, useRef, useEffect } from "react";
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
  Download,
  Calendar,
  Loader2,
} from "lucide-react";
import apiClient from "../../api/axiosConfig";
import { getSafeErrorMessage } from "../../utils/errorHandler";
import { motion, AnimatePresence } from "framer-motion";
import imageCompression from "browser-image-compression";

const btnPrimaryClass =
  "bg-[#354C8F] hover:bg-[#1F2B4D] text-white py-3.5 px-6 rounded-xl active:scale-95 transition-all font-bold text-sm shadow-md shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none";
const btnSecondaryClass = "bg-white border border-slate-300 text-slate-700 py-3.5 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition-all active:scale-95";
const btnConfirmClass = "bg-[#22C55E] hover:bg-[#16A34A] text-white py-3.5 px-6 rounded-xl font-bold text-sm shadow-md shadow-green-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"; 

const PermissionPage = () => {
  // --- HELPERS ---
  const formatDateRange = (startISO, endISO) => {
    try {
      if (!startISO) return "-";
      const start = new Date(startISO);
      const end = new Date(endISO || startISO);
      // Use numeric day/month/year format: DD/MM/YYYY
      const opts = { day: "2-digit", month: "2-digit", year: "numeric" };
      const startStr = start.toLocaleDateString("en-GB", opts); // e.g., 04/02/2026
      const endStr = end.toLocaleDateString("en-GB", opts);
      if (start.toDateString() === end.toDateString()) return startStr;
      return `${startStr} - ${endStr}`;
    } catch (e) { return "-"; }
  };

  const mapJenisIzin = (jenis) => {
    if (!jenis) return "Permission";
    const key = jenis.toLowerCase();
    if (key === "sakit") return "Sick";
    if (key === "izin" || key === "leave_requests") return "On Leave";
    return jenis.charAt(0).toUpperCase() + jenis.slice(1);
  };

  const formatDateTime = (iso) => {
    if (!iso) return "-";
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso);
      return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch (e) { return String(iso); }
  };

  const formatDateDDMMYYYY = (dateStr) => {
    if (!dateStr) return dateStr;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    } catch (e) { return dateStr; }
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

  // Try to find timestamp (approved/rejected) relevant to a role (mentor|admin) with flexible key names
  const findTimestampForRole = (obj, role) => {
    if (!obj) return null;
    // Prefer explicit role-scoped keys, then common generic keys, then a heuristic search
    const tries = [
      `approved_at_${role}`,
      `rejected_at_${role}`,
      `approved_at_${role}s`,
      `approved_at`,
      `rejected_at`,
      `approvedAt${role}`,
      `rejectedAt${role}`,
    ];
    for (const k of tries) {
      if (obj[k]) return obj[k];
    }
    // heuristic: find a key containing role and (approved|rejected)
    const key = Object.keys(obj).find(k => k.toLowerCase().includes(role) && (k.toLowerCase().includes('approved') || k.toLowerCase().includes('rejected')));
    if (key) return obj[key];
    // fallback generic
    if (obj.approved_at) return obj.approved_at;
    if (obj.rejected_at) return obj.rejected_at;
    return null;
  };

  // --- STATES UTAMA ---
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isConfirmSubmitOpen, setIsConfirmSubmitOpen] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [isErrorOpen, setIsErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);
  const [loadingViewId, setLoadingViewId] = useState(null);
  const [downloadingFileId, setDownloadingFileId] = useState(null);

  // Detail View
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedPermission, setSelectedPermission] = useState(null);

  // --- DATA & FILTER STATE ---
  const [permissions, setPermissions] = useState([]);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0, from: 0, to: 0 });
  const [searchTerm, setSearchTerm] = useState("");
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [activeFilters, setActiveFilters] = useState({ type: [], status: [] });
  const [tempFilters, setTempFilters] = useState({ type: [], status: [] });

  // --- FETCH DATA (SERVER SIDE PAGINATION) ---
  const fetchPermissions = async (page = 1) => {
    setIsLoadingPermissions(true);
    try {
      const params = { page, limit: itemsPerPage };

      if (searchTerm) params.q = searchTerm;

      if (activeFilters.type.length > 0) {
        const mappedTypes = activeFilters.type.map(t => t === "Sick" ? "sakit" : "izin");
        params.type = mappedTypes;
      }
      if (activeFilters.status.length > 0) {
        params.status = activeFilters.status.map(s => s.toLowerCase());
      }

      const res = await apiClient.get("/izin", { params });

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
      }

      // --- PERBAIKAN LOGIC MAPPING STATUS ---
      const mappedItems = items.map((it) => {
        let filesArr = [];
        if (it.lampiran) {
          try {
            const parsed = typeof it.lampiran === "string" ? JSON.parse(it.lampiran) : it.lampiran;
            filesArr = Array.isArray(parsed) ? parsed : [parsed];
          } catch { filesArr = [it.lampiran]; }
        }

        // 1. Ambil status mentah dari Mentor & Admin (lowercase biar aman)
        const sMentor = it.status_mentor ? it.status_mentor.toLowerCase() : 'pending';
        const sAdmin = it.status_admin ? it.status_admin.toLowerCase() : 'pending';

        // 2. Logic Penentuan Status Akhir UI
        let finalStatusUI = 'Pending';

        if (sMentor === 'rejected' || sAdmin === 'rejected') {
          finalStatusUI = 'Rejected';
        } else if (sMentor === 'approved' && sAdmin === 'approved') {
          finalStatusUI = 'Approved';
        } else if (sMentor === 'pending' && sAdmin === 'approved') {
          // Mentor belum approve tetapi admin sudah approve -> pending (admin involved)
          finalStatusUI = 'Pending';
        } else if (sMentor === 'approved' && sAdmin === 'pending') {
          // Admin belum approve -> pending admin
          finalStatusUI = 'Pending';
        } else if (sMentor === 'pending') {
          // Mentor pending (baik admin pending atau tidak) -> generic Pending label
          finalStatusUI = 'Pending';
        } else {
          finalStatusUI = 'Pending';
        }

        return {
          id: it.id_leave_requests || it.id_izin || it.id,
          id_izin: it.id_leave_requests || it.id_izin || it.id,
          typeLabel: mapJenisIzin(it.type || it.jenis_leave_requests || it.jenis_izin),
          dateLabel: formatDateRange(it.tanggal_mulai, it.tanggal_selesai),
          reason: it.keterangan || "-",

          // Gunakan hasil perhitungan logic di atas
          statusLabel: finalStatusUI,

          files: filesArr,
          // Raw statuses and flexible timestamps to support inconsistent API key names
          statusMentorRaw: it.status_mentor || it.statusMentor || null,
          statusAdminRaw: it.status_admin || it.statusAdmin || null,
          mentorTimestamp: findTimestampForRole(it, "mentor"),
          adminTimestamp: findTimestampForRole(it, "admin"),
          // Backwards-compatible approved fields kept for older code
          approvedAtMentor: it.approved_at_mentor || it.approved_at_mentor,
          approvedAtAdmin: it.approved_at_admin || it.approved_at,
          raw: it,
          user_id: it.user_id,
        };
      });

      setPermissions(mappedItems);
      setPagination(meta);

    } catch (err) {
      console.error(err);
      setPermissions([]);
    } finally {
      setIsLoadingPermissions(false);
    }
  };

  // Trigger Fetch
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchPermissions(1);
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, activeFilters, itemsPerPage]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.last_page) {
      fetchPermissions(newPage);
    }
  };

  // --- FILTER HANDLERS ---
  const openFilterModal = () => {
    setTempFilters(activeFilters);
    setIsFilterOpen(true);
  };

  const handleTempFilterChange = (category, value) => {
    setTempFilters((prev) => {
      const currentList = prev[category] || [];
      if (currentList.includes(value)) {
        return { ...prev, [category]: currentList.filter(item => item !== value) };
      } else {
        return { ...prev, [category]: [...currentList, value] };
      }
    });
  };

  const applyFilter = () => {
    setActiveFilters(tempFilters);
    setIsFilterOpen(false);
  };

  const resetFilter = () => {
    setTempFilters({ type: [], status: [] });
    setActiveFilters({ type: [], status: [] });
    setIsFilterOpen(false);
  };

  // --- FORM LOGIC ---
  const [permissionType, setPermissionType] = useState("Sick");
  const [fileError, setFileError] = useState("");
  const [formData, setFormData] = useState({ startDate: "", endDate: "", reason: "" });
  const [files, setFiles] = useState([]);
  const fileInputRef = useRef(null);

  // If start and end date are the same (or endDate omitted), attachments are optional
  const isSingleDay = Boolean(
    formData.startDate && (!formData.endDate || formData.endDate === formData.startDate)
  );

  const isFormValid = formData.startDate !== "" && formData.reason.trim() !== "" && (isSingleDay || files.length > 0);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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
    const maxSize = 5 * 1024 * 1024;

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
          } catch (compErr) { finalFile = file; }
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
      } catch (err) { setFileError("Error processing file."); }
    }

    if (processedFiles.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setFiles((prev) => [...prev, ...processedFiles]);
    processedFiles.forEach((fObj) => {
      const interval = setInterval(() => {
        setFiles((curr) => curr.map((f) => {
          if (f.id === fObj.id) {
            const nextProg = (typeof f.progress === 'number' ? f.progress : 0) + 20;
            if (nextProg >= 100) { clearInterval(interval); return { ...f, progress: 100, status: "completed" }; }
            return { ...f, progress: nextProg };
          }
          return f;
        }));
      }, 150);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (id) => setFiles(files.filter((f) => f.id !== id));

  const closeForm = () => {
    setIsFormOpen(false);
    setFiles([]);
    setFileError("");
    setFormData({ startDate: "", endDate: "", reason: "" });
  };

  const handleInitialSubmit = (e) => {
    e.preventDefault();
    if (isFormValid) setIsConfirmSubmitOpen(true);
  };

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    try {
      const data = new FormData();
      data.append("type", permissionType === "Sick" ? "sakit" : "izin");
      data.append("tanggal_mulai", formData.startDate);
      data.append("tanggal_selesai", formData.endDate || formData.startDate);
      data.append("keterangan", formData.reason);
      files.forEach((f) => data.append("lampiran[]", f.fileObj));

      await apiClient.post("/izin", data);
      setIsConfirmSubmitOpen(false);
      closeForm();
      setIsSuccessOpen(true);
      fetchPermissions(1);
    } catch (error) {
      setIsConfirmSubmitOpen(false);
      
      let errorMsg = getSafeErrorMessage(error, "Failed to submit.");
      
      // Format dates in error message from YYYY-MM-DD to DD-MM-YYYY
      if (errorMsg) {
        errorMsg = errorMsg.replace(/(\d{4})-(\d{2})-(\d{2})/g, (match, year, month, day) => {
          return `${day}-${month}-${year}`;
        });
      }
      
      setErrorMessage(errorMsg);
      setIsErrorOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- VIEW & DOWNLOAD ---
  const handleViewClick = (item) => {
    setLoadingViewId(item.id);
    setTimeout(() => {
      let attachmentFiles = [];
      if (item.files) attachmentFiles = item.files;

      setSelectedPermission({ ...item, files: attachmentFiles });
      setIsViewOpen(true);
      setLoadingViewId(null);
    }, 500);
  };

  const handleFileAction = async (fileUrl, fileIndex, actionType = "preview", idIzin = null) => {
    const fileId = `file-${fileIndex}`;
    if (actionType === "preview") {
      const fullUrl = fileUrl.startsWith("http") ? fileUrl : `${import.meta.env.VITE_STORAGE_BASE_URL}${fileUrl}`;
      window.open(fullUrl, "_blank");
      return;
    }
    if (actionType === "download") {
      setDownloadingFileId(fileId);
      try {
        const pId = idIzin || selectedPermission?.id_izin;
        const response = await apiClient.get(`/izin/${pId}/download-lampiran/${fileIndex}`, { responseType: "blob" });
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
        setErrorMessage("Failed to download file.");
        setIsErrorOpen(true);
      } finally {
        setDownloadingFileId(null);
      }
    }
  };



  const handleViewLampiran = (index, idIzin = null) => {
    const pId = idIzin || selectedPermission?.id_izin;
    const url = `${window.location.origin}/izin/view/${pId}/${index}`;
    window.open(url, "_blank");
  };

  // --- UI COMPONENTS ---

  const getStatusBadge = (status) => {
    const statusLower = (status || "").toLowerCase();

    if (statusLower === "approved") {
      return <span className="inline-flex items-center justify-center w-[120px] h-[34px] px-2 rounded-lg text-[13px] font-bold border whitespace-nowrap bg-green-100 text-green-600 border-green-200">Approved</span>;
    } else if (statusLower === "rejected") {
      return <span className="inline-flex items-center justify-center w-[120px] h-[34px] px-2 rounded-lg text-[13px] font-bold border whitespace-nowrap bg-red-100 text-red-600 border-red-200">Rejected</span>;
    } else {
      // Generic pending (mentor pending or general)
      return <span className="inline-flex items-center justify-center w-[120px] h-[34px] px-2 rounded-lg text-[13px] font-bold border whitespace-nowrap bg-[#FFF8E1] text-[#F59E0B] border-[#FFE0B2]">Pending</span>;
    }
  };

  const getFileIcon = (fileType) => {
    const isPdf = fileType?.includes("pdf") || fileType?.endsWith(".pdf");
    return (
      <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm shrink-0 border border-slate-100">
        <div className={`${isPdf ? "bg-red-500" : "bg-blue-500"} text-white text-[9px] font-bold px-1 rounded-sm`}>{isPdf ? "PDF" : "IMG"}</div>
      </div>
    );
  };

  return (
    <div className="bg-slate-50 -ml-2 -mr-2 min-h-screen px-4 md:px-4 py-4 font-sans text-slate-800">

      {/* ERROR MODAL */}
      <AnimatePresence>
        {isErrorOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setIsErrorOpen(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-6 text-center max-w-sm w-full shadow-2xl relative">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6"><AlertCircle className="text-red-500" size={40} strokeWidth={2.5} /></div>
              <h3 className="text-xl font-bold text-[#27345A] mb-2">Error</h3>
              <p className="text-slate-500 text-sm mb-6">{errorMessage}</p>
              <button onClick={() => setIsErrorOpen(false)} className={`${btnPrimaryClass} w-full`}>OK</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* HEADER */}
      <div className="mb-4 -mt-4">
        <h1 className="text-3xl font-bold text-[#27345A] mb-2 mt-2">Leave Request</h1>
        <p className="text-slate-500 max-w-3xl leading-relaxed text-sm">Submit a request if you are unable to attend work due to illness or official activities.</p>
      </div>

      {/* ACTION BAR */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-3 mb-4">
        <div className="flex flex-row w-full md:w-auto gap-3">
          <div className="relative flex-1 md:w-80">
            <input type="text" placeholder="Search by reason.." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 text-sm shadow-sm transition-all" />
            <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
          </div>
          <div className="w-auto">
            <button onClick={openFilterModal} className={`${btnPrimaryClass} !px-4 md:!px-6`}>
              <Filter size={18} /> <span className="hidden md:inline">Filter</span>
              {(activeFilters.type.length > 0 || activeFilters.status.length > 0) && (
                <div className="w-2 h-2 bg-red-400 rounded-full ml-1 animate-pulse"></div>
              )}
            </button>
          </div>
        </div>
        <div className="w-full md:w-auto">
          <button onClick={() => setIsFormOpen(true)} className={`${btnPrimaryClass} w-full md:w-auto`}><Plus size={18} /> Add New</button>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-sm font-bold text-slate-900 bg-slate-50/50">
                <th className="px-3 py-1.5 w-16 text-center">No</th>
                <th className="px-3 py-1.5">Type</th>
                <th className="px-3 py-1.5">Date</th>
                <th className="px-3 py-1.5">Brief Reason</th>
                <th className="px-3 py-1.5 text-center">Status</th>
                <th className="px-3 py-1.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-600">
              {isLoadingPermissions ? (
                <tr><td colSpan="6" className="py-6 px-3 text-center"><Loader2 size={32} className="animate-spin text-[#354C8F] mx-auto" /><p className="mt-2 text-slate-400">Loading data...</p></td></tr>
              ) : permissions.length > 0 ? (
                permissions.map((item, index) => (
                  <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-1.5 font-medium text-center">
                      {(pagination.from ? pagination.from + index : index + 1)}
                    </td>
                    <td className="px-3 py-1.5">{item.typeLabel}</td>
                    <td className="px-3 py-1.5">{item.dateLabel}</td>
                    <td className="px-3 py-1.5 truncate max-w-xs" title={item.reason}>{item.reason}</td>

                    {/* Menggunakan statusLabel hasil kalkulasi */}
                    <td className="px-3 py-1.5 text-center">{getStatusBadge(item.statusLabel)}</td>

                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => handleViewClick(item)}
                        disabled={loadingViewId === item.id}
                        className="inline-flex items-center justify-center w-9 h-9 rounded-lg transition-colors active:scale-95 shadow-sm text-white bg-[#354C8F] hover:bg-[#2a3c70] shadow-indigo-100 disabled:opacity-70 disabled:cursor-not-allowed"
                        title="View Detail"
                        aria-label="View Detail"
                      >
                        {loadingViewId === item.id ? <Loader2 size={18} className="animate-spin" /> : <Eye size={18} />}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="6" className="py-6 px-3 text-center text-slate-400">No data available.</td></tr>
              )} 
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {!isLoadingPermissions && permissions.length > 0 && (
          <div className="flex flex-col md:flex-row justify-between items-center px-4 py-3 border-t border-slate-100 text-sm text-slate-500 gap-3">
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
                    fetchPermissions(1);
                  }}
                  className="px-2 py-1.5 rounded-lg border border-slate-200 text-sm md:text-sm font-medium text-slate-700 bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 cursor-pointer transition-all"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
              <>
              <button onClick={() => handlePageChange(pagination.current_page - 1)} disabled={pagination.current_page === 1} className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 border border-slate-200"><ChevronLeft size={18} /></button>

              {(() => {
                const total = pagination.last_page || 1;
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
                return getPageItems(pagination.current_page, total, 1).map((p, idx) => {
                  if (p === 'left-ellipsis' || p === 'right-ellipsis') return <div key={`${p}-${idx}`} className="w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold text-slate-400">...</div>;
                  return <button key={p} onClick={() => handlePageChange(p)} className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-colors ${pagination.current_page === p ? "bg-slate-100 text-[#27345A]" : "text-slate-500 hover:bg-slate-50 border border-transparent"}`}>{p}</button>;
                });
              })()}

              <button onClick={() => handlePageChange(pagination.current_page + 1)} disabled={pagination.current_page === pagination.last_page} className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 border border-slate-200"><ChevronRight size={18} /></button>
              </>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FILTER MODAL */}
      <AnimatePresence>
        {isFilterOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative">
              <div className="flex justify-between items-center mb-6"><h3 className="text-[18px] font-bold text-[#27345A]">Leave Request Filter</h3><button onClick={() => setIsFilterOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button></div>

              <div className="space-y-6 mb-8">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Type</label>
                  <div className="flex flex-wrap gap-2">
                    {["Sick", "On Leave"].map((type) => (
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


              <div className="flex gap-3 justify-end"><button onClick={resetFilter} className={btnSecondaryClass}>Reset</button><button onClick={applyFilter} className={btnPrimaryClass}>Apply</button></div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* VIEW DETAIL MODAL */}
      <AnimatePresence>
        {isViewOpen && selectedPermission && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white"><h3 className="text-xl font-bold text-[#27345A]">Request Detail</h3><button onClick={() => setIsViewOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button></div>
              <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                <div className="space-y-6">
                  <div className="flex items-start justify-between">
                    <div><p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">Type</p><p className="text-lg font-bold text-slate-800">{selectedPermission.typeLabel}</p></div>
                    <div className="text-right"><p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Status</p>{getStatusBadge(selectedPermission.statusLabel)}</div>
                  </div>
                <div className="grid grid-cols-1 gap-2 p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div><p className="text-xs text-slate-400 font-bold uppercase mb-1">Date</p><div className="flex items-center gap-2 text-sm font-medium text-slate-700"><div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-[#354C8F] shadow-sm"><Calendar size={16} /></div>{selectedPermission.dateLabel}</div></div>
                  <div><p className="text-xs text-slate-400 font-bold uppercase mb-1">Reason</p><p className="text-sm text-slate-600 leading-relaxed bg-white p-3 rounded-lg border border-slate-100">{selectedPermission.reason}</p></div>
                  {/* Approved timestamps */}
                  <div>
                    <p className="text-xs text-slate-400 font-bold uppercase mb-1">Mentor</p>
                    <p className="text-sm text-slate-700">{selectedPermission.statusMentorRaw && selectedPermission.statusMentorRaw.toLowerCase().includes('rejected') ? `Rejected by Mentor${selectedPermission.mentorTimestamp ? ' at ' + formatDateTime(selectedPermission.mentorTimestamp) : ''}` : ((selectedPermission.statusMentorRaw && selectedPermission.statusMentorRaw.toLowerCase().includes('approved')) || selectedPermission.mentorTimestamp) ? `Approved by Mentor${selectedPermission.mentorTimestamp ? ' at ' + formatDateTime(selectedPermission.mentorTimestamp) : ''}` : '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-bold uppercase mb-1">Admin</p>
                    <p className="text-sm text-slate-700">{selectedPermission.statusAdminRaw && selectedPermission.statusAdminRaw.toLowerCase().includes('rejected') ? `Rejected by Admin${selectedPermission.adminTimestamp ? ' at ' + formatDateTime(selectedPermission.adminTimestamp) : ''}` : ((selectedPermission.statusAdminRaw && selectedPermission.statusAdminRaw.toLowerCase().includes('approved')) || selectedPermission.adminTimestamp) ? `Approved by Admin${selectedPermission.adminTimestamp ? ' at ' + formatDateTime(selectedPermission.adminTimestamp) : ''}` : '-'}</p>
                  </div>                        </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase mb-3">Attachments</p>
                  {selectedPermission.files && selectedPermission.files.length > 0 ? (
                    <div className="space-y-3">
                      {selectedPermission.files.map((fileUrl, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl group hover:border-[#354C8F]/30 transition-all">
                          <div className="flex items-center gap-3 overflow-hidden cursor-pointer flex-1" onClick={() => handleViewLampiran(idx, selectedPermission?.id_izin)}>
                            {getFileIcon(fileUrl)}
                            <div className="min-w-0"><p className="text-sm font-bold text-slate-700 truncate group-hover:text-[#354C8F] transition-colors">{getCleanFileName(fileUrl)}</p><p className="text-[10px] text-slate-400">Click to preview</p></div>
                          </div>
                          <button onClick={() => handleFileAction(fileUrl, idx, "download", selectedPermission?.id_izin)} disabled={downloadingFileId === `file-${idx}`} className="p-2 text-slate-400 hover:text-[#354C8F] hover:bg-slate-50 rounded-lg transition-all" title="Download">{downloadingFileId === `file-${idx}` ? <Loader2 size={18} className="animate-spin text-[#354C8F]" /> : <Download size={18} />}</button>
                        </div>
                      ))}
                    </div>
                  ) : (<div className="text-center p-6 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-400 text-sm">No attachments.</div>)}
                </div>
                </div>
              </div>
              <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3 sticky bottom-0 z-10">
                <button onClick={() => setIsViewOpen(false)} className={btnSecondaryClass}>Close</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FORM MODAL & SUCCESS/CONFIRM MODALS (SAMA SEPERTI SEBELUMNYA) */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg relative animate-scale-up flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-5 border-b border-slate-100"><h3 className="text-xl font-bold text-[#27345A]">Attendance Leave Request Form</h3><button onClick={closeForm} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={24} /></button></div>
            <div className="p-5 overflow-y-auto">
              <form onSubmit={handleInitialSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Type <span className="text-red-500">*</span></label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setPermissionType("Sick")} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 ${permissionType === "Sick" ? "bg-[#354C8F] text-white shadow-md" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>Sick</button>
                    <button type="button" onClick={() => setPermissionType("On Leave")} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 ${permissionType === "On Leave" ? "bg-[#354C8F] text-white shadow-md" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>On Leave</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-bold text-slate-700 mb-1.5">Start Date <span className="text-red-500">*</span></label><div className="relative"><input type="date" name="startDate" value={formData.startDate} onChange={handleInputChange} onClick={(e) => e.target.showPicker()} className="w-full pl-10 pr-3 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden" /><Calendar className="absolute left-3 top-3 text-slate-400" size={18} /></div></div>
                  <div><label className="block text-sm font-bold text-slate-700 mb-1.5">End Date</label><div className="relative"><input type="date" name="endDate" value={formData.endDate} onChange={handleInputChange} onClick={(e) => e.target.showPicker()} className="w-full pl-10 pr-3 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 [&::-webkit-calendar-picker-indicator]:hidden" /><Calendar className="absolute left-3 top-3 text-slate-400" size={18} /></div></div>
                </div>
                <div><label className="block text-sm font-bold text-slate-700 mb-1.5">Reason <span className="text-red-500">*</span></label><textarea rows="3" name="reason" value={formData.reason} onChange={handleInputChange} placeholder="Fill your reason..." className="w-full p-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#354C8F]/20 resize-none bg-slate-50"></textarea></div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Attachments {isSingleDay ? <span className="text-sm text-slate-400 ml-2">(Optional for single-day)</span> : <span className="text-red-500">*</span>}</label>
                  <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center hover:bg-slate-50 transition-colors">
                    <div onClick={() => fileInputRef.current.click()} className="cursor-pointer">
                      <UploadCloud className="mx-auto text-slate-400 mb-2" size={32} />
                      <p className="text-sm font-bold text-slate-700">Choose a file or drag & drop it here</p>
                      <p className="text-xs text-slate-400 mt-1">JPEG, PNG, PDG formats, up to 5MB</p>
                      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".jpg,.jpeg,.png,.pdf" className="hidden" multiple />
                    </div>
                    <button type="button" onClick={() => fileInputRef.current.click()} className="mt-3 px-4 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors">Browse File</button>
                  </div>
                  {fileError && <div className="flex items-center gap-2 text-red-500 text-sm mt-3 bg-red-50 p-2 rounded-lg border border-red-100 animate-pulse"><AlertCircle size={16} /> <span>{fileError}</span></div>}
                  <div className="space-y-3 mt-3">
                    {files.map((file) => (
                      <div key={file.id} className="bg-[#EFF4FF] rounded-xl p-3 flex items-center gap-3 border border-slate-100 relative overflow-hidden">
                        {file.status === "uploading" && <div className="absolute bottom-0 left-0 h-1 bg-blue-500 transition-all duration-300 ease-out" style={{ width: `${file.progress}%` }}></div>}
                        {getFileIcon(file.type)}
                        <div className="flex-1 min-w-0"><div className="flex justify-between items-center mb-1"><span className="text-sm font-bold text-slate-700 truncate">{file.name}</span><button type="button" onClick={() => removeFile(file.id)} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={16} /></button></div><div className="flex items-center gap-2 text-xs text-slate-500"><span>{file.sizeFormatted}</span><span className="w-1 h-1 rounded-full bg-slate-300"></span>{file.status === "uploading" ? <span className="text-blue-600 font-medium flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Uploading {file.progress}%</span> : <span className="text-green-600 font-medium flex items-center gap-1"><Check size={10} /> Completed</span>}</div></div>
                      </div>
                    ))}
                  </div>
                </div>
              </form>
            </div>
            <div className="p-4 border-t border-slate-100 flex gap-3 justify-end"><button type="button" onClick={closeForm} disabled={isSubmitting} className={`${btnSecondaryClass} min-w-[140px]`}>Cancel</button><button type="button" onClick={handleInitialSubmit} disabled={!isFormValid || isSubmitting} className={`${btnPrimaryClass} min-w-[140px]`}>Submit</button></div>
          </div>
        </div>
      )}

      {isConfirmSubmitOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-scale-up relative">
            <div className="w-24 h-24 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-6"><AlertTriangle className="text-yellow-500" size={48} strokeWidth={2.5} /></div>
            <h3 className="text-2xl font-bold text-[#27345A] mb-2">Submit Request?</h3>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">Once submitted, you cannot edit or delete this request. Are you sure you want to proceed?</p>
            <div className="flex gap-3"><button onClick={() => setIsConfirmSubmitOpen(false)} disabled={isSubmitting} className={`${btnSecondaryClass} w-full`}>Cancel</button><button onClick={handleFinalSubmit} disabled={isSubmitting} className={`${btnConfirmClass} w-full`}>{isSubmitting ? <><Loader2 size={18} className="animate-spin" /> Processing...</> : "Yes, Submit"}</button></div> 
          </div>
        </div>
      )}
      {isSuccessOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center animate-bounce-in relative">
            <div className="w-24 h-24 bg-[#E8F8EA] rounded-full flex items-center justify-center mx-auto mb-6"><Check className="text-[#4CD964]" size={48} strokeWidth={3.5} /></div>
            <h3 className="text-2xl font-bold text-[#27345A] mb-2">Request Success!</h3>
            <p className="text-slate-500 text-sm mb-8">Your correction request has been submitted successfully.</p>
            <button onClick={() => setIsSuccessOpen(false)} className="w-full bg-[#4CD964] hover:bg-[#42BD56] text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-green-100 transition-all active:scale-95 flex items-center justify-center">OK</button>
          </div>
        </div>
      )}

    </div>
  );
};

export default PermissionPage;