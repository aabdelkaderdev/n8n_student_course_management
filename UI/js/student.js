// js/student.js — Student Dashboard: AI recommendations, timetable, policy chat, slot requests

const ttColors = ['tt-blue', 'tt-green', 'tt-purple', 'tt-amber', 'tt-rose'];
let lastRecommendation = null;

// ===== GET RECOMMENDATION =====
async function getRecommendation() {
  const studentId = document.getElementById('studentIdInput').value.trim();
  const careerGoal = document.getElementById('careerGoalInput').value.trim();
  if (!studentId) { alert('Please enter a Student ID'); return; }

  const btn = document.getElementById('btnRecommend');
  const loading = document.getElementById('recLoading');
  const results = document.getElementById('recResults');
  const conflicts = document.getElementById('conflictAlerts');
  const info = document.getElementById('studentInfo');

  btn.disabled = true;
  loading.style.display = 'flex';
  results.style.display = 'none';
  results.innerHTML = '';
  conflicts.innerHTML = '';
  info.innerHTML = '';

  try {
    const r = await fetch(getApiBase() + '/webhook/student/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '/recommend', student_id: studentId, career_goal: careerGoal || 'general', current_semester: parseInt(document.getElementById('semesterInput').value) || null })
    });
    const data = await r.json();
    lastRecommendation = data;

    if (data.error) {
      results.innerHTML = `<div class="alert-banner danger" style="grid-column:1/-1"><i class="fas fa-circle-xmark"></i><div><h4>Error</h4><p>${data.error_message}</p></div></div>`;
      results.style.display = 'grid';
      loading.style.display = 'none';
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-brain"></i> Recommend';
      return;
    }

    // Student info bar
    info.innerHTML = `<i class="fas fa-circle-info" style="color:var(--accent)"></i> Showing results for <strong>${data.student_name}</strong> — GPA ${data.cumulative_gpa}, ${data.academic_program} Program` + (data.current_semester ? ` • Semester ${data.current_semester}` : '') + (data.remaining_credit_budget != null ? ` • Budget: ${data.mandatory_credits || 0} locked + ${data.remaining_credit_budget} flexible of ${data.max_allowed_credits} max` : '');

    // Build recommendation cards
    const courses = data.recommended_schedule?.courses || [];
    courses.forEach((c, i) => {
      const isCross = c.is_cross_program || c.ai_reasoning?.includes('[CROSS-PROGRAM]');
      const isRetake = c.reason === 'FAILED_RETAKE' || c.ai_reasoning?.toLowerCase().includes('retake');
      const isMandatory = c.reason === 'FAILED_RETAKE' || c.reason === 'CURRENT_SEMESTER_CORE';
      const slots = (c.slots || []).map(s => `<span><i class="fas fa-clock"></i> ${s.day} P${s.period}</span><span><i class="fas fa-location-dot"></i> ${s.room} (${s.component})</span>`).join('');
      const tagLabel = isRetake ? '🔄 Retake (Mandatory)' : isMandatory ? '🔒 Core (Mandatory)' : isCross ? '🔀 Cross-Program' : '🧠 AI Recommended';
      const tagClass = isRetake ? 'retake-tag' : isMandatory ? 'mandatory-tag' : isCross ? 'cross-tag' : '';
      results.innerHTML += `
    <div class="rec-card ${isCross ? 'cross-program' : ''}">
      <div class="rec-card-top">
        <h4>${c.course_code} — ${c.course_name || 'N/A'}</h4>
        <span class="code">${c.credits || 3} Credits${c.mapping_status === 'NOT_SCHEDULED' ? ' • ⚠️ Not Scheduled' : ''}${c.study_plan_term ? ' • Sem ' + c.study_plan_term : ''}</span>
      </div>
      <div class="rec-card-body">
        <div class="ai-tag ${tagClass}">${tagLabel}</div>
        <p>${c.ai_reasoning || ''}</p>
      </div>
      <div class="rec-card-footer">${slots}</div>
    </div>`;
    });
    results.style.display = 'grid';

    // Conflicts
    if (data.has_conflicts && data.conflicts?.length > 0) {
      conflicts.innerHTML = `
    <div class="conflict-alert">
      <strong><i class="fas fa-triangle-exclamation"></i> ${data.conflicts.length} Time Conflict(s) Detected:</strong><br>
      ${data.conflicts.map(c => `
        <div style="margin:.35rem 0;display:flex;align-items:center;gap:.75rem;flex-wrap:wrap">
          <span>• <strong>${c.course_a}</strong> vs <strong>${c.course_b}</strong> — ${c.day} Period ${c.period}</span>
          <button class="btn btn-outline" style="font-size:.72rem;padding:4px 12px;border-color:#ef4444;color:#ef4444" onclick="requestSlot('${c.course_a}', '${studentId}')">
            <i class="fas fa-hand-paper"></i> Request New Slot for ${c.course_a}
          </button>
        </div>`).join('')}
    </div>`;
    }

    // Build timetable
    buildTimetable(courses);

  } catch (e) {
    results.innerHTML = `<div class="alert-banner danger" style="grid-column:1/-1"><i class="fas fa-circle-xmark"></i><div><h4>Connection Error</h4><p>${e.message}</p></div></div>`;
    results.style.display = 'grid';
  }
  loading.style.display = 'none';
  btn.disabled = false;
  btn.innerHTML = '<i class="fas fa-brain"></i> Recommend';
}

