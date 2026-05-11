// js/superadmin.js — SuperAdmin Dashboard: file cards, upload modal, stats

// ===== FILE TYPE DEFINITIONS =====
const FILE_TYPES = {
  grades:        { label: 'Grades',        icon: 'fa-graduation-cap', category: 'semester' },
  study_plan:    { label: 'Study Plan',    icon: 'fa-sitemap',        category: 'university' },
  prerequisites: { label: 'Prerequisites', icon: 'fa-project-diagram',category: 'university' },
  electives:     { label: 'Electives',     icon: 'fa-puzzle-piece',   category: 'university' },
  constraints:   { label: 'Constraints',   icon: 'fa-sliders',        category: 'university' },
  rooms:         { label: 'Rooms',         icon: 'fa-door-open',      category: 'university' }
};

const STORAGE_KEY = 'uas_upload_history';

// ===== LOCAL STORAGE HELPERS =====
function getUploadHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch { return {}; }
}

function saveUploadRecord(fileType, fileName, rowsProcessed) {
  const history = getUploadHistory();
  history[fileType] = {
    fileName,
    uploadedAt: new Date().toISOString(),
    rowsProcessed: rowsProcessed || 0
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

// ===== RENDER FILE CARD STATUSES =====
function renderFileCardStatuses() {
  const history = getUploadHistory();

  Object.keys(FILE_TYPES).forEach(type => {
    const statusEl = document.getElementById('fcs-' + type);
    if (!statusEl) return;

    const record = history[type];
    const cardEl = document.getElementById('fc-' + type);

    if (record) {
      const date = new Date(record.uploadedAt);
      const dateStr = date.toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
      });
      const timeStr = date.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit'
      });

      statusEl.innerHTML = `
        <span class="badge badge-success"><i class="fas fa-circle-check"></i> Uploaded</span>
        <div class="file-card-meta">
          <span class="file-card-filename" title="${escapeHtml(record.fileName)}">
            <i class="fas fa-file-excel"></i> ${escapeHtml(record.fileName)}
          </span>
          <span class="file-card-date">
            <i class="fas fa-calendar"></i> ${dateStr} at ${timeStr}
          </span>
          ${record.rowsProcessed ? `<span class="file-card-rows"><i class="fas fa-table-rows"></i> ${record.rowsProcessed} rows</span>` : ''}
        </div>
      `;

      // Mark card as uploaded
      cardEl.classList.add('uploaded');
      cardEl.classList.remove('missing');
    } else {
      statusEl.innerHTML = `<span class="badge badge-warning"><i class="fas fa-clock"></i> Not uploaded</span>`;
      cardEl.classList.add('missing');
      cardEl.classList.remove('uploaded');
    }
  });

  // Update action buttons text based on state
  updateActionButtons();
}

function updateActionButtons() {
  const history = getUploadHistory();
  const allUploaded = Object.keys(FILE_TYPES).every(t => history[t]);
  const gradesUploaded = !!history.grades;

  const btnSemester = document.getElementById('btnNewSemester');
  const btnUniversity = document.getElementById('btnNewUniversity');

  if (btnSemester) {
    btnSemester.innerHTML = gradesUploaded
      ? '<i class="fas fa-calendar-plus"></i> Update Semester Files'
      : '<i class="fas fa-calendar-plus"></i> New Semester Files';
  }

  if (btnUniversity) {
    btnUniversity.innerHTML = allUploaded
      ? '<i class="fas fa-university"></i> Update University Files'
      : '<i class="fas fa-university"></i> New University Files';
  }
}

// ===== UPLOAD MODAL =====
let currentUploadMode = 'all'; // 'semester' | 'university' | 'all'

function openUploadModal(mode) {
  currentUploadMode = mode;
  const modal = document.getElementById('uploadModal');
  const title = document.getElementById('uploadModalTitle');
  const hint  = document.getElementById('uploadModalHint');
  const filesContainer = document.getElementById('uploadedFiles');

  // Clear previous upload results
  filesContainer.innerHTML = '';

  if (mode === 'semester') {
    title.innerHTML = '<i class="fas fa-calendar-plus"></i> Upload Semester Files';
    hint.innerHTML = '<i class="fas fa-info-circle"></i> Upload the <strong>Grades</strong> file for the new semester. You may also re-upload any updated structural files.';
  } else {
    title.innerHTML = '<i class="fas fa-university"></i> Upload University Files';
    hint.innerHTML = '<i class="fas fa-info-circle"></i> Upload all 6 required files: Grades, Study Plan, Prerequisites, Electives, Constraints, and Rooms.';
  }

  modal.style.display = 'flex';
  requestAnimationFrame(() => modal.classList.add('visible'));
}

