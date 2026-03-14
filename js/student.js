// Student Exam Logic
// ===================

// ===== GLOBAL STATE =====
let currentTest = null;
let currentSession = null;
let sessionId = null;
let studentName = '';
let answers = {};
let currentQuestionIndex = 0;
let timerInterval = null;
let remainingSeconds = 0;
let tabViolations = 0;
let cameraStream = null;
let snapshotInterval = null;
let examStarted = false;

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('entryForm').addEventListener('submit', handleEntry);
    document.getElementById('allowCameraBtn').addEventListener('click', startExamWithCamera);
    document.getElementById('submitExamBtn').addEventListener('click', () => confirmSubmit());
    document.getElementById('dismissViolation').addEventListener('click', dismissViolation);
});

// ===== ENTRY: Find test by access code =====
async function handleEntry(e) {
    e.preventDefault();
    const name = document.getElementById('studentName').value.trim();
    const code = document.getElementById('accessCode').value.trim().toUpperCase();
    const errorEl = document.getElementById('entryError');
    const btn = document.getElementById('startExamBtn');

    if (!name || !code) return;

    btn.disabled = true;
    btn.textContent = '⏳ Đang tìm bài thi...';
    errorEl.classList.add('hidden');

    try {
        const snapshot = await db.collection('tests')
            .where('accessCode', '==', code)
            .where('isActive', '==', true)
            .limit(1)
            .get();

        if (snapshot.empty) {
            errorEl.textContent = '❌ Mã bài thi không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra lại.';
            errorEl.classList.remove('hidden');
            btn.disabled = false;
            btn.textContent = '🚀 Bắt Đầu Làm Bài';
            return;
        }

        const testDoc = snapshot.docs[0];
        currentTest = { id: testDoc.id, ...testDoc.data() };
        studentName = name;

        if (currentTest.requireCamera) {
            // Show camera permission section
            showSection('cameraSection');
            requestCamera();
        } else {
            // Start exam directly
            await createSession();
            startExam();
        }

    } catch (error) {
        console.error('Entry error:', error);
        errorEl.textContent = '❌ Lỗi kết nối. Vui lòng thử lại.';
        errorEl.classList.remove('hidden');
    }

    btn.disabled = false;
    btn.textContent = '🚀 Bắt Đầu Làm Bài';
}

// ===== CAMERA =====
async function requestCamera() {
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } },
            audio: false
        });
        document.getElementById('cameraPreview').srcObject = cameraStream;
        document.getElementById('allowCameraBtn').classList.remove('hidden');
    } catch (error) {
        console.error('Camera error:', error);
        const errEl = document.getElementById('cameraError');
        errEl.textContent = '❌ Không thể truy cập camera. Vui lòng cho phép quyền camera trong cài đặt trình duyệt rồi tải lại trang.';
        errEl.classList.remove('hidden');
        document.getElementById('allowCameraBtn').classList.add('hidden');
    }
}

async function startExamWithCamera() {
    if (!cameraStream) {
        showToast('Vui lòng cho phép quyền camera!', 'warning');
        return;
    }
    await createSession();
    startExam();
}

function startCameraSnapshots() {
    if (!cameraStream) return;

    const video = document.getElementById('examCameraVideo');
    video.srcObject = cameraStream;
    // Camera preview stays hidden - runs silently in background

    // Capture snapshot every 25 minutes (1500 seconds)
    snapshotInterval = setInterval(() => {
        captureAndUploadSnapshot();
    }, 1500000);

    // Capture first snapshot immediately
    setTimeout(() => captureAndUploadSnapshot(), 1000);
}

function captureAndUploadSnapshot() {
    if (!cameraStream || !sessionId) return;

    const video = document.getElementById('examCameraVideo');
    const canvas = document.getElementById('snapshotCanvas');
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, 320, 240);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.5);

    // Upload to Firestore
    db.collection('sessions').doc(sessionId).update({
        cameraSnapshot: dataUrl
    }).catch(err => console.error('Snapshot upload error:', err));
}

// ===== SESSION MANAGEMENT =====
async function createSession() {
    try {
        const docRef = await db.collection('sessions').add({
            testId: currentTest.id,
            studentName: studentName,
            startTime: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'in-progress',
            tabViolations: 0,
            answers: {},
            score: null,
            cheatingLog: [],
            cameraSnapshot: null
        });
        sessionId = docRef.id;
    } catch (error) {
        console.error('Create session error:', error);
        showToast('Lỗi tạo phiên thi: ' + error.message, 'error');
    }
}

