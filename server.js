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

// 1. TỰ ĐỘNG ĐỌC BIẾN MÔI TRƯỜNG TỪ .env VÀ .env.local (.env.local ưu tiên hơn)
export function loadEnv() {
  for (const fname of ['.env', '.env.local']) {
    const envPath = path.join(__dirname, fname);
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const idx = trimmed.indexOf('=');
        if (idx !== -1) {
          const key = trimmed.slice(0, idx).trim();
          let val = trimmed.slice(idx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          process.env[key] = val;
        }
      }
    }
  }
}
loadEnv();

export const PORT = parseInt(process.env.PORT || '5000', 10);

// Quản lý danh sách API Key, xoay vòng đều theo từng câu hỏi, và theo dõi trạng thái key × mô hình
let requestCounter = 0;
let lastUsedModel = process.env.GEMINI_MODEL || '';
const geminiErrorLogs = [];
const pairCooldowns = new Map();     // `${keyIndex}:${model}` -> expiryMs (429 -> 60s)
const keyBadCooldowns = new Map();   // keyIndex -> expiryMs (400/403 -> 10m)
const deadModels = new Set();        // models that returned 404
const keyModelStatus = new Map();    // `${keyIndex}:${model}` -> { keyIndex, model, status, updatedAt }

let cachedModelsList = null;
let cachedModelsAt = 0;
const MODELS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 giờ

function recordGeminiError({ endpoint, status, keyIndex, model, message }) {
  const entry = {
    timestamp: new Date().toISOString(),
    endpoint,
    status: status || 'NETWORK',
    keyIndex: keyIndex != null ? keyIndex + 1 : null,
    model: model || null,
    message: String(message || '').slice(0, 300),
  };
  geminiErrorLogs.unshift(entry);
  if (geminiErrorLogs.length > 20) geminiErrorLogs.length = 20;
  if (keyIndex != null && model) {
    keyModelStatus.set(`${keyIndex}:${model}`, {
      key: `Key #${keyIndex + 1}`,
      model,
      status: String(status),
      updatedAt: entry.timestamp,
    });
  }
  console.error(`[Gemini Error] ${entry.timestamp} | ${endpoint} | Model=${model || '?'} | Status=${entry.status} | Key #${entry.keyIndex || '?'} | ${entry.message}`);
}

function recordKeyModelOk(keyIndex, model) {
  lastUsedModel = model;
  keyModelStatus.set(`${keyIndex}:${model}`, {
    key: `Key #${keyIndex + 1}`,
    model,
    status: 'OK',
    updatedAt: new Date().toISOString(),
  });
}

export function getApiKeys() {
  const parts = [];
  const mainRaw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
  if (mainRaw) parts.push(...mainRaw.split(/[;,]/));
  for (let i = 2; i <= 10; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`];
    if (k) parts.push(k);
  }
  return [...new Set(parts.map((k) => k.trim()).filter((k) => k.length > 10))];
}

export function getActiveModel() {
  return lastUsedModel || process.env.GEMINI_MODEL || 'gemini-flash-latest';
}

async function fetchAvailableFlashModels(keys) {
  const now = Date.now();
  if (cachedModelsList && now - cachedModelsAt < MODELS_CACHE_TTL_MS) {
    return cachedModelsList;
  }
  for (let i = 0; i < keys.length; i++) {
    if ((keyBadCooldowns.get(i) || 0) > now) continue;
    try {
      const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
        method: 'GET',
        headers: { 'x-goog-api-key': keys[i] },
      });
      if (!resp.ok) continue;
      const data = await resp.json();
      const models = (data.models || [])
        .filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
        .map((m) => String(m.name || '').replace(/^models\//, ''))
        .filter((name) => /flash/i.test(name) && !/image|audio|tts|thinking|exp|preview/i.test(name));

      const regularFlash = models.filter((n) => !/lite/i.test(n)).sort().reverse();
      const liteFlash = models.filter((n) => /lite/i.test(n)).sort().reverse();
      const ordered = [...new Set([...regularFlash, ...liteFlash])];
      if (ordered.length > 0) {
        cachedModelsList = ordered;
        cachedModelsAt = now;
        return ordered;
      }
    } catch {}
  }
  return cachedModelsList || [];
}

async function getModelFallbackChain(keys) {
  const discovered = await fetchAvailableFlashModels(keys);
  const envModel = (process.env.GEMINI_MODEL || '').trim();
  const chain = [];
  if (envModel) chain.push(envModel);
  for (const m of discovered) {
    if (!chain.includes(m)) chain.push(m);
  }
  if (chain.length === 0) {
    chain.push('gemini-flash-latest', 'gemini-flash-lite-latest');
  }
  return chain.filter((m) => !deadModels.has(m));
}

function normalizeContents(history = [], userText, inlineImage = null) {
  const merged = [];
  for (const h of history) {
    const role = h.role === 'model' ? 'model' : 'user';
    const text = String(h.content || h.text || '').trim();
    if (!text) continue;
    if (merged.length === 0 && role !== 'user') continue; // Lượt đầu bắt buộc là user
    if (merged.length > 0 && merged[merged.length - 1].role === role) {
      merged[merged.length - 1].parts[0].text += '\n' + text;
    } else {
      merged.push({ role, parts: [{ text }] });
    }
  }
  const cleanUserText = String(userText || '').trim();
  const userParts = [];
  if (cleanUserText) userParts.push({ text: cleanUserText });
  if (inlineImage && inlineImage.data) {
    userParts.push({ inlineData: { mimeType: inlineImage.mimeType || 'image/png', data: inlineImage.data } });
  }
  if (userParts.length === 0) userParts.push({ text: 'Xin hỗ trợ bài toán này.' });

  if (merged.length > 0 && merged[merged.length - 1].role === 'user' && !inlineImage) {
    merged[merged.length - 1].parts[0].text += '\n' + cleanUserText;
  } else if (merged.length > 0 && merged[merged.length - 1].role === 'user' && inlineImage) {
    merged.push({ role: 'model', parts: [{ text: 'Đã nhận thông tin.' }] });
    merged.push({ role: 'user', parts: userParts });
  } else {
    merged.push({ role: 'user', parts: userParts });
  }
  return merged;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function extractNonThoughtText(candidate) {
  return (candidate?.content?.parts || [])
    .filter((p) => !p.thought)
    .map((p) => p.text || '')
    .join('');
}

function buildGenerationConfig(baseConfig, includeThinking = true) {
  const cfg = { ...baseConfig, maxOutputTokens: 8192 };
  if (includeThinking) {
    cfg.thinkingConfig = { thinkingBudget: 512 };
  }
  return cfg;
}

async function executeGeminiSingleCall({ endpointName, model, keyToUse, keyIndex, systemInstructionText, contents, generationConfig }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  let useThinking = true;

  for (let pass = 0; pass < 2; pass++) {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': keyToUse,
      },
      signal: AbortSignal.timeout(25000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstructionText }] },
        contents,
        generationConfig: buildGenerationConfig(generationConfig, useThinking),
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      if (resp.status === 400 && useThinking && /thinking/i.test(errText)) {
        useThinking = false;
        continue; // Mô hình không hỗ trợ thinkingConfig -> bỏ qua tham số này
      }
      const err = new Error(`Gemini ${resp.status} (${model}, Key #${keyIndex + 1}): ${errText}`);
      err.status = resp.status;
      err.errText = errText;
      throw err;
    }

    const data = await resp.json();
    const candidate = data?.candidates?.[0];
    const text = extractNonThoughtText(candidate).trim();
    if (!text) {
      const reason = candidate?.finishReason || data?.promptFeedback?.blockReason || 'EMPTY_RESPONSE';
      throw new Error(`Gemini trả về rỗng hoặc bị chặn (${reason})`);
    }
    return {
      text,
      finishReason: candidate?.finishReason || 'STOP',
      usageMetadata: data?.usageMetadata || null,
    };
  }
}

