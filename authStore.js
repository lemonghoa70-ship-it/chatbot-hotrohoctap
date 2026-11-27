import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET || crypto.createHash('sha256').update(__dirname + '_hiepphuoc_secret_v1').digest('hex');
const failedLoginAttempts = new Map(); // key (ip|identifier) -> { count, lockedUntil }

export function isSupabaseConfigured() {
  return Boolean(
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function getSecurityStatus() {
  return {
    supabaseConfigured: isSupabaseConfigured(),
    usingDefaultAdminPassword: !process.env.ADMIN_PASSWORD,
    isProduction: Boolean(process.env.VERCEL || process.env.NODE_ENV === 'production'),
  };
}

export function normalizeVietnameseName(rawName) {
  const nfc = String(rawName || '').normalize('NFC').trim().replace(/\s+/g, ' ');
  const lookup = nfc.toLowerCase();
  const display = nfc
    ? nfc.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
    : '';
  return { display, lookup };
}

function makeInternalStudentEmail(displayName, className) {
  const ascii = String(displayName || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'hs';
  const cls = String(className || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const rnd = crypto.randomBytes(2).toString('hex');
  return `${ascii}-${cls}-${rnd}@hs.hiepphuoc.local`;
}

function hashPasswordScrypt(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPasswordScrypt(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
}

function signSessionToken(payload) {
  const data = Buffer.from(JSON.stringify({ ...payload, iat: Date.now(), exp: Date.now() + 7 * 24 * 3600 * 1000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyLocalToken(token) {
  if (!token || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(data).digest('base64url');
  if (sig !== expected) return null;
  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8'));
    if (parsed.exp && Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ==========================================
// LOCAL FALLBACK STORE (khi chưa điền khóa Supabase)
// ==========================================
let memCloudStore = null;

function getCloudFilePath() {
  const localDir = path.join(__dirname, 'data');
  try {
    if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
    return path.join(localDir, 'cloud_store.json');
  } catch {
    return '/tmp/trogiang_cloud_store.json';
  }
}

function readLocalCloud() {
  if (memCloudStore) return memCloudStore;
  const file = getCloudFilePath();
  try {
    if (fs.existsSync(file)) {
      memCloudStore = JSON.parse(fs.readFileSync(file, 'utf-8'));
      return memCloudStore;
    }
  } catch {}
  memCloudStore = {
    profiles: [],
    settings: {},
    messages: {},
    practice_results: {},
    activity_log: {},
    config: { allow_self_register: true },
  };
  return memCloudStore;
}

function writeLocalCloud(store) {
  memCloudStore = store;
  try {
    fs.writeFileSync(getCloudFilePath(), JSON.stringify(store, null, 2), 'utf-8');
  } catch {}
}

// ==========================================
// SUPABASE HELPERS
// ==========================================
async function supaFetch(endpoint, { method = 'GET', body = null, useServiceRole = true, bearer = null, headers = {} } = {}) {
  const url = `${process.env.SUPABASE_URL.replace(/\/$/, '')}${endpoint}`;
  const key = useServiceRole ? process.env.SUPABASE_SERVICE_ROLE_KEY : process.env.SUPABASE_ANON_KEY;
  const resp = await fetch(url, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${bearer || key}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await resp.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  return { ok: resp.ok, status: resp.status, data: json };
}

// ==========================================
// RATE LIMIT (5 lần sai -> khóa 5 phút)
// ==========================================
export function checkLoginLockout(key) {
  const rec = failedLoginAttempts.get(key);
  if (!rec) return { locked: false };
  if (rec.lockedUntil && Date.now() < rec.lockedUntil) {
    const mins = Math.ceil((rec.lockedUntil - Date.now()) / 60000);
    return { locked: true, mins };
  }
  if (rec.lockedUntil && Date.now() >= rec.lockedUntil) {
    failedLoginAttempts.delete(key);
  }
  return { locked: false };
}

export function recordFailedAttempt(key) {
  const rec = failedLoginAttempts.get(key) || { count: 0, lockedUntil: 0 };
  rec.count += 1;
  if (rec.count >= 5) {
    rec.lockedUntil = Date.now() + 5 * 60 * 1000;
  }
  failedLoginAttempts.set(key, rec);
}

export function clearFailedAttempts(key) {
  failedLoginAttempts.delete(key);
}

// ==========================================
// PUBLIC CONFIG (allow_self_register)
// ==========================================
export async function getPublicAuthConfig() {
  if (isSupabaseConfigured()) {
    const r = await supaFetch('/rest/v1/app_config?key=eq.auth_settings&select=value');
    if (r.ok && Array.isArray(r.data) && r.data[0]?.value) {
      return { allow_self_register: r.data[0].value.allow_self_register !== false, storage: 'supabase' };
    }
    return { allow_self_register: true, storage: 'supabase' };
  }
  const store = readLocalCloud();
  return { allow_self_register: store.config?.allow_self_register !== false, storage: 'local' };
}

export async function setAllowSelfRegister(allow) {
  if (isSupabaseConfigured()) {
    await supaFetch('/rest/v1/app_config', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: { key: 'auth_settings', value: { allow_self_register: Boolean(allow) }, updated_at: new Date().toISOString() },
    });
    return { allow_self_register: Boolean(allow) };
  }
  const store = readLocalCloud();
  store.config = store.config || {};
  store.config.allow_self_register = Boolean(allow);
  writeLocalCloud(store);
  return { allow_self_register: store.config.allow_self_register };
}

// ==========================================
// VERIFY REQUEST TOKEN
// ==========================================
export async function authenticateRequest(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return null;

  if (isSupabaseConfigured()) {
    const u = await supaFetch('/auth/v1/user', { method: 'GET', useServiceRole: false, bearer: token });
    if (!u.ok || !u.data?.id) return null;
    const p = await supaFetch(`/rest/v1/profiles?id=eq.${u.data.id}&select=*`);
    const profile = Array.isArray(p.data) ? p.data[0] : null;
    if (!profile || profile.locked) return null;
    return { userId: u.data.id, token, profile, isSupabase: true };
  }

  const parsed = verifyLocalToken(token);
  if (!parsed || !parsed.userId) return null;
  const store = readLocalCloud();
  if (parsed.role === 'admin' && parsed.userId === 'admin_root') {
    return {
      userId: 'admin_root',
      token,
      profile: { id: 'admin_root', role: 'admin', full_name: 'Giáo viên Quản trị', class_name: 'THCS Hiệp Phước', email: parsed.email || 'admin@hiepphuoc.edu.vn' },
      isSupabase: false,
    };
  }
  const profile = (store.profiles || []).find((p) => p.id === parsed.userId);
  if (!profile || profile.locked) return null;
  const { password_hash: _, ...safeProfile } = profile;
  return { userId: profile.id, token, profile: safeProfile, isSupabase: false };
}

// ==========================================
// LOGIN (STUDENT BY FULL NAME + CLASS / ADMIN BY EMAIL)
// ==========================================
export async function loginStudent({ fullName, className, password }) {
  const { lookup } = normalizeVietnameseName(fullName);
  const cls = String(className || '').normalize('NFC').trim();
  const pw = String(password || '');
  if (!lookup || !cls || !pw) {
    return { ok: false, status: 400, message: 'Sai họ tên, lớp hoặc mật khẩu' };
  }

  if (isSupabaseConfigured()) {
    const pr = await supaFetch(`/rest/v1/profiles?role=eq.student&ho_ten_chuan_hoa=eq.${encodeURIComponent(lookup)}&class_name=eq.${encodeURIComponent(cls)}&select=*`);
    const profile = Array.isArray(pr.data) ? pr.data[0] : null;
    if (!profile || !profile.auth_email) {
      return { ok: false, status: 401, message: 'Sai họ tên, lớp hoặc mật khẩu' };
    }
    const r = await supaFetch('/auth/v1/token?grant_type=password', {
      method: 'POST',
      useServiceRole: false,
      body: { email: profile.auth_email, password: pw },
    });
    if (!r.ok || !r.data?.access_token) {
      return { ok: false, status: 401, message: 'Sai họ tên, lớp hoặc mật khẩu' };
    }
    if (profile.locked) return { ok: false, status: 403, message: 'Tài khoản đang tạm khóa, em liên hệ giáo viên nhé!' };
    if (!profile.approved) return { ok: false, status: 403, message: 'Tài khoản đang chờ giáo viên duyệt!' };

    await supaFetch(`/rest/v1/profiles?id=eq.${profile.id}`, { method: 'PATCH', body: { last_login_at: new Date().toISOString() } });
    await supaFetch('/rest/v1/activity_log', { method: 'POST', body: { user_id: profile.id, event_type: 'login', summary: 'Đăng nhập học sinh' } });
    const bundle = await loadUserCloudData(profile.id);
    return { ok: true, token: r.data.access_token, profile, ...bundle };
  }

  const store = readLocalCloud();
  const user = (store.profiles || []).find((p) => {
    if (p.role !== 'student') return false;
    const pLookup = p.ho_ten_chuan_hoa || normalizeVietnameseName(p.full_name).lookup;
    return pLookup === lookup && String(p.class_name || '').trim() === cls;
  });
  if (!user || !verifyPasswordScrypt(pw, user.password_hash)) {
    return { ok: false, status: 401, message: 'Sai họ tên, lớp hoặc mật khẩu' };
  }
  if (user.locked) return { ok: false, status: 403, message: 'Tài khoản đang tạm khóa, em liên hệ giáo viên nhé!' };
  if (!user.approved) return { ok: false, status: 403, message: 'Tài khoản đang chờ giáo viên duyệt!' };

  // Chuyển cấu trúc cũ sang chuẩn mới nếu thiếu
  const norm = normalizeVietnameseName(user.full_name);
  user.full_name = norm.display;
  user.ho_ten_chuan_hoa = norm.lookup;
  user.last_login_at = new Date().toISOString();
  store.activity_log[user.id] = store.activity_log[user.id] || [];
  store.activity_log[user.id].unshift({ event_type: 'login', summary: 'Đăng nhập học sinh', created_at: user.last_login_at });
  writeLocalCloud(store);

  const token = signSessionToken({ userId: user.id, role: 'student' });
  const { password_hash: _, ...safeProfile } = user;
  const bundle = await loadUserCloudData(user.id);
  return { ok: true, token, profile: safeProfile, ...bundle };
}

export async function loginAdmin({ email, password }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const pw = String(password || '');

  if (isSupabaseConfigured()) {
    const r = await supaFetch('/auth/v1/token?grant_type=password', {
      method: 'POST',
      useServiceRole: false,
      body: { email: cleanEmail, password: pw },
    });
    if (!r.ok || !r.data?.access_token || !r.data?.user?.id) {
      return { ok: false, status: 401, message: 'Sai email hoặc mật khẩu giáo viên' };
    }
    const uid = r.data.user.id;
    const pr = await supaFetch(`/rest/v1/profiles?id=eq.${uid}&select=*`);
    const profile = Array.isArray(pr.data) ? pr.data[0] : null;
    if (!profile || profile.role !== 'admin') {
      return { ok: false, status: 403, message: 'Tài khoản không có quyền Quản trị viên.' };
    }
    await supaFetch(`/rest/v1/profiles?id=eq.${uid}`, { method: 'PATCH', body: { last_login_at: new Date().toISOString() } });
    await supaFetch('/rest/v1/activity_log', { method: 'POST', body: { user_id: uid, event_type: 'admin_login', summary: 'Đăng nhập quản trị' } });
    const bundle = await loadUserCloudData(uid);
    return { ok: true, token: r.data.access_token, profile, ...bundle };
  }

  const expectedPw = process.env.ADMIN_PASSWORD || 'hiepphuoc2026';
  const expectedEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if ((!cleanEmail || (expectedEmail && cleanEmail !== expectedEmail)) || pw !== expectedPw) {
    return { ok: false, status: 401, message: 'Sai email hoặc mật khẩu giáo viên' };
  }
  const token = signSessionToken({ userId: 'admin_root', role: 'admin', email: cleanEmail });
  const profile = { id: 'admin_root', role: 'admin', full_name: 'Giáo viên Quản trị', class_name: 'THCS Hiệp Phước', email: cleanEmail };
  const bundle = await loadUserCloudData('admin_root');
  return { ok: true, token, profile, ...bundle };
}

// ==========================================
// REGISTER STUDENT (HỌ TÊN + LỚP + MẬT KHẨU) & ADMIN CREATE
// ==========================================
const DUPLICATE_NAME_MSG = 'Lớp em đã có bạn trùng họ tên đã đăng ký. Em thêm ký hiệu phân biệt sau tên, ví dụ: Nguyễn Văn An B, hoặc hỏi giáo viên nhé.';

export async function registerStudent({ fullName, className, password, approved = false }) {
  const { display, lookup } = normalizeVietnameseName(fullName);
  const cls = String(className || '').normalize('NFC').trim();
  const pw = String(password || '');

  if (!display || !cls || pw.length < 6) {
    return { ok: false, status: 400, message: 'Vui lòng nhập đủ Họ tên, Lớp và Mật khẩu tối thiểu 6 ký tự.' };
  }

  const authEmail = makeInternalStudentEmail(display, cls);

  if (isSupabaseConfigured()) {
    const dup = await supaFetch(`/rest/v1/profiles?role=eq.student&ho_ten_chuan_hoa=eq.${encodeURIComponent(lookup)}&class_name=eq.${encodeURIComponent(cls)}&select=id`);
    if (dup.ok && Array.isArray(dup.data) && dup.data.length > 0) {
      return { ok: false, status: 409, message: DUPLICATE_NAME_MSG };
    }
    const created = await supaFetch('/auth/v1/admin/users', {
      method: 'POST',
      body: { email: authEmail, password: pw, email_confirm: true, user_metadata: { full_name: display, class_name: cls, role: 'student' } },
    });
    if (!created.ok || !created.data?.id) {
      return { ok: false, status: 400, message: created.data?.msg || 'Không thể tạo tài khoản học sinh.' };
    }
    const uid = created.data.id;
    const profileRow = { id: uid, role: 'student', full_name: display, ho_ten_chuan_hoa: lookup, class_name: cls, auth_email: authEmail, approved: Boolean(approved), locked: false };
    await supaFetch('/rest/v1/profiles', { method: 'POST', body: profileRow });
    await supaFetch('/rest/v1/settings', { method: 'POST', body: { user_id: uid } });
    return { ok: true, profile: profileRow };
  }

  const store = readLocalCloud();
  const exists = (store.profiles || []).find((p) => {
    const pLookup = p.ho_ten_chuan_hoa || normalizeVietnameseName(p.full_name).lookup;
    return p.role === 'student' && pLookup === lookup && String(p.class_name || '').trim() === cls;
  });
  if (exists) {
    return { ok: false, status: 409, message: DUPLICATE_NAME_MSG };
  }
  const newUser = {
    id: 'hs_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    role: 'student',
    full_name: display,
    ho_ten_chuan_hoa: lookup,
    class_name: cls,
    auth_email: authEmail,
    password_hash: hashPasswordScrypt(pw),
    approved: Boolean(approved),
    locked: false,
    created_at: new Date().toISOString(),
    last_login_at: null,
  };
  store.profiles.unshift(newUser);
  writeLocalCloud(store);
  const { password_hash: _, ...safeProfile } = newUser;
  return { ok: true, profile: safeProfile };
}

// ==========================================
// CLOUD DATA SYNC (SETTINGS, MESSAGES, PRACTICE, ACTIVITY)
// ==========================================
export async function loadUserCloudData(userId) {
  if (isSupabaseConfigured()) {
    const [sRes, mRes, pRes, aRes] = await Promise.all([
      supaFetch(`/rest/v1/settings?user_id=eq.${userId}&select=*`),
      supaFetch(`/rest/v1/messages?user_id=eq.${userId}&order=created_at.asc&limit=40&select=*`),
      supaFetch(`/rest/v1/practice_results?user_id=eq.${userId}&order=created_at.desc&limit=30&select=*`),
      supaFetch(`/rest/v1/activity_log?user_id=eq.${userId}&order=created_at.desc&limit=50&select=*`),
    ]);
    return {
      settings: (Array.isArray(sRes.data) && sRes.data[0]) || null,
      messages: Array.isArray(mRes.data) ? mRes.data : [],
      practice_results: Array.isArray(pRes.data) ? pRes.data : [],
      activity_log: Array.isArray(aRes.data) ? aRes.data : [],
    };
  }
  const store = readLocalCloud();
  return {
    settings: store.settings[userId] || null,
    messages: store.messages[userId] || [],
    practice_results: store.practice_results[userId] || [],
    activity_log: store.activity_log[userId] || [],
  };
}

export async function syncUserCloudData(userId, payload = {}) {
  const { settings, newMessages, newPractice, newActivity } = payload;

  if (isSupabaseConfigured()) {
    if (settings) {
      await supaFetch('/rest/v1/settings', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: {
          user_id: userId,
          lang_mode: settings.lang_mode || 'vi',
          selected_grade: Number(settings.selected_grade || 9),
          teacher_gender: settings.teacher_gender || 'co',
          sound_enabled: settings.sound_enabled !== false,
          sound_volume: Number(settings.sound_volume ?? 0.4),
          updated_at: new Date().toISOString(),
        },
      });
    }
    if (Array.isArray(newMessages) && newMessages.length > 0) {
      const convRes = await supaFetch(`/rest/v1/conversations?user_id=eq.${userId}&order=created_at.desc&limit=1&select=id`);
      let convId = Array.isArray(convRes.data) && convRes.data[0]?.id;
      if (!convId) {
        const createdConv = await supaFetch('/rest/v1/conversations', {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: { user_id: userId, grade: Number(settings?.selected_grade || 9), lang_mode: settings?.lang_mode || 'vi' },
        });
        convId = Array.isArray(createdConv.data) ? createdConv.data[0]?.id : null;
      }
      if (convId) {
        await supaFetch('/rest/v1/messages', {
          method: 'POST',
          body: newMessages.map((m) => ({
            conversation_id: convId,
            user_id: userId,
            role: m.role === 'model' ? 'model' : 'user',
            content: String(m.content || ''),
            grade: Number(m.grade || settings?.selected_grade || 9),
            lang_mode: m.lang_mode || settings?.lang_mode || 'vi',
          })),
        });
      }
    }
    if (newPractice) {
      await supaFetch('/rest/v1/practice_results', {
        method: 'POST',
        body: { user_id: userId, title: String(newPractice.title || 'Luyện tập'), score: newPractice.score ?? null, details: newPractice.details || {} },
      });
    }
    if (newActivity) {
      await supaFetch('/rest/v1/activity_log', {
        method: 'POST',
        body: { user_id: userId, event_type: String(newActivity.event_type || 'activity'), summary: String(newActivity.summary || '') },
      });
    }
    return { ok: true };
  }

  const store = readLocalCloud();
  if (settings) {
    store.settings[userId] = { ...settings, updated_at: new Date().toISOString() };
  }
  if (Array.isArray(newMessages) && newMessages.length > 0) {
    store.messages[userId] = store.messages[userId] || [];
    newMessages.forEach((m) => store.messages[userId].push({ ...m, created_at: new Date().toISOString() }));
    if (store.messages[userId].length > 60) store.messages[userId] = store.messages[userId].slice(-60);
  }
  if (newPractice) {
    store.practice_results[userId] = store.practice_results[userId] || [];
    store.practice_results[userId].unshift({ ...newPractice, created_at: new Date().toISOString() });
  }
  if (newActivity) {
    store.activity_log[userId] = store.activity_log[userId] || [];
    store.activity_log[userId].unshift({ ...newActivity, created_at: new Date().toISOString() });
  }
  writeLocalCloud(store);
  return { ok: true };
}

export async function changeUserPassword(userId, newPassword) {
  if (!newPassword || String(newPassword).length < 6) {
    return { ok: false, status: 400, message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' };
  }
  if (isSupabaseConfigured()) {
    const r = await supaFetch(`/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      body: { password: String(newPassword) },
    });
    return r.ok ? { ok: true } : { ok: false, status: 400, message: 'Không đổi được mật khẩu.' };
  }
  if (userId === 'admin_root') {
    return { ok: false, status: 400, message: 'Mật khẩu admin cục bộ đọc từ ADMIN_PASSWORD trong .env.' };
  }
  const store = readLocalCloud();
  const user = (store.profiles || []).find((p) => p.id === userId);
  if (!user) return { ok: false, status: 404, message: 'Không tìm thấy tài khoản.' };
  user.password_hash = hashPasswordScrypt(newPassword);
  writeLocalCloud(store);
  return { ok: true };
}

// ==========================================
// ADMIN MANAGEMENT (STUDENTS LIST, APPROVE, LOCK, RESET PW, DELETE)
// ==========================================
export async function adminListStudents() {
  if (isSupabaseConfigured()) {
    const r = await supaFetch('/rest/v1/profiles?role=eq.student&order=created_at.desc&select=*');
    const act = await supaFetch('/rest/v1/activity_log?select=user_id,event_type');
    const counts = {};
    if (Array.isArray(act.data)) {
      act.data.forEach((a) => {
        if (a.event_type === 'chat_question') counts[a.user_id] = (counts[a.user_id] || 0) + 1;
      });
    }
    const list = (Array.isArray(r.data) ? r.data : []).map((p) => ({ ...p, questions_count: counts[p.id] || 0 }));
    return list;
  }
  const store = readLocalCloud();
  return (store.profiles || [])
    .filter((p) => p.role === 'student')
    .map(({ password_hash: _, ...p }) => {
      const logs = store.activity_log[p.id] || [];
      return { ...p, questions_count: logs.filter((a) => a.event_type === 'chat_question').length };
    });
}

export async function adminUpdateStudent(userId, patch) {
  const cleanPatch = { ...patch };
  if (cleanPatch.full_name) {
    const norm = normalizeVietnameseName(cleanPatch.full_name);
    cleanPatch.full_name = norm.display;
    cleanPatch.ho_ten_chuan_hoa = norm.lookup;
  }
  if (cleanPatch.class_name) {
    cleanPatch.class_name = String(cleanPatch.class_name).normalize('NFC').trim();
  }
  if (isSupabaseConfigured()) {
    const r = await supaFetch(`/rest/v1/profiles?id=eq.${userId}`, { method: 'PATCH', body: cleanPatch });
    if (!r.ok && String(r.data?.message || r.data?.code || '').includes('23505')) {
      return { ok: false, status: 409, message: 'Lớp này đã có học sinh trùng họ tên.' };
    }
    return { ok: r.ok };
  }
  const store = readLocalCloud();
  const user = (store.profiles || []).find((p) => p.id === userId);
  if (!user) return { ok: false };
  const nextLookup = cleanPatch.ho_ten_chuan_hoa || user.ho_ten_chuan_hoa || normalizeVietnameseName(user.full_name).lookup;
  const nextClass = cleanPatch.class_name || user.class_name;
  const dup = (store.profiles || []).find((p) =>
    p.id !== userId &&
    p.role !== 'admin' &&
    (p.ho_ten_chuan_hoa || normalizeVietnameseName(p.full_name).lookup) === nextLookup &&
    p.class_name === nextClass
  );
  if (dup) {
    return { ok: false, status: 409, message: 'Lớp này đã có học sinh trùng họ tên.' };
  }
  Object.assign(user, cleanPatch);
  writeLocalCloud(store);
  return { ok: true };
}

export async function adminDeleteStudent(userId) {
  if (isSupabaseConfigured()) {
    await supaFetch(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' });
    return { ok: true };
  }
  const store = readLocalCloud();
  store.profiles = (store.profiles || []).filter((p) => p.id !== userId);
  delete store.settings[userId];
  delete store.messages[userId];
  delete store.practice_results[userId];
  delete store.activity_log[userId];
  writeLocalCloud(store);
  return { ok: true };
}
