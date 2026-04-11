import React, { useEffect, useState } from "react";
import { fetchSecureRawBlob } from '../../utils/secureFetch';
import { pdfjs, Document, Page } from 'react-pdf';
import { Loader2, AlertCircle, Download, X, FileText, Image as ImageIcon, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useParams, useLocation } from "react-router-dom";
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const FileViewer = () => {
  const { id, index } = useParams();
  const location = useLocation();

  const query = new URLSearchParams(location.search);
  const urlParam = query.get("url");
  const nameParam = query.get("name");

  const [fileUrl, setFileUrl] = useState(null);
  const [mimeType, setMimeType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
    setLoading(false);
  }

  const isIzin = location.pathname.includes("/izin/");
  const isKoreksi = location.pathname.includes("/koreksi/");
  const endpoint = urlParam
    ? urlParam
    : (isIzin
        ? `/izin/view-lampiran/${id}/${index}`
        : `/koreksi/view-lampiran/${id}/${index}`);

  const title = urlParam ? "Lampiran Logbook" : (isIzin ? "Lampiran Izin" : "Lampiran Koreksi");

  useEffect(() => {
    let objectUrl;
    const fetchFile = async () => {
      try {
        const blob = await fetchSecureRawBlob(endpoint);
        if (!blob) {
          setError(true);
          setLoading(false);
          return;
        }

        let contentType = blob.type;
        const isPdfName = String(nameParam || endpoint).toLowerCase().endsWith('.pdf');
        
        // Force PDF type if filename indicates PDF
        if (isPdfName) {
           contentType = 'application/pdf';
        }

        const typedBlob = new Blob([blob], { type: contentType });
        setMimeType(contentType);
        objectUrl = URL.createObjectURL(typedBlob);
        setFileUrl(objectUrl);
      } catch (err) {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchFile();
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [endpoint]);

  /* ================= LOADING ================= */
  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 gap-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-slate-200 border-t-[#354C8F] rounded-full animate-spin"></div>
        </div>
        <p className="text-slate-500 font-medium animate-pulse">Memuat dokumen...</p>
      </div>
    );
  }

  /* ================= ERROR ================= */
  if (error || !fileUrl) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 px-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 text-center max-w-md w-full">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="text-red-500" size={40} strokeWidth={2} />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Gagal Memuat File</h3>
          <p className="text-slate-500 text-sm mb-8 leading-relaxed">
            File tidak ditemukan atau Anda tidak memiliki akses.
          </p>
          <button onClick={() => window.close()} className="w-full bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-xl font-bold text-sm transition-all active:scale-95">
            Tutup Tab
          </button>
        </div>
      </div>
    );
  }

  /* ================= UI VIEWER ================= */
  return (
    <div className="h-screen w-full bg-[#0F172A] flex flex-col overflow-hidden">
      
      {/* HEADER TOOLBAR */}
      <header className="h-16 bg-white/5 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-6 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-400">
            {mimeType.includes("pdf") ? <FileText size={18} /> : <ImageIcon size={18} />}
          </div>
          <div className="hidden sm:block">
            <h1 className="text-slate-200 font-bold text-sm md:text-base">{title}</h1>
            <p className="text-slate-400 text-xs">
              {mimeType.includes("pdf") ? "Dokumen PDF" : "Gambar Lampiran"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Tombol Download */}
          <a
            href={fileUrl}
            download={nameParam || `Lampiran-${title}-${Number(index ?? 0) + 1}`}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-blue-900/20"
          >
            <Download size={16} />
            <span className="hidden sm:inline">Download</span>
          </a>

          <div className="h-6 w-px bg-white/10 mx-1"></div>

          {/* PERBAIKAN: Tombol Tutup dengan Label Teks agar Jelas */}
          <button
            onClick={() => window.close()}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg text-sm font-medium transition-colors border border-red-500/20"
            title="Tutup Halaman ini"
          >
            <X size={16} />
            <span>Tutup</span>
          </button>
        </div>
      </header>

      {/* CONTENT AREA */}
      <main className="flex-1 overflow-auto relative flex flex-col items-center p-4 md:p-8">
        <div className="w-full max-w-6xl mx-auto bg-white/5 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-sm overflow-hidden flex flex-col flex-shrink-0 min-h-0">
          {mimeType.includes("pdf") ? (
            <div className="flex flex-col items-center justify-start p-4 bg-slate-500/10 h-full overflow-auto">
              <Document
                file={fileUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={
                  <div className="flex flex-col items-center gap-2 mt-20">
                    <Loader2 className="animate-spin text-blue-400" size={32} />
                    <p className="text-white text-sm">Loading PDF...</p>
                  </div>
                }
                error={
                  <div className="text-red-400 font-medium mt-20">
                    Failed to load PDF. Please try downloading.
                  </div>
                }
                className="shadow-2xl my-auto"
              >
                <Page 
                  pageNumber={pageNumber} 
                  renderTextLayer={false} 
                  renderAnnotationLayer={false}
                  className="max-w-full" 
                  scale={1.2}
                />
              </Document>

              {numPages && (
                <div className="fixed bottom-8 bg-slate-900/80 backdrop-blur-md px-6 py-3 rounded-full flex items-center gap-4 text-white shadow-xl z-50 border border-white/10">
                  <button
                    disabled={pageNumber <= 1}
                    onClick={() => setPageNumber(prev => Math.max(1, prev - 1))}
                    className="hover:text-blue-400 disabled:opacity-30 disabled:hover:text-white transition-colors"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <span className="font-medium font-mono text-sm">
                    Page {pageNumber} of {numPages}
                  </span>
                  <button
                    disabled={pageNumber >= numPages}
                    onClick={() => setPageNumber(prev => Math.min(numPages, prev + 1))}
                    className="hover:text-blue-400 disabled:opacity-30 disabled:hover:text-white transition-colors"
                  >
                    <ChevronRight size={24} />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-start bg-[#020617]/50 p-4 overflow-auto">
              <img
                src={fileUrl}
                alt="Preview Lampiran"
                className="max-w-full h-auto object-contain rounded-lg shadow-lg my-auto"
                style={{ maxHeight: "calc(100vh - 120px)" }}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default FileViewer;