async function executeGeminiWithRotation({ endpointName, keys, systemInstructionText, contents, generationConfig }) {
  const modelChain = await getModelFallbackChain(keys);
  const startKey = requestCounter % keys.length;
  requestCounter = (requestCounter + 1) % 1000000;
  let lastError = null;

  for (const model of modelChain) {
    if (deadModels.has(model)) continue;

    for (let offset = 0; offset < keys.length; offset++) {
      const keyIndex = (startKey + offset) % keys.length;
      const now = Date.now();
      if ((keyBadCooldowns.get(keyIndex) || 0) > now) continue;
      if ((pairCooldowns.get(`${keyIndex}:${model}`) || 0) > now) continue;

      const keyToUse = keys[keyIndex];
      let retried503 = 0;

      while (true) {
        try {
          const first = await executeGeminiSingleCall({
            endpointName,
            model,
            keyToUse,
            keyIndex,
            systemInstructionText,
            contents,
            generationConfig,
          });

          let fullText = first.text;
          let finalReason = first.finishReason;
          let continuations = 0;

          // Nếu bị MAX_TOKENS: tự động nối tiếp tối đa 2 lần
          while (finalReason === 'MAX_TOKENS' && continuations < 2 && !generationConfig?.responseSchema) {
            continuations += 1;
            const contContents = [
              ...contents,
              { role: 'model', parts: [{ text: fullText }] },
              { role: 'user', parts: [{ text: 'Viết tiếp chính xác từ chỗ đang dừng, không lặp lại phần trước.' }] },
            ];
            const nextPart = await executeGeminiSingleCall({
              endpointName,
              model,
              keyToUse,
              keyIndex,
              systemInstructionText,
              contents: contContents,
              generationConfig,
            });
            fullText += nextPart.text;
            finalReason = nextPart.finishReason;
          }

          recordKeyModelOk(keyIndex, model);
          return { text: fullText, finishReason: finalReason, model, keyIndex: keyIndex + 1, usageMetadata: first.usageMetadata };
        } catch (err) {
          const status = err.status || 'EXCEPTION';
          recordGeminiError({ endpoint: endpointName, status, keyIndex, model, message: err.errText || err.message });
          lastError = err;

          if (status === 404) {
            deadModels.add(model);
            break;
          }
          if (status === 400 || status === 403) {
            keyBadCooldowns.set(keyIndex, Date.now() + 10 * 60 * 1000);
            break;
          }
          if (status === 429) {
            pairCooldowns.set(`${keyIndex}:${model}`, Date.now() + 60 * 1000);
            break;
          }
          if (status === 503 && retried503 < 2) {
            const waitMs = retried503 === 0 ? 2000 : 4000;
            retried503 += 1;
            await sleep(waitMs);
            continue;
          }
          break;
        }
      }
      if (deadModels.has(model)) break;
    }
  }

  throw lastError || new Error('Tất cả API key và mô hình Gemini đều đang bận hoặc hết hạn mức.');
}

