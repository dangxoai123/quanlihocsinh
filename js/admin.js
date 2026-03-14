// Admin Dashboard Logic
// =====================

// ===== GLOBAL STATE =====
let currentUser = null;
let questionsCount = 0;
let monitorUnsubscribe = null;
let currentAdminQIndex = 0; // Current visible page in question builder

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
  // Check auth state
  Auth.checkAuth(user => {
    if (user) {
      currentUser = user;
      showDashboard();
      loadHistory();
      loadMonitorTestList();
    } else {
      showLogin();
    }
  });

  // Setup event listeners
  setupEventListeners();
});

function setupEventListeners() {
  // Login form
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('toggleRegister').addEventListener('click', () => {
    document.getElementById('loginFormContainer').classList.add('hidden');
    document.getElementById('registerFormContainer').classList.remove('hidden');
  });
  document.getElementById('toggleLogin').addEventListener('click', () => {
    document.getElementById('registerFormContainer').classList.add('hidden');
    document.getElementById('loginFormContainer').classList.remove('hidden');
  });
  document.getElementById('registerForm').addEventListener('submit', handleRegister);

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', () => Auth.logout());

  // Navigation
  document.querySelectorAll('.nav-item[data-tab]').forEach(item => {
    item.addEventListener('click', () => switchTab(item.dataset.tab));
  });

  // Create test
  document.getElementById('createTestForm').addEventListener('submit', handleCreateTest);

  // Preview test
  document.getElementById('previewTestBtn').addEventListener('click', previewTest);

  // Generate answer inputs on page load (default 40)
  renderAnswerInputs();

  // ===== PASTE HANDLER for exam text editor =====
  // Normalizes Word line-breaks so text reflows cleanly on any screen
  document.getElementById('examFullText').addEventListener('paste', function (e) {
    e.preventDefault();
    const clipData = e.clipboardData || window.clipboardData;
    const html = clipData.getData('text/html');

    if (html) {
      const tmp = document.createElement('div');
      tmp.innerHTML = html;

      // Remove junk elements
      tmp.querySelectorAll('script,style,iframe,meta,link,head,img,table').forEach(el => el.remove());

      // Normalize inline styles: keep only bold/italic/underline
      tmp.querySelectorAll('[style]').forEach(el => {
        const s = el.style;
        const bold = s.fontWeight === 'bold' || parseInt(s.fontWeight) >= 700;
        const italic = s.fontStyle === 'italic';
        const underline = s.textDecoration && s.textDecoration.includes('underline');
        el.removeAttribute('style');
        if (bold) el.style.fontWeight = 'bold';
        if (italic) el.style.fontStyle = 'italic';
        if (underline) el.style.textDecoration = 'underline';
      });

      // Remove class/id
      tmp.querySelectorAll('[class],[id]').forEach(el => {
        el.removeAttribute('class');
        el.removeAttribute('id');
      });

      // Strip empty <span> wrappers
      tmp.querySelectorAll('span').forEach(span => {
        if (!span.getAttribute('style')) span.replaceWith(...span.childNodes);
      });

      // Convert block elements (p/div) to paragraphs separated by double-br
      // Empty blocks → single br (blank line); non-empty → content + br
      tmp.querySelectorAll('p, div').forEach(block => {
        const isEmpty = block.textContent.trim() === '';
        const nodes = [...block.childNodes];
        const br1 = document.createElement('br');
        if (!isEmpty) {
          // Append a <br> after the inline content to end the line
          block.after(br1);
          block.replaceWith(...nodes);
        } else {
          // Empty paragraph → skip (Word often has empty p as spacing)
          block.remove();
        }
      });

      // Collapse 3+ consecutive <br> → max 2
      let cleaned = tmp.innerHTML.replace(/(<br\s*\/?>[\s]*){3,}/gi, '<br><br>');

      // Remove leading/trailing <br>
      cleaned = cleaned.replace(/^(<br\s*\/?>[\s]*)+/i, '').replace(/(<br\s*\/?>[\s]*)+$/i, '');

      // Strip non-breaking spaces → regular space, collapse 2+ spaces to 1
      cleaned = cleaned.replace(/&nbsp;/g, ' ').replace(/ {2,}/g, ' ');

      document.execCommand('insertHTML', false, cleaned);
    } else {
      // Fallback: plain text — normalize line breaks
      let text = clipData.getData('text/plain') || '';
      // Double newline → paragraph break marker, single newline → space
      text = text.replace(/\n{2,}/g, '\u0000').replace(/\n/g, ' ').replace(/\u0000/g, '\n\n');
      document.execCommand('insertText', false, text.trim());
    }
  });

  // Monitor test selection
  document.getElementById('monitorTestSelect').addEventListener('change', handleMonitorTestChange);

  // Mobile menu
  document.getElementById('mobileMenuBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  // Delete all tests
  document.getElementById('deleteAllTestsBtn').addEventListener('click', deleteAllTests);
}

// ===== AUTH HANDLERS =====
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');

  btn.disabled = true;
  btn.textContent = '⏳ Đang đăng nhập...';
  errorEl.classList.add('hidden');

  const result = await Auth.login(email, password);
  if (!result.success) {
    errorEl.textContent = '❌ ' + result.message;
    errorEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Đăng Nhập';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;
  const errorEl = document.getElementById('regError');
  const successEl = document.getElementById('regSuccess');

  errorEl.classList.add('hidden');
  successEl.classList.add('hidden');

  const result = await Auth.register(email, password);
  if (result.success) {
    successEl.textContent = '✅ Đăng ký thành công! Đang chuyển hướng...';
    successEl.classList.remove('hidden');
  } else {
    errorEl.textContent = '❌ ' + result.message;
    errorEl.classList.remove('hidden');
  }
}

function showDashboard() {
  document.getElementById('loginSection').classList.add('hidden');
  document.getElementById('dashboardSection').classList.remove('hidden');
}

function showLogin() {
  document.getElementById('loginSection').classList.remove('hidden');
  document.getElementById('dashboardSection').classList.add('hidden');
}

// ===== TAB NAVIGATION =====
function switchTab(tab) {
  // Update nav items
  document.querySelectorAll('.nav-item[data-tab]').forEach(item => {
    item.classList.toggle('active', item.dataset.tab === tab);
  });

  // Update content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById('tab' + capitalize(tab)).classList.add('active');

  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('open');

  // Refresh data when switching tabs
  if (tab === 'history') loadHistory();
  if (tab === 'monitor') loadMonitorTestList();
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ===== EXAM TEXT FORMATTING HELPERS =====
function fmtExam(command) {
  document.getElementById('examFullText').focus();
  document.execCommand(command, false, null);
}

function fmtExamUppercase() {
  const el = document.getElementById('examFullText');
  el.focus();
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return;
  const selectedText = sel.toString();
  document.execCommand('insertText', false, selectedText.toUpperCase());
}

function fmtExamInsert(chars) {
  const el = document.getElementById('examFullText');
  el.focus();
  document.execCommand('insertText', false, chars);
}

// ===== ANSWER INPUTS =====
const ANSWER_COLORS = {
  A: { bg: 'rgba(6,182,212,0.18)',  border: '#06b6d4', text: '#06b6d4'  },
  B: { bg: 'rgba(16,185,129,0.18)', border: '#10b981', text: '#10b981' },
  C: { bg: 'rgba(251,146,60,0.18)', border: '#fb923c', text: '#fb923c'  },
  D: { bg: 'rgba(239,68,68,0.18)',  border: '#ef4444', text: '#ef4444'  },
};

function applyAnswerColor(wrapper, value) {
  const c = ANSWER_COLORS[value] || ANSWER_COLORS.A;
  wrapper.style.background = c.bg;
  wrapper.style.borderColor = c.border;
  wrapper.querySelector('select').style.color = c.text;
}

function renderAnswerInputs() {
  const count = parseInt(document.getElementById('answerCount').value) || 0;
  const container = document.getElementById('answerInputsContainer');
  if (count < 1 || count > 200) {
    showToast('Số câu hỏi phải từ 1 đến 200!', 'warning');
    return;
  }

  // Preserve existing selected values
  const existing = {};
  container.querySelectorAll('select[data-q]').forEach(sel => {
    existing[sel.dataset.q] = sel.value;
  });

  container.innerHTML = '';
  for (let i = 1; i <= count; i++) {
    const val = existing[String(i)] || 'A';
    const c = ANSWER_COLORS[val];

    const wrapper = document.createElement('div');
    wrapper.style.cssText = `display:flex; align-items:center; gap:6px; background:${c.bg}; border:1.5px solid ${c.border}; border-radius: var(--radius-sm); padding: 6px 10px; transition: background 0.2s, border-color 0.2s;`;

    const label = document.createElement('span');
    label.style.cssText = 'font-size:0.78rem; color: var(--text-muted); min-width:40px; font-weight:600;';
    label.textContent = `Câu ${i}`;

    const sel = document.createElement('select');
    sel.dataset.q = String(i);
    sel.style.cssText = `background: transparent; border: none; color:${c.text}; font-size: 1rem; font-weight: 800; cursor:pointer; outline:none; padding: 2px 4px;`;
    ['A','B','C','D'].forEach(opt => {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      if (opt === val) o.selected = true;
      sel.appendChild(o);
    });

    sel.addEventListener('change', () => applyAnswerColor(wrapper, sel.value));

    wrapper.appendChild(label);
    wrapper.appendChild(sel);
    container.appendChild(wrapper);
  }
  showToast(`✅ Đã tạo ${count} ô đáp án!`, 'success');
}


// ===== CREATE TEST =====
function generateAccessCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function handleCreateTest(e) {
  e.preventDefault();

  const title = document.getElementById('testTitle').value.trim();
  const subject = document.getElementById('testSubject').value.trim();
  const duration = parseInt(document.getElementById('testDuration').value);
  const requireCamera = document.getElementById('testCamera').value === 'true';

  if (!title || !subject || !duration) {
    showToast('Vui lòng điền đầy đủ tiêu đề, môn học và thời gian!', 'warning');
    return;
  }

  // Read exam text
  const examEl = document.getElementById('examFullText');
  const examText = examEl.innerHTML.trim();
  if (!examText || examText === '<br>') {
    showToast('Vui lòng nhập nội dung đề thi!', 'warning');
    return;
  }

  // Read answer key dropdowns
  const answerSelects = document.querySelectorAll('#answerInputsContainer select[data-q]');
  if (answerSelects.length === 0) {
    showToast('Vui lòng tạo ô đáp án trước!', 'warning');
    return;
  }

  // Build questions array from answer key
  const questions = [];
  answerSelects.forEach((sel, idx) => {
    questions.push({
      question: `Câu ${idx + 1}`,
      passage: '',
      instruction: '',
      options: { A: 'A', B: 'B', C: 'C', D: 'D' },
      correctAnswer: sel.value
    });
  });

  const btn = document.getElementById('publishTestBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Đang đăng...';

  try {
    const accessCode = generateAccessCode();
    await db.collection('tests').add({
      title,
      subject,
      duration,
      requireCamera,
      examText,          // full exam body stored here
      questions,
      accessCode,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: currentUser.uid,
      isActive: true
    });

    showToast('✅ Đăng bài thi thành công!', 'success');
    showAccessCodeModal(title, accessCode);

    // Reset form
    document.getElementById('createTestForm').reset();
    examEl.innerHTML = '';
    document.getElementById('answerInputsContainer').innerHTML = '';
    document.getElementById('testDuration').value = '45';
    renderAnswerInputs(); // reset to default 40 slots

  } catch (error) {
    console.error('Create test error:', error);
    showToast('❌ Lỗi khi tạo bài thi: ' + error.message, 'error');
  }

  btn.disabled = false;
  btn.textContent = '🚀 Đăng Bài Thi';
}


function showAccessCodeModal(title, code) {
  const modal = document.getElementById('resultModal');
  document.getElementById('resultModalTitle').textContent = 'Bài thi đã được tạo!';
  document.getElementById('resultModalContent').innerHTML = `
    <p style="color: var(--text-secondary); margin-bottom: 16px;">
      Bài thi "<strong>${title}</strong>" đã được đăng thành công. Gửi mã bên dưới cho học sinh:
    </p>
    <div class="access-code-display">
      <div class="access-code-label">Mã truy cập bài thi</div>
      <div class="access-code-value">${code}</div>
    </div>
    <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 12px;">
      Học sinh nhập mã này tại trang Học Sinh để bắt đầu làm bài.
    </p>
  `;
  modal.classList.remove('hidden');
}

// ===== PREVIEW TEST =====
function previewTest() {
  const title = document.getElementById('testTitle').value.trim() || 'Bài thi chưa đặt tên';
  const duration = document.getElementById('testDuration').value || '45';
  const examEl = document.getElementById('examFullText');
  const examHtml = examEl.innerHTML.trim();
  const answerSelects = document.querySelectorAll('#answerInputsContainer select[data-q]');

  if (!examHtml || examHtml === '<br>') {
    showToast('Chưa có nội dung đề thi để xem trước!', 'warning');
    return;
  }

  // Build answer key summary
  let answerKeyHtml = '';
  if (answerSelects.length > 0) {
    answerKeyHtml = `<div style="margin-top:16px; border-top:1px solid var(--border-glass); padding-top:14px;">
      <strong style="font-size:0.95rem;">✅ Đáp án (${answerSelects.length} câu)</strong>
      <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(80px,1fr)); gap:8px; margin-top:10px;">`;
    answerSelects.forEach(sel => {
      answerKeyHtml += `<div style="padding:6px 10px; background:rgba(16,185,129,0.12); border:1px solid var(--accent-green); border-radius:var(--radius-sm); font-size:0.88rem; text-align:center;">
        <span style="color:var(--text-muted); font-size:0.75rem;">Câu ${sel.dataset.q}</span><br>
        <strong style="color:var(--accent-green);">${sel.value}</strong>
      </div>`;
    });
    answerKeyHtml += '</div></div>';
  }

  const html = `
    <div style="margin-bottom:14px; padding:12px; background:var(--bg-glass); border-radius:var(--radius-md);">
      <strong>📌 ${escapeHtml(title)}</strong> | ⏱️ ${duration} phút | 📝 ${answerSelects.length} câu
    </div>
    <div style="background:rgba(99,102,241,0.06); border:1px solid var(--border-glass); border-radius:var(--radius-md); padding:18px; font-size:0.93rem; line-height:1.9; white-space:pre-wrap; font-family:'Courier New',monospace; max-height:500px; overflow-y:auto;">
      ${examHtml}
    </div>
    ${answerKeyHtml}
  `;

  const modal = document.getElementById('resultModal');
  document.getElementById('resultModalTitle').textContent = '👁️ Xem trước bài thi';
  document.getElementById('resultModalContent').innerHTML = html;
  modal.classList.remove('hidden');
}

// ===== HISTORY =====
async function loadHistory() {
  try {
    const snapshot = await db.collection('tests')
      .where('createdBy', '==', currentUser.uid)
      .get();

    // Sort client-side to avoid needing composite index
    const docs = snapshot.docs.sort((a, b) => {
      const ta = a.data().createdAt?.toMillis() || 0;
      const tb = b.data().createdAt?.toMillis() || 0;
      return tb - ta;
    });

    const tbody = document.getElementById('historyBody');
    const emptyState = document.getElementById('historyEmpty');
    tbody.innerHTML = '';

    if (snapshot.empty) {
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');

    docs.forEach(doc => {
      const data = doc.data();
      const date = data.createdAt ? data.createdAt.toDate().toLocaleDateString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      }) : 'N/A';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(data.title)}</strong></td>
        <td>${escapeHtml(data.subject)}</td>
        <td>${data.duration} phút</td>
        <td><code style="color: var(--accent-cyan); font-weight: 700; letter-spacing: 0.1em;">${data.accessCode}</code></td>
        <td><span class="badge ${data.isActive ? 'badge-active' : 'badge-inactive'}">${data.isActive ? 'Đang mở' : 'Đã đóng'}</span></td>
        <td style="font-size: 0.85rem; color: var(--text-secondary);">${date}</td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-sm btn-outline" onclick="toggleTestStatus('${doc.id}', ${data.isActive})">${data.isActive ? '🔒 Đóng' : '🔓 Mở'}</button>
            <button class="btn btn-sm btn-primary" onclick="viewTestResults('${doc.id}')">📊 Kết quả</button>
            <button class="btn btn-sm btn-danger" onclick="deleteTest('${doc.id}')">🗑️</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error('Load history error:', error);
    showToast('Lỗi tải lịch sử: ' + error.message, 'error');
  }
}

async function toggleTestStatus(testId, currentStatus) {
  try {
    await db.collection('tests').doc(testId).update({
      isActive: !currentStatus
    });
    showToast(currentStatus ? '🔒 Đã đóng bài thi' : '🔓 Đã mở bài thi', 'success');
    loadHistory();
    loadMonitorTestList();
  } catch (error) {
    showToast('Lỗi: ' + error.message, 'error');
  }
}

async function deleteTest(testId) {
  showConfirm({
    icon: '🗑️',
    title: 'Xóa bài thi?',
    text: 'Bạn có chắc muốn xóa bài thi này?<br><strong style="color: var(--accent-red)">Hành động này không thể hoàn tác.</strong>',
    btnText: '🗑️ Xóa',
    btnClass: 'btn-danger',
    onConfirm: async () => {
      try {
        await db.collection('tests').doc(testId).delete();
        showToast('🗑️ Đã xóa bài thi', 'success');
        loadHistory();
        loadMonitorTestList();
      } catch (error) {
        showToast('Lỗi: ' + error.message, 'error');
      }
    }
  });
}

async function deleteAllTests() {
  showConfirm({
    icon: '⚠️',
    title: 'Xóa TẤT CẢ bài thi?',
    text: 'Bạn sẽ xóa <strong style="color: var(--accent-red)">toàn bộ</strong> bài thi và kết quả liên quan.<br><strong style="color: var(--accent-red)">Hành động này không thể hoàn tác!</strong>',
    btnText: '🗑️ Xóa tất cả',
    btnClass: 'btn-danger',
    onConfirm: async () => {
      try {
        const snapshot = await db.collection('tests')
          .where('createdBy', '==', currentUser.uid)
          .get();

        if (snapshot.empty) {
          showToast('Đã không có bài thi nào để xóa', 'info');
          return;
        }

        const batch = db.batch();
        const testIds = [];

        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
          testIds.push(doc.id);
        });

        // Also delete related sessions
        for (const testId of testIds) {
          const sessions = await db.collection('sessions')
            .where('testId', '==', testId)
            .get();
          sessions.docs.forEach(doc => {
            batch.delete(doc.ref);
          });
        }

        await batch.commit();
        showToast(`🗑️ Đã xóa ${snapshot.size} bài thi`, 'success');
        loadHistory();
        loadMonitorTestList();
      } catch (error) {
        showToast('Lỗi xóa: ' + error.message, 'error');
      }
    }
  });
}

async function viewTestResults(testId) {
  try {
    const testDoc = await db.collection('tests').doc(testId).get();
    const testData = testDoc.data();

    const sessionsSnapshot = await db.collection('sessions')
      .where('testId', '==', testId)
      .get();

    // Sort client-side to avoid needing composite index
    const sortedSessions = sessionsSnapshot.docs.sort((a, b) => {
      const ta = a.data().startTime?.toMillis() || 0;
      const tb = b.data().startTime?.toMillis() || 0;
      return tb - ta;
    });

    const modal = document.getElementById('resultModal');
    document.getElementById('resultModalTitle').textContent = `📊 Kết quả: ${testData.title}`;

    let html = '';
    if (sessionsSnapshot.empty) {
      html = '<div class="empty-state"><p>Chưa có học sinh nào làm bài thi này</p></div>';
    } else {
      html = `<div class="table-container"><table class="data-table">
        <thead><tr>
          <th>Học sinh</th>
          <th>Điểm</th>
          <th>Trạng thái</th>
          <th>Vi phạm</th>
          <th>Thời gian</th>
          <th>Chi tiết</th>
        </tr></thead><tbody>`;

      sortedSessions.forEach(doc => {
        const s = doc.data();
        const time = s.startTime ? s.startTime.toDate().toLocaleString('vi-VN') : 'N/A';
        let statusClass = 'status-active';
        let statusText = 'Đang làm';
        if (s.status === 'completed') { statusClass = 'status-completed'; statusText = 'Đã nộp'; }
        if (s.status === 'cancelled') { statusClass = 'status-cancelled'; statusText = 'Bị hủy'; }

        const score = s.score !== undefined ? `${s.score}/${testData.questions.length}` : '-';
        const violations = s.tabViolations || 0;

        html += `<tr>
          <td><strong>${escapeHtml(s.studentName)}</strong></td>
          <td style="font-weight: 700; color: var(--accent-cyan);">${score}</td>
          <td><span class="student-status ${statusClass}">${statusText}</span></td>
          <td>${violations > 0 ? `<span class="violation-badge">⚠️ ${violations}</span>` : '0'}</td>
          <td style="font-size: 0.85rem; color: var(--text-secondary);">${time}</td>
          <td><button class="btn btn-sm btn-primary" onclick="viewStudentDetail('${doc.id}', '${testId}')">📋 Xem</button></td>
        </tr>`;
      });

      html += '</tbody></table></div>';
    }

    document.getElementById('resultModalContent').innerHTML = html;
    modal.classList.remove('hidden');
  } catch (error) {
    showToast('Lỗi tải kết quả: ' + error.message, 'error');
  }
}

// ===== VIEW STUDENT DETAIL (answers per question) =====
async function viewStudentDetail(sessionId, testId) {
  try {
    const sessionDoc = await db.collection('sessions').doc(sessionId).get();
    const sessionData = sessionDoc.data();
    const testDoc = await db.collection('tests').doc(testId).get();
    const testData = testDoc.data();

    const modal = document.getElementById('resultModal');
    document.getElementById('resultModalTitle').textContent = `📋 Chi tiết: ${escapeHtml(sessionData.studentName)}`;

    let html = `
      <div style="display: flex; gap: 16px; margin-bottom: 16px; flex-wrap: wrap;">
        <div style="background: var(--bg-glass); padding: 12px 16px; border-radius: var(--radius-md); flex: 1; min-width: 120px;">
          <div style="font-size: 0.8rem; color: var(--text-muted);">Điểm</div>
          <div style="font-size: 1.3rem; font-weight: 700; color: var(--accent-cyan);">${sessionData.score !== null ? sessionData.score + '/' + testData.questions.length : '-'}</div>
        </div>
        <div style="background: var(--bg-glass); padding: 12px 16px; border-radius: var(--radius-md); flex: 1; min-width: 120px;">
          <div style="font-size: 0.8rem; color: var(--text-muted);">Trạng thái</div>
          <div style="font-size: 1rem; font-weight: 600;">${sessionData.status === 'completed' ? '✅ Đã nộp' : sessionData.status === 'cancelled' ? '🚫 Bị hủy' : '⏳ Đang làm'}</div>
        </div>
        <div style="background: var(--bg-glass); padding: 12px 16px; border-radius: var(--radius-md); flex: 1; min-width: 120px;">
          <div style="font-size: 0.8rem; color: var(--text-muted);">Vi phạm</div>
          <div style="font-size: 1rem; font-weight: 600; color: ${sessionData.tabViolations > 0 ? 'var(--accent-red)' : 'var(--accent-green)'};">${sessionData.tabViolations || 0} lần</div>
        </div>
      </div>`;

    // Camera snapshot
    if (sessionData.cameraSnapshot) {
      html += `
        <div style="margin-bottom: 16px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <strong style="font-size: 0.9rem;">📷 Ảnh camera cuối cùng</strong>
            <button class="btn btn-sm btn-danger" onclick="deleteSnapshot('${sessionId}')">🗑️ Xóa ảnh</button>
          </div>
          <img src="${sessionData.cameraSnapshot}" alt="Camera" style="width: 200px; border-radius: var(--radius-sm); border: 1px solid var(--border-glass);">
        </div>`;
    }

    // Question detail
    html += '<h3 style="font-size: 1.2rem; margin-bottom: 14px;">📝 Chi tiết câu trả lời</h3>';

    testData.questions.forEach((q, index) => {
      const studentAnswer = sessionData.answers ? sessionData.answers[index] : null;
      const isCorrect = studentAnswer === q.correctAnswer;
      const borderColor = studentAnswer === null ? 'var(--border-glass)' : (isCorrect ? 'var(--accent-green)' : 'var(--accent-red)');
      const bgColor = studentAnswer === null ? 'var(--bg-glass)' : (isCorrect ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)');

      html += `
        <div style="background: ${bgColor}; border: 1px solid ${borderColor}; border-radius: var(--radius-md); padding: 18px; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
            <span style="font-size: 1.05rem; font-weight: 700; padding: 5px 14px; border-radius: 12px; background: var(--gradient-btn); color: white;">Câu ${index + 1}</span>
            ${studentAnswer === null ? '<span style="font-size: 1.05rem; color: var(--text-muted);">⚪ Chưa trả lời</span>' : (isCorrect ? '<span style="font-size: 1.05rem; color: var(--accent-green);">✅ Đúng</span>' : '<span style="font-size: 1.05rem; color: var(--accent-red);">❌ Sai</span>')}
          </div>
          ${q.passage ? `<div class="passage-richtext" style="background: rgba(99,102,241,0.08); border-left: 3px solid var(--accent-purple); padding: 14px 18px; border-radius: 0 var(--radius-sm) var(--radius-sm) 0; margin-bottom: 14px; font-size: 1.15rem; color: var(--text-secondary); line-height: 1.8;">${q.passage}</div>` : ''}
          <div style="font-weight: 600; margin-bottom: 12px; font-size: 1.2rem;">${escapeHtml(q.question)}</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            ${['A', 'B', 'C', 'D'].map(l => {
        let optStyle = 'padding: 12px 16px; border-radius: 8px; font-size: 1.15rem; ';
        if (l === q.correctAnswer) {
          optStyle += 'background: rgba(16,185,129,0.15); border: 1px solid var(--accent-green); color: var(--accent-green);';
        } else if (l === studentAnswer && !isCorrect) {
          optStyle += 'background: rgba(239,68,68,0.15); border: 1px solid var(--accent-red); color: var(--accent-red); text-decoration: line-through;';
        } else {
          optStyle += 'background: var(--bg-glass); border: 1px solid var(--border-glass);';
        }
        const marker = l === q.correctAnswer ? ' ✅' : (l === studentAnswer && !isCorrect ? ' ❌' : '');
        return `<div style="${optStyle}"><strong>${l}.</strong> ${escapeHtml(q.options[l] || '')}${marker}</div>`;
      }).join('')}
          </div>
        </div>`;
    });

    html += `<div style="margin-top: 16px;"><button class="btn btn-outline" onclick="viewTestResults('${testId}')">← Quay lại danh sách</button></div>`;

    document.getElementById('resultModalContent').innerHTML = html;
  } catch (error) {
    showToast('Lỗi tải chi tiết: ' + error.message, 'error');
  }
}

// ===== DELETE SNAPSHOT =====
async function deleteSnapshot(sessionId) {
  showConfirm({
    icon: '📷',
    title: 'Xóa ảnh camera?',
    text: 'Bạn có chắc muốn xóa ảnh camera này?',
    btnText: '🗑️ Xóa ảnh',
    btnClass: 'btn-danger',
    onConfirm: async () => {
      try {
        await db.collection('sessions').doc(sessionId).update({
          cameraSnapshot: null
        });
        showToast('🗑️ Đã xóa ảnh camera', 'success');
        const img = document.querySelector(`[onclick="deleteSnapshot('${sessionId}')"]`);
        if (img) {
          img.closest('div').remove();
        }
      } catch (error) {
        showToast('Lỗi xóa ảnh: ' + error.message, 'error');
      }
    }
  });
}

// ===== MONITORING =====
async function loadMonitorTestList() {
  try {
    const snapshot = await db.collection('tests')
      .where('createdBy', '==', currentUser.uid)
      .get();

    // Filter and sort client-side to avoid needing composite index
    const filteredAndSortedDocs = snapshot.docs
      .filter(doc => doc.data().isActive === true)
      .sort((a, b) => {
        const ta = a.data().createdAt?.toMillis() || 0;
        const tb = b.data().createdAt?.toMillis() || 0;
        return tb - ta;
      });

    const select = document.getElementById('monitorTestSelect');
    const currentValue = select.value;
    select.innerHTML = '<option value="">-- Chọn bài thi --</option>';

    filteredAndSortedDocs.forEach(doc => {
      const data = doc.data();
      const option = document.createElement('option');
      option.value = doc.id;
      option.textContent = `${data.title} (${data.accessCode})`;
      select.appendChild(option);
    });

    if (currentValue) {
      select.value = currentValue;
    }
  } catch (error) {
    console.error('Load monitor test list error:', error);
  }
}

function handleMonitorTestChange() {
  const testId = document.getElementById('monitorTestSelect').value;

  // Unsubscribe from previous listener
  if (monitorUnsubscribe) {
    monitorUnsubscribe();
    monitorUnsubscribe = null;
  }

  if (!testId) {
    resetMonitorUI();
    return;
  }

  // Subscribe to real-time updates
  monitorUnsubscribe = db.collection('sessions')
    .where('testId', '==', testId)
    .onSnapshot(snapshot => {
      updateMonitorUI(snapshot);
    }, error => {
      console.error('Monitor error:', error);
      showToast('Lỗi giám sát: ' + error.message, 'error');
    });
}

function updateMonitorUI(snapshot) {
  const grid = document.getElementById('monitorGrid');
  const alertsContainer = document.getElementById('cheatingAlerts');

  let total = 0, active = 0, completed = 0, cheating = 0;
  let gridHtml = '';
  let alertsHtml = '';

  snapshot.forEach(doc => {
    const s = doc.data();
    total++;

    if (s.status === 'in-progress') active++;
    else if (s.status === 'completed') completed++;
    if (s.status === 'cancelled' || (s.tabViolations && s.tabViolations > 0)) cheating++;

    // Determine card status
    let cardClass = '';
    let statusClass = 'status-active';
    let statusText = 'Đang làm';

    if (s.status === 'cancelled') {
      cardClass = 'cancelled';
      statusClass = 'status-cancelled';
      statusText = 'Bị hủy';
    } else if (s.status === 'completed') {
      cardClass = 'completed';
      statusClass = 'status-completed';
      statusText = 'Đã nộp';
    } else if (s.tabViolations && s.tabViolations > 0) {
      cardClass = 'cheating';
      statusClass = 'status-warning';
      statusText = `⚠️ ${s.tabViolations} vi phạm`;
    }

    // Camera snapshot
    let cameraHtml = '<div class="no-camera">📷 Không có camera</div>';
    if (s.cameraSnapshot) {
      cameraHtml = `<img src="${s.cameraSnapshot}" alt="Camera ${escapeHtml(s.studentName)}">`;
    }

    const score = s.score !== undefined ? `${s.score}` : '-';
    const answeredCount = s.answers ? Object.keys(s.answers).length : 0;

    gridHtml += `
      <div class="student-monitor-card ${cardClass}">
        <div class="student-monitor-header">
          <span class="student-name">🎓 ${escapeHtml(s.studentName)}</span>
          <span class="student-status ${statusClass}">${statusText}</span>
        </div>
        <div class="student-camera">${cameraHtml}</div>
        <div class="student-info-row">
          <span>Đã trả lời</span>
          <span>${answeredCount} câu</span>
        </div>
        ${s.tabViolations > 0 ? `<div class="student-info-row">
          <span>Vi phạm</span>
          <span class="violation-badge">⚠️ ${s.tabViolations} lần</span>
        </div>` : ''}
        ${s.status === 'completed' ? `<div class="student-info-row">
          <span>Điểm</span>
          <span style="font-weight: 700; color: var(--accent-cyan);">${score}</span>
        </div>` : ''}
      </div>
    `;

    // Cheating alerts
    if (s.status === 'cancelled') {
      alertsHtml += `
        <div class="alert-bar alert-danger">
          🚫 <strong>${escapeHtml(s.studentName)}</strong> - Bài thi bị HỦY do vi phạm ${s.tabViolations} lần
        </div>
      `;
    } else if (s.tabViolations && s.tabViolations > 0 && s.status === 'in-progress') {
      alertsHtml += `
        <div class="alert-bar alert-warning">
          ⚠️ <strong>${escapeHtml(s.studentName)}</strong> - Đã vi phạm ${s.tabViolations} lần (chuyển tab/thoát)
        </div>
      `;
    }
  });

  // Update stats
  document.getElementById('totalStudents').textContent = total;
  document.getElementById('activeStudents').textContent = active;
  document.getElementById('completedStudents').textContent = completed;
  document.getElementById('cheatingStudents').textContent = cheating;

  // Update grid
  grid.innerHTML = gridHtml || `
    <div class="empty-state" style="grid-column: 1 / -1;">
      <div class="empty-state-icon">🎓</div>
      <p class="empty-state-text">Chưa có học sinh nào đang làm bài</p>
    </div>
  `;

  // Update alerts
  alertsContainer.innerHTML = alertsHtml;
}

function resetMonitorUI() {
  document.getElementById('totalStudents').textContent = '0';
  document.getElementById('activeStudents').textContent = '0';
  document.getElementById('completedStudents').textContent = '0';
  document.getElementById('cheatingStudents').textContent = '0';
  document.getElementById('monitorGrid').innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">📡</div>
      <p class="empty-state-text">Chọn bài thi để bắt đầu giám sát</p>
    </div>
  `;
  document.getElementById('cheatingAlerts').innerHTML = '';
}

// ===== UTILITIES =====
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const icons = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <span class="toast-message">${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Sanitize HTML - only allow safe formatting tags
function sanitizeHtml(html) {
  if (!html) return '';
  const temp = document.createElement('div');
  temp.innerHTML = html;
  // Remove script, style, iframe, etc.
  temp.querySelectorAll('script, style, iframe, object, embed, form, link').forEach(el => el.remove());
  // Clean up Google Docs spans but keep formatting
  return temp.innerHTML
    .replace(/<(?!\/?(b|i|u|strong|em|br|p|span|sub|sup|ul|ol|li)\b)[^>]+>/gi, '')
    .replace(/\sclass="[^"]*"/gi, '')
    .replace(/\sid="[^"]*"/gi, '')
    .replace(/\sstyle="[^"]*"/gi, (match) => {
      // Only keep font-weight and font-style from styles
      const bold = /font-weight\s*:\s*(bold|[7-9]00)/i.test(match);
      const italic = /font-style\s*:\s*italic/i.test(match);
      const underline = /text-decoration[^"]*underline/i.test(match);
      let kept = [];
      if (bold) kept.push('font-weight:bold');
      if (italic) kept.push('font-style:italic');
      if (underline) kept.push('text-decoration:underline');
      return kept.length > 0 ? ` style="${kept.join(';')}"` : '';
    });
}

// ===== CUSTOM CONFIRM MODAL =====
function showConfirm({ icon, title, text, btnText, btnClass, onConfirm }) {
  const modal = document.getElementById('confirmModal');
  document.getElementById('confirmIcon').textContent = icon || '❓';
  document.getElementById('confirmTitle').textContent = title || 'Xác nhận';
  document.getElementById('confirmText').innerHTML = text || '';

  const okBtn = document.getElementById('confirmOk');
  const cancelBtn = document.getElementById('confirmCancel');

  // Clone to remove old listeners
  const newOk = okBtn.cloneNode(true);
  const newCancel = cancelBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(newOk, okBtn);
  cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

  // Set button style and text
  newOk.className = `btn ${btnClass || 'btn-danger'}`;
  newOk.textContent = btnText || 'Xác nhận';

  modal.classList.remove('hidden');

  newOk.addEventListener('click', () => {
    modal.classList.add('hidden');
    if (onConfirm) onConfirm();
  });

  newCancel.addEventListener('click', () => {
    modal.classList.add('hidden');
  });
}
