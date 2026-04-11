import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  ArrowUpRight,
  ArrowLeft,
  UserX,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { motion } from "framer-motion";
import apiClient from "../../api/axiosConfig";

const textDarkBlue = "text-[#203266]";

const EndingSoonInterns = () => {
  const navigate = useNavigate();
  
  const [endingInterns, setEndingInterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    total: 0,
    from: 0,
    to: 0,
  });

  const itemsPerPage = 10;

  useEffect(() => {
    fetchEndingInterns();
  }, [currentPage]);

  const fetchEndingInterns = async () => {
    try {
      setLoading(true);
      const role = localStorage.getItem("role") || "mentor";
      
      // Call API endpoint for mentor's ending soon interns (30 days)
      const res = await apiClient.get("/mentor/interns/ending-soon", {
        params: {
          role,
          days: 30,
          page: currentPage,
          per_page: itemsPerPage,
        },
      });

      if (res.data?.success) {
        const data = res.data.data;
        
        // Map API response to component state
        const mapped = (data.data || []).map((item) => ({
          id: item.id_mahasiswa ?? item.user_id ?? item.id,
          name: item.nama_lengkap,
          university: item.universitas,
          program: item.jurusan,
          endDate: item.akhir_magang,
          daysLeft: item.days_left,
        }));

        setEndingInterns(mapped);
        setPagination({
          current_page: data.current_page,
          last_page: data.last_page,
          total: data.total,
          from: data.from,
          to: data.to,
        });
      }
    } catch (err) {
      console.error("Failed to fetch ending soon interns:", err);
      setEndingInterns([]);
      setPagination({
        current_page: 1,
        last_page: 1,
        total: 0,
        from: 0,
        to: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.last_page) {
      setCurrentPage(newPage);
    }
  };

  const handleCardClick = (internId) => {
    navigate(`/mentor/interns/${internId}`);
  };

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <div className="bg-[#F8FAFC] min-h-screen -ml-6 -mr-6  px-4 md:px-8 py-8 font-sans text-slate-800 -mt-8">
      {/* Header */}
      <div className="mb-8 flex items-start gap-4">
        <button
          type="button"
          onClick={handleBack}
          className="w-12 h-12 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-500 opacity-70 hover:opacity-100 hover:bg-slate-50 transition-all shrink-0"
          aria-label="Back"
        >
          <ArrowLeft size={22} />
        </button>
        <div>
          <h1 className={`text-3xl font-bold ${textDarkBlue} mb-2`}>
            Ending Soon Interns
          </h1>
          <p className="text-slate-500 text-sm">
            Your mentored interns whose internship period will end within the next 30 days
          </p>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={48} className="animate-spin text-[#354C8F]" />
        </div>
      ) : (
        <>
          {/* Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8 -mt-9">
            {endingInterns.map((intern) => (
              <motion.div
                key={intern.id}
                onClick={() => handleCardClick(intern.id)}
                className="group p-5 rounded-2xl border border-slate-100 bg-white hover:bg-slate-50 hover:border-slate-200 hover:shadow-lg transition-all duration-200 cursor-pointer"
                whileHover={{ y: -4 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-800 text-base leading-tight mb-1">
                      {intern.name}
                    </h4>
                    <p className="text-xs text-slate-500 line-clamp-1 mb-1">
                      {intern.university}
                    </p>
                    {intern.program && (
                      <p className="text-[10px] text-slate-400 line-clamp-1">
                        {intern.program}
                      </p>
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-extrabold px-2.5 py-1 rounded-md border shrink-0 ${
                      intern.daysLeft <= 7
                        ? "bg-red-50 text-red-600 border-red-100"
                        : intern.daysLeft <= 14
                        ? "bg-orange-50 text-orange-600 border-orange-100"
                        : "bg-yellow-50 text-yellow-600 border-yellow-100"
                    }`}
                  >
                    {intern.daysLeft} Days
                  </span>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-200/50">
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                    <Calendar size={14} className="text-slate-400" />
                    <span>
                      {intern.endDate
                        ? new Date(intern.endDate).toLocaleDateString("en-GB")
                        : "-"}
                    </span>
                  </div>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-slate-300 group-hover:text-[#354C8F] group-hover:bg-blue-50 transition-colors">
                    <ArrowUpRight size={16} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Empty State */}
          {endingInterns.length === 0 && (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
              <UserX size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 font-medium">
                No interns ending soon found
              </p>
            </div>
          )}

          {/* Pagination */}
          {pagination.total > 0 && (
            <div className="flex flex-col md:flex-row justify-between items-center p-5 bg-white rounded-xl shadow-sm border border-slate-100 text-sm text-slate-500 gap-4">
              <p className="order-2 md:order-1">Showing {pagination.from || 0} to {pagination.to || 0} of {pagination.total || 0} entries</p>
              <div className="flex items-center gap-2 order-1 md:order-2">
                {(() => {
                  const pageCurrent = pagination.current_page || currentPage;
                  const pageTotal = pagination.last_page || 1;
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
                  return (
                    <>
                      <button onClick={() => handlePageChange(pageCurrent - 1)} disabled={pageCurrent === 1} className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 border border-slate-200"><ChevronLeft size={18} /></button>
                      {getPageItems(pageCurrent, pageTotal, 1).map((p, idx) => {
                        if (p === 'left-ellipsis' || p === 'right-ellipsis') return <div key={`${p}-${idx}`} className="w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold text-slate-400">...</div>;
                        return <button key={p} onClick={() => handlePageChange(p)} className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-colors ${pageCurrent === p ? "bg-slate-100 text-[#27345A] border border-slate-200" : "text-slate-500 hover:bg-slate-50 border border-transparent"}`}>{p}</button>;
                      })}
                      <button onClick={() => handlePageChange(pageCurrent + 1)} disabled={pageCurrent === pageTotal} className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 border border-slate-200"><ChevronRight size={18} /></button>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default EndingSoonInterns;