async function streamGeminiSseCall({ model, keyToUse, systemInstructionText, contents, generationConfig, onDelta }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;
  let useThinking = true;

  for (let pass = 0; pass < 2; pass++) {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': keyToUse,
      },
      signal: AbortSignal.timeout(25000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstructionText }] },
        contents,
        generationConfig: buildGenerationConfig(generationConfig, useThinking),
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      if (resp.status === 400 && useThinking && /thinking/i.test(errText)) {
        useThinking = false;
        continue;
      }
      const err = new Error(`Gemini Stream ${resp.status} (${model}): ${errText}`);
      err.status = resp.status;
      err.errText = errText;
      throw err;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let collected = '';
    let finishReason = 'STOP';
    let usageMetadata = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) continue;
        const jsonStr = line.slice(5).trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const candidate = parsed?.candidates?.[0];
          if (candidate?.finishReason) finishReason = candidate.finishReason;
          if (parsed?.usageMetadata) usageMetadata = parsed.usageMetadata;
          const chunkText = extractNonThoughtText(candidate);
          if (chunkText) {
            collected += chunkText;
            onDelta(chunkText);
          }
        } catch {}
      }
    }
    return { text: collected, finishReason, usageMetadata };
  }
}

async function executeGeminiStreamWithRotation({ endpointName, keys, systemInstructionText, contents, generationConfig, onDelta }) {
  const modelChain = await getModelFallbackChain(keys);
  const startKey = requestCounter % keys.length;
  requestCounter = (requestCounter + 1) % 1000000;
  let lastError = null;

  for (const model of modelChain) {
    if (deadModels.has(model)) continue;

    for (let offset = 0; offset < keys.length; offset++) {
      const keyIndex = (startKey + offset) % keys.length;
      const now = Date.now();
      if ((keyBadCooldowns.get(keyIndex) || 0) > now) continue;
      if ((pairCooldowns.get(`${keyIndex}:${model}`) || 0) > now) continue;

      const keyToUse = keys[keyIndex];
      let retried503 = 0;

      while (true) {
        let emittedAny = false;
        try {
          const first = await streamGeminiSseCall({
            model,
            keyToUse,
            systemInstructionText,
            contents,
            generationConfig,
            onDelta: (d) => { emittedAny = true; onDelta(d); },
          });

          let fullText = first.text;
          let finalReason = first.finishReason;
          let continuations = 0;

          while (finalReason === 'MAX_TOKENS' && continuations < 2) {
            continuations += 1;
            const contContents = [
              ...contents,
              { role: 'model', parts: [{ text: fullText }] },
              { role: 'user', parts: [{ text: 'Viết tiếp chính xác từ chỗ đang dừng, không lặp lại phần trước.' }] },
            ];
            const nextPart = await streamGeminiSseCall({
              model,
              keyToUse,
              systemInstructionText,
              contents: contContents,
              generationConfig,
              onDelta,
            });
            fullText += nextPart.text;
            finalReason = nextPart.finishReason;
          }

          if (!fullText.trim()) {
            throw new Error('Gemini stream trả về rỗng');
          }
          recordKeyModelOk(keyIndex, model);
          return { text: fullText, finishReason: finalReason, model, keyIndex: keyIndex + 1, usageMetadata: first.usageMetadata };
        } catch (err) {
          const status = err.status || 'EXCEPTION';
          recordGeminiError({ endpoint: endpointName, status, keyIndex, model, message: err.errText || err.message });
          lastError = err;
          if (emittedAny) {
            // Đã stream một phần ra client -> ném lỗi để client hiện nút Viết tiếp
            err.partialStreamed = true;
            throw err;
          }
          if (status === 404) { deadModels.add(model); break; }
          if (status === 400 || status === 403) { keyBadCooldowns.set(keyIndex, Date.now() + 10 * 60 * 1000); break; }
          if (status === 429) { pairCooldowns.set(`${keyIndex}:${model}`, Date.now() + 60 * 1000); break; }
          if (status === 503 && retried503 < 2) {
            const waitMs = retried503 === 0 ? 2000 : 4000;
            retried503 += 1;
            await sleep(waitMs);
            continue;
          }
          break;
        }
      }
      if (deadModels.has(model)) break;
    }
  }

  throw lastError || new Error('Tất cả API key và mô hình Gemini đều đang bận hoặc hết hạn mức.');
}

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
NGUYÊN TẮC KHÍCH LỆ TÂM LÝ HỌC SINH: Khi học sinh hỏi bài hoặc gặp khó khăn, TUYỆT ĐỐI KHÔNG dùng các từ/cụm từ mang tính xem nhẹ như "đơn giản", "rất đơn giản", "dễ", "quá dễ", "very simple", "simple", "easy" để tránh làm học sinh tự ti hoặc nản lòng. Hãy luôn khích lệ tự nhiên.

NGUYÊN TẮC TRẢ LỜI ĐÚNG TRỌNG TÂM & KHÔNG LẶP LẠI:
- Đọc kỹ câu hỏi và trả lời ĐÚNG TRỌNG TÂM điều học sinh hỏi. Không trả lời chung chung, không lặp lại cùng một câu mở đầu.
- Câu hỏi tính toán đơn giản (ví dụ 1+1, căn bậc hai của 9): trả lời ngay kết quả và giải thích ngắn 1–2 câu.
- Bài tập cần giải (ví dụ Tìm x biết 2x = 4): hướng dẫn theo gợi ý từng bước, đặt câu hỏi gợi mở để học sinh tự làm; nếu học sinh đã thử hoặc hỏi đáp án để kiểm tra thì đưa đáp án kèm lời giải ngắn.
- Câu hỏi kiến thức, công thức: giải thích ngắn, có ví dụ, có mẹo ghi nhớ.
- Yêu cầu ra đề theo Công văn 7991: ra đề ngắn gồm trắc nghiệm nhiều lựa chọn, đúng/sai, trả lời ngắn hoặc tự luận, đúng kiến thức lớp đang chọn; chưa đưa đáp án, chờ học sinh làm xong mới chấm.
- Chỉ dùng kiến thức trong chương trình lớp đang chọn và các lớp dưới.
- Công thức toán viết bằng LaTeX ($...$ hoặc $$...$$).
- Không dùng các từ 'đơn giản', 'dễ', 'very simple', 'easy' khi học sinh hỏi bài.
- Câu hỏi không liên quan đến học tập: nhẹ nhàng hướng học sinh quay lại môn Toán.

