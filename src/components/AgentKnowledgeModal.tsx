import React, { useState, useEffect } from 'react';
import { AgentKnowledgeFiles } from '../types';
import {
  getActiveKnowledge,
  saveActiveKnowledge,
  resetDefaultKnowledge,
  DEFAULT_KNOWLEDGE,
  getSavedApiKey,
  saveApiKey,
} from '../services/geminiService';

interface AgentKnowledgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSavedNotification?: (msg: string) => void;
}

type TabKey = 'skillOcr' | 'skillPhanTich' | 'persona' | 'agentConfig' | 'apiKey';

export const AgentKnowledgeModal: React.FC<AgentKnowledgeModalProps> = ({
  isOpen,
  onClose,
  onSavedNotification,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('skillOcr');
  const [knowledge, setKnowledge] = useState<AgentKnowledgeFiles>(getActiveKnowledge());
  const [apiKey, setApiKey] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setKnowledge(getActiveKnowledge());
      setApiKey(getSavedApiKey());
      setHasChanges(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTextChange = (tab: keyof AgentKnowledgeFiles, value: string) => {
    setKnowledge((prev) => ({ ...prev, [tab]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    saveActiveKnowledge(knowledge);
    saveApiKey(apiKey);
    setHasChanges(false);
    if (onSavedNotification) {
      onSavedNotification('Đã lưu cấu hình Kỹ năng, Tính cách và Agent thành công!');
    }
  };

  const handleReset = () => {
    if (window.confirm('Bạn có chắc muốn khôi phục toàn bộ 4 file kỹ năng về nội dung mặc định ban đầu không?')) {
      const def = resetDefaultKnowledge();
      setKnowledge(def);
      setHasChanges(false);
      if (onSavedNotification) {
        onSavedNotification('Đã khôi phục 4 file về mặc định gốc từ src/ai-config.');
      }
    }
  };

  const handleCopyCurrent = () => {
    let content = '';
    if (activeTab === 'skillOcr') content = knowledge.skillOcr;
    else if (activeTab === 'skillPhanTich') content = knowledge.skillPhanTich;
    else if (activeTab === 'persona') content = knowledge.persona;
    else if (activeTab === 'agentConfig') content = knowledge.agentConfig;
    else content = apiKey;

    navigator.clipboard.writeText(content).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const tabMeta: Record<
    keyof AgentKnowledgeFiles,
    { title: string; subtitle: string; icon: string; path: string; badge: string }
  > = {
    skillOcr: {
      title: 'Kỹ năng 1: OCR & Chuẩn hóa Toán',
      subtitle: 'Đọc chữ viết tay, chuẩn hóa LaTeX ($...$), số phẩy {,}, gạch xóa & ảnh mờ',
      icon: '📐',
      path: 'src/ai-config/skills/skill-ocr-va-chuan-hoa-toan.md',
      badge: 'Vision & LaTeX',
    },
    skillPhanTich: {
      title: 'Kỹ năng 2: Chấm từng bước GDPT 2018',
      subtitle: 'Quy trình 4 bước: ĐKXĐ -> Chuỗi tương đương -> Danh mục lỗi -> Gợi mở sư phạm',
      icon: '🎯',
      path: 'src/ai-config/skills/skill-phan-tich-loi-su-pham.md',
      badge: 'Sư phạm THCS',
    },
    persona: {
      title: 'Tính cách & Giọng điệu Trợ giảng',
      subtitle: 'Hình mẫu Thầy/Cô ấm áp, kiên nhẫn, khen trước chỉ lỗi sau, xưng hô mẫu mực',
      icon: '💖',
      path: 'src/ai-config/persona/tinh-cach-tro-giang.md',
      badge: 'Persona',
    },
    agentConfig: {
      title: 'Cấu hình Agent TroGiangKiemTraBaiLam',
      subtitle: 'Điều phối 2 kỹ năng + tính cách, model gemini-2.5-flash/pro, temp 0.2/0.5, JSON Schema',
      icon: '🤖',
      path: 'src/ai-config/agents/tro-giang-cham-bai.agent.md',
      badge: 'Orchestrator',
    },
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
        {/* MODAL HEADER */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-900 text-white flex items-center justify-center shadow-xs">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  Hệ Thống Kỹ Năng & Tính Cách Agent Trợ Giảng
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-semibold border border-indigo-200">
                  Vite ?raw Synced
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Xem và chỉnh sửa trực tiếp 4 tệp tri thức cấu thành Prompt của Gemini API
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyCurrent}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition flex items-center gap-1.5"
              title="Sao chép nội dung tab hiện tại"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
              </svg>
              <span>{isCopied ? 'Đã chép!' : 'Sao chép'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
              title="Đóng modal"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* TAB NAVIGATION */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 overflow-x-auto px-4 gap-1.5 pt-2">
          {(['skillOcr', 'skillPhanTich', 'persona', 'agentConfig'] as const).map((key) => {
            const meta = tabMeta[key];
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`py-2 px-3 text-xs sm:text-sm font-semibold rounded-t-xl transition flex items-center gap-2 whitespace-nowrap border-t border-x ${
                  isActive
                    ? 'bg-white text-indigo-900 border-slate-200 shadow-xs -mb-[1px]'
                    : 'bg-transparent text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <span>{meta.icon}</span>
                <span>{meta.title}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${isActive ? 'bg-indigo-50 text-indigo-800' : 'bg-slate-200 text-slate-600'}`}>
                  {meta.badge}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setActiveTab('apiKey')}
            className={`py-2 px-3 text-xs sm:text-sm font-semibold rounded-t-xl transition flex items-center gap-2 whitespace-nowrap border-t border-x ${
              activeTab === 'apiKey'
                ? 'bg-white text-emerald-900 border-slate-200 shadow-xs -mb-[1px]'
                : 'bg-transparent text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <span>🔑</span>
            <span>Cấu hình Gemini API Key</span>
          </button>
        </div>

        {/* TAB CONTENT BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col bg-slate-50/50">
          {activeTab !== 'apiKey' ? (
            <div className="flex-1 flex flex-col gap-3">
              {/* Meta bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="font-bold text-slate-800">{tabMeta[activeTab].title}</span>
                  <p className="text-slate-500 mt-0.5">{tabMeta[activeTab].subtitle}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-[11px] bg-slate-100 text-slate-600 px-2 py-1 rounded-md border border-slate-200">
                    {tabMeta[activeTab].path}
                  </span>
                  <span className="text-slate-400">|</span>
                  <span className="text-slate-500">{knowledge[activeTab].length} ký tự</span>
                </div>
              </div>

              {/* Textarea editor */}
              <div className="flex-1 min-h-[320px] flex flex-col relative rounded-xl border border-slate-300 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 bg-white overflow-hidden shadow-inner">
                <textarea
                  value={knowledge[activeTab]}
                  onChange={(e) => handleTextChange(activeTab, e.target.value)}
                  className="w-full h-full p-4 font-mono text-xs sm:text-sm text-slate-800 leading-relaxed resize-none focus:outline-none overflow-y-auto"
                  placeholder="Nhập nội dung Markdown cấu hình tri thức..."
                  spellCheck={false}
                />
              </div>
            </div>
          ) : (
            /* Tab cấu hình API Key */
            <div className="max-w-2xl mx-auto w-full py-6 space-y-5">
              <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 flex items-start gap-3">
                <div className="text-2xl mt-0.5">💡</div>
                <div className="text-xs sm:text-sm text-indigo-900 leading-relaxed">
                  <strong className="block text-indigo-950 font-bold mb-1">Cấu hình kết nối Google Gemini API</strong>
                  Hệ thống hỗ trợ gọi trực tiếp mô hình thị giác <strong>Gemini 2.5 Flash</strong> (chấm bài siêu tốc, nhiệt độ 0.2) và <strong>Gemini 2.5 Pro</strong> (hình học và đại số nâng cao). Nếu không có API Key, ứng dụng sẽ chạy ở chế độ mô phỏng sư phạm với 3 bài toán mẫu.
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div>
                  <label htmlFor="modal-gemini-key" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Gemini API Key (Google AI Studio)
                  </label>
                  <input
                    id="modal-gemini-key"
                    type="password"
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setHasChanges(true);
                    }}
                    placeholder="AIzaSy..."
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 focus:bg-white px-3.5 py-2.5 text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    API Key được lưu an toàn trên trình duyệt của bạn (localStorage) và không truyền tới bất kỳ máy chủ trung gian nào.
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Chưa có khóa API?</span>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-700 font-semibold hover:underline flex items-center gap-1"
                  >
                    <span>Lấy API Key miễn phí tại Google AI Studio</span>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              <span>Khôi phục mặc định ban đầu</span>
            </button>
            {hasChanges && (
              <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                Có thay đổi chưa lưu
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 transition"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-indigo-900 hover:bg-indigo-800 shadow-md shadow-indigo-900/15 transition flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              <span>Lưu thay đổi & Áp dụng ngay</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
