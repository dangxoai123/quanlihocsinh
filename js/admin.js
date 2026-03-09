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
  document.getElementById('addQuestionBtn').addEventListener('click', addQuestion);
  document.getElementById('addReadingGroupBtn').addEventListener('click', addReadingGroup);
  document.getElementById('createTestForm').addEventListener('submit', handleCreateTest);

  // Preview test
  document.getElementById('previewTestBtn').addEventListener('click', previewTest);

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

// ===== QUESTION BUILDER =====
function addQuestion() {
  questionsCount++;
  const container = document.getElementById('questionsContainer');
  const qDiv = document.createElement('div');
  qDiv.className = 'question-item';
  qDiv.id = `question-${questionsCount}`;
  qDiv.innerHTML = `
    <span class="question-number">Câu ${questionsCount}</span>
    <button type="button" class="question-remove" onclick="removeQuestion(${questionsCount})" title="Xóa câu hỏi">✕</button>
    <div class="form-group" style="margin-top: 12px;">
      <label class="form-label" style="font-size:0.8rem; color: var(--text-muted);">📄 Đoạn văn (tùy chọn - bỏ trống nếu không cần)</label>
      <div class="form-input q-passage richtext-editor" contenteditable="true" data-placeholder="Nhập đoạn văn / bài đọc hiểu nếu có..." style="min-height: 80px; font-size: 0.9rem; line-height: 1.6; white-space: pre-wrap;"></div>
    </div>
    <div class="form-group">
      <input type="text" class="form-input q-text" placeholder="Nhập câu hỏi..." required>
    </div>
    <div class="options-grid">
      <div class="option-item">
        <span class="option-label">A</span>
        <input type="text" class="form-input q-option" data-option="A" placeholder="Đáp án A" required>
      </div>
      <div class="option-item">
        <span class="option-label">B</span>
        <input type="text" class="form-input q-option" data-option="B" placeholder="Đáp án B" required>
      </div>
      <div class="option-item">
        <span class="option-label">C</span>
        <input type="text" class="form-input q-option" data-option="C" placeholder="Đáp án C" required>
      </div>
      <div class="option-item">
        <span class="option-label">D</span>
        <input type="text" class="form-input q-option" data-option="D" placeholder="Đáp án D" required>
      </div>
    </div>
    <div class="correct-answer-group">
      <label>✅ Đáp án đúng:</label>
      <select class="q-correct">
        <option value="A">A</option>
        <option value="B">B</option>
        <option value="C">C</option>
        <option value="D">D</option>
      </select>
    </div>
  `;
  container.appendChild(qDiv);
  updateQuestionNumbers();
  // Navigate to the newly added question (last page)
  const allItems = getAdminPageItems();
  navigateAdminQuestion(0, allItems.length - 1);
}

function removeQuestion(id) {
  const el = document.getElementById(`question-${id}`);
  if (el) {
    el.remove();
    updateQuestionNumbers();
    // Adjust current index if needed
    const allItems = getAdminPageItems();
    if (allItems.length === 0) {
      currentAdminQIndex = 0;
      updateAdminPagination();
    } else {
      if (currentAdminQIndex >= allItems.length) currentAdminQIndex = allItems.length - 1;
      navigateAdminQuestion(0, currentAdminQIndex);
    }
  }
}

function updateQuestionNumbers() {
  // Re-number all question items (both standalone and in groups)
  const items = document.querySelectorAll('#questionsContainer .question-item');
  items.forEach((item, index) => {
    const num = index + 1;
    item.querySelector('.question-number').textContent = `Câu ${num}`;
    // Update the element ID and remove button onclick to match new number
    item.id = `question-${num}`;
    const removeBtn = item.querySelector('.question-remove');
    if (removeBtn && !item.getAttribute('data-group-id')) {
      removeBtn.setAttribute('onclick', `removeQuestion(${num})`);
    } else if (removeBtn && item.getAttribute('data-group-id')) {
      removeBtn.setAttribute('onclick', `removeQuestion(${num})`);
    }
  });
  // Keep questionsCount in sync with actual count
  questionsCount = items.length;
}

// ===== ADMIN QUESTION PAGINATION =====
function getAdminPageItems() {
  // Each "page" is a top-level child of questionsContainer (either .question-item or .reading-group)
  return Array.from(document.getElementById('questionsContainer').children);
}

function navigateAdminQuestion(direction, absoluteIndex) {
  const items = getAdminPageItems();
  if (items.length === 0) {
    currentAdminQIndex = 0;
    updateAdminPagination();
    return;
  }

  // Hide all items
  items.forEach(item => item.style.display = 'none');

  // Calculate new index
  if (absoluteIndex !== undefined) {
    currentAdminQIndex = absoluteIndex;
  } else {
    currentAdminQIndex += direction;
  }

  // Clamp
  if (currentAdminQIndex < 0) currentAdminQIndex = 0;
  if (currentAdminQIndex >= items.length) currentAdminQIndex = items.length - 1;

  // Show current item
  items[currentAdminQIndex].style.display = '';

  updateAdminPagination();
}

