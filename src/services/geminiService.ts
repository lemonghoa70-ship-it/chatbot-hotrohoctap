import { GoogleGenAI, Type, Schema } from '@google/genai';
import skillOcrRaw from '../ai-config/skills/skill-ocr-va-chuan-hoa-toan.md?raw';
import skillPhanTichRaw from '../ai-config/skills/skill-phan-tich-loi-su-pham.md?raw';
import personaRaw from '../ai-config/persona/tinh-cach-tro-giang.md?raw';
import agentConfigRaw from '../ai-config/agents/tro-giang-cham-bai.agent.md?raw';
import { AnalysisResult, AgentKnowledgeFiles, FeedbackMode } from '../types';

export const LOCAL_STORAGE_KEY_KNOWLEDGE = 'trogiang_ai_agent_knowledge_v1';
export const LOCAL_STORAGE_KEY_API_KEY = 'trogiang_ai_gemini_api_key';

// 1. Tải tri thức mặc định từ 4 file .md qua Vite ?raw
export const DEFAULT_KNOWLEDGE: AgentKnowledgeFiles = {
  skillOcr: skillOcrRaw,
  skillPhanTich: skillPhanTichRaw,
  persona: personaRaw,
  agentConfig: agentConfigRaw,
};

// 2. Lấy tri thức đang hoạt động (ưu tiên phiên bản giáo viên đã chỉnh sửa trên web)
export function getActiveKnowledge(): AgentKnowledgeFiles {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_KNOWLEDGE);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        skillOcr: parsed.skillOcr || DEFAULT_KNOWLEDGE.skillOcr,
        skillPhanTich: parsed.skillPhanTich || DEFAULT_KNOWLEDGE.skillPhanTich,
        persona: parsed.persona || DEFAULT_KNOWLEDGE.persona,
        agentConfig: parsed.agentConfig || DEFAULT_KNOWLEDGE.agentConfig,
      };
    }
  } catch (e) {
    console.error('Không thể đọc tri thức từ localStorage:', e);
  }
  return { ...DEFAULT_KNOWLEDGE };
}

// 3. Lưu tri thức đã chỉnh sửa vào localStorage
export function saveActiveKnowledge(knowledge: AgentKnowledgeFiles): void {
  localStorage.setItem(LOCAL_STORAGE_KEY_KNOWLEDGE, JSON.stringify(knowledge));
}

// 4. Khôi phục tri thức mặc định gốc
export function resetDefaultKnowledge(): AgentKnowledgeFiles {
  localStorage.removeItem(LOCAL_STORAGE_KEY_KNOWLEDGE);
  return { ...DEFAULT_KNOWLEDGE };
}

// 5. Ghép 4 tệp tri thức thành System Instruction hoàn chỉnh cho Gemini API
export function buildSystemInstruction(knowledge: AgentKnowledgeFiles = getActiveKnowledge()): string {
  return `
# HỆ THỐNG TRI THỨC VÀ QUY TẮC CỦA AGENT TRỢ GIẢNG TOÁN HỌC

## [PHẦN 1: CẤU HÌNH AGENT]
${knowledge.agentConfig}

## [PHẦN 2: TÍNH CÁCH & GIỌNG ĐIỆU SƯ PHẠM]
${knowledge.persona}

## [PHẦN 3: KỸ NĂNG OCR & CHUẨN HÓA LATEX]
${knowledge.skillOcr}

## [PHẦN 4: KỸ NĂNG PHÂN TÍCH LỖI VÀ DẪN DẮT GDPT 2018]
${knowledge.skillPhanTich}

---
BẮT BUỘC: Khi phân tích ảnh bài làm, trả về JSON chuẩn theo đúng định dạng 4 thẻ đã quy định trong cấu hình Agent.
Không trả thêm văn bản ngoài JSON khi ở bước chấm ảnh.
`.trim();
}

// JSON Schema cho 4 thẻ kết quả phân tích ảnh
export const ANALYSIS_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    card1_ocr: {
      type: Type.OBJECT,
      properties: {
        problem: {
          type: Type.STRING,
          description: 'Đề bài hoặc yêu cầu bài toán kèm công thức LaTeX chuẩn ($...$ hoặc $$...$$)',
        },
        steps: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Danh sách từng dòng bài làm của học sinh (Dòng 1: ..., Dòng 2: ...)',
        },
      },
      required: ['problem', 'steps'],
    },
    card2_correct: {
      type: Type.OBJECT,
      properties: {
        highlights: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Ghi nhận và khen ngợi cụ thể các bước học sinh đã làm đúng, logic chuẩn',
        },
      },
      required: ['highlights'],
    },
    card3_error: {
      type: Type.OBJECT,
      properties: {
        has_error: { type: Type.BOOLEAN },
        line: { type: Type.STRING, description: 'Vị trí dòng bắt đầu sai lệch' },
        category: { type: Type.STRING, description: 'Tên phân loại lỗi chuẩn theo GDPT 2018' },
        explanation: { type: Type.STRING, description: 'Giải thích nguyên nhân cốt lõi vì sao sai' },
      },
      required: ['has_error', 'line', 'category', 'explanation'],
    },
    card4_guidance: {
      type: Type.OBJECT,
      properties: {
        mode: { type: Type.STRING, enum: ['hint', 'detail'] },
        hint_content: {
          type: Type.STRING,
          description: '1-2 câu hỏi gợi mở để học sinh tự nháp lại, không tiết lộ kết quả cuối',
        },
        detailed_solution: {
          type: Type.STRING,
          description: 'Lời giải chi tiết từng bước chuẩn mẫu GDPT 2018 kèm lưu ý',
        },
      },
      required: ['mode', 'hint_content', 'detailed_solution'],
    },
    suggested_model_upgrade: {
      type: Type.BOOLEAN,
      description: 'True nếu phát hiện bài hình học nhiều đường phụ hoặc chứng minh phức tạp cần Gemini 2.5 Pro',
    },
    upgrade_reason: { type: Type.STRING },
  },
  required: ['card1_ocr', 'card2_correct', 'card4_guidance'],
};

