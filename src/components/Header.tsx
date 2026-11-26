import React from 'react';

interface HeaderProps {
  onOpenKnowledgeModal: () => void;
  onSelectSample: (sampleId: 'sample1' | 'sample2' | 'sample3') => void;
  activeSampleId: string | null;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenKnowledgeModal,
  onSelectSample,
  activeSampleId,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        {/* LOGO & TITLE */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-900 text-white flex items-center justify-center shadow-xs shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Trợ Giảng AI — Kiểm Tra Bài Làm Qua Ảnh
              </h1>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200">
                Agent 2.5
              </span>
            </div>
            <p className="text-xs text-slate-500">Chấm chữa từng bước theo chương trình GDPT 2018 (Lớp 6–9)</p>
          </div>
        </div>

        {/* CÁC NÚT ĐIỀU KHIỂN & NÚT CẤU HÌNH AGENT */}
        <div className="flex flex-wrap items-center gap-2">
          {/* NÚT XEM / CHỈNH SỬA KỸ NĂNG & TÍNH CÁCH AGENT (YÊU CẦU ĐẶC BIỆT CỦA BÀI TOÁN) */}
          <button
            type="button"
            onClick={onOpenKnowledgeModal}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-indigo-900 to-indigo-800 text-white hover:from-indigo-800 hover:to-indigo-700 shadow-sm shadow-indigo-900/20 transition flex items-center gap-1.5 border border-indigo-700"
          >
            <svg className="w-4 h-4 text-indigo-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
            </svg>
            <span>Xem / Chỉnh sửa Kỹ năng & Tính cách Agent</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          </button>

          <span className="h-4 w-[1px] bg-slate-300 mx-1 hidden sm:inline-block"></span>

          {/* 3 BÀI MẪU THỬ NHANH */}
          <button
            type="button"
            onClick={() => onSelectSample('sample1')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition flex items-center gap-1.5 ${
              activeSampleId === 'sample1'
                ? 'bg-indigo-900 text-white border-indigo-900'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-900'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            Bài 1: Quên ĐKXĐ
          </button>

          <button
            type="button"
            onClick={() => onSelectSample('sample2')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition flex items-center gap-1.5 ${
              activeSampleId === 'sample2'
                ? 'bg-indigo-900 text-white border-indigo-900'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-900'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Bài 2: Sai dấu căn thức
          </button>

          <button
            type="button"
            onClick={() => onSelectSample('sample3')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition flex items-center gap-1.5 ${
              activeSampleId === 'sample3'
                ? 'bg-indigo-900 text-white border-indigo-900'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-900'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Bài 3: Hệ PT đúng 100%
          </button>
        </div>
      </div>
    </header>
  );
};
