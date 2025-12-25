window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return; }

  // 1. Setup Dates
  const todayDate = new Date();
  const todayIso = todayDate.toISOString().split('T')[0];
  document.getElementById('current-date').textContent = todayDate.toDateString();

  // Calculate Next 7 Days for the Forecast
  const next7Days = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(todayDate);
    d.setDate(todayDate.getDate() + i);
    next7Days.push(d.toISOString().split('T')[0]);
  }

  // 2. Fetch Data
  // A. Employees
  const p1 = supabaseClient.from('employees').select('id, name, role').order('name');
  
  // B. Today's Attendance (For the top table)
  const p2 = supabaseClient.from('attendance').select('employee_id, in_time, out_time').eq('date', todayIso);

  // C. Leaves: Fetch ANY approved leave that overlaps with Today OR Next 7 Days
  // Logic: Leave End Date >= Today
  const p3 = supabaseClient.from('leaves')
    .select('employee_id, leave_type, start_date, end_date')
    .eq('status', 'Approved')
    .gte('end_date', todayIso); 

  const [resEmp, resAtt, resLeave] = await Promise.all([p1, p2, p3]);

  if (resEmp.error) {
    document.getElementById('status-table').innerHTML = '<div class="error">Error loading data.</div>';
    return;
  }

  const employees = resEmp.data;
  const attendance = resAtt.data || [];
  const allLeaves = resLeave.data || [];

  // ---------------------------------------------------------
  // RENDER 1: TODAY'S LIVE STATUS (Same as before)
  // ---------------------------------------------------------
  renderLiveStatus(employees, attendance, allLeaves, todayIso);

  // ---------------------------------------------------------
  // RENDER 2: 7-DAY FORECAST (The New Feature)
  // ---------------------------------------------------------
  renderForecast(employees, allLeaves, next7Days);

  // --- HELPER FUNCTIONS ---

  function renderLiveStatus(emps, atts, leaves, dateStr) {
    let cPresent=0, cWFH=0, cLeave=0, cAbsent=0;
    
    // Filter leaves to only those active TODAY
    const todayLeaves = leaves.filter(l => l.start_date <= dateStr && l.end_date >= dateStr);

    let html = `<table style="width:100%; border-collapse:collapse;">
      <tr style="background:#f8f9fa; border-bottom:2px solid #ddd;">
        <th style="padding:10px; text-align:left;">Employee</th>
        <th style="padding:10px; text-align:left;">Status</th>
        <th style="padding:10px; text-align:left;">In</th>
        <th style="padding:10px; text-align:left;">Out</th>
        <th style="padding:10px; text-align:left;">Duration</th>
      </tr>`;

    emps.forEach(emp => {
      const att = atts.find(a => a.employee_id === emp.id);
      const leave = todayLeaves.find(l => l.employee_id === emp.id);
      
      let statusHtml = '', inT = '-', outT = '-', dur = '-', bg = '#fff';

      if (att) {
        inT = new Date(att.in_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        outT = att.out_time ? new Date(att.out_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '-';
        
        // Duration Logic
        const start = new Date(att.in_time);
        const end = att.out_time ? new Date(att.out_time) : new Date();
        const diffMins = Math.floor((end - start)/60000);
        const h = Math.floor(diffMins/60), m = diffMins%60;
        dur = `${h}h ${m}m${!att.out_time ? ' (Run)' : ''}`;

        if (leave && leave.leave_type === 'Work From Home') {
          statusHtml = '<span class="badge status-WFH">WFH (Active)</span>'; cWFH++;
        } else {
          statusHtml = '<span class="badge status-Present">Present</span>'; cPresent++;
        }
      } else if (leave) {
        if(leave.leave_type==='Work From Home') {
           statusHtml = '<span class="badge status-WFH">WFH (Pending)</span>'; cWFH++;
        } else {
           statusHtml = `<span class="badge status-Leave">${leave.leave_type}</span>`; cLeave++;
        }
      } else {
        statusHtml = '<span class="badge status-Absent">Absent</span>'; cAbsent++; bg='#fff5f5';
      }

      html += `<tr style="border-bottom:1px solid #eee; background:${bg};">
        <td style="padding:10px;"><strong>${emp.name}</strong><br><small>${emp.role}</small></td>
        <td style="padding:10px;">${statusHtml}</td>
        <td style="padding:10px;">${inT}</td>
        <td style="padding:10px;">${outT}</td>
        <td style="padding:10px; ${dur.includes('Run')?'color:green;font-weight:bold':''}">${dur}</td>
      </tr>`;
    });
    html += '</table>';
    
    document.getElementById('status-table').innerHTML = html;
    document.getElementById('count-present').textContent = cPresent;
    document.getElementById('count-wfh').textContent = cWFH;
    document.getElementById('count-leave').textContent = cLeave;
    document.getElementById('count-absent').textContent = cAbsent;
  }

  function renderForecast(emps, leaves, days) {
    // Build Header Row (Dates)
    let html = `<table style="width:100%; border-collapse:collapse; font-size:0.9em;">
      <tr style="background:#343a40; color:#fff;">
        <th style="padding:10px; text-align:left;">Employee</th>`;
    
    days.forEach(d => {
      // Format: "Fri 26"
      const dateObj = new Date(d);
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = dateObj.getDate();
      html += `<th style="padding:10px; text-align:center;">${dayName} ${dayNum}</th>`;
    });
    html += '</tr>';

    // Build Rows
    emps.forEach(emp => {
      html += `<tr style="border-bottom:1px solid #eee;">
        <td style="padding:10px; background:#f8f9fa; font-weight:bold; border-right:1px solid #ddd;">${emp.name}</td>`;
      
      days.forEach(d => {
        // Check if employee has leave on this date 'd'
        const leave = leaves.find(l => l.employee_id === emp.id && l.start_date <= d && l.end_date >= d);
        
        let cellHtml = '<span style="color:#28a745;">Available</span>';
        let bg = '#fff';

        if (leave) {
          if (leave.leave_type === 'Sick') { cellHtml = 'Sick'; bg = '#ffeeba'; } // Yellow
          else if (leave.leave_type === 'Casual') { cellHtml = 'Casual'; bg = '#e2e3e5'; } // Grey
          else if (leave.leave_type === 'Work From Home') { cellHtml = 'WFH'; bg = '#cce5ff'; } // Blue
          else { cellHtml = leave.leave_type; bg = '#f8d7da'; } // Red/Other
        }

        html += `<td style="padding:10px; text-align:center; background:${bg}; border-right:1px solid #eee;">${cellHtml}</td>`;
      });

      html += '</tr>';
    });

    html += '</table>';
    document.getElementById('forecast-table').innerHTML = html;
  }
});