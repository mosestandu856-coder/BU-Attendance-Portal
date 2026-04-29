document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('attendance-container');
  const userEl = document.getElementById('dashboard-user');
  const logoutBtn = document.getElementById('logout-btn');

  // Check auth
  try {
    const meRes = await fetch('/api/auth/me');
    if (meRes.status === 401) {
      window.location.href = '/login.html';
      return;
    }
    const me = await meRes.json();
    if (userEl) userEl.textContent = `Welcome, ${me.username || me.reg_number}`;
  } catch (err) {
    window.location.href = '/login.html';
    return;
  }

  // Logout
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login.html';
    });
  }

  // Load attendance data
  if (!container) return;
  try {
    const records = await fetchAttendanceData();
    if (!records.length) {
      container.textContent = 'No attendance records found.';
      return;
    }

    const table = document.createElement('table');
    table.className = 'data-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Course</th>
          <th>Lecture</th>
          <th>Period</th>
          <th>Scanned At</th>
          <th>Location</th>
        </tr>
      </thead>
    `;
    const tbody = document.createElement('tbody');
    records.forEach(record => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${record.course_code || '—'}</td>
        <td>${record.lecture_title || '—'}</td>
        <td>${record.period || '—'}</td>
        <td>${record.scanned_at ? new Date(record.scanned_at).toLocaleString() : '—'}</td>
        <td>${record.location_valid ? 'In class' : 'Outside'}</td>
      `;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'data-table-wrap';
    wrap.appendChild(table);
    container.appendChild(wrap);
  } catch (err) {
    container.textContent = err.message;
  }
});