// ===== EXAM LOGIC =====
function startExam() {
    showSection('examSection');
    examStarted = true;

    // Set exam title
    document.getElementById('examTitle').textContent = currentTest.title;

    // Setup timer
    remainingSeconds = currentTest.duration * 60;
    updateTimerDisplay();
    timerInterval = setInterval(timerTick, 1000);

    // Render questions
    renderQuestions();

    // Start camera if needed
    if (currentTest.requireCamera && cameraStream) {
        startCameraSnapshots();
    }

    // Setup cheat detection
    setupCheatDetection();

    // Navigate to first question
    navigateToQuestion(0);
}

function renderQuestions() {
    const container = document.getElementById('questionsDisplay');
    container.innerHTML = '';

    // ===== EXAM TEXT PANEL (if teacher used new input method) =====
    if (currentTest.examText) {
        const examPanel = document.createElement('div');
        examPanel.id = 'examTextPanel';
        examPanel.style.cssText = [
            'background: rgba(99,102,241,0.06)',
            'border: 1px solid rgba(99,102,241,0.2)',
            'border-left: 4px solid #7c3aed',
            'border-radius: 12px',
            'padding: 18px 20px',
            'margin-bottom: 20px',
            'font-size: 1rem',
            'line-height: 1.85',
            'white-space: normal',
            'font-family: Inter, system-ui, sans-serif',
            'max-height: 380px',
            'overflow-y: auto',
            'color: #1e293b',
            'word-break: break-word',
        ].join(';');


        // Clean stored HTML: strip &nbsp; and collapse multi-spaces for clean reflow
        const cleanedExam = (currentTest.examText || '')
            .replace(/&nbsp;/g, ' ')
            .replace(/\u00a0/g, ' ')
            .replace(/ {2,}/g, ' ');
        examPanel.innerHTML = cleanedExam;


        // Collapsible toggle
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'btn btn-outline btn-sm';
        toggleBtn.style.cssText = 'margin-bottom: 10px; font-size: 0.8rem;';
        toggleBtn.textContent = '📄 Ẩn / Hiện đề thi';
        toggleBtn.onclick = () => {
            examPanel.style.display = examPanel.style.display === 'none' ? '' : 'none';
        };

        const wrapper = document.createElement('div');
        wrapper.style.marginBottom = '20px';
        wrapper.appendChild(toggleBtn);
        wrapper.appendChild(examPanel);
        container.appendChild(wrapper);
    }

    currentTest.questions.forEach((q, index) => {
        // Question card
        const card = document.createElement('div');
        card.className = 'question-card';
        card.id = `exam-q-${index}`;
        card.style.display = index === 0 ? 'block' : 'none';

        let optionsHtml = '';
        const optionLabels = ['A', 'B', 'C', 'D'];
        optionLabels.forEach(label => {
            if (q.options[label]) {
                const isSelected = answers[index] === label;
                optionsHtml += `
          <label class="answer-option ${isSelected ? 'selected' : ''}" id="opt-${index}-${label}">
            <input type="radio" name="q${index}" value="${label}" ${isSelected ? 'checked' : ''}
                   onchange="selectAnswer(${index}, '${label}')">
            <span class="answer-circle">${label}</span>
            <span class="answer-text">${escapeHtml(q.options[label])}</span>
          </label>
        `;
            }
        });

        // Show passage only for old-format tests (non-examText based)
        const passageHtml = (!currentTest.examText && q.passage) ? `
          ${q.instruction ? `<div style="font-style: italic; color: var(--text-muted); font-size: 0.85rem; margin: 8px 0;">${escapeHtml(q.instruction)}</div>` : ''}
          <div class="passage-richtext" style="background: rgba(99,102,241,0.08); border-left: 3px solid var(--accent-purple); padding: 12px 16px; border-radius: 0 var(--radius-sm) var(--radius-sm) 0; margin: 12px 0; font-size: 0.9rem; color: var(--text-secondary); line-height: 1.7; max-height: 300px; overflow-y: auto;">${q.passage}</div>
        ` : '';

        // For new examText-based tests, show only the question number (no question text label)
        const questionLabel = currentTest.examText
            ? `<span class="question-badge">Câu ${index + 1}/${currentTest.questions.length}</span>`
            : `<span class="question-badge">Câu ${index + 1}/${currentTest.questions.length}</span>`;

        card.innerHTML = `
      ${questionLabel}
      ${passageHtml}
      ${!currentTest.examText ? `<p class="question-text">${escapeHtml(q.question)}</p>` : ''}
      <div class="answer-options">${optionsHtml}</div>
      <div class="exam-nav">
        ${index > 0 ? `<button class="btn btn-outline" onclick="navigateToQuestion(${index - 1})">← Câu trước</button>` : '<div></div>'}
        ${index < currentTest.questions.length - 1
                ? `<button class="btn btn-primary" onclick="navigateToQuestion(${index + 1})">Câu tiếp →</button>`
                : `<button class="btn btn-success" onclick="confirmSubmit()">📤 Nộp bài</button>`}
      </div>
    `;
        container.appendChild(card);
    });

    updateProgress();
    updateNavWindow();
}

