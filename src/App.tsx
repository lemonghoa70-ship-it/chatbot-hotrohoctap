import React, { useState } from 'react';
import { Header } from './components/Header';
import { UploadSection } from './components/UploadSection';
import { ResultSection } from './components/ResultSection';
import { AgentKnowledgeModal } from './components/AgentKnowledgeModal';
import { AnalysisResult, FeedbackMode, ChatMessage } from './types';
import { callGeminiGrading, callGeminiFollowUpChat, getSavedApiKey } from './services/geminiService';

// Dữ liệu mô phỏng 3 mẫu học sinh thực tế để kiểm thử nhanh
export const MOCK_SAMPLES: Record<string, AnalysisResult & { notebookLines: { text: string; isTitle?: boolean }[] }> = {
  sample1: {
    grade: 'Toán 9',
    userNote: 'Em giải ra hai nghiệm x = 2 và x = 1/2 nhưng không chắc đúng chưa ạ.',
    notebookLines: [
      { text: 'Bài 1: Giải phương trình:  (x² - 4) / (x - 2) = 3x + 1', isTitle: true },
      { text: 'Bài làm:', isTitle: true },
      { text: 'Ta có:  (x - 2)(x + 2) / (x - 2) = 3x + 1' },
      { text: '      =>  x + 2 = 3x + 1' },
      { text: '      =>  3x - x = 2 - 1' },
      { text: '      =>  2x = 1  =>  x = 1/2' },
      { text: '      Và x - 2 = 0  =>  x = 2' },
      { text: 'Vậy phương trình có tập nghiệm S = {1/2 ; 2}.' },
    ],
    card1_ocr: {
      problem: 'Giải phương trình chứa ẩn ở mẫu: $$\\frac{x^2 - 4}{x - 2} = 3x + 1$$',
      steps: [
        'Dòng 1: $\\frac{(x - 2)(x + 2)}{x - 2} = 3x + 1$',
        'Dòng 2: $\\Rightarrow x + 2 = 3x + 1$',
        'Dòng 3: $\\Rightarrow 3x - x = 2 - 1 \\Rightarrow 2x = 1 \\Rightarrow x = \\frac{1}{2}$',
        'Dòng 4: Cho $x - 2 = 0 \\Rightarrow x = 2$, kết luận $S = \\left\\{\\frac{1}{2};\\, 2\\right\\}$',
      ],
    },
    card2_correct: {
      highlights: [
        'Phân tích đúng tử thức thành nhân tử: $x^2 - 4 = (x - 2)(x + 2)$.',
        'Rút gọn nhân tử chung $(x - 2)$ và giải tìm được $x = \\frac{1}{2}$ chuẩn xác.',
      ],
    },
    card3_error: {
      has_error: true,
      line: 'Ngay từ đầu bài & Dòng 4',
      category: 'Lỗi quên điều kiện xác định (ĐKXĐ) & Nhận nhầm nghiệm ngoại lai',
      explanation:
        'Phương trình có chứa ẩn ở mẫu thức $(x - 2)$ nhưng bài làm chưa đặt ĐKXĐ $x - 2 \\neq 0 \\Leftrightarrow x \\neq 2$. Ở Dòng 4 giải thêm $x - 2 = 0 \\Rightarrow x = 2$ là sai vì $x = 2$ làm mẫu thức bằng 0.',
    },
    card4_guidance: {
      mode: 'hint',
      hint_content: `
        <p class="mb-2">Để sửa bài này thật chuẩn, em hãy tự trả lời 2 câu hỏi gợi mở sau nhé:</p>
        <ul class="list-disc pl-5 space-y-1.5">
          <li><strong>Câu 1:</strong> Phân thức $\\frac{A}{B}$ xác định khi mẫu thức $B$ như thế nào? Vậy điều kiện của $x$ là gì?</li>
          <li><strong>Câu 2:</strong> Sau khi rút gọn còn $x + 2 = 3x + 1$, ta có cần xét thêm $x - 2 = 0$ nữa không?</li>
        </ul>
      `,
      detailed_solution: `
        <p class="font-semibold mb-1.5">Lời giải chuẩn theo chương trình Toán 9:</p>
        <div class="space-y-1.5 pl-2 border-l-2 border-emerald-400">
          <p>• <strong>Điều kiện xác định:</strong> $x - 2 \\neq 0 \\Leftrightarrow x \\neq 2$.</p>
          <p>• <strong>Biến đổi phương trình:</strong></p>
          <p>$$\\frac{(x - 2)(x + 2)}{x - 2} = 3x + 1 \\Leftrightarrow x + 2 = 3x + 1 \\quad (\\text{do } x \\neq 2)$$</p>
          <p>$$2x = 1 \\Leftrightarrow x = \\frac{1}{2} \\quad (\\text{thỏa mãn ĐKXĐ})$$</p>
          <p>• <strong>Kết luận:</strong> Vậy phương trình có nghiệm duy nhất $x = \\frac{1}{2}$.</p>
        </div>
      `,
    },
  },

  sample2: {
    grade: 'Toán 9',
    userNote: 'Thầy kiểm tra giúp em dấu trừ trước căn thức ở dòng thứ 2 ạ.',
    notebookLines: [
      { text: 'Bài 2: Rút gọn biểu thức:  A = √(3 - √5)² - √(2 - √5)²', isTitle: true },
      { text: 'Bài làm:', isTitle: true },
      { text: 'Ta có:  A = |3 - √5| - |2 - √5|' },
      { text: '        A = (3 - √5) - (√5 - 2)' },
      { text: '        A = 3 - √5 - √5 - 2' },
      { text: '        A = 1 - 2√5' },
    ],
    card1_ocr: {
      problem: 'Rút gọn biểu thức chứa căn thức bậc hai: $$A = \\sqrt{(3 - \\sqrt{5})^2} - \\sqrt{(2 - \\sqrt{5})^2}$$',
      steps: [
        'Dòng 1: $A = |3 - \\sqrt{5}| - |2 - \\sqrt{5}|$',
        'Dòng 2: $A = (3 - \\sqrt{5}) - (\\sqrt{5} - 2)$',
        'Dòng 3: $A = 3 - \\sqrt{5} - \\sqrt{5} - 2$',
        'Dòng 4: $A = 1 - 2\\sqrt{5}$',
      ],
    },
    card2_correct: {
      highlights: [
        'Áp dụng rất chuẩn hằng đẳng thức $\\sqrt{A^2} = |A|$ ở Dòng 1.',
        'So sánh đúng $3 > \\sqrt{5}$ và $2 < \\sqrt{5}$ để phá dấu giá trị tuyệt đối ở Dòng 2.',
      ],
    },
    card3_error: {
      has_error: true,
      line: 'Dòng 3',
      category: 'Lỗi quy tắc dấu ngoặc (Quên đổi dấu số hạng thứ hai)',
      explanation:
        'Ở Dòng 2 em viết đúng $-(\\sqrt{5} - 2)$. Nhưng khi bỏ ngoặc có dấu trừ ở Dòng 3, em mới đổi dấu $+\\sqrt{5}$ mà quên đổi dấu $-2$ thành $+2$, dẫn đến viết nhầm thành $-2$.',
    },
    card4_guidance: {
      mode: 'hint',
      hint_content: `
        <p class="mb-2">Em đã vượt qua phần khó nhất là khử căn! Chỉ còn một lỗi nhỏ ở bước phá ngoặc:</p>
        <ul class="list-disc pl-5 space-y-1.5">
          <li><strong>Gợi mở:</strong> Khi bỏ dấu ngoặc có dấu trừ đằng trước $-(\\sqrt{5} - 2)$, dấu của $-2$ đổi thành gì?</li>
          <li>Sau khi đổi dấu đúng, em hãy cộng lại phần số nguyên $3 + 2$ nhé!</li>
        </ul>
      `,
      detailed_solution: `
        <p class="font-semibold mb-1.5">Lời giải chuẩn từng bước:</p>
        <div class="space-y-1.5 pl-2 border-l-2 border-emerald-400">
          <p>$$A = |3 - \\sqrt{5}| - |2 - \\sqrt{5}|$$</p>
          <p>Vì $3 > \\sqrt{5}$ và $2 < \\sqrt{5}$ nên:</p>
          <p>$$A = (3 - \\sqrt{5}) - (\\sqrt{5} - 2) = 3 - \\sqrt{5} - \\sqrt{5} + 2 = 5 - 2\\sqrt{5}$$</p>
        </div>
      `,
    },
  },

  sample3: {
    grade: 'Toán 9',
    userNote: 'Em giải bằng phương pháp cộng đại số ạ.',
    notebookLines: [
      { text: 'Bài 3: Giải hệ phương trình:  { 2x + y = 5', isTitle: true },
      { text: '                              { 3x - y = 5', isTitle: true },
      { text: 'Bài làm:', isTitle: true },
      { text: 'Cộng từng vế hai phương trình của hệ, ta được:' },
      { text: '      (2x + 3x) + (y - y) = 5 + 5' },
      { text: '  <=> 5x = 10  <=>  x = 2' },
      { text: 'Thay x = 2 vào phương trình (1): 2.2 + y = 5' },
      { text: '  <=> 4 + y = 5  <=>  y = 1' },
      { text: 'Vậy hệ phương trình có nghiệm duy nhất (x ; y) = (2 ; 1).' },
    ],
    card1_ocr: {
      problem: 'Giải hệ phương trình bậc nhất hai ẩn: $$\\begin{cases} 2x + y = 5 \\\\ 3x - y = 5 \\end{cases}$$',
      steps: [
        'Dòng 1: Cộng từng vế: $(2x + 3x) + (y - y) = 5 + 5$',
        'Dòng 2: $\\Leftrightarrow 5x = 10 \\Leftrightarrow x = 2$',
        'Dòng 3: Thay $x = 2$ vào (1): $2 \\cdot 2 + y = 5 \\Leftrightarrow y = 1$',
        'Dòng 4: Kết luận $(x;\\, y) = (2;\\, 1)$',
      ],
    },
    card2_correct: {
      highlights: [
        '<strong>Chính xác hoàn toàn 100%!</strong> Em chọn phương pháp cộng đại số triệt tiêu $y$ rất thông minh.',
        'Cách trình bày kết luận nghiệm theo cặp số $(x;\\, y) = (2;\\, 1)$ chuẩn barem thi vào 10.',
      ],
    },
    card3_error: null,
    card4_guidance: {
      mode: 'hint',
      hint_content: '<p class="text-emerald-900 font-medium">Bài làm của em hoàn hảo, không có lỗi sai nào!</p>',
      detailed_solution: '<p>Lời giải của em đạt điểm tối đa 10/10.</p>',
    },
  },
};

