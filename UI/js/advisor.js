// js/advisor.js — Advisor Dashboard: schedule generation, approval, views, slot requests

// ===== GENERATE SCHEDULE =====
async function generateSchedule() {
  const btn = document.getElementById('btnGenerate');
  const result = document.getElementById('generateResult');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Generating...';
  result.innerHTML = '';

  try {
    const r = await fetch(getApiBase() + '/webhook/advisor/generate-schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ term: document.getElementById('termInput').value })
    });
    const data = await r.json();

    if (data.status === 'draft_generated') {
      result.innerHTML = `
    <div class="alert-banner success" style="margin-top:1rem">
      <i class="fas fa-circle-check"></i>
      <div>
        <h4>Draft Schedule Generated Successfully!</h4>
        <p><strong>${data.total_placed}</strong> entries placed across <strong>${Object.keys(data.program_breakdown || {}).length}</strong> programs. <strong>${data.total_alerts}</strong> alert(s).</p>
        ${Object.entries(data.program_breakdown || {}).map(([p, c]) => `<span class="badge badge-info" style="margin:.15rem .25rem">${p}: ${c}</span>`).join('')}
      </div>
    </div>
    ${data.total_alerts > 0 ? `
      <div class="alert-banner warning" style="margin-top:.5rem">
        <i class="fas fa-triangle-exclamation"></i>
        <div>
          <h4>${data.total_alerts} Course(s) Could Not Be Placed</h4>
          <p>${data.alerts.map(a => `${a.course_code} (${a.component})`).join(', ')}</p>
        </div>
      </div>
    ` : ''}
  `;
    } else {
      result.innerHTML = `<div class="alert-banner danger"><i class="fas fa-circle-xmark"></i><div><h4>Error</h4><p>${JSON.stringify(data)}</p></div></div>`;
    }
  } catch (e) {
    result.innerHTML = `<div class="alert-banner danger"><i class="fas fa-circle-xmark"></i><div><h4>Connection Error</h4><p>${e.message}</p></div></div>`;
  }
  btn.disabled = false;
  btn.innerHTML = '<i class="fas fa-play"></i> Generate';
}