function buildTimetable(courses) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
  const periods = [1, 2, 3, 4];
  const periodTimes = { 1: '08:30–10:00', 2: '10:15–11:45', 3: '12:00–13:30', 4: '13:45–15:15' };

  // Build slot map
  const slotMap = {};
  courses.forEach((c, ci) => {
    (c.slots || []).forEach(s => {
      const key = `${s.day}-${s.period}`;
      if (!slotMap[key]) slotMap[key] = [];
      slotMap[key].push({ code: c.course_code, name: c.course_name, room: s.room, component: s.component, colorIdx: ci % ttColors.length });
    });
  });

  let html = '<table class="timetable"><thead><tr><th>Day</th>';
  periods.forEach(p => html += `<th>${periodTimes[p]}</th>`);
  html += '</tr></thead><tbody>';

  days.forEach(d => {
    html += `<tr><td style="font-weight:600;font-size:.78rem;color:var(--text-secondary)">${d.toUpperCase()}</td>`;
    periods.forEach(p => {
      const slots = slotMap[`${d}-${p}`];
      if (slots && slots.length > 0) {
        html += `<td style="vertical-align: top;">`;
        slots.forEach(slot => {
          // Add a red border and margin if there are multiple courses in the same slot (conflict)
          const conflictStyle = slots.length > 1 ? 'border: 1.5px solid #ef4444; margin-bottom: 4px;' : '';
          html += `<div class="tt-cell ${ttColors[slot.colorIdx]}" style="${conflictStyle}"><strong>${slot.code}</strong>${slot.component}<br><small>${slot.room}</small></div>`;
        });
        html += `</td>`;
      } else {
        html += '<td></td>';
      }
    });
    html += '</tr>';
  });
  html += '</tbody></table>';

  document.getElementById('timetableWrap').innerHTML = html;
}

// ===== POLICY CHAT =====
async function sendChat() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;

  const container = document.getElementById('chatMessages');
  const studentId = document.getElementById('studentIdInput').value.trim() || '20100252';

  // Add user message
  const userDiv = document.createElement('div');
  userDiv.className = 'msg user';
  userDiv.innerHTML = `<div class="msg-avatar"><i class="fas fa-user"></i></div><div><div class="msg-bubble">${escapeHtml(msg)}</div></div>`;
  container.appendChild(userDiv);
  input.value = '';
  container.scrollTop = container.scrollHeight;

  // Add thinking indicator
  const thinkId = 'think-' + Date.now();
  const thinkDiv = document.createElement('div');
  thinkDiv.className = 'msg bot';
  thinkDiv.id = thinkId;
  thinkDiv.innerHTML = '<div class="msg-avatar"><i class="fas fa-robot"></i></div><div><div class="msg-bubble"><div class="spinner" style="border-color:rgba(0,180,216,.3);border-top-color:var(--accent);width:16px;height:16px"></div> Thinking...</div></div>';
  container.appendChild(thinkDiv);
  container.scrollTop = container.scrollHeight;

  try {
    const r = await fetch(getApiBase() + '/webhook/student/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, student_id: studentId })
    });
    const data = await r.json();
    const response = data.output || data.response || data.telegram_message_text || JSON.stringify(data);

    document.getElementById(thinkId).innerHTML = `<div class="msg-avatar"><i class="fas fa-robot"></i></div><div><div class="msg-bubble">${escapeHtml(response)}</div></div>`;
  } catch (e) {
    document.getElementById(thinkId).innerHTML = `<div class="msg-avatar"><i class="fas fa-robot"></i></div><div><div class="msg-bubble" style="border-color:#fca5a5;background:#fef2f2">⚠️ Connection error: ${e.message}</div></div>`;
  }
  container.scrollTop = container.scrollHeight;
}

// ===== REQUEST NEW SLOT =====
async function requestSlot(courseCode, studentId) {
  const btn = event.currentTarget;
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Sending...';
  try {
    const r = await fetch(getApiBase() + '/webhook/student/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '/request-slot', student_id: studentId, course_code: courseCode })
    });
    const data = await r.json();
    btn.innerHTML = '<i class="fas fa-check"></i> Request Sent!';
    btn.style.borderColor = 'var(--success)';
    btn.style.color = 'var(--success)';
    setTimeout(() => {
      btn.innerHTML = `<i class="fas fa-hand-paper"></i> Request New Slot for ${courseCode}`;
      btn.style.borderColor = '#ef4444';
      btn.style.color = '#ef4444';
      btn.disabled = false;
    }, 3000);
  } catch (e) {
    btn.innerHTML = '<i class="fas fa-circle-xmark"></i> Failed';
    btn.disabled = false;
  }
}

// Enter key for chat
document.getElementById('chatInput')?.addEventListener('keypress', e => { if (e.key === 'Enter') sendChat(); });