// 6. Quản lý API Key
export function getSavedApiKey(): string {
  return localStorage.getItem(LOCAL_STORAGE_KEY_API_KEY) || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
}

export function saveApiKey(key: string): void {
  localStorage.setItem(LOCAL_STORAGE_KEY_API_KEY, key.trim());
}

// 7. Hàm gọi Gemini API chấm bài từ ảnh
export async function callGeminiGrading(params: {
  imageBase64: string;
  mimeType: string;
  grade: string;
  studentNote?: string;
  feedbackMode: FeedbackMode;
  apiKey?: string;
  forceProModel?: boolean;
}): Promise<AnalysisResult> {
  const apiKey = params.apiKey || getSavedApiKey();

  if (!apiKey) {
    throw new Error('MISSING_API_KEY');
  }

  const ai = new GoogleGenAI({ apiKey });
  const activeKnowledge = getActiveKnowledge();
  const systemInstruction = buildSystemInstruction(activeKnowledge);

  // Chọn model: mặc định gemini-2.5-flash, nâng cấp lên gemini-2.5-pro nếu được yêu cầu
  const modelName = params.forceProModel ? 'gemini-2.5-pro' : 'gemini-2.5-flash';

  const userPrompt = `
Hãy chấm bài làm viết tay trong ảnh đính kèm theo chương trình: ${params.grade}.
Chế độ phản hồi hiện tại: ${params.feedbackMode === 'hint' ? 'Gợi ý tự sửa (Sư phạm gợi mở)' : 'Lời giải chi tiết'}.
Ghi chú thêm của học sinh: ${params.studentNote || 'Không có'}.

Tuân thủ nghiêm ngặt 4 bước chấm bài, chuẩn hóa LaTeX ($...$ hoặc $$...$$) với dấu phẩy thập phân {,} và trả về JSON theo đúng schema.
`.trim();

  // Tách base64 sạch
  const cleanBase64 = params.imageBase64.includes(',')
    ? params.imageBase64.split(',')[1]
    : params.imageBase64;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: [
      {
        role: 'user',
        parts: [
          { text: userPrompt },
          {
            inlineData: {
              data: cleanBase64,
              mimeType: params.mimeType || 'image/jpeg',
            },
          },
        ],
      },
    ],
    config: {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      temperature: 0.2, // Nhiệt độ 0.2 cho bước chấm bài chính xác
      responseMimeType: 'application/json',
      responseSchema: ANALYSIS_RESPONSE_SCHEMA,
    },
  });

  const responseText = response.text || '{}';
  const parsed: AnalysisResult = JSON.parse(responseText);
  parsed.grade = params.grade;
  parsed.userNote = params.studentNote;

  return parsed;
}

// 8. Hàm gọi Gemini API trò chuyện hỏi đáp nối tiếp
export async function callGeminiFollowUpChat(params: {
  history: Array<{ role: 'user' | 'model'; text: string }>;
  newQuestion: string;
  analysisContext?: AnalysisResult | null;
  apiKey?: string;
  modelName?: string;
}): Promise<string> {
  const apiKey = params.apiKey || getSavedApiKey();

  if (!apiKey) {
    throw new Error('MISSING_API_KEY');
  }

  const ai = new GoogleGenAI({ apiKey });
  const activeKnowledge = getActiveKnowledge();
  const systemInstruction = buildSystemInstruction(activeKnowledge);

  const contextPrompt = params.analysisContext
    ? `
NGỮ CẢNH BÀI LÀM ĐANG KIỂM TRA:
- Lớp: ${params.analysisContext.grade || 'Toán THCS'}
- Đề bài: ${params.analysisContext.card1_ocr?.problem || ''}
- Dòng sai: ${params.analysisContext.card3_error?.line || 'Không có lỗi'} (${params.analysisContext.card3_error?.category || ''})
- Lời giải/Gợi ý: ${params.analysisContext.card4_guidance?.hint_content || ''}
`.trim()
    : '';

  const fullSystemInstruction = `${systemInstruction}\n\n${contextPrompt}`;

  const contents = [
    ...params.history.map((h) => ({
      role: h.role,
      parts: [{ text: h.text }],
    })),
    {
      role: 'user',
      parts: [{ text: params.newQuestion }],
    },
  ];

  const response = await ai.models.generateContent({
    model: params.modelName || 'gemini-2.5-flash',
    contents,
    config: {
      systemInstruction: { parts: [{ text: fullSystemInstruction }] },
      temperature: 0.5, // Nhiệt độ 0.5 cho giao tiếp sư phạm tự nhiên, gợi mở
    },
  });

  return response.text || 'Thầy/Cô chưa nghe rõ câu hỏi của em, em hãy nhắn lại nhé!';
}