// ===== APPROVE SCHEDULE =====
async function approveSchedule() {
  const btn = document.getElementById('btnApprove');
  const result = document.getElementById('approveResult');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Approving...';

  try {
    const r = await fetch(getApiBase() + '/webhook/advisor/approve-schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const data = await r.json();
    result.innerHTML = `
  <div class="alert-banner success">
    <i class="fas fa-circle-check"></i>
    <div><h4>Schedule Finalized!</h4><p>${data.message || 'All draft entries promoted to finalized. Recommendation cache cleared.'}</p></div>
  </div>`;
  } catch (e) {
    result.innerHTML = `<div class="alert-banner danger"><i class="fas fa-circle-xmark"></i><div><h4>Error</h4><p>${e.message}</p></div></div>`;
  }
  btn.disabled = false;
  btn.innerHTML = '<i class="fas fa-stamp"></i> Approve Schedule';
}

// ===== SCHEDULE VIEWS =====
let currentViewMode = 'program';

async function viewSchedule(mode) {
  currentViewMode = mode;
  const loading = document.getElementById('scheduleViewLoading');
  const result = document.getElementById('scheduleViewResult');
  const btn1 = document.getElementById('btnView1');
  const btn2 = document.getElementById('btnView2');

  btn1.className = mode === 'program' ? 'btn btn-accent' : 'btn btn-outline';
  btn2.className = mode === 'master' ? 'btn btn-accent' : 'btn btn-outline';

  loading.style.display = 'flex';
  result.innerHTML = '';

  try {
    const program = document.getElementById('programFilter').value;
    const r = await fetch(getApiBase() + '/webhook/advisor/view-schedule?program=' + program, {
      method: 'GET'
    });
    const data = await r.json();

    if (!data.schedule || data.schedule.length === 0) {
      result.innerHTML = `<div class="alert-banner warning"><i class="fas fa-triangle-exclamation"></i><div><h4>No Schedule Found</h4><p>No finalized schedule entries exist. Generate and approve a schedule first.</p></div></div>`;
      loading.style.display = 'none';
      return;
    }

    if (mode === 'program') {
      buildProgramView(data.schedule, program);
    } else {
      buildMasterView(data.schedule);
    }
  } catch (e) {
    result.innerHTML = `<div class="alert-banner danger"><i class="fas fa-circle-xmark"></i><div><h4>Connection Error</h4><p>${e.message}</p></div></div>`;
  }
  loading.style.display = 'none';
}

function buildProgramView(rows, filterProgram) {
  const result = document.getElementById('scheduleViewResult');
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
  const periods = [1, 2, 3, 4];
  const periodTimes = { 1: '08:30–10:00', 2: '10:15–11:45', 3: '12:00–13:30', 4: '13:45–15:15' };

  // Group by program
  const programs = filterProgram === 'ALL'
    ? [...new Set(rows.map(r => r.program_code))].sort()
    : [filterProgram];

  let html = '';
  for (const prog of programs) {
    const progRows = rows.filter(r => r.program_code === prog);
    if (!progRows.length) continue;
    const slotMap = {};
    progRows.forEach(r => {
      const key = `${r.day}-${r.period}`;
      if (!slotMap[key]) slotMap[key] = [];
      slotMap[key].push(r);
    });

    html += `<div style="margin-bottom:2rem"><h4 style="font-weight:700;color:var(--primary);margin-bottom:.75rem"><i class="fas fa-layer-group" style="color:var(--accent)"></i> ${prog} Program</h4>`;
    html += `<div class="table-wrap"><table class="timetable"><thead><tr><th>Day</th>${periods.map(p => `<th>${periodTimes[p]}</th>`).join('')}</tr></thead><tbody>`;
    days.forEach(d => {
      html += `<tr><td style="font-weight:600;font-size:.78rem;color:var(--text-secondary)">${d}</td>`;
      periods.forEach(p => {
        const key = `${d}-${p}`;
        const slots = slotMap[key] || [];
        if (slots.length) {
          const colors = ['tt-blue', 'tt-green', 'tt-purple', 'tt-amber', 'tt-rose'];
          html += `<td>${slots.map((s, i) => `<div class="tt-cell ${colors[i % colors.length]}"><strong>${s.course_code}</strong> ${s.component}<br><small>${s.room_id}</small></div>`).join('')}</td>`;
        } else {
          html += '<td></td>';
        }
      });
      html += '</tr>';
    });
    html += `</tbody></table></div></div>`;
  }
  result.innerHTML = html || '<p style="color:var(--text-secondary)">No data for selected program.</p>';
}

function buildMasterView(rows) {
  const result = document.getElementById('scheduleViewResult');
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
  const periods = [1, 2, 3, 4];
  const periodTimes = { 1: '08:30–10:00', 2: '10:15–11:45', 3: '12:00–13:30', 4: '13:45–15:15' };

  const rooms = [...new Set(rows.map(r => r.room_id))].sort();
  const slotMap = {};
  rows.forEach(r => {
    const key = `${r.room_id}-${r.day}-${r.period}`;
    if (!slotMap[key]) slotMap[key] = [];
    slotMap[key].push(r);
  });

  let html = '';
  rooms.forEach(room => {
    html += `<div style="margin-bottom:2rem"><h4 style="font-weight:700;color:var(--primary);margin-bottom:.75rem"><i class="fas fa-door-open" style="color:var(--accent)"></i> Room: ${room}</h4>`;
    html += `<div class="table-wrap"><table class="timetable"><thead><tr><th>Day</th>${periods.map(p => `<th>${periodTimes[p]}</th>`).join('')}</tr></thead><tbody>`;
    days.forEach(day => {
      html += `<tr><td style="font-weight:600;font-size:.78rem">${day}</td>`;
      periods.forEach(p => {
        const key = `${room}-${day}-${p}`;
        const slots = slotMap[key] || [];
        if (slots.length) {
          // Group identical courses (cross-listed)
          const grouped = {};
          slots.forEach(s => {
            const gKey = `${s.course_code}-${s.component}-${s.section}`;
            if (!grouped[gKey]) {
              grouped[gKey] = { ...s, programs: [s.program_code] };
            } else if (!grouped[gKey].programs.includes(s.program_code)) {
              grouped[gKey].programs.push(s.program_code);
            }
          });
          const mergedSlots = Object.values(grouped);

          const colors = ['tt-blue', 'tt-green', 'tt-purple', 'tt-amber', 'tt-rose'];
          html += `<td>${mergedSlots.map((s, i) => `<div class="tt-cell ${colors[i % colors.length]}"><strong>${s.course_code}</strong> <span style="font-size:0.75rem;opacity:0.85">${s.component}</span><br><small>${s.programs.join(', ')}</small></div>`).join('')}</td>`;
        } else {
          html += '<td></td>';
        }
      });
      html += '</tr>';
    });
    html += `</tbody></table></div></div>`;
  });
  result.innerHTML = html;
}

// ===== LOAD SLOT REQUESTS =====
async function loadSlotRequests() {
  try {
    const r = await fetch(getApiBase() + '/webhook/advisor/slot-requests', { method: 'GET' });
    const data = await r.json();
    const requests = data.slot_requests || [];
    const count = requests.filter(r => r.status === 'pending').length;
    document.getElementById('slotRequestCount').textContent = count;

    if (requests.length === 0) {
      document.getElementById('slotRequestsEmpty').style.display = 'block';
      document.getElementById('slotRequestsTable').style.display = 'none';
      return;
    }

    document.getElementById('slotRequestsEmpty').style.display = 'none';
    document.getElementById('slotRequestsTable').style.display = 'block';

    const tbody = document.getElementById('slotRequestsBody');
    tbody.innerHTML = '';
    requests.forEach(req => {
      const statusBadge = req.status === 'pending'
        ? '<span class="badge badge-warning"><i class="fas fa-clock"></i> Pending</span>'
        : req.status === 'approved'
          ? '<span class="badge badge-success"><i class="fas fa-check"></i> Approved</span>'
          : '<span class="badge badge-danger"><i class="fas fa-xmark"></i> Denied</span>';
      const timeAgo = formatTimeAgo(new Date(req.created_at));
      tbody.innerHTML += `<tr>
    <td><strong>${escapeHtml(req.student_name || req.student_id)}</strong><br><span style="font-size:.75rem;color:var(--text-secondary)">${req.student_id}</span></td>
    <td><strong>${req.course_code}</strong><br><span style="font-size:.75rem;color:var(--text-secondary)">${escapeHtml(req.course_name || '')}</span></td>
    <td>${statusBadge}</td>
    <td style="font-size:.82rem;color:var(--text-secondary)">${timeAgo}</td>
  </tr>`;
    });
  } catch (e) {
    console.warn('Slot requests load failed:', e.message);
  }
}
