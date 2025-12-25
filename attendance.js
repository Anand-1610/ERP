// attendance.js
window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return; }
  
  const user = session.user;
  
  // Get Employee ID
  const { data: emp, error: empErr } = await supabaseClient
    .from('employees')
    .select('id, name, role')
    .eq('email', user.email)
    .maybeSingle();
    
  if (!emp) { 
    document.getElementById('attendance-actions').innerHTML = '<div class="error">Employee record not found. Contact Admin.</div>'; 
    return; 
  }
  
  const employeeId = emp.id;
  const today = new Date().toISOString().split('T')[0];
  
  // Helper function to calculate duration
  const getDuration = (startIso, endIso) => {
    if (!startIso || !endIso) return '-';
    const start = new Date(startIso);
    const end = new Date(endIso);
    const diffMs = end - start; // Difference in milliseconds
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
  };
  
  const { data: att, error: attErr } = await supabaseClient
    .from('attendance')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('date', today)
    .maybeSingle();
  
  let html = '';
  if (!att) {
    html = '<button id="in-btn">IN</button><div id="action-error" class="error"></div>';
  } else if (!att.out_time) {
    html = `<div>IN: ${new Date(att.in_time).toLocaleTimeString()}</div><button id="out-btn">OUT</button><div id="action-error" class="error"></div>`;
  } else {
    // Display Duration for the user themselves
    const duration = getDuration(att.in_time, att.out_time);
    html = `<div>IN: ${new Date(att.in_time).toLocaleTimeString()}</div>
            <div>OUT: ${new Date(att.out_time).toLocaleTimeString()}</div>
            <div style="font-weight:bold; color:green;">Total Time: ${duration}</div>
            <div>Done for today.</div>`;
  }
  document.getElementById('attendance-actions').innerHTML = html;

  // IN Button Logic
  const inBtn = document.getElementById('in-btn');
  if (inBtn) {
    inBtn.onclick = async () => {
      inBtn.disabled = true;
      inBtn.textContent = "Processing...";
      const { error } = await supabaseClient.from('attendance').insert({ 
        employee_id: employeeId, 
        in_time: new Date().toISOString(), 
        date: today 
      });
      if (error) {
        document.getElementById('action-error').textContent = error.message;
        inBtn.disabled = false;
        inBtn.textContent = "IN";
      } else {
        location.reload();
      }
    };
  }

  // OUT Button Logic
  const outBtn = document.getElementById('out-btn');
  if (outBtn) {
    outBtn.onclick = async () => {
      outBtn.disabled = true;
      outBtn.textContent = "Processing...";
      const { error } = await supabaseClient
        .from('attendance')
        .update({ out_time: new Date().toISOString() })
        .eq('id', att.id);
      if (error) {
        document.getElementById('action-error').textContent = error.message;
        outBtn.disabled = false;
        outBtn.textContent = "OUT";
      } else {
        location.reload();
      }
    };
  }
  
  // Admin View: Show everyone's logs with Duration Column
  if (["Admin", "Manager"].includes(emp.role)) {
    const { data: allAtt } = await supabaseClient
      .from('attendance')
      .select('in_time, out_time, employees(name)')
      .eq('date', today);
      
    // Added "Duration" Header
    let table = '<h3>Today\'s Logs</h3><table><tr><th>Name</th><th>IN</th><th>OUT</th><th>Duration</th></tr>';
    
    if (allAtt && allAtt.length > 0) {
      for (const row of allAtt) {
        // Calculate duration for each row
        const duration = getDuration(row.in_time, row.out_time);
        
        table += `<tr>
          <td>${row.employees?.name || 'Unknown'}</td>
          <td>${row.in_time ? new Date(row.in_time).toLocaleTimeString() : ''}</td>
          <td>${row.out_time ? new Date(row.out_time).toLocaleTimeString() : ''}</td>
          <td>${duration}</td>
        </tr>`;
      }
    } else {
      table += '<tr><td colspan="4">No records yet today.</td></tr>';
    }
    table += '</table>';
    document.getElementById('today-attendance').innerHTML = table;
  }
});