function closeUploadModal() {
  const modal = document.getElementById('uploadModal');
  modal.classList.remove('visible');
  setTimeout(() => { modal.style.display = 'none'; }, 300);
  // Refresh cards to reflect any new uploads
  renderFileCardStatuses();
}

// ===== FILE UPLOAD (drag & drop + click) =====
function initUploadZone() {
  const uploadZone = document.getElementById('uploadZone');
  if (!uploadZone) return;

  ['dragenter', 'dragover'].forEach(e => uploadZone.addEventListener(e, ev => {
    ev.preventDefault(); uploadZone.classList.add('dragover');
  }));
  ['dragleave', 'drop'].forEach(e => uploadZone.addEventListener(e, ev => {
    ev.preventDefault(); uploadZone.classList.remove('dragover');
  }));

  uploadZone.addEventListener('drop', ev => { uploadFiles(ev.dataTransfer.files); });
  uploadZone.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file'; input.multiple = true; input.accept = '.xlsx,.xls,.csv';
    input.onchange = () => uploadFiles(input.files);
    input.click();
  });
}

async function uploadFiles(files) {
  const container = document.getElementById('uploadedFiles');

  for (const file of files) {
    const id = 'file-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    container.innerHTML += `
      <div class="upload-file" id="${id}">
        <i class="fas fa-spinner fa-spin" style="color:var(--accent)"></i>
        <span class="fname">${escapeHtml(file.name)}</span>
        <span class="fstatus" style="color:var(--accent)">Uploading...</span>
      </div>`;

    try {
      const formData = new FormData();
      formData.append('file', file);
      const r = await fetch(getApiBase() + '/webhook/admin/process-data', {
        method: 'POST', body: formData
      });
      const data = await r.json();

      // Detect file type from response and save to localStorage
      const detectedType = data.file_type || detectFileTypeFromName(file.name);
      if (detectedType && FILE_TYPES[detectedType]) {
        saveUploadRecord(detectedType, file.name, data.rows_processed);
      }

      document.getElementById(id).innerHTML = `
        <i class="fas fa-circle-check" style="color:var(--success)"></i>
        <span class="fname">${escapeHtml(file.name)}</span>
        <span class="fstatus" style="color:var(--success)">✓ ${data.message || detectedType || 'Processed'}</span>`;

      // Live-update the card
      renderFileCardStatuses();
    } catch (e) {
      document.getElementById(id).innerHTML = `
        <i class="fas fa-circle-xmark" style="color:var(--danger)"></i>
        <span class="fname">${escapeHtml(file.name)}</span>
        <span class="fstatus" style="color:var(--danger)">✗ ${e.message}</span>`;
    }
  }
}

// Fallback: try to guess file type from filename if backend doesn't return it
function detectFileTypeFromName(name) {
  const n = name.toLowerCase();
  if (n.includes('grade'))        return 'grades';
  if (n.includes('study') || n.includes('plan'))  return 'study_plan';
  if (n.includes('prereq'))       return 'prerequisites';
  if (n.includes('elective'))     return 'electives';
  if (n.includes('constraint'))   return 'constraints';
  if (n.includes('room'))         return 'rooms';
  return null;
}

// ===== CLOSE MODAL ON OVERLAY CLICK =====
function initModalClose() {
  const modal = document.getElementById('uploadModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeUploadModal();
    });
  }
}

// ===== LOAD ADMIN STATS =====
async function loadAdminStats() {
  try {
    const r = await fetch(getApiBase() + '/webhook/admin/stats', { method: 'GET' });
    const data = await r.json();
    document.getElementById('statStudents').textContent = data.total_students ?? '—';
    document.getElementById('statCourses').textContent = data.total_courses ?? '—';
    document.getElementById('statRooms').textContent = data.total_rooms ?? '—';
    document.getElementById('statSchedule').textContent = data.total_schedule_entries ?? '—';
  } catch (e) {
    console.warn('Stats load failed:', e.message);
  }
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  initUploadZone();
  initModalClose();
  renderFileCardStatuses();
});