function updateAdminPagination() {
  const items = getAdminPageItems();
  const pagination = document.getElementById('questionPagination');
  const pageInfo = document.getElementById('questionPageInfo');
  const prevBtn = document.getElementById('prevQuestionBtn');
  const nextBtn = document.getElementById('nextQuestionBtn');

  if (items.length === 0) {
    pagination.classList.add('hidden');
    return;
  }

  pagination.classList.remove('hidden');

  // Count total question items (for display)
  const totalQuestions = document.querySelectorAll('#questionsContainer .question-item').length;
  // Find question numbers on current page
  const currentItem = items[currentAdminQIndex];
  const questionsOnPage = currentItem.querySelectorAll('.question-number');
  let label = '';
  if (questionsOnPage.length === 1) {
    label = questionsOnPage[0].textContent;
  } else if (questionsOnPage.length > 1) {
    const first = questionsOnPage[0].textContent;
    const last = questionsOnPage[questionsOnPage.length - 1].textContent;
    label = `${first} - ${last}`;
  } else {
    label = `${currentAdminQIndex + 1}/${items.length}`;
  }
  pageInfo.textContent = `${label} (Tổng: ${totalQuestions})`;

  prevBtn.disabled = currentAdminQIndex <= 0;
  nextBtn.disabled = currentAdminQIndex >= items.length - 1;
}

// ===== READING COMPREHENSION GROUP =====
let readingGroupCount = 0;

