import React, { useRef } from 'react';
import { FeedbackMode } from '../types';

interface UploadSectionProps {
  imageSrc: string | null;
  rotation: number;
  grade: string;
  feedbackMode: FeedbackMode;
  studentNote: string;
  isAnalyzing: boolean;
  onImageSelected: (src: string) => void;
  onRotate: (deg: number) => void;
  onClearImage: () => void;
  onGradeChange: (grade: string) => void;
  onModeChange: (mode: FeedbackMode) => void;
  onNoteChange: (note: string) => void;
  onStartAnalysis: () => void;
}

export const UploadSection: React.FC<UploadSectionProps> = ({
  imageSrc,
  rotation,
  grade,
  feedbackMode,
  studentNote,
  isAnalyzing,
  onImageSelected,
  onRotate,
  onClearImage,
  onGradeChange,
  onModeChange,
  onNoteChange,
  onStartAnalysis,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onImageSelected(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onImageSelected(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-800 text-xs font-bold flex items-center justify-center">
            1
          </span>
          Ảnh chụp bài làm của học sinh
        </h2>
        {imageSrc ? (
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            Đã có ảnh
          </span>
        ) : (
          <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
            Chưa có ảnh
          </span>
        )}
      </div>

      {/* DROP ZONE */}
      <div
        onClick={() => !imageSrc && fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl transition min-h-[250px] flex flex-col items-center justify-center p-4 text-center ${
          imageSrc
            ? 'border-slate-200 bg-slate-900/5'
            : 'border-slate-300 hover:border-indigo-500 bg-slate-50/70 cursor-pointer'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {!imageSrc ? (
          <div className="flex flex-col items-center max-w-xs">
            <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-700">Kéo thả ảnh bài làm vào đây</p>
            <p className="text-xs text-slate-500 mt-1">
              hoặc <span className="text-indigo-700 font-semibold underline">bấm để chọn ảnh</span> từ máy
            </p>
            <p className="text-[11px] text-slate-400 mt-3">
              Có thể chọn nhanh 3 bài mẫu trên thanh tiêu đề để thử ngay
            </p>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center">
            <div className="w-full h-[250px] sm:h-[270px] bg-white rounded-lg overflow-hidden flex items-center justify-center p-2 border border-slate-200">
              <img
                src={imageSrc}
                alt="Bài làm"
                className="max-h-full max-w-full object-contain rounded transition-transform duration-300 shadow-xs"
                style={{ transform: `rotate(${rotation}deg)` }}
              />
            </div>

            {/* ACTION BUTTONS */}
            <div
              className="w-full flex items-center justify-between gap-2 mt-3 pt-2 border-t border-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onRotate(-90)}
                  className="px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg flex items-center gap-1 transition"
                  title="Xoay trái 90 độ"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                  </svg>
                  Xoay trái
                </button>
                <button
                  type="button"
                  onClick={() => onRotate(90)}
                  className="px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg flex items-center gap-1 transition"
                  title="Xoay phải 90 độ"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
                  </svg>
                  Xoay phải
                </button>
              </div>

              <button
                type="button"
                onClick={onClearImage}
                className="px-2.5 py-1.5 text-xs font-medium bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 rounded-lg flex items-center gap-1 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
                Xóa ảnh
              </button>
            </div>
          </div>
        )}
      </div>

      {/* OPTIONS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="grade-select-react" className="block text-xs font-semibold text-slate-700 mb-1.5">
            Chương trình lớp
          </label>
          <select
            id="grade-select-react"
            value={grade}
            onChange={(e) => onGradeChange(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="Toán 6">Toán 6 (GDPT 2018)</option>
            <option value="Toán 7">Toán 7 (GDPT 2018)</option>
            <option value="Toán 8">Toán 8 (GDPT 2018)</option>
            <option value="Toán 9">Toán 9 (GDPT 2018)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Chế độ phản hồi của AI</label>
          <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => onModeChange('hint')}
              className={`py-1.5 px-2 text-xs font-semibold rounded-lg transition ${
                feedbackMode === 'hint'
                  ? 'bg-white text-indigo-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Gợi ý tự sửa
            </button>
            <button
              type="button"
              onClick={() => onModeChange('detail')}
              className={`py-1.5 px-2 text-xs font-semibold rounded-lg transition ${
                feedbackMode === 'detail'
                  ? 'bg-white text-indigo-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Lời giải chi tiết
            </button>
          </div>
        </div>
      </div>

      {/* NOTE */}
      <div>
        <label htmlFor="note-react" className="block text-xs font-semibold text-slate-700 mb-1.5">
          Ghi chú thêm cho trợ giảng <span className="font-normal text-slate-400">(không bắt buộc)</span>
        </label>
        <input
          id="note-react"
          type="text"
          value={studentNote}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Ví dụ: Em bị vướng ở bước quy đồng / Thầy cô kiểm tra giúp em dấu..."
          className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* ANALYZE BUTTON */}
      <button
        type="button"
        disabled={isAnalyzing}
        onClick={onStartAnalysis}
        className={`w-full py-3 px-4 rounded-xl font-semibold text-sm shadow-md transition flex items-center justify-center gap-2 ${
          isAnalyzing
            ? 'bg-indigo-300 text-white cursor-not-allowed'
            : 'bg-indigo-900 hover:bg-indigo-800 active:scale-[0.99] text-white shadow-indigo-900/15'
        }`}
      >
        {isAnalyzing ? (
          <>
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            <span>Agent đang phân tích bài làm...</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
            </svg>
            <span>Kiểm tra bài làm ngay</span>
          </>
        )}
      </button>
    </section>
  );
};
