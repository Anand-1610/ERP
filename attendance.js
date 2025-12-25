// Attendance Logic - Fixed & Debuggable
window.addEventListener('DOMContentLoaded', async () => {
  try {
    // 1. Check Session
    if (typeof supabaseClient === 'undefined') {
      throw new Error("Supabase client not initialized. Check your internet or scripts.");
    }
    
    const { data: { session }, error: authError } = await supabaseClient.auth.getSession();
    if (authError) throw authError;
    if (!session) { window.location.href = 'index.html'; return; }
    
    const user = session.user;
    
    // 2. Get Employee Details
    const { data: emp, error: empError } = await supabaseClient
      .from('employees')
      .select('id, name, role')
      .eq('email', user.email)
      .maybeSingle();
      
    if (empError) throw new Error("DB Error (Employees): " + empError.message);
    if (!emp) { 
      document.getElementById('attendance-actions').innerHTML = '<div class="error" style="color:red; padding:10px;">Employee record not found. Contact Admin.</div>'; 
      return; 
    }
    
    const employeeId = emp.id;
    const today = new Date().toISOString().split('T')[0];
    
    // 3. CHECK FOR LEAVE (Blocker)
    const { data: activeLeave, error: leaveError } = await supabaseClient
      .from('leaves')
      .select('leave_type')
      .eq('employee_id', employeeId)
      .eq('status', 'Approved')
      .lte('start_date', today)
      .gte('end_date', today)
      .maybeSingle();

    if (leaveError && leaveError.code !== 'PGRST116') console.error("Leave Check Error:", leaveError);

    // 4. CHECK ATTENDANCE STATUS
    const { data: att, error: attError } = await supabaseClient
      .from('attendance')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', today)
      .maybeSingle();

    if (attError && attError.code !== 'PGRST116') throw new Error("DB Error (Attendance): " + attError.message);
    
    // Helper: Calculate Duration
    const getDuration = (start, end) => {
      if (!start || !end) return '-';
      const diff = (new Date(end) - new Date(start)) / 60000; // minutes
      const h = Math.floor(diff / 60);
      const m = Math.floor(diff % 60);
      return `${h}h ${m}m`;
    };

    let html = '';

    // --- RENDER PERSONAL CARD ---
    if (activeLeave && activeLeave.leave_type !== 'Work From Home') {
      // ON LEAVE
      html = `<div style="background:#fff3cd; border:1px solid #ffeeba; padding:15px; border-radius:8px; color:#856404; text-align:center;">
        <h3 style="margin:0;">🌴 You are on Leave</h3>
        <p style="margin:5px 0;">Type: <strong>${activeLeave.leave_type}</strong></p>
        <p style="font-size:0.9em;">Attendance is disabled for today.</p>
      </div>`;
    } 
    else {
      // WORKING (Normal or WFH)
      if (activeLeave && activeLeave.leave_type === 'Work From Home') {
        html += `<div class="badge status-Present" style="display:block; text-align:center; margin-bottom:15px; background:#cce5ff; color:#004085;">🏠 Work From Home Mode</div>`;
      }

      if (!att) {
        // Not Checked In
        html += `<div style="text-align:center; padding:20px 0;">
                   <div style="font-size:3rem;">👋</div>
                   <p>Good Morning! Ready to start?</p>
                 </div>
                 <button id="in-btn" class="btn" style="width:100%; height:50px; font-size:1.1rem;">CLOCK IN</button>
                 <div id="action-error" class="error" style="margin-top:10px; color:red;"></div>`;
      } else if (!att.out_time) {
        // Checked In
        html += `<div style="text-align:center; margin-bottom:20px; padding:15px; background:#f0fdf4; border-radius:8px;">
                    <div style="color:#666; font-size:0.9rem;">Started at</div>
                    <div style="font-size:2rem; font-weight:bold; color:var(--primary);">${new Date(att.in_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                 </div>
                 <button id="out-btn" class="danger" style="width:100%; height:50px; font-size:1.1rem;">CLOCK OUT</button>
                 <div id="action-error" class="error" style="margin-top:10px; color:red;"></div>`;
      } else {
        // Done
        html += `<div style="text-align:center; padding:20px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px;">
                  <div style="font-size:1.1rem; margin-bottom:5px;">✅ Day Complete</div>
                  <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:15px 0;">
                    <div><small>IN</small><br><strong>${new Date(att.in_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</strong></div>
                    <div><small>OUT</small><br><strong>${new Date(att.out_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</strong></div>
                  </div>
                  <div style="background:#dcfce7; color:#166534; padding:5px; border-radius:4px; font-weight:bold;">Total: ${getDuration(att.in_time, att.out_time)}</div>
                 </div>`;
      }
    }
    
    // Export Links
    html += `<div style="margin-top:20px; text-align:center;">
       <a href="#" id="export-my-btn" style="font-size:0.85em; text-decoration:underline; color:#555;">Download My Log (CSV)</a>
    </div>`;

    document.getElementById('attendance-actions').innerHTML = html;

    // --- ATTACH LISTENERS ---
    const inBtn = document.getElementById('in-btn');
    if (inBtn) inBtn.onclick = async () => {
      inBtn.disabled = true; inBtn.textContent = "Processing...";
      const { error } = await supabaseClient.from('attendance').insert({ employee_id: employeeId, in_time: new Date().toISOString(), date: today });
      if (error) { document.getElementById('action-error').textContent = error.message; inBtn.disabled = false; inBtn.textContent = "CLOCK IN"; } 
      else location.reload();
    };

    const outBtn = document.getElementById('out-btn');
    if (outBtn) outBtn.onclick = async () => {
      outBtn.disabled = true; outBtn.textContent = "Processing...";
      const { error } = await supabaseClient.from('attendance').update({ out_time: new Date().toISOString() }).eq('id', att.id);
      if (error) { document.getElementById('action-error').textContent = error.message; outBtn.disabled = false; outBtn.textContent = "CLOCK OUT"; } 
      else location.reload();
    };

    document.getElementById('export-my-btn').onclick = async (e) => {
      e.preventDefault();
      const { data } = await supabaseClient.from('attendance').select('date, in_time, out_time').eq('employee_id', employeeId).order('date', {ascending: false});
      downloadCSV(data, `my_attendance_${today}.csv`);
    };

    // 5. ADMIN VIEW TABLE (Right Side)
    if (["Admin", "Manager"].includes(emp.role)) {
      const { data: allAtt, error: allErr } = await supabaseClient
        .from('attendance')
        .select('in_time, out_time, employees(name)')
        .eq('date', today);

      if (allErr) {
        document.getElementById('today-attendance').innerHTML = `<p style="color:red">Error loading live status: ${allErr.message}</p>`;
      } else if (allAtt && allAtt.length > 0) {
        let table = `<table style="font-size:0.9em;">
          <tr style="background:#f9fafb;"><th>Name</th><th>IN</th><th>OUT</th><th>Total</th></tr>`;
        
        allAtt.forEach(r => {
          const duration = getDuration(r.in_time, r.out_time);
          const empName = r.employees ? r.employees.name : 'Unknown';
          
          table += `<tr>
            <td><strong>${empName}</strong></td>
            <td>${r.in_time ? new Date(r.in_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '-'}</td>
            <td>${r.out_time ? new Date(r.out_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '-'}</td>
            <td style="font-weight:bold; color:${duration === '-' ? '#999' : '#059669'}">${duration}</td>
          </tr>`;
        });
        table += '</table>';
        document.getElementById('today-attendance').innerHTML = table;
      } else {
        document.getElementById('today-attendance').innerHTML = '<p style="color:#666; font-style:italic;">No one has clocked in yet today.</p>';
      }
    }

  } catch (err) {
    console.error(err);
    document.getElementById('attendance-actions').innerHTML = 
      `<div style="color:red; background:#fee2e2; padding:15px; border-radius:8px; border:1px solid #ef4444;">
         <strong>System Error:</strong><br>${err.message}
       </div>`;
  }
});

function downloadCSV(data, filename) {
  if (!data || !data.length) { alert('No data found.'); return; }
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row => Object.values(row).map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([headers + "\n" + rows], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = window.URL.createObjectURL(blob); a.download = filename; a.click();
}