function navigateToQuestion(index) {
    const total = currentTest.questions.length;
    // Clamp index
    if (index < 0) index = 0;
    if (index >= total) index = total - 1;

    // Hide current
    document.getElementById(`exam-q-${currentQuestionIndex}`).style.display = 'none';

    // Show target
    currentQuestionIndex = index;
    document.getElementById(`exam-q-${index}`).style.display = 'block';

    updateNavWindow();
}

function updateNavWindow() {
    const total = currentTest.questions.length;
    const navWindow = document.getElementById('navWindow');
    navWindow.innerHTML = '';

    // Calculate window range: 2 before + current + 2 after
    let start = currentQuestionIndex - 2;
    let end = currentQuestionIndex + 2;

    // Adjust if near edges
    if (start < 0) {
        end = Math.min(end - start, total - 1);
        start = 0;
    }
    if (end >= total) {
        start = Math.max(start - (end - total + 1), 0);
        end = total - 1;
    }

    for (let i = start; i <= end; i++) {
        const btn = document.createElement('button');
        btn.className = 'q-nav-btn';
        if (i === currentQuestionIndex) btn.classList.add('current');
        if (answers[i]) btn.classList.add('answered');
        btn.textContent = i + 1;
        btn.onclick = () => navigateToQuestion(i);
        navWindow.appendChild(btn);
    }

    document.getElementById('navPrevBtn').disabled = currentQuestionIndex <= 0;
    document.getElementById('navNextBtn').disabled = currentQuestionIndex >= total - 1;
}

function selectAnswer(questionIndex, answer) {
    answers[questionIndex] = answer;

    // Update UI
    const optionLabels = ['A', 'B', 'C', 'D'];
    optionLabels.forEach(l => {
        const el = document.getElementById(`opt-${questionIndex}-${l}`);
        if (el) el.classList.toggle('selected', l === answer);
    });

    // Update nav window to reflect answered status
    updateNavWindow();

    // Save to Firestore
    if (sessionId) {
        db.collection('sessions').doc(sessionId).update({
            [`answers.${questionIndex}`]: answer
        }).catch(err => console.error('Save answer error:', err));
    }

    updateProgress();
}

function updateProgress() {
    const total = currentTest.questions.length;
    const answered = Object.keys(answers).length;
    const pct = (answered / total) * 100;

    document.getElementById('progressFill').style.width = pct + '%';
    document.getElementById('progressText').textContent = `${answered}/${total}`;
}

// ===== TIMER =====
function timerTick() {
    remainingSeconds--;
    updateTimerDisplay();

    if (remainingSeconds <= 0) {
        clearInterval(timerInterval);
        autoSubmit();
    }
}

function updateTimerDisplay() {
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    const display = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    document.getElementById('timerDisplay').textContent = display;

    const timerEl = document.getElementById('examTimer');
    timerEl.classList.remove('warning', 'danger');
    if (remainingSeconds <= 60) {
        timerEl.classList.add('danger');
    } else if (remainingSeconds <= 300) {
        timerEl.classList.add('warning');
    }
}

// ===== CHEAT DETECTION =====
let violationCooldown = false; // Prevent double-counting
let warningShown = false; // Don't count while warning is displayed

function setupCheatDetection() {
    // Only use visibilitychange (blur would double-count)
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Disable right-click
    document.addEventListener('contextmenu', e => e.preventDefault());

    // Disable copy/paste shortcuts
    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'v' || e.key === 'u' || e.key === 'a')) {
            e.preventDefault();
        }
        // Disable F12
        if (e.key === 'F12') {
            e.preventDefault();
        }
    });
}

function handleVisibilityChange() {
    if (!examStarted) return;
    if (warningShown) return; // Don't count while warning is showing
    if (violationCooldown) return; // Debounce: ignore rapid fire events

    if (document.hidden) {
        // Set cooldown to prevent double-counting
        violationCooldown = true;
        setTimeout(() => { violationCooldown = false; }, 1500);

        recordViolation('Tab switch detected');
    }
}

function recordViolation(event) {
    tabViolations++;

    // Log to Firestore
    if (sessionId) {
        db.collection('sessions').doc(sessionId).update({
            tabViolations: tabViolations,
            cheatingLog: firebase.firestore.FieldValue.arrayUnion({
                time: new Date().toISOString(),
                event: event,
                count: tabViolations
            })
        }).catch(err => console.error('Log violation error:', err));
    }

    if (tabViolations >= 2) {
        // Cancel the exam
        cancelExam();
    } else {
        // Show first warning
        showViolationWarning();
    }
}

function showViolationWarning() {
    warningShown = true;
    document.getElementById('violationCount').textContent = tabViolations;
    document.getElementById('violationOverlay').classList.remove('hidden');
}

