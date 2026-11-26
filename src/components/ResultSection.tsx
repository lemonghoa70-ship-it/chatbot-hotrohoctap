import React, { useEffect, useRef, useState } from 'react';
import { AnalysisResult, FeedbackMode, ChatMessage } from '../types';

declare global {
  interface Window {
    renderMathInElement?: (el: HTMLElement, opts: any) => void;
  }
}

interface ResultSectionProps {
  analysisResult: AnalysisResult | null;
  feedbackMode: FeedbackMode;
  isAnalyzing: boolean;
  chatMessages: ChatMessage[];
  onToggleMode: () => void;
  onReset: () => void;
  onSendChatMessage: (text: string) => void;
}

export const ResultSection: React.FC<ResultSectionProps> = ({
  analysisResult,
  feedbackMode,
  isAnalyzing,
  chatMessages,
  onToggleMode,
  onReset,
  onSendChatMessage,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [chatInput, setChatInput] = useState('');

  // Tự động render KaTeX khi có kết quả mới hoặc tin nhắn mới
  useEffect(() => {
    if (containerRef.current && typeof window.renderMathInElement === 'function') {
      window.renderMathInElement(containerRef.current, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
        ],
        throwOnError: false,
      });
    }
  }, [analysisResult, chatMessages, feedbackMode]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [chatMessages, isAnalyzing, analysisResult]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendChatMessage(chatInput.trim());
    setChatInput('');
  };

  const isHint = feedbackMode === 'hint';

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col min-h-[600px] max-h-[82vh] overflow-hidden">
      {/* HEADER */}
      <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-indigo-900 text-white flex items-center justify-center text-xs font-bold">
            AI
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">Nhận xét & Hướng dẫn của Trợ Giảng</h2>
            <p className="text-xs text-indigo-700 font-medium">
              Đang bật: {isHint ? 'Chế độ Gợi ý tự sửa (Sư phạm)' : 'Chế độ Xem lời giải chi tiết'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-slate-500 hover:text-slate-800 px-2.5 py-1 rounded-lg hover:bg-slate-200/60 transition"
        >
          Làm mới
        </button>
      </div>

      {/* CHAT / RESULT CONTAINER */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/30">
        {!analysisResult && !isAnalyzing && (
          <div className="h-full flex flex-col items-center justify-center text-center py-10 px-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-800 flex items-center justify-center mb-4 border border-indigo-100">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-800">Sẵn sàng kiểm tra bài làm của em!</h3>
            <p className="text-sm text-slate-500 max-w-md mt-1.5 leading-relaxed">
              Tải ảnh chụp vở bài tập ở cột bên trái hoặc chọn nhanh <strong>Bài 1, Bài 2, Bài 3</strong> ở thanh Header, sau đó bấm <strong>"Kiểm tra bài làm ngay"</strong>.
            </p>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full max-w-lg text-left">
              <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
                <p className="text-xs font-bold text-indigo-900">1. OCR & LaTeX</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Chuẩn hóa đề bài và từng dòng bài làm.</p>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
                <p className="text-xs font-bold text-emerald-700">2. Soi lỗi GDPT 2018</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Tìm chính xác dòng sai đầu tiên & nguyên nhân.</p>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
                <p className="text-xs font-bold text-amber-700">3. Gợi mở sư phạm</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Đặt câu hỏi hướng dẫn tự sửa hoặc đáp án mẫu.</p>
              </div>
            </div>
          </div>
        )}

        {/* LOADING ANIMATION */}
        {isAnalyzing && (
          <div className="bg-white rounded-2xl border border-indigo-100 p-4 shadow-xs space-y-3 animate-pulse">
            <div className="flex items-center gap-2 text-sm font-bold text-indigo-900">
              <svg className="w-5 h-5 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              <span>Agent Trợ Giảng AI đang phân tích bài làm từ ảnh...</span>
            </div>
            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping"></span>
                <span>Kỹ năng 1: Nhận diện chữ viết tay & chuẩn hóa ký hiệu LaTeX...</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                <span>Kỹ năng 2: Đối chiếu chuỗi tương đương từng bước theo GDPT 2018...</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-300"></span>
                <span>Tính cách: Tổng hợp nhận xét khen ngợi và gợi mở sư phạm...</span>
              </div>
            </div>
          </div>
        )}

        {/* ANALYSIS RESULTS (4 THẺ KẾT QUẢ) */}
        {analysisResult && (
          <div className="space-y-4">
            {/* THÔNG BÁO NÂNG CẤP MODEL (NẾU CÓ BÀI HÌNH PHỨC TẠP) */}
            {analysisResult.suggested_model_upgrade && (
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900 flex items-center justify-between">
                <span>🤖 Đề xuất: Bài toán này có yếu tố hình học/chứng minh nâng cao, phù hợp với <strong>Gemini 2.5 Pro</strong>.</span>
              </div>
            )}

            {/* GHI CHÚ CỦA HỌC SINH */}
            {analysisResult.userNote && (
              <div className="flex justify-end">
                <div className="bg-indigo-900 text-white text-xs sm:text-sm px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-[85%] shadow-xs">
                  <span className="font-semibold opacity-80 block text-[11px] mb-0.5">
                    Ghi chú của em ({analysisResult.grade}):
                  </span>
                  &ldquo;{analysisResult.userNote}&rdquo;
                </div>
              </div>
            )}

            {/* THẺ 1: OCR VÀ CÁC DÒNG BÀI LÀM */}
            <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-sky-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-600"></span>
                  1. Nội dung nhận diện từ ảnh ({analysisResult.grade || 'Toán THCS'})
                </span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-white text-sky-700 border border-sky-200">
                  Vision & LaTeX
                </span>
              </div>
              <div className="text-sm text-slate-800 bg-white/90 rounded-xl p-3 border border-sky-100 space-y-2">
                <div>
                  <strong className="text-sky-900">Đề bài: </strong>
                  <span>{analysisResult.card1_ocr?.problem}</span>
                </div>
                <div className="border-t border-slate-100 pt-2">
                  <strong className="text-sky-900 block mb-1">Các dòng bài làm đọc được:</strong>
                  <ul className="space-y-1 text-slate-700">
                    {analysisResult.card1_ocr?.steps?.map((step, idx) => (
                      <li key={idx} className="pl-2 border-l-2 border-sky-300">
                        {step}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* THẺ 2: CÁC BƯỚC ĐÃ LÀM ĐÚNG */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-xs">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-800 mb-2">
                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                2. Phần bài làm đã thực hiện đúng (Khen ngợi)
              </div>
              <ul className="space-y-1.5 text-sm text-slate-800 bg-white/90 rounded-xl p-3 border border-emerald-100">
                {analysisResult.card2_correct?.highlights?.map((hl, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold mt-0.5">✓</span>
                    <span>{hl}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* THẺ 3: VỊ TRÍ SAI & BẢN CHẤT LỖI */}
            {analysisResult.card3_error && analysisResult.card3_error.has_error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 shadow-xs">
                <div className="flex items-center justify-between flex-wrap gap-1 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    3. Phát hiện điểm sai: {analysisResult.card3_error.line}
                  </span>
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                    {analysisResult.card3_error.category}
                  </span>
                </div>
                <div className="text-sm text-slate-800 bg-white/95 rounded-xl p-3 border border-rose-100 leading-relaxed">
                  {analysisResult.card3_error.explanation}
                </div>
              </div>
            )}

            {/* THẺ 4: HƯỚNG DẪN SỬA / LỜI GIẢI CHI TIẾT */}
            <div
              className={`rounded-2xl border p-4 shadow-xs ${
                isHint ? 'border-amber-200 bg-amber-50/80' : 'border-teal-200 bg-teal-50/80'
              }`}
            >
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                <span
                  className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                    isHint ? 'text-amber-900' : 'text-teal-900'
                  }`}
                >
                  <span>
                    {isHint
                      ? '💡 4. Hướng dẫn gợi mở để em tự sửa'
                      : '📘 4. Hướng làm đúng & Lời giải chi tiết'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={onToggleMode}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition"
                >
                  {isHint ? 'Xem đáp án chi tiết →' : '← Quay lại gợi ý tự sửa'}
                </button>
              </div>
              <div
                className={`text-sm text-slate-800 bg-white/95 rounded-xl p-3.5 border leading-relaxed ${
                  isHint ? 'border-amber-100' : 'border-teal-100'
                }`}
                dangerouslySetInnerHTML={{
                  __html: isHint
                    ? analysisResult.card4_guidance?.hint_content || ''
                    : analysisResult.card4_guidance?.detailed_solution || '',
                }}
              />
            </div>
          </div>
        )}

        {/* CÁC TIN NHẮN HỎI ĐÁP NỐI TIẾP */}
        {chatMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'items-start gap-2.5'}`}
          >
            {msg.sender === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-900 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                AI
              </div>
            )}
            <div
              className={`text-sm px-4 py-2.5 rounded-2xl shadow-xs leading-relaxed max-w-[85%] ${
                msg.sender === 'user'
                  ? 'bg-indigo-900 text-white rounded-tr-sm'
                  : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm'
              }`}
              dangerouslySetInnerHTML={{ __html: msg.content }}
            />
          </div>
        ))}
      </div>

      {/* QUICK PROMPTS & CHAT INPUT */}
      <div className="border-t border-slate-200 bg-white p-3.5 space-y-2.5">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-[11px] font-semibold text-slate-400 shrink-0">Hỏi nhanh:</span>
          <button
            type="button"
            onClick={() => onSendChatMessage('Tại sao chỗ này phải đổi dấu / đặt điều kiện?')}
            className="shrink-0 text-xs px-3 py-1 rounded-full bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-900 border border-slate-200 transition"
          >
            Tại sao chỗ này phải đổi dấu / đặt điều kiện?
          </button>
          <button
            type="button"
            onClick={() => onSendChatMessage('Cho em xin 1 bài tương tự để luyện lại')}
            className="shrink-0 text-xs px-3 py-1 rounded-full bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-900 border border-slate-200 transition"
          >
            Cho em xin 1 bài tương tự để luyện lại
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Nhập câu hỏi thêm cho trợ giảng (VD: Dòng 2 em biến đổi vậy được không?)..."
            className="flex-1 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-indigo-900 hover:bg-indigo-800 text-white text-sm font-semibold transition flex items-center gap-1.5 shrink-0"
          >
            <span>Gửi</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </form>
      </div>
    </section>
  );
};
