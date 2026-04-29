/**
 * API Client - fetch wrapper for attendance data
 */

async function fetchAttendanceData() {
  let response;
  try {
    response = await fetch('/api/attendance');
  } catch (err) {
    throw new Error(`Network error: ${err.message}`);
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch attendance data: HTTP ${response.status}`);
  }

  const data = await response.json();
  // The /api/attendance endpoint returns { records, attended, total, percentage, courseStats }
  // Return the records array for backward compatibility
  return Array.isArray(data) ? data : (data.records || []);
}

// Export for browser and Node.js
if (typeof window !== 'undefined') {
  window.fetchAttendanceData = fetchAttendanceData;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { fetchAttendanceData };
}
