import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { CalendarDays, AlertTriangle, BookOpen, AlertCircle, ExternalLink } from 'lucide-react';
import apiClient from '../../api/axiosConfig';
import InternshipEndingNotification from '../../components/InternshipEndingNotification';

const Beranda = () => {
    // --- STATE ---
    const [attendanceData, setAttendanceData] = useState({
        present: 0, total: 0, absent: 0, sick: 0, leave: 0, lateCount: 0, lateMinutes: 0, month: ""
    });
    const [logbookData, setLogbookData] = useState({
        pending: 0, approved: 0, revisionNeeded: 0, notYet: 0, notSubmit: 0
    });
    const [mentorData, setMentorData] = useState({ name: "" });
    const [akhirMagang, setAkhirMagang] = useState(null);

    // --- FETCH DATA ---
    useEffect(() => {
        const loadData = async () => {
            try {
                let userData = localStorage.getItem('user');
                if (!userData) userData = localStorage.getItem('user_profile');
                if (userData) {
                    const user = JSON.parse(userData);
                    if (user.akhir_magang) setAkhirMagang(user.akhir_magang);
                }

                const [resDash, resTime] = await Promise.all([
                    apiClient.get('/dashboard'),
                    apiClient.get('/absensi/server-time')
                ]);

                const data = resDash.data.data;
                const monthName = new Date(resTime.data.server_date).toLocaleString('en-US', { month: 'long' });

                setAttendanceData({
                    present: data.akumulasi_kehadiran.total_hadir,
                    total: data.akumulasi_kehadiran.total_hari_kerja,
                    absent: data.akumulasi_kehadiran.alpa,
                    sick: data.detail_leave_requests_approved.sakit,
                    leave: data.detail_leave_requests_approved.leave_requests_lainnya,
                    lateCount: data.akumulasi_kehadiran.total_telat,
                    lateMinutes: data.akumulasi_kehadiran.lama_telat,
                    month: monthName
                });
                setMentorData({ name: data.mentor.nama });

                const lb = data.logbooks || {};
                setLogbookData({
                    pending: Number(lb.pending || 0),
                    approved: Number(lb.approved || 0),
                    revisionNeeded: Number(lb.revision_needed || 0),
                    notYet: Number(lb.not_yet || 0),
                    notSubmit: Number(lb.not_submit || 0),
                });
            } catch (err) { console.error(err); }
        };
        loadData();
    }, []);

    // --- STYLES & VARIANTS ---
    const gradientMain = "bg-[linear-gradient(90deg,#203266_0%,#263C79_19%,#4064CC_100%)]";
    const textDarkBlue = "text-[#203266]";
    const borderDarkBlue = "border-[#203266]";
    
    const containerVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6, staggerChildren: 0.1 } } };
    const itemVariants = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

    const attendancePercent = attendanceData.total > 0 ? Math.round((attendanceData.present / attendanceData.total) * 100) : 0;

    return (
        <motion.div className="max-w-screen-2xl mx-auto p-4 font-sans" initial="hidden" animate="visible" variants={containerVariants}>
            
            <InternshipEndingNotification akhirMagang={akhirMagang} />

            {/* BANNER */}
            <motion.div variants={itemVariants} className={`w-full ${gradientMain} rounded-3xl p-8 -mt-3 mb-8 text-white shadow-xl flex flex-col md:flex-row items-center justify-between`}>
                <div className="max-w-3xl">
                    <h1 className="text-3xl font-bold mb-4">Welcome to SIER Internship Program</h1>
                    <p className="text-indigo-100 text-lg">Monitor your daily performance and track your internship hours.</p>
                </div>
            </motion.div>

            {/* MAIN GRID LAYOUT */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch"> 

                {/* === LEFT COLUMN (2/3) === */}
                <div className="lg:col-span-2 flex flex-col gap-6 h-full">
                    
                    {/* Top Row: Attendance & Late */}
                    {/* UBAH: h-full dihapus, ganti h-fit agar compact (tidak banyak whitespace) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-fit"> 
                        
                        {/* 1. Attendance */}
                        <motion.div variants={itemVariants} className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-100 flex flex-col justify-between h-full">
                            <div>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2.5 ${gradientMain} text-white rounded-xl shadow-md`}><CalendarDays size={24} /></div>
                                        <div><p className={`text-sm font-extrabold ${textDarkBlue} uppercase tracking-wide`}>ATTENDANCE</p><p className="text-xs text-slate-400 font-medium">{attendanceData.month}</p></div>
                                    </div>
                                    <div className="flex items-baseline gap-1"><span className={`text-4xl font-extrabold ${textDarkBlue}`}>{attendanceData.present}</span><span className="text-xl font-bold text-slate-300">/ {attendanceData.total}</span></div>
                                </div>
                                <div className="mt-4">
                                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden"><div className={`h-3 rounded-full ${gradientMain}`} style={{ width: `${attendancePercent}%` }} /></div>
                                    <p className="text-xs text-slate-500 mt-1">Attendance completion: <span className="font-semibold text-slate-700">{attendancePercent}%</span></p>
                                </div>
                                <div className="grid grid-cols-3 gap-3 mt-4">
                                    {[{ v: attendanceData.absent, l: "Abs" }, { v: attendanceData.sick, l: "Sick" }, { v: attendanceData.leave, l: "On Leave" }].map((i, idx) => (
                                        <div key={idx} className={`flex items-center justify-center px-2 py-1 gap-2 rounded-xl border ${borderDarkBlue} bg-white`}>
                                            <span className={`font-bold ${textDarkBlue} text-sm`}>{i.v}</span><span className={`text-xs font-bold ${textDarkBlue}`}>{i.l}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>

                        {/* 2. Late Arrival */}
                        <motion.div variants={itemVariants} className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-100 flex flex-col justify-between h-full">
                            <div>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2.5 ${gradientMain} text-white rounded-xl shadow-md`}><AlertTriangle size={24} /></div>
                                        <div><p className={`text-sm font-extrabold ${textDarkBlue} uppercase tracking-wide`}>LATE ARRIVAL</p><p className="text-xs text-slate-400 font-medium">{attendanceData.month}</p></div>
                                    </div>
                                    <span className={`text-4xl font-extrabold ${textDarkBlue}`}>{attendanceData.lateCount}</span>
                                </div>
                                <div className="mt-2 space-y-1">
                                    <p className="text-sm font-bold text-slate-800">Late Accumulation: <span className="font-extrabold">{attendanceData.lateMinutes} Minutes</span></p>
                                    <p className="text-xs text-slate-400 font-medium mt-1">Be on time.</p>
                                </div>
                            </div>
                            {/* <p className='text-xs text-slate-400 font-medium mt-6'>Good luck!</p> */}
                        </motion.div>
                    </div>

                    {/* Bottom Row: Info Penting */}
                    {/* UBAH: h-fit diganti flex-1 agar dia yang mengisi sisa ruang (jadi tinggi) */}
                    <motion.div variants={itemVariants} className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-100 flex-1 flex flex-col">
                        <h3 className="flex items-center gap-2 font-bold text-sm mb-4 text-slate-800">
                            <AlertCircle className="text-yellow-500" size={22} /> Important Information
                        </h3>
                        {/* Tambahkan h-full / flex-1 di konten agar tersebar jika cardnya jadi sangat tinggi */}
                        <div className="space-y-4 flex-1"> 
                            <div className="bg-red-50 p-4 rounded-xl flex gap-3 items-start border border-red-100">
                                <div className="w-2 h-2 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                                <p className="text-sm text-slate-600 font-medium">Intern information will be accessible via the provided <a href="https://drive.google.com/drive/folders/1A8-nCiq_QCzdIQpRdTMOvoewAWO0XIv1" target="_blank" rel="noreferrer" className="font-bold text-slate-900 inline-flex items-center hover:underline">Google Drive <ExternalLink size={12} className="ml-1" /></a>.</p>
                            </div>
                            <div className="bg-blue-50 p-4 rounded-xl flex gap-3 items-start border border-blue-100">
                                <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                                <p className="text-sm text-slate-600 font-medium">Please ensure your <span className="font-bold text-slate-900">profile information</span> is complete and up to date.</p>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* === RIGHT COLUMN (1/3) === */}
                <div className="lg:col-span-1 h-full flex flex-col"> 
                    {/* Logbook Chart */}
                    <motion.div variants={itemVariants} className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-100 flex-1 flex flex-col justify-between">
                        <div>
                            {/* Header */}
                            <div className="flex items-center gap-3 mb-6">
                                <div className={`p-2.5 ${gradientMain} text-white rounded-xl shadow-md`}><BookOpen size={24} /></div>
                                <div><p className={`text-sm font-extrabold ${textDarkBlue} uppercase tracking-wide`}>LOGBOOK</p><p className="text-xs text-slate-400 font-medium">Accumulation</p></div>
                            </div>
                            <p className="text-sm font-bold text-slate-800 mb-8 -mt-2">Logbook Status</p>

                            {/* Chart Area */}
                            {(() => {
                                const { pending, approved, revisionNeeded: rev, notYet: ny, notSubmit: ns } = logbookData;
                                const total = pending + approved + rev + ny + ns;
                                const completion = total > 0 ? (approved / total) * 100 : 0;
                                const maxVal = Math.max(pending, approved, rev, ny, 10); 
                                const H_PX = 180;

                                const bars = [
                                    { v: pending, l: "Pending", c: "bg-[#EAB308]" },
                                    { v: approved, l: "Verified", c: "bg-[#1ad326]" },
                                    { v: rev, l: "Revision", c: "bg-[#EF4444]" },
                                    { v: ny, l: "Not Yet", c: "bg-slate-300" },
                                ];

                                return (
                                    <div className="flex flex-col items-center">
                                        <div className="relative w-full h-[200px] flex items-end justify-between gap-2 px-2 mb-4">
                                            {/* Grid Lines */}
                                            <div className="absolute inset-0 flex flex-col justify-between text-[10px] text-slate-300 pointer-events-none z-0 pb-6">
                                                {[1, 0.75, 0.5, 0.25, 0].map((r, i) => (
                                                    <div key={i} className="flex items-center w-full">
                                                        <span className="w-4 mr-1 text-right">{Math.round(maxVal * r)}</span>
                                                        <div className="h-[1px] w-full bg-slate-100 border-t border-dashed border-slate-300"></div>
                                                    </div>
                                                ))}
                                            </div>
                                            {/* Bars */}
                                            {bars.map((b, i) => (
                                                <div key={i} className="flex flex-col items-center gap-1 z-10 flex-1 group">
                                                    <span className="text-xs font-bold text-slate-700 mb-1">{b.v}</span>
                                                    <div className={`w-full max-w-[40px] rounded-t-md ${b.c} transition-all duration-500`} style={{ height: `${(b.v / maxVal) * H_PX || 4}px` }} />
                                                    <span className="text-[10px] font-medium text-slate-500 mt-1">{b.l}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-xs text-slate-500">Completion Rate: <span className="text-lg font-bold text-slate-800 ml-1">{completion.toFixed(1)}%</span></p>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Footer (Mentor) */}
                        <div className="mt-6 text-left border-t border-slate-100 pt-4">
                            <p className="text-xs text-slate-500">Mentor: <span className="font-bold text-slate-800">{mentorData.name}</span></p>
                        </div>
                    </motion.div>
                </div>

            </div>
        </motion.div>
    );
};

export default Beranda;