function addReadingGroup() {
  readingGroupCount++;
  const container = document.getElementById('questionsContainer');
  const groupDiv = document.createElement('div');
  groupDiv.className = 'reading-group';
  groupDiv.id = `reading-group-${readingGroupCount}`;
  groupDiv.style.cssText = 'border: 2px solid var(--accent-purple); border-radius: var(--radius-md); padding: 20px; margin-bottom: 16px; background: rgba(99,102,241,0.05);';
  groupDiv.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
      <h4 style="color: var(--accent-purple); font-size: 1rem; display: flex; align-items: center; gap: 6px;">📄 Nhóm Đọc Hiểu</h4>
      <button type="button" class="reading-group-remove" onclick="removeReadingGroup(${readingGroupCount})" title="Xóa nhóm">✕</button>
    </div>
    <div class="form-group">
      <label class="form-label" style="font-size: 0.85rem;">Yêu cầu / Đề bài</label>
      <input type="text" class="form-input group-instruction" placeholder="VD: Read the following passage and mark the letter A, B, C or D..." style="font-size: 0.85rem;">
    </div>
    <div class="form-group">
      <label class="form-label" style="font-size: 0.85rem;">📄 Đoạn văn / Bài đọc</label>
      <div class="form-input group-passage richtext-editor" contenteditable="true" data-placeholder="Dán đoạn văn / bài đọc hiểu ở đây..." style="min-height: 150px; font-size: 0.9rem; line-height: 1.6; white-space: pre-wrap;"></div>
    </div>
    <div class="group-questions-container"></div>
    <button type="button" class="btn btn-outline btn-sm" onclick="addGroupQuestion(${readingGroupCount})" style="border-color: var(--accent-purple); color: var(--accent-purple); margin-top: 8px;">+ Thêm câu hỏi vào nhóm</button>
  `;
  container.appendChild(groupDiv);

  // Add first question to group
  addGroupQuestion(readingGroupCount);

  // Navigate to the newly added group (last page)
  const allItems = getAdminPageItems();
  navigateAdminQuestion(0, allItems.length - 1);
}

function addGroupQuestion(groupId) {
  questionsCount++;
  const group = document.getElementById(`reading-group-${groupId}`);
  if (!group) return;
  const container = group.querySelector('.group-questions-container');

  const qDiv = document.createElement('div');
  qDiv.className = 'question-item';
  qDiv.id = `question-${questionsCount}`;
  qDiv.setAttribute('data-group-id', groupId);
  qDiv.style.cssText = 'border-color: var(--accent-purple); margin-bottom: 12px;';
  qDiv.innerHTML = `
    <span class="question-number">Câu ${questionsCount}</span>
    <button type="button" class="question-remove" onclick="removeQuestion(${questionsCount})" title="Xóa câu hỏi">✕</button>
    <div class="form-group" style="margin-top: 12px;">
      <input type="text" class="form-input q-text" placeholder="Nhập câu hỏi..." required>
    </div>
    <div class="options-grid">
      <div class="option-item">
        <span class="option-label">A</span>
        <input type="text" class="form-input q-option" data-option="A" placeholder="Đáp án A" required>
      </div>
      <div class="option-item">
        <span class="option-label">B</span>
        <input type="text" class="form-input q-option" data-option="B" placeholder="Đáp án B" required>
      </div>
      <div class="option-item">
        <span class="option-label">C</span>
        <input type="text" class="form-input q-option" data-option="C" placeholder="Đáp án C" required>
      </div>
      <div class="option-item">
        <span class="option-label">D</span>
        <input type="text" class="form-input q-option" data-option="D" placeholder="Đáp án D" required>
      </div>
    </div>
    <div class="correct-answer-group">
      <label>✅ Đáp án đúng:</label>
      <select class="q-correct">
        <option value="A">A</option>
        <option value="B">B</option>
        <option value="C">C</option>
        <option value="D">D</option>
      </select>
    </div>
  `;
  container.appendChild(qDiv);
  updateQuestionNumbers();
  // Stay on the current reading group page
  updateAdminPagination();
}

function removeReadingGroup(groupId) {
  const el = document.getElementById(`reading-group-${groupId}`);
  if (el) {
    el.remove();
    updateQuestionNumbers();
    // Adjust pagination
    const allItems = getAdminPageItems();
    if (allItems.length === 0) {
      currentAdminQIndex = 0;
      updateAdminPagination();
    } else {
      if (currentAdminQIndex >= allItems.length) currentAdminQIndex = allItems.length - 1;
      navigateAdminQuestion(0, currentAdminQIndex);
    }
  }
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

  // Collect questions
  const questionItems = document.querySelectorAll('#questionsContainer .question-item');
  if (questionItems.length === 0) {
    showToast('Vui lòng thêm ít nhất 1 câu hỏi!', 'warning');
    return;
  }

  const questions = [];
  let valid = true;
  questionItems.forEach((item, index) => {
    const text = item.querySelector('.q-text').value.trim();

    // Check if this question belongs to a reading group
    let passage = '';
    let instruction = '';
    const groupId = item.getAttribute('data-group-id');
    if (groupId) {
      const group = document.getElementById(`reading-group-${groupId}`);
      if (group) {
        const passageEl = group.querySelector('.group-passage');
        passage = passageEl ? sanitizeHtml(passageEl.innerHTML).trim() : '';
        instruction = group.querySelector('.group-instruction') ? group.querySelector('.group-instruction').value.trim() : '';
      }
    } else {
      // Standalone question - use its own passage
      const passageEl = item.querySelector('.q-passage');
      passage = passageEl ? sanitizeHtml(passageEl.innerHTML).trim() : '';
    }

    const options = {};
    item.querySelectorAll('.q-option').forEach(opt => {
      options[opt.dataset.option] = opt.value.trim();
    });
    const correct = item.querySelector('.q-correct').value;

    if (!text || !options.A || !options.B || !options.C || !options.D) {
      valid = false;
    }

    questions.push({
      question: text,
      passage: passage || '',
      instruction: instruction || '',
      options: options,
      correctAnswer: correct
    });
  });

  if (!valid) {
    showToast('Vui lòng điền đầy đủ câu hỏi và đáp án!', 'warning');
    return;
  }

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
      questions,
      accessCode,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: currentUser.uid,
      isActive: true
    });

    showToast('✅ Đăng bài thi thành công!', 'success');

    // Show access code modal
    showAccessCodeModal(title, accessCode);

    // Reset form
    document.getElementById('createTestForm').reset();
    document.getElementById('questionsContainer').innerHTML = '';
    questionsCount = 0;
    currentAdminQIndex = 0;
    updateAdminPagination();
    document.getElementById('testDuration').value = '45';

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
  const questionItems = document.querySelectorAll('#questionsContainer .question-item');

  if (questionItems.length === 0) {
    showToast('Chưa có câu hỏi nào để xem trước!', 'warning');
    return;
  }

  let html = `
    <div style="margin-bottom: 16px; padding: 12px; background: var(--bg-glass); border-radius: var(--radius-md);">
      <strong>📌 ${escapeHtml(title)}</strong> | ⏱️ ${duration} phút | 📝 ${questionItems.length} câu
    </div>
  `;

  questionItems.forEach((item, index) => {
    const text = item.querySelector('.q-text').value.trim() || '(Chưa nhập câu hỏi)';
    const passageEl = item.querySelector('.q-passage');
    const passage = passageEl ? sanitizeHtml(passageEl.innerHTML).trim() : '';
    const options = {};
    item.querySelectorAll('.q-option').forEach(opt => {
      options[opt.dataset.option] = opt.value.trim() || '(Chưa nhập)';
    });
    const correct = item.querySelector('.q-correct').value;

    html += `
      <div style="background: var(--bg-glass); border: 1px solid var(--border-glass); border-radius: var(--radius-md); padding: 16px; margin-bottom: 12px;">
        ${passage ? `<div class="passage-richtext" style="background: rgba(99,102,241,0.08); border-left: 3px solid var(--accent-purple); padding: 10px 14px; border-radius: 0 var(--radius-sm) var(--radius-sm) 0; margin-bottom: 12px; font-size: 0.88rem; color: var(--text-secondary); line-height: 1.6;">${passage}</div>` : ''}
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
          <span class="question-badge" style="margin: 0;">Câu ${index + 1}</span>
          <strong>${escapeHtml(text)}</strong>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          ${['A', 'B', 'C', 'D'].map(l => `
            <div style="padding: 8px 12px; background: ${l === correct ? 'rgba(16,185,129,0.15)' : 'var(--bg-glass)'}; border: 1px solid ${l === correct ? 'var(--accent-green)' : 'var(--border-glass)'}; border-radius: var(--radius-sm); font-size: 0.9rem;">
              <strong>${l}.</strong> ${escapeHtml(options[l])} ${l === correct ? ' ✅' : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  });

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
