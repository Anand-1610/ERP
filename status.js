window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return; }

  // --- HELPER: IST DATE GENERATOR ---
  const getIST = (offsetDays = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // Returns YYYY-MM-DD
  };

  const todayIso = getIST(0);
  document.getElementById('current-date').textContent = new Date().toDateString();

  // Calculate Next 7 Days (IST)
  const next7Days = [];
  for (let i = 1; i <= 7; i++) {
      next7Days.push(getIST(i));
  }

  // FETCH DATA
  const p1 = supabaseClient.from('employees').select('id, name, role').order('name');
  const p2 = supabaseClient.from('attendance').select('employee_id, in_time, out_time').eq('date', todayIso);
  const p3 = supabaseClient.from('leaves').select('employee_id, leave_type, start_date, end_date').eq('status', 'Approved').gte('end_date', todayIso);
  const p4 = supabaseClient.from('holidays').select('date, name').gte('date', todayIso);

  const [resEmp, resAtt, resLeave, resHol] = await Promise.all([p1, p2, p3, p4]);

  if (resEmp.error) {
    document.getElementById('status-table').innerHTML = '<div class="error">Error loading data.</div>';
    return;
  }

  const employees = resEmp.data || [];
  const attendance = resAtt.data || [];
  const leaves = resLeave.data || [];
  const holidays = resHol.data || [];

  // ---------------------------------------------------------
  // RENDER 1: TODAY'S LIVE STATUS (IST)
  // ---------------------------------------------------------
  
  // Check if TODAY is a holiday
  const isHolidayToday = holidays.find(h => h.date === todayIso);
  if(isHolidayToday) {
     document.getElementById('status-table').insertAdjacentHTML('beforebegin', 
       `<div style="background:#e2e3e5; color:#383d41; padding:10px; text-align:center; border-radius:6px; margin-bottom:15px; font-weight:bold;">
          🎉 Today is a Holiday: ${isHolidayToday.name}
        </div>`
     );
  }

  let html = `<table style="width:100%; border-collapse:collapse;">
      <tr style="background:#f8f9fa; border-bottom:2px solid #ddd;">
        <th style="padding:10px; text-align:left;">Employee</th>
        <th style="padding:10px; text-align:left;">Status</th>
        <th style="padding:10px; text-align:left;">In (IST)</th>
        <th style="padding:10px; text-align:left;">Out (IST)</th>
      </tr>`;

  let cPresent=0, cWFH=0, cLeave=0, cAbsent=0;

  employees.forEach(emp => {
      const att = attendance.find(a => a.employee_id === emp.id);
      const leave = leaves.find(l => l.employee_id === emp.id && l.start_date <= todayIso && l.end_date >= todayIso);
      
      let statusHtml = '<span class="badge status-Absent">Absent</span>';
      let inT='-', outT='-';
      let bg='#fff5f5'; // Default redish for absent

      if (att) {
          statusHtml = '<span class="badge status-Present">Present</span>'; cPresent++; bg='#fff';
          inT = new Date(att.in_time).toLocaleTimeString('en-US', {timeZone:'Asia/Kolkata', hour:'2-digit', minute:'2-digit'});
          if(att.out_time) outT = new Date(att.out_time).toLocaleTimeString('en-US', {timeZone:'Asia/Kolkata', hour:'2-digit', minute:'2-digit'});
          
          if(leave && leave.leave_type === 'Work From Home') {
             statusHtml = '<span class="badge status-WFH">WFH (Active)</span>'; cPresent--; cWFH++;
          }
      } else if (leave) {
          if(leave.leave_type === 'Work From Home') {
             statusHtml = '<span class="badge status-WFH">WFH (Pending)</span>'; cWFH++; bg='#e3f2fd';
          } else {
             statusHtml = `<span class="badge status-Leave">${leave.leave_type}</span>`; cLeave++; bg='#fff3cd';
          }
      } else if (isHolidayToday) {
          statusHtml = `<span class="badge status-Weekend">Holiday</span>`; bg='#f8f9fa';
      } else {
          cAbsent++;
      }

      html += `<tr style="border-bottom:1px solid #eee; background:${bg};">
        <td style="padding:10px;"><strong>${emp.name}</strong><br><small>${emp.role}</small></td>
        <td style="padding:10px;">${statusHtml}</td>
        <td style="padding:10px;">${inT}</td>
        <td style="padding:10px;">${outT}</td>
      </tr>`;
  });
  document.getElementById('status-table').innerHTML = html + '</table>';

  // Update Counters (Hide if holiday)
  if(!isHolidayToday) {
    document.getElementById('count-present').textContent = cPresent;
    document.getElementById('count-wfh').textContent = cWFH;
    document.getElementById('count-leave').textContent = cLeave;
    document.getElementById('count-absent').textContent = cAbsent;
  } else {
    ['count-present','count-wfh','count-leave','count-absent'].forEach(id => document.getElementById(id).textContent = '-');
  }

  // ---------------------------------------------------------
  // RENDER 2: 7-DAY FORECAST (Strict IST Matching)
  // ---------------------------------------------------------
  let fHtml = `<table style="width:100%; border-collapse:collapse; font-size:0.9em;">
    <tr style="background:#343a40; color:#fff;">
      <th style="padding:10px; text-align:left;">Employee</th>`;
  
  next7Days.forEach(d => {
      const dateObj = new Date(d); // Parsing "YYYY-MM-DD" creates UTC Midnight
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }); 
      const dayNum = d.split('-')[2];
      fHtml += `<th style="padding:10px; text-align:center;">${dayName} ${dayNum}</th>`;
  });
  fHtml += '</tr>';

  employees.forEach(emp => {
    fHtml += `<tr style="border-bottom:1px solid #eee;">
      <td style="padding:10px; background:#f8f9fa; font-weight:bold; border-right:1px solid #ddd;">${emp.name}</td>`;
    
    next7Days.forEach(d => {
        // Find holiday for this specific IST Date string
        const holiday = holidays.find(h => h.date === d);
        
        // Find leave covering this specific IST Date string
        const leave = leaves.find(l => l.employee_id === emp.id && l.start_date <= d && l.end_date >= d);
        
        let cell = '<span style="color:#28a745;">Available</span>';
        let bg = '#fff';
        
        if(holiday) { 
            cell = `<b style="color:#555;">${holiday.name}</b>`; 
            bg = '#e2e3e5'; 
        }
        else if(leave) { 
            cell = leave.leave_type; 
            if(leave.leave_type==='Sick') bg='#ffeeba';
            else if(leave.leave_type==='Casual') bg='#e2e3e5';
            else bg='#f8d7da';
        }
        
        fHtml += `<td style="padding:10px; text-align:center; background:${bg}; border-right:1px solid #eee;">${cell}</td>`;
    });
    fHtml += '</tr>';
  });
  document.getElementById('forecast-table').innerHTML = fHtml + '</table>';
});