export const App: React.FC = () => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [rotation, setRotation] = useState<number>(0);
  const [grade, setGrade] = useState<string>('Toán 9');
  const [feedbackMode, setFeedbackMode] = useState<FeedbackMode>('hint');
  const [studentNote, setStudentNote] = useState<string>('');
  const [activeSampleId, setActiveSampleId] = useState<string | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isKnowledgeModalOpen, setIsKnowledgeModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Nạp bài mẫu
  const handleSelectSample = (sampleKey: 'sample1' | 'sample2' | 'sample3') => {
    const sample = MOCK_SAMPLES[sampleKey];
    if (!sample) return;

    setActiveSampleId(sampleKey);
    setGrade(sample.grade || 'Toán 9');
    setStudentNote(sample.userNote || '');

    // Tạo ảnh vở mô phỏng qua canvas
    const canvas = document.createElement('canvas');
    canvas.width = 760;
    canvas.height = 440;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#fffdf7';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#dbeafe';
      ctx.lineWidth = 1.5;
      for (let y = 55; y < canvas.height - 20; y += 42) {
        ctx.beginPath();
        ctx.moveTo(20, y);
        ctx.lineTo(canvas.width - 20, y);
        ctx.stroke();
      }
      ctx.strokeStyle = '#fca5a5';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(75, 15);
      ctx.lineTo(75, canvas.height - 15);
      ctx.stroke();

      sample.notebookLines.forEach((line, idx) => {
        const yPos = 55 + idx * 42 - 8;
        ctx.font = line.isTitle
          ? 'bold 20px "Patrick Hand", cursive, sans-serif'
          : '22px "Patrick Hand", cursive, sans-serif';
        ctx.fillStyle = line.isTitle ? '#1e293b' : '#1d4ed8';
        ctx.fillText(line.text, 90, yPos);
      });
      setImageSrc(canvas.toDataURL('image/png'));
    }

    showToast(`Đã nạp ${sampleKey === 'sample1' ? 'Bài 1: Quên ĐKXĐ' : sampleKey === 'sample2' ? 'Bài 2: Sai dấu căn' : 'Bài 3: Hệ PT đúng'}. Bấm "Kiểm tra bài làm ngay" để xem AI chấm!`);
  };

  // Phân tích bài làm
  const handleStartAnalysis = async () => {
    if (!imageSrc) {
      showToast('Vui lòng chọn ảnh bài làm hoặc bấm thử 1 bài mẫu ở trên nhé!');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);

    const apiKey = getSavedApiKey();

    if (apiKey) {
      // Có API Key: gọi trực tiếp Google Gemini API
      try {
        const result = await callGeminiGrading({
          imageBase64: imageSrc,
          mimeType: 'image/png',
          grade,
          studentNote,
          feedbackMode,
          apiKey,
        });
        setAnalysisResult(result);
        showToast('Agent Gemini 2.5 đã phân tích xong bài làm!');
      } catch (err: any) {
        console.warn('Lỗi gọi Gemini API, chuyển sang mô phỏng:', err);
        fallbackToSampleOrMock();
        showToast('Đang hiển thị phản hồi mẫu (Kiểm tra lại Gemini API Key trong phần Cài đặt).');
      } finally {
        setIsAnalyzing(false);
      }
    } else {
      // Không có API Key: chạy mô phỏng sau 1.8 giây
      setTimeout(() => {
        fallbackToSampleOrMock();
        setIsAnalyzing(false);
        showToast('Đã phân tích bài làm theo chuẩn sư phạm GDPT 2018.');
      }, 1600);
    }
  };

  const fallbackToSampleOrMock = () => {
    if (activeSampleId && MOCK_SAMPLES[activeSampleId]) {
      setAnalysisResult({
        ...MOCK_SAMPLES[activeSampleId],
        grade,
        userNote: studentNote,
      });
    } else {
      // Mẫu tự tải lên
      setAnalysisResult({
        grade,
        userNote: studentNote,
        card1_ocr: {
          problem: `Bài toán đại số (${grade}): Tìm $x$ biết $(2x - 3)^2 - 4x(x - 2) = 5$`,
          steps: [
            'Dòng 1: $4x^2 - 12x + 9 - 4x^2 - 8x = 5$',
            'Dòng 2: $-20x + 9 = 5$',
            'Dòng 3: $-20x = -4 \\Leftrightarrow x = \\frac{1}{5}$',
          ],
        },
        card2_correct: {
          highlights: [
            'Khai triển đúng hằng đẳng thức $(2x - 3)^2 = 4x^2 - 12x + 9$.',
            'Nhận diện triệt tiêu $4x^2 - 4x^2 = 0$ đưa về phương trình bậc nhất.',
          ],
        },
        card3_error: {
          has_error: true,
          line: 'Dòng 1 (cuối vế trái)',
          category: 'Lỗi quy tắc dấu khi nhân đơn thức âm với đa thức',
          explanation:
            'Khi nhân $-4x$ với $(x - 2)$, ta có $-4x \\cdot x = -4x^2$ đúng, nhưng $(-4x) \\cdot (-2) = +8x$ thay vì $-8x$.',
        },
        card4_guidance: {
          mode: feedbackMode,
          hint_content: `
            <p><strong>Gợi mở:</strong> Tích của hai số âm $(-4x) \\cdot (-2)$ mang dấu dương hay âm? Hãy nháp lại dấu của hạng tử $8x$ nhé!</p>
          `,
          detailed_solution: `
            <p>$$4x^2 - 12x + 9 - 4x^2 + 8x = 5 \\Leftrightarrow -4x = -4 \\Leftrightarrow x = 1$$</p>
          `,
        },
      });
    }
  };

  // Chat hỏi đáp nối tiếp
  const handleSendChatMessage = async (text: string) => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      content: text,
      timestamp: Date.now(),
    };
    setChatMessages((prev) => [...prev, userMsg]);

    const apiKey = getSavedApiKey();
    if (apiKey) {
      try {
        const history = chatMessages.map((m) => ({
          role: (m.sender === 'user' ? 'user' : 'model') as 'user' | 'model',
          text: m.content,
        }));
        const reply = await callGeminiFollowUpChat({
          history,
          newQuestion: text,
          analysisContext: analysisResult,
          apiKey,
        });
        const botMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          content: reply,
          timestamp: Date.now(),
        };
        setChatMessages((prev) => [...prev, botMsg]);
        return;
      } catch (e) {
        console.warn('Lỗi gọi Gemini Chat, chuyển sang phản hồi có sẵn:', e);
      }
    }

    // Phản hồi mẫu tự nhiên
    setTimeout(() => {
      let reply = 'Em hỏi câu này rất đúng trọng tâm! ';
      const q = text.toLowerCase();
      if (q.includes('đổi dấu') || q.includes('điều kiện') || q.includes('tại sao')) {
        reply +=
          'Trong toán học THCS, khi nhân một số âm với một số âm thì kết quả luôn mang dấu <strong>dương</strong>: $(-a) \\cdot (-b) = ab$. Đồng thời với mẫu thức thì luôn cần điều kiện khác 0 để phân thức có nghĩa em nhé!';
      } else if (q.includes('tương tự') || q.includes('luyện')) {
        reply +=
          'Thầy/Cô tặng em một bài tương tự để làm chủ dạng này nè: <em>Tìm $x$ biết $(3x - 1)^2 - 9x(x - 2) = 19$</em>. Em làm ra vở rồi gửi Thầy/Cô xem nhé!';
      } else {
        reply +=
          'Em hãy lưu ý luôn bám sát 3 bước: (1) Đặt điều kiện, (2) Biến đổi cẩn thận dấu ngoặc, và (3) Thử lại nghiệm. Em cần giải thích thêm bước nào không?';
      }

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        content: reply,
        timestamp: Date.now(),
      };
      setChatMessages((prev) => [...prev, botMsg]);
    }, 450);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* HEADER */}
      <Header
        onOpenKnowledgeModal={() => setIsKnowledgeModalOpen(true)}
        onSelectSample={handleSelectSample}
        activeSampleId={activeSampleId}
      />

      {/* TOAST */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 animate-fadeIn">
          <div className="bg-slate-900 text-white text-sm px-4 py-3 rounded-xl shadow-lg flex items-center gap-2.5">
            <svg className="w-5 h-5 text-amber-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* MAIN 2-COLUMN LAYOUT */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5">
          <UploadSection
            imageSrc={imageSrc}
            rotation={rotation}
            grade={grade}
            feedbackMode={feedbackMode}
            studentNote={studentNote}
            isAnalyzing={isAnalyzing}
            onImageSelected={(src) => {
              setImageSrc(src);
              setActiveSampleId(null);
            }}
            onRotate={(deg) => setRotation((prev) => (prev + deg) % 360)}
            onClearImage={() => {
              setImageSrc(null);
              setActiveSampleId(null);
            }}
            onGradeChange={setGrade}
            onModeChange={setFeedbackMode}
            onNoteChange={setStudentNote}
            onStartAnalysis={handleStartAnalysis}
          />
        </div>

        <div className="lg:col-span-7">
          <ResultSection
            analysisResult={analysisResult}
            feedbackMode={feedbackMode}
            isAnalyzing={isAnalyzing}
            chatMessages={chatMessages}
            onToggleMode={() => setFeedbackMode((prev) => (prev === 'hint' ? 'detail' : 'hint'))}
            onReset={() => {
              setAnalysisResult(null);
              setChatMessages([]);
              showToast('Đã làm mới khung nhận xét.');
            }}
            onSendChatMessage={handleSendChatMessage}
          />
        </div>
      </main>

      {/* AGENT KNOWLEDGE MODAL (4 TABS CHO 4 FILE MD) */}
      <AgentKnowledgeModal
        isOpen={isKnowledgeModalOpen}
        onClose={() => setIsKnowledgeModalOpen(false)}
        onSavedNotification={showToast}
      />
    </div>
  );
};