QUY TẮC TRÌNH BÀY & ĐỘ DÀI (BẮT BUỘC):
- Trả lời ĐẦY ĐỦ trong MỘT lần, không chia nhỏ, không hứa "thầy/cô sẽ gửi" rồi dừng lại.
- Câu mở đầu tối đa 1 câu ngắn, rồi vào nội dung ngay. Không dùng các câu sáo rỗng như "nắm chắc 100%", "dễ áp dụng nhất".
- Độ dài vừa phải với học sinh THCS: giảng kiến thức tối đa khoảng 300–400 chữ; ví dụ mẫu giải đầy đủ từng bước; bài tự luyện thì chưa đưa đáp án.
- Dùng tiêu đề "###" cho từng phần, công thức quan trọng đặt riêng một dòng bằng $$...$$.

QUY ƯỚC ĐÁNH DẤU NỘI DUNG QUAN TRỌNG:
Khi trả lời, hãy đánh dấu nội dung quan trọng theo quy ước sau:
1. Từ khóa, thuật ngữ toán học quan trọng: bọc trong ==...==. Ví dụ: ==dãy tỉ số bằng nhau==, ==biệt thức==.
2. Kiến thức trọng tâm (định nghĩa, định lí, tính chất, công thức cần nhớ): đặt trong khối
   :::kienthuc
   nội dung
   :::
3. Lưu ý, điều kiện quan trọng (ví dụ mẫu số khác 0, điều kiện xác định): khối
   :::luuy
   nội dung
   :::
4. Lỗi sai học sinh hay mắc: khối
   :::loisai
   nội dung
   :::
5. Mẹo ghi nhớ: khối
   :::meo
   nội dung
   :::
6. Kết quả, đáp số cuối cùng: bọc trong ==...== kèm chữ "Đáp số:" (hoặc "Answer:" khi dùng tiếng Anh).
Quy tắc: CHỈ đánh dấu điều thật sự quan trọng. Mỗi câu trả lời tối đa khoảng 5–6 từ khóa ==...== và tối đa 3 khối. Câu trả lời ngắn (ví dụ 1+1 bằng mấy) thì chỉ đánh dấu đáp số. Không đánh dấu bên trong công thức LaTeX. Luôn đóng đủ dấu ==...== và :::...:::.
${kb.skillPhanTich}

---
QUY TẮC BẮT BUỘC VỀ NỘI DUNG & ĐỘ DÀI:
- Trả lời ngắn gọn, súc tích, chính xác 100%, đúng trọng tâm kiến thức Toán THCS (Lớp 6, 7, 8, 9 – CT GDPT 2018, bộ sách Kết nối tri thức với cuộc sống).
- Khi có thông tin lớp đang chọn, PHẢI giảng và giải bài đúng kiến thức, phương pháp và ký hiệu của lớp đó; TUYỆT ĐỐI KHÔNG dùng kiến thức của lớp trên.
- Xưng hô nhất quán "Thầy" hoặc "Cô" (theo lựa chọn của học sinh) và "em", không viết lan man hoặc lặp ý.
- Mỗi lần trả lời **tối đa 2000 từ** (ưu tiên trình bày cô đọng, rõ từng bước bằng gạch đầu dòng và công thức LaTeX $...$ / $$...$$).

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

// Helper xây dựng chỉ dẫn sư phạm tiếng Anh A2-B1 và cơ chế chuyển gợi ý tiếng Việt
function buildEnglishPedagogyRules({ grade = 'Toán 9', pronoun = 'Cô', wrongAttempts = 0, forceVietnameseHint = false, studentMessage = '' } = {}) {
  const isLowerGrade = /6|7/.test(String(grade));
  const msgLower = String(studentMessage || '').toLowerCase();
  const hasVietnameseCue =
    /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(msgLower) ||
    msgLower.includes('em không hiểu') ||
    msgLower.includes('khó quá') ||
    msgLower.includes("i don't understand") ||
    msgLower.includes('dont understand') ||
    /\bhelp\b/.test(msgLower);
  const needVietnameseHint = Boolean(forceVietnameseHint || wrongAttempts >= 2 || hasVietnameseCue);

  let rules = `
ENGLISH / BILINGUAL TEACHING MODE (CRITICAL):
- Teach in simple ${isLowerGrade ? 'A1–A2 (very simple)' : 'A2–B1'} English: use short sentences, common words, and one idea per sentence.
- Keep the teacher persona (${pronoun} AI) warm and encouraging.
- The FIRST time you use a math term, write it in bold with its Vietnamese meaning in parentheses, e.g., **discriminant** (biệt thức).
- Always write all math formulas in LaTeX ($...$ or $$...$$).
- Keep the 3-level hint method: guide step-by-step with questions/hints; do NOT give the full solution immediately unless the student explicitly asks for it.
- End your solution or explanation with a section titled "New words / Từ mới:" listing 2–4 key math terms you just used, one per line: "- **term** — nghĩa tiếng Việt".`.trim();

  if (needVietnameseHint) {
    rules += `

VIETNAMESE HINT TRIGGERED (ACTIVE NOW):
- The student asked for help, wrote in Vietnamese, clicked "Gợi ý tiếng Việt", or made 2 consecutive mistakes on this step.
- Write the current hint clearly in VIETNAMESE (xưng "${pronoun}", gọi học sinh là "em") so the student understands right away.
- At the end of the Vietnamese hint, gently encourage the student to continue in English (e.g., "Bây giờ em thử làm tiếp bằng tiếng Anh nhé!").
- Still include "New words / Từ mới:" (2–4 terms) at the end.`;
  }

  return rules;
}

