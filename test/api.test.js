/**
 * TEST SUITE: KIỂM THỬ BACKEND API CHO TRỢ GIẢNG AI (ES Module)
 * Chạy bằng Node.js: node test/api.test.js
 */

import assert from 'assert';
import http from 'http';
import { server, PORT } from '../server.js';

const BASE_URL = `http://localhost:${PORT}`;

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${path}`;
    const parsed = new URL(url);

    const headers = { 'Content-Type': 'application/json' };
    const payload = body ? JSON.stringify(body) : null;
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method,
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch (e) {
            json = data;
          }
          resolve({ status: res.statusCode, headers: res.headers, data: json });
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('🚀 BẮT ĐẦU CHẠY KIỂM THỬ TỰ ĐỘNG CHO TRỢ GIẢNG AI API');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    process.stdout.write(`• [TEST] ${name} ... `);
    try {
      await fn();
      console.log('✅ PASS');
      passed++;
    } catch (err) {
      console.log('❌ FAIL');
      console.error('  Chi tiết lỗi:', err.message);
      failed++;
    }
  }

  // Khởi động server cho test nếu chưa chạy
  let startedServer = false;
  try {
    const health = await makeRequest('GET', '/api/health');
    if (health.status === 200) {
      console.log(`⚡ Server đã đang hoạt động tại ${BASE_URL} (Model: ${health.data.model}, Keys: ${health.data.keys_count})`);
    }
  } catch (e) {
    await new Promise((res) => server.listen(PORT, '0.0.0.0', res));
    startedServer = true;
  }

  // TEST 1: Health Check Endpoint
  await test('GET /api/health phản hồi 200 OK và trạng thái hệ thống', async () => {
    const res = await makeRequest('GET', '/api/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status, 'ok');
    assert.ok(res.data.model, 'Cần có thông tin model');
  });

  // TEST 2: Config Endpoint tải 4 file tri thức
  await test('GET /api/config trả về đầy đủ 4 tệp tri thức markdown', async () => {
    const res = await makeRequest('GET', '/api/config');
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.knowledge, 'Cần có object knowledge');
    assert.ok(res.data.knowledge.skillOcr, 'Cần có skillOcr');
    assert.ok(res.data.knowledge.skillPhanTich, 'Cần có skillPhanTich');
    assert.ok(res.data.knowledge.persona, 'Cần có persona');
    assert.ok(res.data.knowledge.agentConfig, 'Cần có agentConfig');
  });

  // TEST 3: Chấm bài qua ảnh (POST /api/grade) - Ép chuẩn 9 trường
  await test('POST /api/grade trả về đúng 9 trường bắt buộc chuẩn GDPT 2018', async () => {
    const sampleBody = {
      sample_id: 'sample1',
      student_note: 'Em giải ra 2 nghiệm x=2 và x=1/2 nhưng chưa chắc ạ.',
      mode: 'tutor',
      grade: 'Toán 9',
    };

    const res = await makeRequest('POST', '/api/grade', sampleBody);
    assert.strictEqual(res.status, 200);
    const d = res.data;

    // 1. status
    assert.ok(d.status, 'Trường status không được rỗng');
    assert.strictEqual(d.status, 'SUCCESS');

    // 2. ocr_summary
    assert.ok(d.ocr_summary, 'Cần có trường ocr_summary');
    assert.ok(typeof d.ocr_summary === 'string', 'ocr_summary phải là chuỗi');

    // 3. good_points
    assert.ok(d.good_points, 'Cần có trường good_points');
    assert.ok(Array.isArray(d.good_points), 'good_points phải là mảng các điểm tốt');
    assert.ok(d.good_points.length > 0, 'Cần có ít nhất 1 điểm khen ngợi');

    // 4. first_error_step
    assert.ok(d.first_error_step, 'Cần có trường first_error_step');

    // 5. error_reason
    assert.ok(d.error_reason, 'Cần có trường error_reason');

    // 6. hint_level_1
    assert.ok(d.hint_level_1, 'Cần có trường hint_level_1 (gợi ý cấp 1)');

    // 7. hint_level_2
    assert.ok(d.hint_level_2, 'Cần có trường hint_level_2 (gợi ý cấp 2)');

    // 8. full_solution
    assert.ok(d.full_solution, 'Cần có trường full_solution (lời giải chi tiết)');

    // 9. similar_exercise
    assert.ok(d.similar_exercise, 'Cần có trường similar_exercise (bài tập tương tự)');
  });

  // TEST 4: Chế độ Chấm nhanh (POST /api/grade với sample2)
  await test('POST /api/grade chế độ Chấm nhanh (quick) phát hiện đúng lỗi dấu căn thức', async () => {
    const res = await makeRequest('POST', '/api/grade', {
      sample_id: 'sample2',
      student_note: 'Kiểm tra giúp em dấu trừ ở dòng 2.',
      mode: 'quick',
      grade: 'Toán 9',
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status, 'SUCCESS');
    assert.ok(res.data.first_error_step.includes('Dòng 3'), 'Phải bắt đúng dòng 3 sai dấu');
    assert.ok(res.data.full_solution.includes('5 - 2\\sqrt{5}'), 'Đáp số chuẩn phải là 5 - 2\\sqrt{5}');
  });

  // TEST 5: Hỏi đáp nối tiếp theo ngữ cảnh bài vừa chấm (POST /api/chat)
  await test('POST /api/chat trả lời đúng ngữ cảnh bài toán với giọng điệu Trợ Giảng', async () => {
    const chatBody = {
      message: 'Tại sao dòng 2 em phá ngoặc phải đổi dấu ạ?',
      context: {
        ocr_summary: 'Rút gọn biểu thức chứa căn bậc hai',
        first_error_step: 'Dòng 3',
        error_reason: 'Quên đổi dấu số hạng thứ hai khi trước ngoặc có dấu trừ',
      },
    };

    const res = await makeRequest('POST', '/api/chat', chatBody);
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.reply, 'Cần có trường reply');
    assert.ok(res.data.reply.length > 20, 'Câu trả lời phải có chiều sâu sư phạm');
  });

  // TEST 6: Gọi Gemini Chat trực tiếp với API Key thật
  await test('POST /api/chat kết nối Gemini API thật với Multi-Key Rotation', async () => {
    const chatBody = {
      message: 'Chào Thầy/Cô, em chuẩn bị thi vào lớp 10, Thầy/Cô cho em một lời khuyên về cách trình bày bài giải phương trình với ạ!',
      context: {},
    };

    const res = await makeRequest('POST', '/api/chat', chatBody);
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.reply, 'Cần có nội dung phản hồi từ AI');
    console.log(`\n    [Phản hồi từ Gemini API]: "${res.data.reply.slice(0, 100)}..."`);
    assert.strictEqual(res.data.source, 'gemini_api', 'Phải kết nối trực tiếp với Gemini API thật');
  });

  console.log('\n====================================================');
  console.log(`🏁 TỔNG KẾT: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');

  if (startedServer) {
    server.close(() => {
      process.exit(failed > 0 ? 1 : 0);
    });
  } else {
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
