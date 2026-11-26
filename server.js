/**
 * TRỢ GIẢNG AI — KIỂM TRA BÀI LÀM QUA ẢNH
 * Backend Server Node.js (ES Module, Node v20+)
 * Tích hợp Gemini Multimodal API (Hỗ trợ Multi-Key Rotation & Auto-Failover)
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import url, { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. TỰ ĐỘNG ĐỌC BIẾN MÔI TRƯỜNG TỪ .env
export function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        process.env[key] = val;
      }
    }
  }
}
loadEnv();

export const PORT = parseInt(process.env.PORT || '5000', 10);

// Quản lý danh sách API Key & Tự động xoay vòng khi chạm hạn mức
let currentKeyIndex = 0;

export function getApiKeys() {
  const raw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
  return raw
    .split(/[;,]/)
    .map((k) => k.trim())
    .filter((k) => k.length > 10);
}

export function rotateApiKey() {
  const keys = getApiKeys();
  if (keys.length > 1) {
    currentKeyIndex = (currentKeyIndex + 1) % keys.length;
    console.log(`[API Key Rotation] Tự động chuyển sang key index #${currentKeyIndex + 1}/${keys.length} (${keys[currentKeyIndex].slice(0, 14)}...)`);
  }
}

export function getActiveModel() {
  let model = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
  // Nếu model là 2.5-flash hoặc cũ hơn đã bị Google đóng với user mới, tự động fallback sang gemini-3.5-flash
  if (model.includes('2.5') || model.includes('2.0') || model.includes('1.5')) {
    model = 'gemini-3.5-flash';
  }
  return model;
}

export const GEMINI_MODEL = getActiveModel();

// 2. NẠP HỆ THỐNG TRI THỨC TỪ src/ai-config
export function loadKnowledgeBase() {
  const read = (rel) => {
    const full = path.join(__dirname, rel);
    return fs.existsSync(full) ? fs.readFileSync(full, 'utf-8') : '';
  };

  return {
    skillOcr: read('src/ai-config/skills/skill-ocr-va-chuan-hoa-toan.md'),
    skillPhanTich: read('src/ai-config/skills/skill-phan-tich-loi-su-pham.md'),
    persona: read('src/ai-config/persona/tinh-cach-tro-giang.md'),
    agentConfig: read('src/ai-config/agents/tro-giang-cham-bai.agent.md'),
  };
}

export function buildSystemInstruction(kb = loadKnowledgeBase()) {
  return `
# HỆ THỐNG TRI THỨC VÀ QUY TẮC CỦA AGENT TRỢ GIẢNG TOÁN HỌC (GDPT 2018)

## [PHẦN 1: CẤU HÌNH AGENT]
${kb.agentConfig}

## [PHẦN 2: TÍNH CÁCH & GIỌNG ĐIỆU SƯ PHẠM]
${kb.persona}

## [PHẦN 3: KỸ NĂNG OCR & CHUẨN HÓA LATEX]
${kb.skillOcr}

## [PHẦN 4: KỸ NĂNG PHÂN TÍCH LỖI VÀ DẪN DẮT GDPT 2018]
${kb.skillPhanTich}

---
BẮT BUỘC: Khi phân tích ảnh bài làm, trả về JSON chính xác theo 9 trường quy chuẩn:
1. "status": "SUCCESS" | "IMAGE_UNCLEAR" | "ERROR"
2. "ocr_summary": Tóm tắt đề bài và từng dòng bài làm của học sinh có công thức LaTeX ($...$ hoặc $$...$$)
3. "good_points": Danh sách các bước học sinh đã làm đúng, logic chuẩn (khen ngợi cụ thể)
4. "first_error_step": Vị trí dòng hoặc bước đầu tiên bắt đầu sai (hoặc "Không có lỗi")
5. "error_reason": Phân tích bản chất lỗi toán học THCS vì sao dòng đó bị sai
6. "hint_level_1": Gợi ý cấp độ 1: 1-2 câu hỏi gợi mở kiến thức nền tảng (không tiết lộ đáp số)
7. "hint_level_2": Gợi ý cấp độ 2: Hướng dẫn sâu hơn về cách biến đổi/tính toán lại bước sai đó
8. "full_solution": Lời giải chi tiết hoàn chỉnh chuẩn mực từng bước theo GDPT 2018
9. "similar_exercise": Bài tập tương tự cùng dạng toán kèm gợi ý để học sinh luyện lại
`.trim();
}

// 3. SCHEMA ĐẦU RA ÉP BUỘC CHO GEMINI API
export const GRADING_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    status: { type: 'STRING', enum: ['SUCCESS', 'IMAGE_UNCLEAR', 'ERROR'] },
    ocr_summary: {
      type: 'STRING',
      description: 'Đề bài và tóm tắt từng bước học sinh đã làm dưới dạng công thức LaTeX ($...$ hoặc $$...$$)',
    },
    good_points: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'Các điểm học sinh đã làm tốt, được khen ngợi cụ thể',
    },
    first_error_step: {
      type: 'STRING',
      description: 'Dòng hoặc bước đầu tiên xuất hiện lỗi (hoặc "Không có lỗi")',
    },
    error_reason: {
      type: 'STRING',
      description: 'Giải thích nguyên nhân vì sao dòng đó bị sai theo kiến thức toán THCS',
    },
    hint_level_1: {
      type: 'STRING',
      description: 'Gợi ý cấp độ 1: Câu hỏi gợi mở định hướng kiến thức nền tảng',
    },
    hint_level_2: {
      type: 'STRING',
      description: 'Gợi ý cấp độ 2: Hướng dẫn cụ thể cách biến đổi lại bước sai đó',
    },
    full_solution: {
      type: 'STRING',
      description: 'Lời giải chi tiết chuẩn mẫu từng bước theo GDPT 2018',
    },
    similar_exercise: {
      type: 'STRING',
      description: 'Đề bài tập tương tự kèm gợi ý để học sinh luyện lại',
    },
  },
  required: [
    'status',
    'ocr_summary',
    'good_points',
    'first_error_step',
    'error_reason',
    'hint_level_1',
    'hint_level_2',
    'full_solution',
    'similar_exercise',
  ],
};

// 4. MẪU DỮ LIỆU DỰ PHÒNG CHẤT LƯỢNG CAO (FALLBACK KHI CHƯA CÓ API KEY HOẶC TEST)
export const SAMPLE_MOCKS = {
  sample1: {
    status: 'SUCCESS',
    ocr_summary: 'Đề bài: Giải phương trình chứa ẩn ở mẫu $$\\frac{x^2 - 4}{x - 2} = 3x + 1$$\nCác bước bài làm:\n• Dòng 1: $\\frac{(x - 2)(x + 2)}{x - 2} = 3x + 1$\n• Dòng 2: $\\Rightarrow x + 2 = 3x + 1$\n• Dòng 3: $\\Rightarrow 3x - x = 2 - 1 \\Rightarrow 2x = 1 \\Rightarrow x = \\frac{1}{2}$\n• Dòng 4: Cho $x - 2 = 0 \\Rightarrow x = 2$, kết luận $S = \\left\\{\\frac{1}{2};\\, 2\\right\\}$',
    good_points: [
      'Phân tích tử thức thành nhân tử rất chính xác bằng hằng đẳng thức hiệu hai bình phương: $x^2 - 4 = (x - 2)(x + 2)$.',
      'Rút gọn nhân tử chung $(x - 2)$ và giải phương trình bậc nhất tìm được $x = \\frac{1}{2}$ chuẩn xác.',
    ],
    first_error_step: 'Ngay từ đầu bài & Dòng 4',
    error_reason:
      'Phương trình có chứa ẩn ở mẫu thức $(x - 2)$ nhưng bài làm chưa đặt ĐKXĐ $x - 2 \\neq 0 \\Leftrightarrow x \\neq 2$. Ở Dòng 4 em lại giải thêm $x - 2 = 0 \\Rightarrow x = 2$: đây là giá trị làm mẫu thức bằng 0 (phép chia vô nghĩa) nên không thể là nghiệm.',
    hint_level_1:
      'Một phân thức $\\frac{A}{B}$ chỉ xác định khi mẫu thức $B$ như thế nào? Em hãy kiểm tra xem mẫu $(x - 2)$ cần điều kiện gì của $x$ nhé!',
    hint_level_2:
      'Điều kiện xác định bắt buộc là $x \\neq 2$. Khi đã rút gọn được $x + 2 = 3x + 1$, ta chỉ giải ra $x = \\frac{1}{2}$. Giá trị $x = 2$ làm mẫu bằng 0 nên bị loại, không lấy làm nghiệm!',
    full_solution:
      '**Lời giải chuẩn (Toán 9):**\n\n• **Điều kiện xác định:** $x - 2 \\neq 0 \\Leftrightarrow x \\neq 2$.\n\n• **Biến đổi phương trình:**\n$$\\frac{(x - 2)(x + 2)}{x - 2} = 3x + 1 \\Leftrightarrow x + 2 = 3x + 1 \\quad (\\text{do } x \\neq 2)$$\n$$2x = 1 \\Leftrightarrow x = \\frac{1}{2} \\quad (\\text{thỏa mãn ĐKXĐ})$$\n\n• **Kết luận:** Vậy phương trình có nghiệm duy nhất $x = \\frac{1}{2}$.',
    similar_exercise:
      '**Bài tập tương tự:** Giải phương trình $\\frac{x^2 - 9}{x + 3} = 2x - 5$.\n*(Gợi ý: Nhớ đặt ĐKXĐ $x + 3 \\neq 0$ ngay dòng đầu tiên nhé!)*',
  },
  sample2: {
    status: 'SUCCESS',
    ocr_summary: 'Đề bài: Rút gọn biểu thức chứa căn bậc hai $$A = \\sqrt{(3 - \\sqrt{5})^2} - \\sqrt{(2 - \\sqrt{5})^2}$$\nCác bước bài làm:\n• Dòng 1: $A = |3 - \\sqrt{5}| - |2 - \\sqrt{5}|$\n• Dòng 2: $A = (3 - \\sqrt{5}) - (\\sqrt{5} - 2)$\n• Dòng 3: $A = 3 - \\sqrt{5} - \\sqrt{5} - 2$\n• Dòng 4: $A = 1 - 2\\sqrt{5}$',
    good_points: [
      'Áp dụng rất tốt hằng đẳng thức $\\sqrt{A^2} = |A|$ ở Dòng 1.',
      'So sánh đúng $3 > \\sqrt{5}$ và $2 < \\sqrt{5}$ để phá dấu giá trị tuyệt đối chuẩn xác ở Dòng 2.',
    ],
    first_error_step: 'Dòng 3 (bước phá ngoặc)',
    error_reason:
      'Ở Dòng 2 em viết đúng $-(\\sqrt{5} - 2)$. Nhưng khi phá dấu ngoặc có dấu trừ đằng trước ở Dòng 3, em mới đổi dấu $+\\sqrt{5}$ thành $-\\sqrt{5}$ mà quên đổi dấu $-2$ thành $+2$, dẫn đến viết nhầm thành $-2$.',
    hint_level_1:
      'Khi bỏ dấu ngoặc mà đằng trước có dấu trừ: $-(a - b) = -a + b$. Em hãy kiểm tra lại dấu của số 2 ở Dòng 3 nhé!',
    hint_level_2:
      'Biểu thức đúng khi bỏ ngoặc là: $-(\\sqrt{5} - 2) = -\\sqrt{5} + 2$. Khi đó phần số nguyên thu gọn sẽ là $3 + 2 = 5$ thay vì $3 - 2 = 1$.',
    full_solution:
      '**Lời giải chuẩn (Toán 9):**\n$$A = \\sqrt{(3 - \\sqrt{5})^2} - \\sqrt{(2 - \\sqrt{5})^2} = |3 - \\sqrt{5}| - |2 - \\sqrt{5}|$$\nVì $3 = \\sqrt{9} > \\sqrt{5}$ và $2 = \\sqrt{4} < \\sqrt{5}$ nên:\n$$A = (3 - \\sqrt{5}) - (\\sqrt{5} - 2) = 3 - \\sqrt{5} - \\sqrt{5} + 2 = 5 - 2\\sqrt{5}$$\n**Kết luận:** $A = 5 - 2\\sqrt{5}$.',
    similar_exercise:
      '**Bài tập tương tự:** Rút gọn biểu thức $B = \\sqrt{(4 - \\sqrt{7})^2} - \\sqrt{(2 - \\sqrt{7})^2}$.',
  },
  sample3: {
    status: 'SUCCESS',
    ocr_summary: 'Đề bài: Giải hệ phương trình bậc nhất hai ẩn $$\\begin{cases} 2x + y = 5 \\\\ 3x - y = 5 \\end{cases}$$\nCác bước bài làm:\n• Dòng 1: Cộng từng vế: $(2x + 3x) + (y - y) = 5 + 5$\n• Dòng 2: $\\Leftrightarrow 5x = 10 \\Leftrightarrow x = 2$\n• Dòng 3: Thay $x = 2$ vào phương trình đầu: $2 \\cdot 2 + y = 5 \\Leftrightarrow y = 1$\n• Dòng 4: Kết luận $(x;\\, y) = (2;\\, 1)$',
    good_points: [
      'Chính xác hoàn toàn 100%! Em nhận xét hệ số của $y$ đối nhau ($+1$ và $-1$) nên chọn phương pháp cộng đại số là tối ưu nhất.',
      'Các bước tìm $x = 2$, thế tìm $y = 1$ và kết luận cặp nghiệm $(x; y) = (2; 1)$ đều đạt chuẩn thi vào 10.',
    ],
    first_error_step: 'Không có lỗi (Bài làm đạt điểm tối đa)',
    error_reason: 'Toàn bộ các bước biến đổi và tính toán số học đều chính xác tuyệt đối.',
    hint_level_1: 'Bài làm của em hoàn hảo! Em có thể thử thay lại $(x; y) = (2; 1)$ vào phương trình thứ hai để tự kiểm tra.',
    hint_level_2: 'Em có thể luyện tập giải lại bài này bằng phương pháp thế để nâng cao tốc độ làm bài.',
    full_solution:
      '**Lời giải chuẩn:**\nCộng từng vế hai phương trình của hệ:\n$$5x = 10 \\Leftrightarrow x = 2$$\nThay $x = 2$ vào phương trình thứ nhất:\n$$2 \\cdot 2 + y = 5 \\Leftrightarrow 4 + y = 5 \\Leftrightarrow y = 1$$\nVậy hệ phương trình có nghiệm duy nhất $(x;\\, y) = (2;\\, 1)$.',
    similar_exercise:
      '**Bài tập tương tự:** Giải hệ phương trình $\\begin{cases} 2x + 3y = 8 \\\\ 4x - y = 2 \\end{cases}$.',
  },
};

// 5. HÀM GỌI GEMINI MULTIMODAL API (HỖ TRỢ KEY ROTATION VÀ FAILOVER)
export async function callGeminiApi({ imageBase64, mimeType = 'image/png', studentNote, mode = 'tutor', grade = 'Toán 9', apiKey }) {
  const keys = apiKey ? [apiKey] : getApiKeys();
  if (keys.length === 0) {
    throw new Error('MISSING_API_KEY');
  }

  const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
  const sysInstruction = buildSystemInstruction();

  const isTutor = mode === 'tutor' || mode === 'Gia sư';
  const userPrompt = `
Hãy chấm bài làm viết tay trong ảnh đính kèm theo chương trình: ${grade}.
Chế độ phản hồi: ${isTutor ? 'Gia sư (Ưu tiên câu hỏi gợi mở, không tiết lộ đáp số trong gợi ý)' : 'Chấm nhanh (Trình bày đầy đủ lỗi và đáp số)'}.
Ghi chú thêm của học sinh: ${studentNote || 'Không có'}.

Bắt buộc trả về JSON chính xác theo đúng 9 trường quy định trong Schema:
status, ocr_summary, good_points, first_error_step, error_reason, hint_level_1, hint_level_2, full_solution, similar_exercise.
`.trim();

  const model = getActiveModel();
  let lastError = null;
  const maxAttempts = Math.min(keys.length, 5);
  const startIndex = currentKeyIndex;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const keyIndex = (startIndex + attempt) % keys.length;
    const keyToUse = keys[keyIndex];
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keyToUse}`;

    const requestBody = {
      system_instruction: { parts: [{ text: sysInstruction }] },
      contents: [
        {
          role: 'user',
          parts: [
            { text: userPrompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: cleanBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2, // Chuẩn xác toán học
        responseMimeType: 'application/json',
        responseSchema: GRADING_RESPONSE_SCHEMA,
      },
    };

    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        const errStatus = resp.status;
        console.warn(`[Gemini API Attempt ${attempt + 1}/${maxAttempts} Failed] Status: ${errStatus} Key #${keyIndex + 1}: ${keyToUse.slice(0, 14)}...`);
        lastError = new Error(`Gemini API Error ${errStatus}: ${errText}`);
        currentKeyIndex = (keyIndex + 1) % keys.length;
        continue;
      }

      const data = await resp.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error('Gemini API trả về nội dung rỗng');
      }

      // Ghi nhận key index chạy thành công để ưu tiên cho lần gọi tiếp theo
      currentKeyIndex = keyIndex;
      return JSON.parse(rawText);
    } catch (err) {
      lastError = err;
      currentKeyIndex = (keyIndex + 1) % keys.length;
    }
  }

  throw lastError || new Error('Không thể kết nối đến Gemini API sau nhiều lần thử.');
}

// 6. HÀM GỌI GEMINI CHAT TIẾP THEO NGỮ CẢNH (HỖ TRỢ KEY ROTATION VÀ FAILOVER)
export async function callGeminiChat({ message, history = [], context = {}, apiKey }) {
  const keys = apiKey ? [apiKey] : getApiKeys();
  if (keys.length === 0) {
    throw new Error('MISSING_API_KEY');
  }

  const sysInstruction = buildSystemInstruction();
  const contextText = `
NGỮ CẢNH BÀI TOÁN VỪA CHẤM CỦA HỌC SINH:
- Đề bài & Bài làm: ${context.ocr_summary || 'Chưa có'}
- Dòng sai: ${context.first_error_step || 'Không có'}
- Nguyên nhân sai: ${context.error_reason || 'Không có'}
- Lời giải đúng: ${context.full_solution || 'Chưa có'}
`.trim();

  const contents = [
    ...history.map((h) => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.content || h.text || '' }],
    })),
    {
      role: 'user',
      parts: [{ text: message }],
    },
  ];

  const model = getActiveModel();
  let lastError = null;
  const maxAttempts = Math.min(keys.length, 5);
  const startIndex = currentKeyIndex;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const keyIndex = (startIndex + attempt) % keys.length;
    const keyToUse = keys[keyIndex];
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keyToUse}`;

    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: `${sysInstruction}\n\n${contextText}` }] },
          contents,
          generationConfig: {
            temperature: 0.5, // Tự nhiên, ấm áp, sư phạm
          },
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        const errStatus = resp.status;
        console.warn(`[Gemini Chat Attempt ${attempt + 1}/${maxAttempts} Failed] Status: ${errStatus} Key #${keyIndex + 1}: ${keyToUse.slice(0, 14)}...`);
        lastError = new Error(`Gemini API Chat Error ${errStatus}: ${errText}`);
        currentKeyIndex = (keyIndex + 1) % keys.length;
        continue;
      }

      const data = await resp.json();
      currentKeyIndex = keyIndex;
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Thầy/Cô chưa nghe rõ, em hãy nhắn lại nhé!';
    } catch (err) {
      lastError = err;
      currentKeyIndex = (keyIndex + 1) % keys.length;
    }
  }

  throw lastError || new Error('Không thể kết nối đến Gemini Chat API sau nhiều lần thử.');
}

// 7. XỬ LÝ HTTP SERVER
function readRequestBody(req) {
  if (req.body && typeof req.body === 'object') {
    return Promise.resolve(req.body);
  }
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 25 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({ raw: body });
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  const payload = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(payload);
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
};

export async function handleRequest(req, res) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  try {
    const keys = getApiKeys();
    const activeModel = getActiveModel();

    // API: GET /api/health
    if (req.method === 'GET' && pathname === '/api/health') {
      return sendJson(res, 200, {
        status: 'ok',
        model: activeModel,
        keys_count: keys.length,
        gemini_configured: keys.length > 0,
        port: PORT,
      });
    }

    // API: GET /api/config
    if (req.method === 'GET' && pathname === '/api/config') {
      return sendJson(res, 200, {
        knowledge: loadKnowledgeBase(),
        model: activeModel,
        keys_count: keys.length,
        gemini_configured: keys.length > 0,
      });
    }

    // API: POST /api/admin/login (Xác thực quản trị viên bảo mật)
    if (req.method === 'POST' && pathname === '/api/admin/login') {
      const body = await readRequestBody(req);
      const inputUser = String(body.username || '').trim();
      const inputPass = String(body.password || '');
      const expectedUser = process.env.ADMIN_USER || 'admin';
      const expectedHash = process.env.ADMIN_PASS_HASH || '83b9d1805dc2c2e57ac23906434636927feede7fb667dcb3831fa305618662c3';
      const inputHash = crypto.createHash('sha256').update(inputPass).digest('hex');

      if (inputUser === expectedUser && inputHash === expectedHash) {
        return sendJson(res, 200, { ok: true, message: 'Đăng nhập thành công' });
      }
      return sendJson(res, 401, { ok: false, message: 'Sai tên đăng nhập hoặc mật khẩu' });
    }

    // API: POST /api/grade (Chấm bài qua ảnh)
    if (req.method === 'POST' && (pathname === '/api/grade' || pathname === '/api/analyze')) {
      const body = await readRequestBody(req);

      // Nhận diện bài mẫu nếu có
      if (body.sample_id && SAMPLE_MOCKS[body.sample_id]) {
        return sendJson(res, 200, {
          ...SAMPLE_MOCKS[body.sample_id],
          source: 'sample_mock',
        });
      }

      // Thử gọi Gemini Multimodal API thực tế nếu có API Key và ảnh
      const effectiveKey = body.api_key || (keys.length > 0 ? keys[0] : null);
      if (effectiveKey && body.image) {
        try {
          const result = await callGeminiApi({
            imageBase64: body.image,
            mimeType: body.mime_type || 'image/png',
            studentNote: body.student_note || body.note,
            mode: body.mode || 'tutor',
            grade: body.grade || 'Toán 9',
            apiKey: body.api_key, // nếu body không có apiKey thì callGeminiApi tự xoay vòng keys
          });
          return sendJson(res, 200, { ...result, source: 'gemini_api' });
        } catch (geminiError) {
          console.warn('[Gemini API Warning]', geminiError.message);
          const fallback = SAMPLE_MOCKS.sample1;
          return sendJson(res, 200, {
            ...fallback,
            source: 'fallback_mock',
            warning: geminiError.message,
          });
        }
      }

      // Không có API key hoặc ảnh: trả về mẫu mô phỏng chuẩn 9 trường
      const fallbackResult = body.sample_id
        ? SAMPLE_MOCKS[body.sample_id]
        : SAMPLE_MOCKS.sample1;
      return sendJson(res, 200, {
        ...fallbackResult,
        source: 'simulation',
        note_echo: body.student_note,
      });
    }

    // API: POST /api/chat (Hỏi đáp tiếp theo ngữ cảnh)
    if (req.method === 'POST' && pathname === '/api/chat') {
      const body = await readRequestBody(req);
      const userMessage = body.message || '';
      const effectiveKey = body.api_key || (keys.length > 0 ? keys[0] : null);

      if (effectiveKey) {
        try {
          const reply = await callGeminiChat({
            message: userMessage,
            history: body.history || [],
            context: body.context || {},
            apiKey: body.api_key,
          });
          return sendJson(res, 200, { reply, source: 'gemini_api' });
        } catch (err) {
          console.warn('[Gemini Chat Warning]', err.message);
        }
      }

      // Phản hồi mô phỏng sư phạm chuẩn
      let reply = 'Em hỏi câu này rất hay! ';
      const q = userMessage.toLowerCase();
      if (q.includes('đổi dấu') || q.includes('điều kiện') || q.includes('tại sao')) {
        reply +=
          'Trong toán học THCS, khi nhân hoặc chia một số âm với một số âm thì kết quả luôn mang dấu **dương**: $(-a) \\cdot (-b) = ab$. Đồng thời với mẫu thức thì luôn cần điều kiện khác 0 để phân thức có nghĩa em nhé!';
      } else if (q.includes('tương tự') || q.includes('luyện lại')) {
        reply +=
          'Thầy/Cô tặng em một bài tương tự để làm chủ dạng này nè: **Giải phương trình $\\frac{x^2 - 1}{x + 1} = 4x - 7$**. Em làm ra vở rồi gửi Thầy/Cô xem nhé!';
      } else {
        reply +=
          'Em hãy lưu ý luôn bám sát 3 bước: (1) Đặt điều kiện, (2) Biến đổi cẩn thận dấu ngoặc, và (3) Thử lại nghiệm. Em có thắc mắc cụ thể bước nào nữa không?';
      }

      return sendJson(res, 200, { reply, source: 'simulation' });
    }

    // PHỤC VỤ STATIC FILES CHO FRONTEND
    let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(__dirname, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = fs.readFileSync(filePath);

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (serverError) {
    console.error('[Server Error]', serverError);
    sendJson(res, 500, { error: 'Internal Server Error', message: serverError.message });
  }
}

export const server = http.createServer(handleRequest);

// Chỉ start server khi file được chạy trực tiếp
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  server.listen(PORT, () => {
    const keys = getApiKeys();
    console.log(`[Trợ Giảng AI Backend] Server running at http://localhost:${PORT}`);
    console.log(`[Config] Model: ${getActiveModel()} | Gemini Keys Active: ${keys.length} keys`);
  });
}

export default server;