// 5. HÀM GỌI GEMINI MULTIMODAL API (HỖ TRỢ KEY ROTATION VÀ FAILOVER)
export async function callGeminiApi({ imageBase64, mimeType = 'image/png', studentNote, mode = 'tutor', grade = 'Toán 9', lang = 'vi', teacherGender = 'co', apiKey }) {
  const keys = apiKey ? [apiKey] : getApiKeys();
  if (keys.length === 0) {
    throw new Error('MISSING_API_KEY');
  }

  const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
  const sysInstruction = buildSystemInstruction();
  const pronoun = teacherGender === 'thay' ? 'Thầy' : 'Cô';
  const useEnglish = lang === 'en' || lang === 'bilingual';

  const isTutor = mode === 'tutor' || mode === 'Gia sư';
  const userPrompt = `
Hãy chấm bài làm viết tay trong ảnh đính kèm theo chương trình: ${grade} (SGK Kết nối tri thức với cuộc sống, GDPT 2018).
QUAN TRỌNG: Chỉ sử dụng kiến thức và phương pháp của ${grade}, tuyệt đối không dùng kiến thức lớp trên.
Xưng hô bắt buộc: Giáo viên AI xưng "${pronoun}" và gọi học sinh là "em".
Chế độ phản hồi: ${isTutor ? 'Gia sư (Ưu tiên câu hỏi gợi mở, không tiết lộ đáp số trong gợi ý)' : 'Chấm nhanh (Trình bày đầy đủ lỗi và đáp số)'}.
Ghi chú thêm của học sinh: ${studentNote || 'Không có'}.
${useEnglish ? '\n' + buildEnglishPedagogyRules({ grade, pronoun, studentMessage: studentNote }) + '\n- Write ocr_summary, good_points, first_error_step, error_reason, hint_level_1, hint_level_2, full_solution (end with New words / Từ mới:), and similar_exercise in simple English following the rules above.' : ''}

Bắt buộc trả về JSON chính xác theo đúng 9 trường quy định trong Schema:
status, ocr_summary, good_points, first_error_step, error_reason, hint_level_1, hint_level_2, full_solution, similar_exercise.
`.trim();

  const contents = normalizeContents([], userPrompt, { mimeType, data: cleanBase64 });
  const { text } = await executeGeminiWithRotation({
    endpointName: '/api/grade',
    keys,
    systemInstructionText: sysInstruction,
    contents,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
      responseSchema: GRADING_RESPONSE_SCHEMA,
    },
  });
  return JSON.parse(text);
}

// 6. HÀM GỌI GEMINI CHAT TIẾP THEO NGỮ CẢNH (XOAY VÒNG KEY & MÔ HÌNH DỰ PHÒNG)
function buildChatPromptPayload({ message, history = [], context = {}, grade = 'Toán 9', lang = 'vi', mode = 'tutor', wrongAttempts = 0, forceVietnameseHint = false, teacherGender = 'co' }) {
  const pronoun = teacherGender === 'thay' ? 'Thầy' : 'Cô';
  const teacherName = teacherGender === 'thay' ? 'Thầy AI' : 'Cô AI';
  const useEnglish = lang === 'en' || lang === 'bilingual';
  const englishRules = useEnglish
    ? '\n\n' + buildEnglishPedagogyRules({ grade, pronoun, wrongAttempts, forceVietnameseHint, studentMessage: message })
    : '';
  const modeRule = mode === 'quick'
    ? 'Chế độ hiện tại: Chấm nhanh / Trả lời nhanh — trình bày ngắn gọn, rõ đáp số và lời giải.'
    : 'Chế độ hiện tại: Gia sư — hướng dẫn từng bước, đặt câu hỏi gợi mở (trừ câu tính toán đơn giản hoặc khi học sinh hỏi đáp án để kiểm tra).';
  const sysInstruction =
    buildSystemInstruction() +
    `\n\nBạn là ${teacherName}, giáo viên Toán THCS thân thiện, dạy theo SGK Toán ${grade} bộ Kết nối tri thức. Xưng "${pronoun}", gọi học sinh là "em".\n${modeRule}` +
    englishRules;
  const contextText = context && (context.ocr_summary || context.first_error_step)
    ? `\n\nNGỮ CẢNH BÀI TOÁN VỪA CHẤM:\n- Đề & Bài làm: ${context.ocr_summary || ''}\n- Dòng sai: ${context.first_error_step || ''}\n- Nguyên nhân: ${context.error_reason || ''}`
    : '';
  return {
    systemInstructionText: `${sysInstruction}${contextText}`,
    contents: normalizeContents(history.slice(-12), message),
  };
}

