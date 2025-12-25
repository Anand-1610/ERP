// Attendance page: IN/OUT, Duration, CSV Export, and Leave Lock
window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return; }
  
  const user = session.user;
  
  // 1. Get Employee Details
  const { data: emp } = await supabaseClient
    .from('employees')
    .select('id, name, role')
    .eq('email', user.email)
    .maybeSingle();
    
  if (!emp) { 
    document.getElementById('attendance-actions').innerHTML = '<div class="error">Employee record not found.</div>'; 
    return; 
  }
  
  const employeeId = emp.id;
  const today = new Date().toISOString().split('T')[0];
  
  // 2. CHECK FOR LEAVE (New Logic)
  // We check if there is an approved leave for today
  const { data: activeLeave } = await supabaseClient
    .from('leaves')
    .select('leave_type')
    .eq('employee_id', employeeId)
    .eq('status', 'Approved')
    .lte('start_date', today)
    .gte('end_date', today)
    .maybeSingle();

  // 3. Attendance Logic (IN/OUT)
  const { data: att } = await supabaseClient
    .from('attendance')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('date', today)
    .maybeSingle();
  
  // Helper for Duration
  const getDuration = (start, end) => {
    if (!start || !end) return '-';
    const diff = (new Date(end) - new Date(start)) / 60000; 
    const h = Math.floor(diff / 60);
    const m = Math.floor(diff % 60);
    return `${h}h ${m}m`;
  };

  let html = '';

  // --- LOGIC TREE ---
  if (activeLeave && activeLeave.leave_type !== 'Work From Home') {
    // A. ON RESTRICTIVE LEAVE (Sick, Casual, etc.)
    html = `<div style="background:#fff3cd; border:1px solid #ffeeba; padding:15px; border-radius:5px; color:#856404; text-align:center;">
      <h3>🌴 You are on Leave</h3>
      <p>Type: <strong>${activeLeave.leave_type}</strong></p>
      <p>Attendance is disabled for today.</p>
    </div>`;
  } 
  else {
    // B. NORMAL or WFH (Attendance Allowed)
    
    // Add WFH Badge if applicable
    if (activeLeave && activeLeave.leave_type === 'Work From Home') {
      html += `<div style="background:#cce5ff; color:#004085; padding:5px; margin-bottom:10px; border-radius:4px; text-align:center; font-weight:bold;">
        🏠 Work From Home Mode Active
      </div>`;
    }

    if (!att) {
      html += '<button id="in-btn">IN</button><div id="action-error" class="error"></div>';
    } else if (!att.out_time) {
      html += `<div>IN: ${new Date(att.in_time).toLocaleTimeString()}</div><button id="out-btn">OUT</button><div id="action-error" class="error"></div>`;
    } else {
      html += `<div>IN: ${new Date(att.in_time).toLocaleTimeString()}</div>
              <div>OUT: ${new Date(att.out_time).toLocaleTimeString()}</div>
              <div style="color:green; font-weight:bold;">Total: ${getDuration(att.in_time, att.out_time)}</div>
              <div>Done for today.</div>`;
    }
  }
  
  // Add Export Buttons
  html += `<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
    <h3>Export Data</h3>
    <button id="export-my-btn" style="background:#6c757d; margin-bottom:5px;">Download My Attendance (CSV)</button>
    ${["Admin", "Manager"].includes(emp.role) ? 
      `<button id="export-all-btn" style="background:#28a745;">Download All Staff Attendance (CSV)</button>` : ''}
  </div>`;

  document.getElementById('attendance-actions').innerHTML = html;

  // 4. Button Event Listeners (Only attach if buttons exist)
  const inBtn = document.getElementById('in-btn');
  if (inBtn) inBtn.onclick = async () => {
    const { error } = await supabaseClient.from('attendance').insert({ employee_id: employeeId, in_time: new Date().toISOString(), date: today });
    if (error) document.getElementById('action-error').textContent = error.message;
    else location.reload();
  };

  const outBtn = document.getElementById('out-btn');
  if (outBtn) outBtn.onclick = async () => {
    const { error } = await supabaseClient.from('attendance').update({ out_time: new Date().toISOString() }).eq('id', att.id);
    if (error) document.getElementById('action-error').textContent = error.message;
    else location.reload();
  };

  // 5. Export Logic (Same as before)
  document.getElementById('export-my-btn').onclick = async () => {
    const { data } = await supabaseClient.from('attendance').select('date, in_time, out_time').eq('employee_id', employeeId).order('date', {ascending: false});
    downloadCSV(data, `my_attendance_${today}.csv`);
  };

  const exportAllBtn = document.getElementById('export-all-btn');
  if (exportAllBtn) {
    exportAllBtn.onclick = async () => {
      const { data } = await supabaseClient.from('attendance').select('date, in_time, out_time, employees(name, email, role)').order('date', {ascending: false});
      const flatData = data.map(row => ({
        Date: row.date,
        Name: row.employees?.name,
        Email: row.employees?.email,
        Role: row.employees?.role,
        In: row.in_time ? new Date(row.in_time).toLocaleTimeString() : '-',
        Out: row.out_time ? new Date(row.out_time).toLocaleTimeString() : '-',
        Duration: getDuration(row.in_time, row.out_time)
      }));
      downloadCSV(flatData, `all_attendance_report_${today}.csv`);
    };
  }

  // 6. Admin View Table (Today)
  if (["Admin", "Manager"].includes(emp.role)) {
    const { data: allAtt } = await supabaseClient.from('attendance').select('in_time, out_time, employees(name)').eq('date', today);
    let table = '<h3>Today\'s Live Status</h3><table><tr><th>Name</th><th>IN</th><th>OUT</th></tr>';
    if(allAtt) allAtt.forEach(r => {
      table += `<tr><td>${r.employees?.name}</td><td>${r.in_time?new Date(r.in_time).toLocaleTimeString():''}</td><td>${r.out_time?new Date(r.out_time).toLocaleTimeString():''}</td></tr>`;
    });
    table += '</table>';
    document.getElementById('today-attendance').innerHTML = table;
  }
});

function downloadCSV(data, filename) {
  if (!data || !data.length) { alert('No data found.'); return; }
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row => Object.values(row).map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([headers + "\n" + rows], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.setAttribute('href', url);
  a.setAttribute('download', filename);
  a.click();
}