function dismissViolation() {
    document.getElementById('violationOverlay').classList.add('hidden');
    // Small delay before re-enabling detection to prevent immediate re-trigger
    setTimeout(() => { warningShown = false; }, 1000);
}

async function cancelExam() {
    examStarted = false;
    clearInterval(timerInterval);
    stopCamera();

    // Remove event listeners
    document.removeEventListener('visibilitychange', handleVisibilityChange);

    // Update Firestore
    if (sessionId) {
        try {
            await db.collection('sessions').doc(sessionId).update({
                status: 'cancelled',
                endTime: firebase.firestore.FieldValue.serverTimestamp(),
                tabViolations: tabViolations
            });
        } catch (err) {
            console.error('Cancel exam error:', err);
        }
    }

    showSection('cancelledSection');
}

// ===== SUBMIT =====
function confirmSubmit() {
    const answered = Object.keys(answers).length;
    const total = currentTest.questions.length;
    const unanswered = total - answered;

    const modal = document.getElementById('confirmModal');
    const icon = document.getElementById('confirmIcon');
    const title = document.getElementById('confirmTitle');
    const text = document.getElementById('confirmText');

    if (unanswered > 0) {
        icon.textContent = '⚠️';
        title.textContent = 'Bạn chưa trả lời hết!';
        text.innerHTML = `Bạn mới trả lời <strong style="color: var(--accent-cyan)">${answered}/${total}</strong> câu hỏi.<br>Còn <strong style="color: var(--accent-orange)">${unanswered}</strong> câu chưa trả lời.<br><br>Bạn có chắc muốn nộp bài?`;
    } else {
        icon.textContent = '📤';
        title.textContent = 'Nộp bài thi?';
        text.innerHTML = `Bạn đã trả lời <strong style="color: var(--accent-green)">${total}/${total}</strong> câu hỏi.<br>Sau khi nộp, bạn không thể chỉnh sửa câu trả lời.`;
    }

    modal.classList.remove('hidden');

    // Setup button handlers
    const okBtn = document.getElementById('confirmOk');
    const cancelBtn = document.getElementById('confirmCancel');

    // Remove old listeners
    const newOk = okBtn.cloneNode(true);
    const newCancel = cancelBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOk, okBtn);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

    newOk.addEventListener('click', () => {
        modal.classList.add('hidden');
        submitExam();
    });

    newCancel.addEventListener('click', () => {
        modal.classList.add('hidden');
    });
}

function autoSubmit() {
    showToast('⏱️ Hết thời gian! Bài thi đang được nộp tự động...', 'warning');
    submitExam();
}

async function submitExam() {
    examStarted = false;
    clearInterval(timerInterval);
    stopCamera();

    // Remove event listeners
    document.removeEventListener('visibilitychange', handleVisibilityChange);

    // Calculate score
    let score = 0;
    currentTest.questions.forEach((q, index) => {
        if (answers[index] === q.correctAnswer) {
            score++;
        }
    });

    // Update Firestore
    if (sessionId) {
        try {
            await db.collection('sessions').doc(sessionId).update({
                status: 'completed',
                endTime: firebase.firestore.FieldValue.serverTimestamp(),
                answers: answers,
                score: score
            });
        } catch (err) {
            console.error('Submit error:', err);
        }
    }

    // Show results
    showResults(score);
}

function showResults(score) {
    const total = currentTest.questions.length;
    const correct = score;
    const wrong = total - correct;
    const percentage = Math.round((score / total) * 10 * 10) / 10; // Scale to 10

    let emoji = '🎉';
    let title = 'Tuyệt vời!';
    if (percentage < 5) { emoji = '😢'; title = 'Cần cố gắng thêm!'; }
    else if (percentage < 7) { emoji = '😊'; title = 'Khá tốt!'; }
    else if (percentage < 9) { emoji = '🎊'; title = 'Rất giỏi!'; }

    document.getElementById('resultEmoji').textContent = emoji;
    document.getElementById('resultTitle').textContent = title;
    document.getElementById('resultSubtitle').textContent = `${currentTest.title} - ${studentName}`;
    document.getElementById('resultScore').textContent = `${percentage}/10`;
    document.getElementById('correctCount').textContent = correct;
    document.getElementById('wrongCount').textContent = wrong;

    showSection('resultSection');
}

// ===== CAMERA CLEANUP =====
function stopCamera() {
    if (snapshotInterval) {
        clearInterval(snapshotInterval);
        snapshotInterval = null;
    }
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
}

// ===== UTILITIES =====
function showSection(sectionId) {
    ['entrySection', 'cameraSection', 'examSection', 'resultSection', 'cancelledSection'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
    document.getElementById(sectionId).classList.remove('hidden');
}

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