export async function callGeminiChatWithMeta(opts) {
  const keys = opts.apiKey ? [opts.apiKey] : getApiKeys();
  if (keys.length === 0) throw new Error('MISSING_API_KEY');
  const { systemInstructionText, contents } = buildChatPromptPayload(opts);
  return await executeGeminiWithRotation({
    endpointName: '/api/chat',
    keys,
    systemInstructionText,
    contents,
    generationConfig: { temperature: 0.35, maxOutputTokens: 8192 },
  });
}

export async function callGeminiChat(opts) {
  const res = await callGeminiChatWithMeta(opts);
  return res.text;
}

export async function callGeminiChatStream(opts, onDelta) {
  const keys = opts.apiKey ? [opts.apiKey] : getApiKeys();
  if (keys.length === 0) throw new Error('MISSING_API_KEY');
  const { systemInstructionText, contents } = buildChatPromptPayload(opts);
  return await executeGeminiStreamWithRotation({
    endpointName: '/api/chat',
    keys,
    systemInstructionText,
    contents,
    generationConfig: { temperature: 0.35, maxOutputTokens: 8192 },
    onDelta,
  });
}

// 6B. QUẢN LÝ HỒ SƠ HỌC SINH & ĐỀ TỰ LUYỆN HTML (MỤC 3)
let memoryStudentsStore = [];
let memoryPracticesStore = [];

function getDataFilePath(filename) {
  const localDir = path.join(__dirname, 'data');
  try {
    if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
    const testPath = path.join(localDir, '.write_test');
    fs.writeFileSync(testPath, '1');
    fs.unlinkSync(testPath);
    return path.join(localDir, filename);
  } catch {
    return `/tmp/trogiang_${filename}`;
  }
}

