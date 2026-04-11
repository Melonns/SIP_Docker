import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import apiClient from '../../api/axiosConfig';
import { fetchSecureRawBlob } from '../../utils/secureFetch';

// Default scores configuration
const defaultScores = [
    { label: 'Integritas (etika, moral dan kesungguhan)', score: 0 },
    { label: 'Ketepatan waktu dalam bekerja', score: 0 },
    { label: 'Keahlian berdasarkan bidang ilmu', score: 0 },
    { label: 'Kerjasama dalam tim', score: 0 },
    { label: 'Komunikasi', score: 0 },
    { label: 'Penggunaan teknologi informasi', score: 0 },
    { label: 'Pengembangan diri', score: 0 },
];

const MAX_TEMPLATE_DIMENSION = 3508;
const TARGET_TEMPLATE_MAX_BYTES = 4 * 1024 * 1024;

const GenerateSertif = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { selectedInterns = [], mode = 'single', fromFinalEvaluation = false, missingSelected = [] } = location.state || {};

    const [isBulk] = useState(mode === 'bulk' || selectedInterns.length > 1);
    const [previewInternId, setPreviewInternId] = useState(selectedInterns.length > 0 ? selectedInterns[0].id : null);
    const [orderedSelectedInterns, setOrderedSelectedInterns] = useState(selectedInterns || []);

    // Templates (State untuk file gambar)
    const [singleTemplate, setSingleTemplate] = useState(null);
    const [singleTemplateBack, setSingleTemplateBack] = useState(null);
    const [bulkTemplate, setBulkTemplate] = useState(null);
    const [bulkTemplateBack, setBulkTemplateBack] = useState(null);

    // Inputs
    const [singleNumber, setSingleNumber] = useState('');
    const [signerName, setSignerName] = useState('Fitrina Kusuma Dewi');
    const [bulkNumbers, setBulkNumbers] = useState(null);
    const [bulkNumbersList, setBulkNumbersList] = useState([]);
    const [bulkNumbersInvalid, setBulkNumbersInvalid] = useState(false);

    // Preview States
    const [previewOpen, setPreviewOpen] = useState(false);
    const [templateUrl, setTemplateUrl] = useState(null);
    const [templateBackUrl, setTemplateBackUrl] = useState(null);
    const [templateRatio, setTemplateRatio] = useState('auto');
    const [templateSize, setTemplateSize] = useState({ width: 0, height: 0 });
    const [previewScale, setPreviewScale] = useState(1);
    const previewContainerRef = useRef(null);
    const [previewExpanded, setPreviewExpanded] = useState(false);

    // Data Master Komponen Penilaian (Dari API)
    const [masterComponents, setMasterComponents] = useState([]);

    // Certificate Data for Preview
    const [certificateData, setCertificateData] = useState({
        name: '',
        number: '',
        university: '',
        program: '',
        periode: '',
        level: '',
        placement: '',
        startDate: '',
        endDate: '',
        months: '',
        predicate: '',
        cityDate: '',
        company: 'PT Surabaya Industrial Estate Rungkut',
        signer: signerName,
        signerTitle: 'Kepala Divisi Sumber Daya Manusia'
    });

    const [scores, setScores] = useState(defaultScores);
    const [totalScore, setTotalScore] = useState(0);
    const [avgScore, setAvgScore] = useState(0);
    const [letter, setLetter] = useState('-');

    // UI States
    const [isGenerating, setIsGenerating] = useState(false);
    const [notice, setNotice] = useState('');
    const [noticeType, setNoticeType] = useState('');
    const [missingEvaluation, setMissingEvaluation] = useState(false);
    const [showNumberInfo, setShowNumberInfo] = useState(false);

    // --- 1. LOAD MASTER DATA (Templates & Komponen Penilaian) ---
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                // A. Load Template Default
                const listRes = await apiClient.get('admin/sertifikat/templates');
                if (listRes.data && listRes.data.success) {
                    const templates = listRes.data.data;
                    const frontTemplate = templates.find(t => t.side === 'front');
                    const backTemplate = templates.find(t => t.side === 'back');

                    if (frontTemplate) {
                        const frontBlob = await fetchSecureRawBlob('admin/sertifikat/templates/view/front');
                        if (frontBlob) {
                            const file = new File([frontBlob], "template_front_default.png", { type: "image/png" });
                            const optimizedFront = await optimizeTemplateImage(file);
                            setSingleTemplate(optimizedFront);
                            setBulkTemplate(optimizedFront);
                            handlePreview(optimizedFront, 'front');
                        }
                    }

                    if (backTemplate) {
                        const backBlob = await fetchSecureRawBlob('admin/sertifikat/templates/view/back');
                        if (backBlob) {
                            const file = new File([backBlob], "template_back_default.png", { type: "image/png" });
                            const optimizedBack = await optimizeTemplateImage(file);
                            setSingleTemplateBack(optimizedBack);
                            setBulkTemplateBack(optimizedBack);
                            try { handlePreview(optimizedBack, 'back'); } catch (e) { /* ignore */ }
                        }
                    }
                }

                // B. Load Master Komponen Penilaian
                const compRes = await apiClient.get('/admin/evaluations/komponen-penilaian');
                if (compRes.data && (compRes.data.success || Array.isArray(compRes.data))) {
                    const data = compRes.data.data || compRes.data;
                    if (Array.isArray(data)) {
                        setMasterComponents(data);
                    }
                }
            } catch (error) {
                console.error("Failed to load initial data:", error);
            }
        };

        loadInitialData();
    }, []);

    const previewIntern = useMemo(() =>
        selectedInterns.find(i => String(i.id) === String(previewInternId)) || {},
        [previewInternId, selectedInterns]);

    const resolvedCertNumber = useMemo(() => {
        if (!isBulk) return singleNumber;
        if (bulkNumbersList.length > 0 && orderedSelectedInterns.length > 0) {
            const idx = orderedSelectedInterns.findIndex(i => String(i.id) === String(previewInternId));
            return bulkNumbersList[idx] || '[Number Not Found]';
        }
        return '[Certificate Number]';
    }, [isBulk, singleNumber, bulkNumbersList, previewInternId, orderedSelectedInterns]);

    const periodLabel = useMemo(() => {
        if (!certificateData.startDate || !certificateData.endDate) return '-';
        return formatDateRange(certificateData.startDate, certificateData.endDate);
    }, [certificateData.startDate, certificateData.endDate]);

    // SCALE LOGIC
    useEffect(() => {
        if (!templateSize.width || !previewContainerRef.current) return;
        const updateScale = () => {
            if (previewContainerRef.current) {
                const { width } = previewContainerRef.current.getBoundingClientRect();
                const next = width / templateSize.width;
                setPreviewScale(Number.isFinite(next) && next > 0 ? next : 1);
            }
        };
        window.addEventListener('resize', updateScale);
        updateScale();
        const ro = new ResizeObserver(updateScale);
        if (previewContainerRef.current) ro.observe(previewContainerRef.current);
        return () => {
            window.removeEventListener('resize', updateScale);
            ro.disconnect();
        };
    }, [templateSize, previewOpen, previewExpanded]);

    // Refetch data when intern changes
    useEffect(() => {
        if (previewIntern.id) {
            setNotice('');
            setNoticeType('');
            setMissingEvaluation(false);
            fetchCertificateData({ userId: previewIntern.id, evaluationId: previewIntern?.evaluationId });
        }
    }, [previewIntern, masterComponents]);

    function formatDate(dateString) {
        if (!dateString) return '-';
        const options = { day: 'numeric', month: 'long', year: 'numeric' };
        return new Date(dateString).toLocaleDateString('id-ID', options);
    }

    function formatDateRange(startDateString, endDateString) {
        try {
            if (!startDateString || !endDateString) return '-';
            const start = new Date(startDateString);
            const end = new Date(endDateString);
            if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return '-';
            const startDay = start.toLocaleDateString('id-ID', { day: 'numeric' });
            const startMonth = start.toLocaleDateString('id-ID', { month: 'long' });
            const startYear = start.toLocaleDateString('id-ID', { year: 'numeric' });
            const endDay = end.toLocaleDateString('id-ID', { day: 'numeric' });
            const endMonth = end.toLocaleDateString('id-ID', { month: 'long' });
            const endYear = end.toLocaleDateString('id-ID', { year: 'numeric' });
            if (startYear === endYear) return `${startDay} ${startMonth} - ${endDay} ${endMonth} ${endYear}`;
            return `${startDay} ${startMonth} ${startYear} - ${endDay} ${endMonth} ${endYear}`;
        } catch { return '-'; }
    }

    function calcDurationMonths(startDate, endDate) {
        try {
            if (!startDate || !endDate) return '';
            const start = new Date(startDate);
            const end = new Date(endDate);
            if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return '';
            const startMonthIndex = start.getFullYear() * 12 + start.getMonth();
            const endMonthIndex = end.getFullYear() * 12 + end.getMonth();
            const diff = endMonthIndex - startMonthIndex + 1;
            return diff > 0 ? String(diff) : '';
        } catch { return ''; }
    }

    function pickFirstObject(value) {
        if (!value) return null;
        if (Array.isArray(value)) return value[0] || null;
        if (typeof value === 'object') return value;
        return null;
    }

    function formatPredicate(pred) {
        if (!pred) return pred || '-';
        const map = { A: 'Sangat Memuaskan', B: 'Memuaskan', C: 'Cukup Memuaskan' };
        return map[String(pred).toUpperCase()] || pred;
    }

    function formatScoreLetter(score) {
        const value = Number(score) || 0;
        if (value >= 86) return 'A';
        if (value >= 71) return 'B';
        return 'C';
    }

    function formatMonthsWord(months) {
        const n = Number(months);
        if (!Number.isFinite(n) || n <= 0) return '';
        const map = {
            1: 'Satu', 2: 'Dua', 3: 'Tiga', 4: 'Empat', 5: 'Lima', 6: 'Enam',
            7: 'Tujuh', 8: 'Delapan', 9: 'Sembilan', 10: 'Sepuluh', 11: 'Sebelas', 12: 'Dua Belas'
        };
        return map[n] || String(n);
    }

    const loadImageElement = (file) => new Promise((resolve, reject) => {
        const imageUrl = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            URL.revokeObjectURL(imageUrl);
            resolve(image);
        };
        image.onerror = (error) => {
            URL.revokeObjectURL(imageUrl);
            reject(error);
        };
        image.src = imageUrl;
    });

    const canvasToBlob = (canvas, mimeType, quality) => new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Failed to create image blob.'));
        }, mimeType, quality);
    });

    const optimizeTemplateImage = async (file) => {
        try {
            if (!file || !file.type?.startsWith('image/')) return file;

            const image = await loadImageElement(file);
            const sourceWidth = image.naturalWidth || image.width;
            const sourceHeight = image.naturalHeight || image.height;
            if (!sourceWidth || !sourceHeight) return file;

            const resizeScale = Math.min(1, MAX_TEMPLATE_DIMENSION / Math.max(sourceWidth, sourceHeight));
            const nextWidth = Math.max(1, Math.round(sourceWidth * resizeScale));
            const nextHeight = Math.max(1, Math.round(sourceHeight * resizeScale));
            const shouldResize = resizeScale < 1;
            const shouldTryCompress = file.size > TARGET_TEMPLATE_MAX_BYTES;

            if (!shouldResize && !shouldTryCompress) return file;

            const canvas = document.createElement('canvas');
            canvas.width = nextWidth;
            canvas.height = nextHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return file;

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(image, 0, 0, nextWidth, nextHeight);

            const mimeType = file.type || 'image/png';
            let optimizedBlob;

            if (mimeType === 'image/jpeg' || mimeType === 'image/webp') {
                let quality = 0.95;
                optimizedBlob = await canvasToBlob(canvas, mimeType, quality);
                while (optimizedBlob.size > TARGET_TEMPLATE_MAX_BYTES && quality > 0.75) {
                    quality -= 0.05;
                    optimizedBlob = await canvasToBlob(canvas, mimeType, quality);
                }
            } else {
                optimizedBlob = await canvasToBlob(canvas, mimeType);
            }

            if (!optimizedBlob || optimizedBlob.size >= file.size * 0.98) {
                return shouldResize ? new File([await canvasToBlob(canvas, mimeType)], file.name, { type: mimeType, lastModified: Date.now() }) : file;
            }

            return new File([optimizedBlob], file.name, {
                type: optimizedBlob.type || mimeType,
                lastModified: Date.now()
            });
        } catch (error) {
            console.error('Template optimization skipped:', error);
            return file;
        }
    };

    const fetchCertificateData = async ({ userId, evaluationId } = {}) => {
        try {
            let res;
            if (evaluationId) {
                res = await apiClient.get(`/admin/evaluations/${evaluationId}`);
            } else {
                res = await apiClient.get(`/admin/sertifikat/data/${userId}`);
            }

            if (!res.data?.success) {
                setMissingEvaluation(true);
                setNoticeType('error');
                setNotice(res.data?.message || 'Final evaluation not found for this intern.');

                const intern = res.data?.data?.intern || {};
                const emptyScores = masterComponents.length > 0 
                    ? masterComponents.map(c => ({ label: c.nama_komponen || c.name, score: 0 }))
                    : defaultScores;

                setCertificateData(prev => ({
                    ...prev,
                    name: intern?.name || prev.name,
                    level: intern?.education_level || prev.level,
                    program: intern?.study_program || prev.program,
                    university: intern?.university || prev.university,
                    placement: intern?.division || prev.placement,
                    startDate: intern?.start_date || prev.startDate,
                    endDate: intern?.end_date || prev.endDate,
                    months: intern?.duration_months || prev.months,
                    cityDate: intern?.certificate_date || prev.cityDate,
                    periode: intern?.periode || prev.periode,
                    predicate: '-',
                    number: resolvedCertNumber
                }));

                setScores(emptyScores);
                setTotalScore(0);
                setAvgScore(0);
                setLetter('-');
                return false;
            }

            setMissingEvaluation(false);
            setNotice('');
            setNoticeType('');
            const payload = res.data.data || {};

            // Handle response with formData (New Structure)
            if (payload?.formData?.scores && payload?.formData?.scoreLabels) {
                const { scores: rawScores, scoreLabels } = payload.formData;
                
                // Map object to array based on keys (c1, c2, etc)
                // Assuming keys are consistent between scores and labels
                const scoreList = Object.keys(scoreLabels).map(key => ({
                    label: scoreLabels[key],
                    score: Number(rawScores[key] || 0)
                }));

                const { intern, finalScore, finalScoreLetter, predicate } = payload;

                setCertificateData(prev => ({
                    ...prev,
                    name: intern?.name || prev.name,
                    level: intern?.education_level || prev.level,
                    program: intern?.study_program || prev.program,
                    university: intern?.university || prev.university,
                    placement: intern?.division || prev.placement,
                    startDate: intern?.start_date || prev.startDate,
                    endDate: intern?.end_date || prev.endDate,
                    months: intern?.duration_months || prev.months,
                    cityDate: intern?.certificate_date || prev.cityDate,
                    periode: intern?.periode || prev.periode,
                    predicate: formatPredicate(predicate || finalScoreLetter) || prev.predicate,
                    number: resolvedCertNumber
                }));

                setScores(scoreList);
                
                const total = scoreList.reduce((acc, curr) => acc + (Number(curr.score) || 0), 0);
                setTotalScore(Number(total.toFixed(2)));
                
                setAvgScore(Number(finalScore || 0).toFixed(2));
                setLetter(finalScoreLetter || '-');

                return true;
            }

            if (payload?.user) {
                const user = payload.user || {};
                const mahasiswa = pickFirstObject(user?.mahasiswa) || {};
                const startDate = mahasiswa?.mulai_magang;
                const endDate = mahasiswa?.akhir_magang;
                const computedMonths = calcDurationMonths(startDate, endDate);

                let scoreList = [];
                if (Array.isArray(payload?.components) && payload.components.length > 0) {
                    scoreList = payload.components.map(comp => ({
                        label: comp.nama_komponen || 'Komponen Penilaian',
                        score: Number(comp.score ?? 0)
                    }));
                } else if (payload.integrity_score !== undefined) {
                    scoreList = [
                        { label: 'Integritas (etika, moral dan kesungguhan)', score: Number(payload.integrity_score ?? 0) },
                        { label: 'Ketepatan waktu dalam bekerja', score: Number(payload.punctuality_score ?? 0) },
                        { label: 'Keahlian berdasarkan bidang ilmu', score: Number(payload.expertise_score ?? 0) },
                        { label: 'Kerjasama dalam tim', score: Number(payload.teamwork_score ?? 0) },
                        { label: 'Komunikasi', score: Number(payload.communication_score ?? 0) },
                        { label: 'Penggunaan teknologi informasi', score: Number(payload.it_proficiency_score ?? 0) },
                        { label: 'Pengembangan diri', score: Number(payload.self_development_score ?? 0) }
                    ];
                } else if (masterComponents.length > 0) {
                     scoreList = masterComponents.map(c => ({
                        label: c.nama_komponen || c.name,
                        score: 0
                    }));
                } else {
                    scoreList = defaultScores;
                }

                setCertificateData(prev => ({
                    ...prev,
                    name: user?.nama_lengkap || prev.name,
                    level: mahasiswa?.jenjang_pendidikan || prev.level,
                    program: mahasiswa?.jurusan || prev.program,
                    university: mahasiswa?.universitas || prev.university,
                    placement: mahasiswa?.division || mahasiswa?.divisi || prev.placement,
                    startDate: startDate || prev.startDate,
                    endDate: endDate || prev.endDate,
                    months: computedMonths || prev.months,
                    cityDate: payload?.admin_reviewed_at || payload?.evaluation_date || payload?.updated_at || prev.cityDate,
                    periode: payload?.periode || prev.periode,
                    predicate: formatPredicate(payload?.final_score_letter) || prev.predicate,
                    number: resolvedCertNumber
                }));

                setScores(scoreList);
                const total = scoreList.reduce((acc, curr) => acc + (Number(curr.score) || 0), 0);
                const avg = payload?.total_average_score ?? payload?.final_score_numeric ?? (scoreList.length ? total / scoreList.length : 0);
                setTotalScore(Number(total.toFixed(2)));
                setAvgScore(Number(avg).toFixed(2));
                const letterValue = String(payload?.final_score_letter || '').trim().toUpperCase();
                setLetter(letterValue || (avg >= 86 ? 'A' : avg >= 71 ? 'B' : 'C'));

                return true;
            }

            const { intern, finalScore, finalScoreLetter, predicate } = payload || {};
            setCertificateData(prev => ({
                ...prev,
                name: intern?.name || prev.name,
                level: intern?.education_level || prev.level,
                program: intern?.study_program || prev.program,
                university: intern?.university || prev.university,
                placement: intern?.division || prev.placement,
                startDate: intern?.start_date || prev.startDate,
                endDate: intern?.end_date || prev.endDate,
                months: intern?.duration_months || prev.months,
                cityDate: intern?.certificate_date || prev.cityDate,
                periode: intern?.periode || prev.periode,
                predicate: formatPredicate(predicate || finalScoreLetter) || prev.predicate,
                number: resolvedCertNumber
            }));
            
            setScores(masterComponents.length > 0 
                ? masterComponents.map(c => ({ label: c.nama_komponen || c.name, score: 0 })) 
                : defaultScores
            );
            
            setTotalScore(0);
            setAvgScore(finalScore || 0);
            setLetter(finalScoreLetter || '-');

            return true;
        } catch (err) {
            console.error('Error fetching preview data', err);
            setNoticeType('error');
            setNotice('An error occurred while retrieving the certificate preview data.');
            return false;
        }
    };

    useEffect(() => {
        setCertificateData(prev => ({ ...prev, number: resolvedCertNumber }));
    }, [resolvedCertNumber]);

    useEffect(() => {
        setCertificateData(prev => ({ ...prev, signer: signerName }));
    }, [signerName]);

    useEffect(() => () => {
        if (templateUrl) URL.revokeObjectURL(templateUrl);
        if (templateBackUrl) URL.revokeObjectURL(templateBackUrl);
    }, [templateUrl, templateBackUrl]);

    const handlePreview = (file, target = 'front') => {
        if (!file) return;
        const objectUrl = URL.createObjectURL(file);
        if (target === 'back') {
            if (templateBackUrl) URL.revokeObjectURL(templateBackUrl);
            setTemplateBackUrl(objectUrl);
        } else {
            if (templateUrl) URL.revokeObjectURL(templateUrl);
            setTemplateUrl(objectUrl);
        }
        setPreviewOpen(true);

        const img = new Image();
        img.src = objectUrl;
        img.onload = () => {
            setTemplateSize({ width: img.naturalWidth, height: img.naturalHeight });
            setTemplateRatio(`${img.naturalWidth} / ${img.naturalHeight}`);
        };
    };

    const handleTemplateLoad = (event) => {
        const { naturalWidth, naturalHeight } = event.target;
        if (naturalWidth && naturalHeight) {
            setTemplateRatio(`${naturalWidth} / ${naturalHeight}`);
            setTemplateSize({ width: naturalWidth, height: naturalHeight });
        }
    };

    const parseNumbersFile = async (force = false, fileToUse = null) => {
        const activeFile = fileToUse || bulkNumbers;
        if (!force && bulkNumbersList.length > 0) return bulkNumbersList;
        if (!activeFile) return [];
        const fileName = activeFile.name.toLowerCase();

        if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
            setBulkNumbersInvalid(true);
            setNoticeType('error');
            setNotice('Only Excel files (.xlsx/.xls) are supported.');
            setBulkNumbersList([]);
            return [];
        }

        try {
            const arrayBuffer = await activeFile.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const firstSheetName = workbook.SheetNames?.[0];
            if (!firstSheetName) {
                setBulkNumbersInvalid(true);
                setNoticeType('error');
                setNotice('Excel file has no sheet.');
                setBulkNumbersList([]);
                return [];
            }

            const sheet = workbook.Sheets[firstSheetName];
            const rows = XLSX.utils.sheet_to_json(sheet, {
                header: 1,
                blankrows: false,
                defval: ''
            });

            if (rows.length > 0) {
                const hasMoreThanOneColumn = rows.some((row) => Array.isArray(row) && row.length > 1 && row.some((cell, index) => index > 0 && String(cell).trim() !== ''));
                if (hasMoreThanOneColumn) {
                    setBulkNumbersInvalid(true);
                    setNoticeType('error');
                    setNotice('Excel file must contain only 1 column.');
                    setBulkNumbersList([]);
                    return [];
                }
            }

            const cleaned = rows
                .map((row) => (Array.isArray(row) ? row[0] : row))
                .map((value) => String(value).trim())
                .filter(Boolean);

            setBulkNumbersInvalid(false);
            setBulkNumbersList(cleaned);
            return cleaned;
        } catch (error) {
            console.error('Failed to parse Excel file:', error);
            setBulkNumbersInvalid(true);
            setNoticeType('error');
            setNotice('Failed to read Excel file. Please check the format.');
            setBulkNumbersList([]);
            return [];
        }
    };

    // Fetch end dates for a list of interns and return interns ordered by end date (earliest first)
    const fetchInternsOrderedByEndDate = async (internsList = []) => {
        if (!Array.isArray(internsList) || internsList.length === 0) return [];

        const tasks = internsList.map(async (intern) => {
            try {
                let res;
                if (intern.evaluationId) {
                    res = await apiClient.get(`/admin/evaluations/${intern.evaluationId}`);
                } else {
                    res = await apiClient.get(`/admin/sertifikat/data/${intern.id}`);
                }
                const payload = res.data?.data || res.data || {};

                // Try several locations for end date
                let endRaw = null;
                if (payload?.user) {
                    const mahasiswa = pickFirstObject(payload.user.mahasiswa) || {};
                    endRaw = mahasiswa?.akhir_magang || mahasiswa?.end_date || mahasiswa?.endDate || mahasiswa?.akhirMagang;
                }
                endRaw = endRaw || payload?.intern?.end_date || payload?.end_date || payload?.endDate || payload?.akhir_magang || payload?.akhirMagang || payload?.evaluation_end_date;

                let endDate = null;
                if (endRaw) {
                    const d = new Date(endRaw);
                    if (Number.isFinite(d.getTime())) endDate = d;
                }
                return { intern, endDate };
            } catch (err) {
                return { intern, endDate: null };
            }
        });

        const settled = await Promise.all(tasks);
        settled.sort((a, b) => {
            if (a.endDate && b.endDate) return a.endDate - b.endDate;
            if (a.endDate) return -1;
            if (b.endDate) return 1;
            return 0;
        });
        return settled.map(s => s.intern);
    };

    // Keep a locally ordered copy of selected interns (earliest end date first)
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                if (!Array.isArray(selectedInterns) || selectedInterns.length === 0) {
                    if (mounted) setOrderedSelectedInterns([]);
                    return;
                }
                const ordered = await fetchInternsOrderedByEndDate(selectedInterns);
                if (!mounted) return;
                setOrderedSelectedInterns(Array.isArray(ordered) && ordered.length > 0 ? ordered : selectedInterns);
            } catch (e) {
                if (mounted) setOrderedSelectedInterns(selectedInterns);
            }
        })();
        return () => { mounted = false; };
    }, [selectedInterns]);

    // Ensure previewInternId defaults to first of ordered list when appropriate
    useEffect(() => {
        if (orderedSelectedInterns && orderedSelectedInterns.length > 0) {
            if (!previewInternId || !orderedSelectedInterns.some(i => String(i.id) === String(previewInternId))) {
                setPreviewInternId(orderedSelectedInterns[0].id);
            }
        }
    }, [orderedSelectedInterns]);

    const downloadBlob = (blob, filename) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
        window.URL.revokeObjectURL(url);
    };

    const generatePdf = async ({ userId, certNumber, imageFile, imageBackFile = null }) => {
        const fd = new FormData();
        const optimizedFront = await optimizeTemplateImage(imageFile);
        const optimizedBack = imageBackFile ? await optimizeTemplateImage(imageBackFile) : null;
        fd.append('user_id', String(userId));
        fd.append('cert_number', certNumber);
        if (optimizedFront) fd.append('background_image', optimizedFront);
        if (optimizedBack) fd.append('background_image_back', optimizedBack);
        if (signerName && signerName.trim()) fd.append('signer', signerName.trim());
        if (certificateData.signerTitle && certificateData.signerTitle.trim()) {
            fd.append('signer_title', certificateData.signerTitle.trim());
        }

        const res = await apiClient.post('/admin/sertifikat/generate', fd, { responseType: 'blob' });
        return res; // return full response so caller can read headers (e.g., content-disposition)
    };

    const generateBulkZip = async ({ userIds, certNumbersFile, imageFile, imageBackFile = null }) => {
        const fd = new FormData();
        const optimizedFront = await optimizeTemplateImage(imageFile);
        const optimizedBack = imageBackFile ? await optimizeTemplateImage(imageBackFile) : null;
        userIds.forEach((id) => fd.append('user_ids[]', String(id)));
        if (certNumbersFile) fd.append('cert_numbers_file', certNumbersFile);
        if (optimizedFront) fd.append('background_image', optimizedFront);
        if (optimizedBack) fd.append('background_image_back', optimizedBack);
        if (signerName && signerName.trim()) fd.append('signer', signerName.trim());
        if (certificateData.signerTitle && certificateData.signerTitle.trim()) {
            fd.append('signer_title', certificateData.signerTitle.trim());
        }

        const res = await apiClient.post('/admin/sertifikat/generate', fd, { responseType: 'blob' });
        return res;
    };

    const handleInlinePreview = async (mode) => {
        const file = mode === 'bulk' ? bulkTemplate : singleTemplate;
        if (!file) {
            setNoticeType('error');
            setNotice('Upload template image first to preview.');
            return;
        }
        if (mode === 'bulk') {
            if (!bulkNumbers) {
                setNoticeType('error');
                setNotice('Please upload a certificate numbers file first.');
                return;
            }
            const numbers = await parseNumbersFile(true);
            // Use locally-ordered selected interns (if available) for preview numbering
            const ordered = orderedSelectedInterns.length ? orderedSelectedInterns : await fetchInternsOrderedByEndDate(selectedInterns);
            const idx = ordered.findIndex(i => String(i.id) === String(previewInternId));
            const certNumber = numbers[idx] || '';
            setCertificateData(prev => ({ ...prev, number: certNumber }));
        }
        handlePreview(file, 'front');
        // If a back template exists for single mode, preview it too
        if (mode === 'bulk') {
            if (bulkTemplateBack) handlePreview(bulkTemplateBack, 'back');
        } else {
            if (singleTemplateBack) handlePreview(singleTemplateBack, 'back');
        }
    };

    const handleGenerateSinglePdf = async () => {
        try {
            if (!previewInternId) {
                setNoticeType('error');
                setNotice('Please select an intern first.');
                return;
            }
            const isMissingSelected = missingSelected?.some(m => String(m.id) === String(previewInternId));
            if (isMissingSelected) {
                setNoticeType('error');
                setNotice('Cannot generate PDF: final evaluation is not finished for this intern.');
                return;
            }
            const current = selectedInterns.find(i => String(i.id) === String(previewInternId));
            const ok = await fetchCertificateData({ userId: previewInternId, evaluationId: current?.evaluationId });
            if (!ok) {
                setNoticeType('error');
                setNotice('Cannot generate PDF: final evaluation not found for this intern.');
                return;
            }
            if (!singleTemplate) {
                setNoticeType('error');
                setNotice('Please upload a template image first or wait for the default template to load.');
                return;
            }
            if (!singleNumber || !singleNumber.trim()) {
                setNoticeType('error');
                setNotice('Please enter the certificate number first.');
                return;
            }
            setIsGenerating(true);
            const res = await generatePdf({ userId: previewInternId, certNumber: singleNumber.trim(), imageFile: singleTemplate, imageBackFile: singleTemplateBack });
            const blob = res?.data;

            // Try to extract filename from Content-Disposition header
            let filename = `sertifikat_${previewInternId}.pdf`;
            const cd = (res?.headers && (res.headers['content-disposition'] || res.headers['Content-Disposition'])) || '';
            const fnStar = cd.match(/filename\*=UTF-8''([^;\n]+)/i);
            const fn = cd.match(/filename="?([^";\n]+)"?/i);
            if (fnStar && fnStar[1]) filename = decodeURIComponent(fnStar[1]);
            else if (fn && fn[1]) filename = fn[1];

            downloadBlob(blob, filename);
            setNoticeType('success');
            setNotice('Certificate PDF downloaded successfully.');
        } catch (err) {
            console.error('Generate PDF error', err);
            setNoticeType('error');
            setNotice('Failed to generate certificate PDF.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGenerateBulkPdf = async () => {
        try {
            if (!bulkTemplate) {
                setNoticeType('error');
                setNotice('Please upload a template image first.');
                return;
            }
            if (!bulkNumbers) {
                setNoticeType('error');
                setNotice('Please upload a certificate numbers file (Excel) for bulk.');
                return;
            }
            if (bulkNumbersInvalid) {
                setNoticeType('error');
                setNotice('Excel file is invalid.');
                return;
            }
            setIsGenerating(true);
            const missingIdSet = new Set((missingSelected || []).map(m => String(m.id)));
            const indexedSelected = selectedInterns.map((intern, idx) => ({ intern, idx }));
            const filteredSelected = indexedSelected.filter(({ intern }) => !missingIdSet.has(String(intern.id)));
            // Order filtered selected interns by internship end date (earliest finish first)
            const filteredInterns = filteredSelected.map(({ intern }) => intern);
            const orderedFiltered = await fetchInternsOrderedByEndDate(filteredInterns);
            const userIds = orderedFiltered.map(i => i.id).filter(Boolean);
            if (userIds.length === 0) {
                setNoticeType('error');
                setNotice('All selected interns are missing final evaluation.');
                return;
            }
            const numbers = await parseNumbersFile(true);
            if (numbers.length < orderedFiltered.length) {
                setNoticeType('error');
                setNotice('Excel rows are fewer than selected interns. Please provide one certificate number per intern.');
                return;
            }
            const filteredNumbers = numbers.slice(0, orderedFiltered.length);
            const hasEmptyNumbers = filteredNumbers.some(num => !String(num).trim());
            if (hasEmptyNumbers) {
                setNoticeType('error');
                setNotice('Some certificate numbers are empty. Please check your Excel file.');
                return;
            }
            const filteredCsv = filteredNumbers.join('\n');
            const filteredNumbersFile = new File([filteredCsv], 'cert_numbers_filtered.csv', { type: 'text/csv' });

            const res = await generateBulkZip({
                userIds,
                certNumbersFile: filteredNumbersFile,
                imageFile: bulkTemplate,
                imageBackFile: bulkTemplateBack
            });

            const blob = res?.data;
            const contentType = res?.headers?.['content-type'] || blob?.type || '';
            if (contentType.includes('application/json') || contentType.includes('text/plain')) {
                const text = await blob.text();
                let message = 'Failed to generate bulk PDFs.';
                try {
                    const parsed = JSON.parse(text);
                    message = parsed?.message || parsed?.error || message;
                } catch {
                    if (text?.trim()) message = text.trim();
                }
                setNoticeType('error');
                setNotice(message);
                return;
            }

            downloadBlob(blob, 'certificates_bulk.zip');
            setNoticeType('success');
            setNotice('Bulk certificates ZIP downloaded successfully.');
        } catch (err) {
            console.error('Generate bulk PDF error', err);
            setNoticeType('error');
            setNotice('Failed to generate bulk PDFs.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="min-h-screen -mt-8 bg-slate-50 p-4 md:p-8 text-slate-800 -ml-5 -mr-8">
            
            {/* Header Area: Button Back + Title aligned */}
            <div className="flex items-center gap-5 mb-8">
                {/* Back Button matching image reference */}
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center justify-center w-[46px] h-[46px] bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm group"
                >
                    <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        width="24" 
                        height="24" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        className="text-slate-600 group-hover:text-slate-900"
                    >
                        <path d="M19 12H5"/>
                        <path d="M12 19l-7-7 7-7"/>
                    </svg>
                </button>

                <div >
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-900 leading-tight">Generate Certificate</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Upload a template and view the certificate preview before generating.
                        {fromFinalEvaluation && (
                            <span className="ml-3 inline-block text-xs bg-yellow-50 border border-yellow-200 text-yellow-700 px-2 py-0.5 rounded">Using Final Evaluation data</span>
                        )}
                    </p>
                </div>
            </div>

            {notice && (
                <div className={`mb-6 px-4 py-3 rounded-xl text-sm border ${noticeType === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                    {notice}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 -mt-2">
                <div className="lg:col-span-1 space-y-6 ">
                    {/* SINGLE GENERATE PANEL */}
                    {!isBulk && (
                        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                            <h2 className="text-[18px] font-bold text-slate-800 mb-4">Generate 1 Certificate</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Certificate Number</label>
                                    <input type="text" value={singleNumber} onChange={(e) => setSingleNumber(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#354C8F]" placeholder="Example: 086/SIER-SF/DK.2/VIII/2025" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Division Head Name</label>
                                    <input type="text" value={signerName} onChange={(e) => setSignerName(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#354C8F]" placeholder="Fitrina Kusuma Dewi" />
                                </div>
                                <div className="flex gap-3">
                                    <button className="w-full py-2.5 rounded-xl bg-[#354C8F] text-white font-semibold text-sm hover:bg-[#2a3c70] disabled:opacity-60" disabled={!singleTemplate || !singleNumber.trim() || isGenerating} onClick={handleGenerateSinglePdf}>
                                        {isGenerating ? 'Generating...' : 'Download'}
                                    </button>
                                </div>
                                {!singleTemplate && <p className="text-xs text-center text-slate-400">Loading default template...</p>}
                            </div>
                        </div>
                    )}

                    {/* BULK GENERATE PANEL */}
                    {isBulk && (
                        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                            <p className="text-[18px] font-bold text-slate-800 mb-4">Generate Multiple Certificates</p>
                            <div className="space-y-4">
                               
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Certificate Numbers File (Excel)</label>
                                    <input type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={async (e) => { const file = e.target.files?.[0] || null; setBulkNumbers(file); setBulkNumbersList([]); if (file) await parseNumbersFile(true, file); }} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Division Head Name</label>
                                    <input type="text" value={signerName} onChange={(e) => setSignerName(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#354C8F]" />
                                </div>
                                <div className="flex gap-3">
                                    {/* <button className="w-full py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 disabled:opacity-50" disabled={!bulkTemplate || bulkNumbersInvalid} onClick={() => handleInlinePreview('bulk')}>Preview</button> */}
                                    <button className="w-full py-2.5 rounded-xl bg-[#354C8F] text-white font-semibold text-sm hover:bg-[#2a3c70] disabled:opacity-60" disabled={!bulkTemplate || !bulkNumbers || bulkNumbersInvalid || isGenerating} onClick={handleGenerateBulkPdf}>{isGenerating ? 'Generating...' : 'Download All'}</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {orderedSelectedInterns.length > 0 && (
                        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                            <h3 className="text-sm font-bold text-slate-700 mb-1">Selected Interns (for preview only)</h3>
                            <p className="text-xs text-slate-500 mb-3">These selected interns are used only for certificate preview.</p>
                            
                            <div className="max-h-40 overflow-y-auto border border-slate-100 rounded-xl p-2 text-sm">
                                {orderedSelectedInterns.map((i) => {
                                    const isMissing = missingSelected?.some(m => String(m.id) === String(i.id));
                                    return (
                                        <label key={i.id ?? i.name} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-50 cursor-pointer">
                                            <input type="radio" name="previewIntern" checked={String(previewInternId) === String(i.id)} onChange={() => setPreviewInternId(i.id)} className="text-[#354C8F] focus:ring-[#354C8F]" />
                                            <span className="text-slate-700">{i.name}</span>
                                            {isMissing && <span className="ml-auto text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-semibold">Missing eval</span>}
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                                    <div className="mt-2">
                                        <button type="button" onClick={() => setShowNumberInfo(prev => !prev)} className="text-xs text-[#354C8F] font-semibold hover:underline">
                                            {showNumberInfo ? 'Hide Excel format info' : 'Excel format info'}
                                        </button>
                                        {showNumberInfo && (
                                            <div className="mt-2 text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-md p-3">
                                                <p className="mb-1">Excel format requirements (for bulk import):</p>
                                                <ul className="list-disc pl-4">
                                                    <li>No header row — first row should be certificate number data.</li>
                                                    <li>Single column only (one certificate number per row).</li>
                                                    <li>Each row should contain exactly one certificate number (no extra columns).</li>
                                                    <li>Save as <strong>.xlsx</strong> or <strong>.xls</strong> and upload via the "Certificate Numbers File" input.</li>
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                </div>

                <div className={`lg:col-span-2 space-y-6 ${previewExpanded ? 'fixed inset-4 z-50 bg-slate-50 p-4 overflow-auto rounded-2xl shadow-2xl' : ''}`}>
                    {/* FRONT PAGE PREVIEW */}
                    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Front Page</h3>
                            <button onClick={() => setPreviewExpanded((prev) => !prev)} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">{previewExpanded ? 'Minimize' : 'Expand'}</button>
                        </div>
                        <div className="border border-slate-200 rounded-2xl overflow-hidden relative w-full mx-auto bg-slate-100" ref={previewContainerRef} style={{ aspectRatio: templateRatio !== 'auto' ? templateRatio.replace(' / ', '/') : 'auto', maxWidth: '100%' }}>
                            {previewOpen && templateUrl ? (
                                <img src={templateUrl} alt="Template" className="absolute inset-0 w-full h-full object-contain z-0" onLoad={handleTemplateLoad} />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-slate-400">Loading template...</div>
                            )}
                            
                            {/* OVERLAY KONTEN DEPAN */}
                            {previewOpen && (
                                <div className="absolute inset-0 z-10 pointer-events-none origin-top-left" style={{ transform: `scale(${previewScale})`, width: `${templateSize.width || 2000}px`, height: `${templateSize.height || 1414}px` }}>
                                    <div className="absolute inset-0 p-[4%] flex flex-col items-center text-center">
                                        <div className="mt-[7%]">
                                            <p className="font-serif font-bold text-slate-900 tracking-widest leading-none text-9lg md:text-[250px]" style={{ fontSize: '100px' }}>SERTIFIKAT</p>
                                            <p className="text-slate-600 mt-2" style={{ fontSize: '24px' }}>Nomor: {certificateData.number}</p>
                                        </div>
                                        <div className="mt-[2%] space-y-6 w-[80%]">
                                            <p className="text-slate-600" style={{ fontSize: '28px' }}>Sertifikat ini diberikan kepada</p>
                                            <h2 className="font-bold font-sans uppercase tracking-wide" style={{ fontSize: '70px', color: '#C5A365' }}>{certificateData.name}</h2>
                                            <p className="font-bold text-slate-800" style={{ fontSize: '32px' }}>{certificateData.level} {certificateData.program} – {certificateData.university}</p>
                                            <p className="text-slate-700 leading-relaxed mt-8" style={{ fontSize: '28px' }}>
                                                Telah Mengikuti <b>Program Magang Bersertifikat PT Surabaya Industrial Estate Rungkut</b><br />
                                                Selama {certificateData.months || '-'} {certificateData.months ? `(${formatMonthsWord(certificateData.months)})` : ''} Bulan ({periodLabel}) dengan Predikat:
                                            </p>
                                            <p className="font-bold italic mt-4 font-serif" style={{ fontSize: '48px', color: '#C5A365' }}>“{certificateData.predicate}”</p>
                                        </div>
                                        <div className="mt-8 w-full flex flex-col items-center pb-[5%]">
                                            <p className="text-slate-700 mb-12" style={{ fontSize: '24px' }}>Surabaya, {formatDate(certificateData.cityDate)}<br />{certificateData.company}</p>
                                            <div className="flex flex-col items-center">
                                                <div className="mb-4 flex items-center justify-center " style={{ width: '150px', height: '150px', fontSize: '20px' }}></div>
                                                <p className="font-bold text-slate-900 border-b-2 border-slate-900 pb-2 mb-2 min-w-[400px]" style={{ fontSize: '28px' }}>{certificateData.signer}</p>
                                                <p className="text-slate-600 italic" style={{ fontSize: '24px' }}>{certificateData.signerTitle}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* BACK PAGE PREVIEW (TRANSCRIPT) */}
                    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-400 mb-4 uppercase tracking-wider">Back Page (Transcript)</h3>
                        <div className="border border-slate-200 rounded-2xl overflow-hidden relative w-full mx-auto bg-white" style={{ aspectRatio: templateRatio !== 'auto' ? templateRatio.replace(' / ', '/') : 'auto', maxWidth: '100%', minHeight: previewOpen ? 'auto' : '320px' }}>
                            {previewOpen && (templateBackUrl || templateUrl) && (
                                <img src={templateBackUrl || templateUrl} alt="Template" className="absolute inset-0 w-full h-full object-contain z-0" />
                            )}
                            
                            {/* OVERLAY KONTEN BELAKANG */}
                            {previewOpen && (
                                <div className="absolute inset-0 z-10 origin-top-left bg-transparent" style={{ transform: `scale(${previewScale})`, width: `${templateSize.width || 2000}px`, height: `${templateSize.height || 1414}px` }}>
                                    <div className="absolute inset-0 p-[6%]">
                                        <div className="mx-auto w-full max-w-[82%] mt-20">
                                            <div className="grid grid-cols-[250px_1fr_250px_1fr] gap-x-8 gap-y-4 text-slate-800 mb-16 w-full" style={{ fontSize: '24px' }}>
                                                <div className="font-bold">Nama</div><div>: {certificateData.name}</div>
                                                <div className="font-bold">Periode Magang</div><div>: {periodLabel}</div>
                                                <div className="font-bold">Institusi</div><div>: {certificateData.university}</div>
                                                <div className="font-bold">Divisi</div><div>: {certificateData.placement}</div>
                                            </div>

                                            <div className="border-2 border-black mb-12 ">
                                                <table className="w-full text-slate-900" style={{ fontSize: '24px', borderCollapse: 'collapse' }}>
                                                    <thead>
                                                        <tr className="border-b-2 border-black">
                                                            <th className="py-4 px-6 text-center w-24 border-r-2 border-black" rowSpan={2}>No.</th>
                                                            <th className="py-4 px-6 text-center border-r-2 border-black" rowSpan={2}>Komponen</th>
                                                            <th className="py-2 px-6 text-center border-b-2 border-black" colSpan={2}>Daftar Nilai</th>
                                                        </tr>
                                                        <tr className="border-b-2 border-black">
                                                            <th className="py-2 px-6 text-center w-40 border-r-2 border-black">Angka</th>
                                                            <th className="py-2 px-6 text-center w-48">Huruf</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {scores.map((item, index) => (
                                                            <tr key={index} className="border-b border-black">
                                                                <td className="py-3 px-6 text-center border-r-2 border-black">{index + 1}</td>
                                                                <td className="py-3 px-6 border-r-2 border-black">{item.label}</td>
                                                                <td className="py-3 px-6 text-center border-r-2 border-black">{item.score}</td>
                                                                <td className="py-3 px-6 text-center">{formatScoreLetter(item.score)}</td>
                                                            </tr>
                                                        ))}
                                                        <tr className="font-bold border-t-2 border-black">
                                                            <td className="py-4 px-6 text-center border-r-2 border-black" colSpan={2}>Total Nilai Mentor</td>
                                                            <td className="py-4 px-6 text-center border-r-2 border-black">{totalScore}</td>
                                                            <td className="py-4 px-6 text-center"></td>
                                                        </tr>
                                                        <tr className="font-bold border-t-2 border-black">
                                                            <td className="py-4 px-6 text-center border-r-2 border-black" colSpan={2}>Rata-rata</td>
                                                            <td className="py-4 px-6 text-center border-r-2 border-black">{avgScore}</td>
                                                            <td className="py-4 px-6 text-center">{letter}</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>

                                            <div className="text-slate-800 max-w-2xl -mt-3" style={{ fontSize: '20px' }}>
                                                <div className="font-bold mb-4">Kriteria Nilai:</div>
                                                <table className="w-full border-2 border-black text-center" style={{ borderCollapse: 'collapse' }}>
                                                    <thead>
                                                        <tr className="border-b-2 border-black">
                                                            <th className="py-2 px-4 border-r-2 border-black">Rentang Nilai</th>
                                                            <th className="py-2 px-4 border-r-2 border-black">Keterangan</th>
                                                            <th className="py-2 px-4">Norma</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        <tr className="border-b border-black"><td className="py-2 px-4 border-r-2 border-black">86 - 100</td><td className="py-2 px-4 border-r-2 border-black">Sangat Memuaskan</td><td className="py-2 px-4">A</td></tr>
                                                        <tr className="border-b border-black"><td className="py-2 px-4 border-r-2 border-black">71 - 85</td><td className="py-2 px-4 border-r-2 border-black">Memuaskan</td><td className="py-2 px-4">B</td></tr>
                                                        <tr><td className="py-2 px-4 border-r-2 border-black">0 - 70</td><td className="py-2 px-4 border-r-2 border-black">Cukup Memuaskan</td><td className="py-2 px-4">C</td></tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GenerateSertif;