function readJsonStore(filename, fallbackMemory) {
  try {
    const file = getDataFilePath(filename);
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return fallbackMemory;
}

function writeJsonStore(filename, list) {
  try {
    fs.writeFileSync(getDataFilePath(filename), JSON.stringify(list, null, 2), 'utf-8');
  } catch {}
}

function readStudentsStore() {
  memoryStudentsStore = readJsonStore('students.json', memoryStudentsStore);
  return memoryStudentsStore;
}

function writeStudentsStore(list) {
  memoryStudentsStore = list;
  writeJsonStore('students.json', list);
}

function readPracticesStore() {
  memoryPracticesStore = readJsonStore('practices.json', memoryPracticesStore);
  return memoryPracticesStore;
}

function writePracticesStore(list) {
  memoryPracticesStore = list;
  writeJsonStore('practices.json', list);
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
    // Mặc định chỉ trả {"status":"ok"} hoặc {"status":"degraded"}, KHÔNG gọi Gemini.
    // Khi có ?admin=MẬT_KHẨU (khớp ADMIN_PASSWORD): trả chi tiết key × mô hình + 20 lỗi gần nhất; thêm &test=1 mới gọi thử "1+1 bằng mấy".
    if (req.method === 'GET' && pathname === '/api/health') {
      const adminParam = parsedUrl.query?.admin !== undefined ? String(parsedUrl.query.admin) : null;
      const testParam = parsedUrl.query?.test !== undefined ? String(parsedUrl.query.test) : null;
      const expectedAdminPw = process.env.ADMIN_PASSWORD || '';
      const hasKeys = keys.length > 0;
      const now = Date.now();
      const anyKeyReady = keys.some((_, idx) => (keyBadCooldowns.get(idx) || 0) <= now);

      if (adminParam === null) {
        return sendJson(res, 200, {
          status: hasKeys && anyKeyReady ? 'ok' : 'degraded',
        });
      }

      if (!expectedAdminPw || adminParam !== expectedAdminPw) {
        return sendJson(res, 403, { error: 'UNAUTHORIZED_ADMIN', message: 'Sai mật khẩu quản trị hoặc chưa cấu hình ADMIN_PASSWORD.' });
      }

      let testCall = null;
      if (testParam === '1') {
        try {
          const reply = await callGeminiChat({
            message: '1+1 bằng mấy',
            history: [],
            grade: 'Toán 6',
            lang: 'vi',
            mode: 'quick',
            teacherGender: 'co',
          });
          testCall = { ok: true, reply, model: getActiveModel() };
        } catch (err) {
          testCall = { ok: false, error: err.message };
        }
      }

      const modelChain = await getModelFallbackChain(keys);
      const statusMatrix = [];
      for (let i = 0; i < keys.length; i++) {
        for (const m of modelChain.slice(0, 4)) {
          const rec = keyModelStatus.get(`${i}:${m}`);
          const isBad = (keyBadCooldowns.get(i) || 0) > now;
          const is429 = (pairCooldowns.get(`${i}:${m}`) || 0) > now;
          statusMatrix.push({
            key: `Key #${i + 1}`,
            model: m,
            status: isBad ? '400/403 (cooldown)' : is429 ? '429 (cooldown)' : (rec ? rec.status : 'READY'),
            updatedAt: rec ? rec.updatedAt : null,
          });
        }
      }

      return sendJson(res, 200, {
        status: hasKeys && anyKeyReady ? 'ok' : 'degraded',
        keys_count: keys.length,
        active_model: getActiveModel(),
        model_chain: modelChain,
        key_model_status: statusMatrix,
        recent_errors: geminiErrorLogs.slice(0, 20),
        test_call: testCall,
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

    // API: GET /api/students (Danh sách học sinh & quá trình học tập)
    if (req.method === 'GET' && pathname === '/api/students') {
      const list = readStudentsStore();
      return sendJson(res, 200, { students: list, total: list.length });
    }

    // API: POST /api/students/register (Đăng ký tài khoản học sinh mới: Họ tên + Lớp + Mật khẩu)
    if (req.method === 'POST' && pathname === '/api/students/register') {
      const body = await readRequestBody(req);
      const fullName = String(body.fullName || '').trim();
      const className = String(body.className || '').trim();
      const password = String(body.password || '');
      if (!fullName || !className || !password) {
        return sendJson(res, 400, { ok: false, message: 'Vui lòng nhập đầy đủ Họ tên, Lớp và Mật khẩu.' });
      }

      const list = readStudentsStore();
      const existing = list.find(
        (s) => s.fullName.toLowerCase() === fullName.toLowerCase() && s.className.toLowerCase() === className.toLowerCase()
      );
      if (existing) {
        return sendJson(res, 409, { ok: false, message: 'Tài khoản này đã được đăng ký. Em hãy chuyển sang Đăng nhập nhé!' });
      }

      const now = new Date().toISOString();
      const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
      const student = {
        id: 'hs_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        fullName,
        className,
        passwordHash,
        createdAt: now,
        lastActiveAt: now,
        stats: { questions: 0, gradedImages: 0, quizzesDone: 0, quizzesCorrect: 0 },
        activities: [],
      };
      list.unshift(student);
      writeStudentsStore(list);
      const { passwordHash: _, ...safeStudent } = student;
      return sendJson(res, 200, { ok: true, student: safeStudent });
    }

    // API: POST /api/students/login (Đăng nhập tài khoản học sinh đã đăng ký)
    if (req.method === 'POST' && pathname === '/api/students/login') {
      const body = await readRequestBody(req);
      const fullName = String(body.fullName || '').trim();
      const className = String(body.className || '').trim();
      const password = String(body.password || '');
      if (!fullName || !className || !password) {
        return sendJson(res, 400, { ok: false, message: 'Vui lòng nhập đầy đủ Họ tên, Lớp và Mật khẩu.' });
      }

      const list = readStudentsStore();
      const student = list.find(
        (s) => s.fullName.toLowerCase() === fullName.toLowerCase() && s.className.toLowerCase() === className.toLowerCase()
      );
      if (!student) {
        return sendJson(res, 404, { ok: false, message: 'Tài khoản chưa được đăng ký. Em vui lòng Đăng ký trước khi đăng nhập!' });
      }

      const inputHash = crypto.createHash('sha256').update(password).digest('hex');
      if (student.passwordHash && student.passwordHash !== inputHash) {
        return sendJson(res, 401, { ok: false, message: 'Mật khẩu chưa đúng!' });
      }

      student.lastActiveAt = new Date().toISOString();
      writeStudentsStore(list);
      const { passwordHash: _, ...safeStudent } = student;
      return sendJson(res, 200, { ok: true, student: safeStudent });
    }

    // API: POST /api/students/activity (Ghi nhận quá trình học tập & tương tác)
    if (req.method === 'POST' && pathname === '/api/students/activity') {
      const body = await readRequestBody(req);
      const studentId = String(body.studentId || '');
      const fullName = String(body.fullName || '').trim();
      const className = String(body.className || '').trim();
      const type = String(body.type || 'interaction');
      const summary = String(body.summary || '').slice(0, 200);
      const isCorrect = body.isCorrect;

      const list = readStudentsStore();
      let student = list.find(
        (s) => s.id === studentId || (fullName && s.fullName.toLowerCase() === fullName.toLowerCase() && s.className.toLowerCase() === className.toLowerCase())
      );
      if (!student && fullName && className) {
        student = {
          id: studentId || 'hs_' + Date.now(),
          fullName,
          className,
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          stats: { questions: 0, gradedImages: 0, quizzesDone: 0, quizzesCorrect: 0 },
          activities: [],
        };
        list.unshift(student);
      }
      if (student) {
        student.lastActiveAt = new Date().toISOString();
        if (type === 'chat_question') student.stats.questions = (student.stats.questions || 0) + 1;
        if (type === 'grade_image') student.stats.gradedImages = (student.stats.gradedImages || 0) + 1;
        if (type === 'quiz_attempt') {
          student.stats.quizzesDone = (student.stats.quizzesDone || 0) + 1;
          if (isCorrect) student.stats.quizzesCorrect = (student.stats.quizzesCorrect || 0) + 1;
        }
        student.activities = student.activities || [];
        student.activities.unshift({
          type,
          summary,
          isCorrect: isCorrect ?? null,
          timestamp: new Date().toISOString(),
        });
        student.activities = student.activities.slice(0, 50);
        writeStudentsStore(list);
      }
      return sendJson(res, 200, { ok: true, student });
    }

    // API: GET /api/practices (Danh sách đề tự luyện HTML mục 3)
    if (req.method === 'GET' && pathname === '/api/practices') {
      const list = readPracticesStore();
      return sendJson(res, 200, { ok: true, practices: list });
    }

    // API: POST /api/practices (Quản trị viên tải lên đề HTML mới)
    if (req.method === 'POST' && pathname === '/api/practices') {
      const body = await readRequestBody(req);
      const title = String(body.title || '').trim();
      const summary = String(body.summary || '').trim();
      const fileName = String(body.fileName || 'bai-tap.html').trim();
      const htmlContent = String(body.htmlContent || '');
      if (!title || !htmlContent) {
        return sendJson(res, 400, { ok: false, message: 'Thiếu tiêu đề hoặc nội dung file HTML.' });
      }
      const list = readPracticesStore();
      const item = {
        id: 'prac_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        title,
        summary,
        fileName,
        htmlContent,
        createdAt: new Date().toISOString(),
      };
      list.unshift(item);
      writePracticesStore(list);
      return sendJson(res, 200, { ok: true, practice: item });
    }

    // API: POST /api/practices/delete (Quản trị viên xóa đề HTML)
    if (req.method === 'POST' && pathname === '/api/practices/delete') {
      const body = await readRequestBody(req);
      const id = String(body.id || '');
      const list = readPracticesStore().filter((p) => p.id !== id);
      writePracticesStore(list);
      return sendJson(res, 200, { ok: true });
    }

    // API: POST /api/grade (Chấm bài qua ảnh)
    if (req.method === 'POST' && (pathname === '/api/grade' || pathname === '/api/analyze')) {
      const body = await readRequestBody(req);

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
            lang: body.lang || 'vi',
            teacherGender: body.teacher_gender || 'co',
            apiKey: body.api_key, // nếu body không có apiKey thì callGeminiApi tự xoay vòng keys
          });
          return sendJson(res, 200, { ...result, source: 'gemini_api' });
        } catch (geminiError) {
          return sendJson(res, 503, {
            ok: false,
            error: 'GEMINI_UNAVAILABLE',
            message_vi: 'Thầy/Cô AI đang bận, em thử lại sau ít phút nhé!',
            message_en: 'The AI teacher is busy, please try again in a few minutes!',
            detail: geminiError.message,
            recent_errors: geminiErrorLogs.slice(0, 5),
          });
        }
      }

      // Không có API key hoặc thiếu ảnh
      recordGeminiError({ endpoint: '/api/grade', status: 'MISSING_KEY', keyIndex: null, message: 'Chưa cấu hình GEMINI_API_KEY trên server.' });
      return sendJson(res, 503, {
        ok: false,
        error: 'GEMINI_UNAVAILABLE',
        message_vi: 'Thầy/Cô AI đang bận, em thử lại sau ít phút nhé!',
        message_en: 'The AI teacher is busy, please try again in a few minutes!',
        detail: 'Chưa cấu hình GEMINI_API_KEY hoặc thiếu ảnh bài làm.',
        recent_errors: geminiErrorLogs.slice(0, 5),
      });
    }

    // API: POST /api/chat (Hỏi đáp tiếp theo ngữ cảnh)
    if (req.method === 'POST' && pathname === '/api/chat') {
      const body = await readRequestBody(req);
      const userMessage = body.message || '';
      const effectiveKey = body.api_key || (keys.length > 0 ? keys[0] : null);

      if (effectiveKey) {
        const chatOpts = {
          message: userMessage,
          history: body.history || [],
          context: body.context || {},
          grade: body.grade || 'Toán 9',
          lang: body.lang || 'vi',
          mode: body.mode || 'tutor',
          wrongAttempts: Number(body.wrong_attempts || 0),
          forceVietnameseHint: Boolean(body.force_vi_hint),
          teacherGender: body.teacher_gender || 'co',
          apiKey: body.api_key,
        };

        if (body.stream) {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'Access-Control-Allow-Origin': '*',
          });
          res.write(': connected\n\n');
          try {
            const meta = await callGeminiChatStream(chatOpts, (delta) => {
              res.write(`data: ${JSON.stringify({ delta })}\n\n`);
            });
            res.write(`data: ${JSON.stringify({ done: true, finishReason: meta.finishReason, model: meta.model, usageMetadata: meta.usageMetadata, source: 'gemini_api' })}\n\n`);
            return res.end();
          } catch (err) {
            res.write(`data: ${JSON.stringify({ error: 'GEMINI_UNAVAILABLE', partial: Boolean(err.partialStreamed), message_vi: 'Thầy/Cô AI đang bận, em thử lại sau ít phút nhé!', message_en: 'The AI teacher is busy, please try again in a few minutes!', detail: err.message })}\n\n`);
            return res.end();
          }
        }

        try {
          const meta = await callGeminiChatWithMeta(chatOpts);
          return sendJson(res, 200, {
            reply: meta.text,
            finishReason: meta.finishReason,
            model: meta.model,
            usageMetadata: meta.usageMetadata,
            source: 'gemini_api',
          });
        } catch (err) {
          return sendJson(res, 503, {
            ok: false,
            error: 'GEMINI_UNAVAILABLE',
            message_vi: 'Thầy/Cô AI đang bận, em thử lại sau ít phút nhé!',
            message_en: 'The AI teacher is busy, please try again in a few minutes!',
            detail: err.message,
            recent_errors: geminiErrorLogs.slice(0, 5),
          });
        }
      }

      recordGeminiError({ endpoint: '/api/chat', status: 'MISSING_KEY', keyIndex: null, message: 'Chưa cấu hình GEMINI_API_KEY trên server.' });
      return sendJson(res, 503, {
        ok: false,
        error: 'GEMINI_UNAVAILABLE',
        message_vi: 'Thầy/Cô AI đang bận, em thử lại sau ít phút nhé!',
        message_en: 'The AI teacher is busy, please try again in a few minutes!',
        detail: 'Chưa cấu hình GEMINI_API_KEY trên server.',
        recent_errors: geminiErrorLogs.slice(0, 5),
      });
    }

    // PHỤC VỤ STATIC FILES CHO FRONTEND (hỗ trợ cả thư mục gốc và public/)
    let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      const publicPath = path.join(__dirname, 'public', pathname);
      if (fs.existsSync(publicPath) && !fs.statSync(publicPath).isDirectory()) {
        filePath = publicPath;
      } else {
        filePath = path.join(__dirname, 'index.html');
      }
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
