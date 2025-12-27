// CONFIGURATION
const ADMIN_EMAIL = "your_email@example.com"; 

window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return; }
  
  const user = session.user;
  const { data: emp } = await supabaseClient.from('employees').select('id, name, role').eq('email', user.email).single();
  const isAdmin = ["Admin", "Manager"].includes(emp.role);

  // --- HELPER: GET IST DATE STRING (YYYY-MM-DD) ---
  // This forces the system to see dates as they are in India, ignoring local browser time
  const toIST = (dateObj) => {
    return dateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); 
  };

  // 1. FETCH BALANCES
  const { data: bal } = await supabaseClient.from('leave_balances').select('*').eq('employee_id', emp.id).maybeSingle();
  if (bal) {
    document.getElementById('bal-sick').textContent = bal.sick_left;
    document.getElementById('bal-casual').textContent = bal.casual_left;
    document.getElementById('bal-earned').textContent = bal.earned_left;
  }

  // 2. FETCH HOLIDAYS
  const { data: holidays } = await supabaseClient.from('holidays').select('*').order('date', {ascending: true});
  const holidayList = holidays || []; 
  
  // Render Holidays (Admin View)
  const holidayContainer = document.getElementById('holiday-list');
  if (holidayContainer) {
    if (holidayList.length > 0) {
      let hHtml = '<strong>Upcoming Holidays: </strong>';
      holidayList.forEach(h => {
          hHtml += `<span class="holiday-tag">${h.date} (${h.name}) ${isAdmin ? `<span style="cursor:pointer; color:red; margin-left:5px;" onclick="deleteHoliday('${h.id}')">×</span>` : ''}</span>`;
      });
      holidayContainer.innerHTML = hHtml;
    } else {
      holidayContainer.innerHTML = '<span style="color:#777;">No holidays declared.</span>';
    }
  }

  // 3. UI SETUP
  loadMyHistory(emp.id);

  if (isAdmin) {
    const adminSec = document.getElementById('admin-section');
    if(adminSec) adminSec.style.display = 'block';
    
    const allHist = document.getElementById('all-history-section');
    if(allHist) allHist.style.display = 'block';
    
    const adminHol = document.getElementById('admin-holiday-section');
    if(adminHol) adminHol.style.display = 'block';
    
    loadPendingRequests();
    loadAllHistory();
  }

  // 4. SUBMIT REQUEST (IST FIXED)
  document.getElementById('leave-form').onsubmit = async (e) => {
    e.preventDefault();
    const type = document.getElementById('leave-type').value;
    const start = document.getElementById('start-date').value;
    const end = document.getElementById('end-date').value;
    const reason = document.getElementById('reason').value;
    
    // --- IST CALCULATION LOGIC ---
    let effectiveDays = 0;
    
    // Initialize dates at NOON IST to avoid midnight boundary issues
    // "T12:00:00+05:30" forces the browser to treat this input as Indian Noon
    let current = new Date(start + "T12:00:00+05:30"); 
    const stop = new Date(end + "T12:00:00+05:30");
    let holidaysHit = [];

    while (current <= stop) {
        // Convert current step to YYYY-MM-DD string in IST
        const dateStr = toIST(current);
        
        // Check holiday list
        const isHoliday = holidayList.find(h => h.date === dateStr);
        
        if (isHoliday) {
            holidaysHit.push(`${dateStr} (${isHoliday.name})`);
        } else {
            effectiveDays++;
        }
        
        // Add 1 day
        current.setDate(current.getDate() + 1);
    }
    // -----------------------------
    
    // Balance Check
    if (bal) {
      if (type === 'Sick' && bal.sick_left < effectiveDays) { alert(`Not enough Sick Leave! (Need ${effectiveDays})`); return; }
      if (type === 'Casual' && bal.casual_left < effectiveDays) { alert(`Not enough Casual Leave! (Need ${effectiveDays})`); return; }
    }

    let confirmMsg = `Requesting ${effectiveDays} days of ${type} leave?`;
    if (holidaysHit.length > 0) confirmMsg += `\n\n(Excluded ${holidaysHit.length} holidays)`;
    
    if(!confirm(confirmMsg)) return;

    const btn = e.target.querySelector('button');
    btn.textContent = "Processing..."; btn.disabled = true;

    const { error } = await supabaseClient.from('leaves').insert({
      employee_id: emp.id, leave_type: type, start_date: start, end_date: end, reason: reason, status: 'Pending'
    });

    if (error) {
      document.getElementById('form-message').innerHTML = `<span style="color:red">${error.message}</span>`;
      btn.textContent = "Submit Request"; btn.disabled = false;
    } else {
      openEmailDraft(ADMIN_EMAIL, `New Leave Request: ${emp.name}`, `I requested ${type} from ${start} to ${end}.\nActual Days: ${effectiveDays}\nReason: ${reason}`);
      location.reload();
    }
  };

  // --- HOLIDAY ACTIONS (IST FIXED) ---
  window.addHoliday = async () => {
    const startStr = document.getElementById('holiday-start').value;
    const endStr = document.getElementById('holiday-end').value || startStr; 
    const name = document.getElementById('holiday-name').value.trim();

    if (!startStr || !name) return alert("Enter Date and Name");
    
    // Use Noon IST for loop safety
    let current = new Date(startStr + "T12:00:00+05:30");
    const stop = new Date(endStr + "T12:00:00+05:30");
    
    if (stop < current) return alert("End date before Start date");

    const btn = document.querySelector('#admin-holiday-section button');
    btn.textContent = "Processing..."; btn.disabled = true;

    const inserts = [];
    while (current <= stop) {
        inserts.push({ date: toIST(current), name: name });
        current.setDate(current.getDate() + 1);
    }

    const { error } = await supabaseClient.from('holidays').insert(inserts);
    if (error) { 
        alert("Error: " + error.message); 
        btn.textContent="Declare"; 
        btn.disabled=false; 
    } else { 
        location.reload(); 
    }
  };

  window.deleteHoliday = async (id) => {
    if(confirm("Delete this holiday?")) {
        await supabaseClient.from('holidays').delete().eq('id', id);
        location.reload();
    }
  };

  // --- DATA LOADING FUNCTIONS ---

  async function loadPendingRequests() {
    const { data: requests } = await supabaseClient.from('leaves').select('*, employees(name, role, email)').eq('status', 'Pending').order('created_at');
    const container = document.getElementById('pending-list');
    
    if (!requests || requests.length === 0) { container.innerHTML = '<p style="color:#777;">No pending requests.</p>'; return; }

    const { data: me } = await supabaseClient.from('employees').select('role').eq('email', session.user.email).single();

    let html = '';
    requests.forEach(req => {
      const days = (new Date(req.end_date) - new Date(req.start_date))/(1000*60*60*24) + 1;
      
      html += `<div style="background:#fff; border-left:4px solid #ffc107; padding:15px; margin-bottom:15px; border-radius:6px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
          <strong>${req.employees?.name}</strong>
          <span style="font-size:0.8em; background:#eee; padding:2px 8px; border-radius:10px;">${req.employees?.role}</span>
        </div>
        <div style="color:#555;">${req.leave_type} (${Math.round(days)} Days Span)</div>
        <div style="font-size:0.9em; color:#777;">${req.start_date} to ${req.end_date}</div>
        <div style="font-style:italic; color:#666; margin:5px 0;">"${req.reason}"</div>
        
        <div style="margin-top:10px;">
            <button onclick="updateStatus('${req.id}', 'Approved', '${req.employees?.email}')" style="background:#28a745; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">Approve</button>
            <button onclick="updateStatus('${req.id}', 'Rejected', '${req.employees?.email}')" style="background:#dc3545; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; margin-left:5px;">Reject</button>
        </div>
      </div>`;
    });
    container.innerHTML = html;
  }

  async function loadMyHistory(myId) {
    const { data: list } = await supabaseClient.from('leaves').select('*').eq('employee_id', myId).order('created_at', { ascending: false });
    renderTable(list, 'my-history-list', false);
  }

  async function loadAllHistory() {
    const { data: list } = await supabaseClient.from('leaves').select('*, employees(name)').order('created_at', { ascending: false }).limit(30);
    renderTable(list, 'company-history-list', true);
  }

  function renderTable(list, targetId, showName) {
    const container = document.getElementById(targetId);
    if (!list || list.length === 0) { container.innerHTML = "<p style='padding:15px;'>No history found.</p>"; return; }
    
    let html = '<table class="history-table"><thead><tr>';
    if (showName) html += '<th>Name</th>';
    html += '<th>Type</th><th>Dates</th><th>Status</th><th style="text-align:right;">Actions</th></tr></thead><tbody>';

    // FIX: Get Today in IST YYYY-MM-DD
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    list.forEach(row => {
      const isActive = row.end_date >= today;
      const canCancel = isActive && (row.status === 'Pending' || row.status === 'Approved');
      const isExpired = row.end_date < today;
      const canDelete = row.status === 'Cancelled' || row.status === 'Rejected' || (row.status === 'Approved' && isExpired);

      html += `<tr>`;
      if (showName) html += `<td><strong>${row.employees?.name || 'Me'}</strong></td>`;
      html += `<td>${row.leave_type}</td>
        <td style="font-size:0.9em; color:#555;">${row.start_date}<br>to ${row.end_date}</td>
        <td><span class="status-badge st-${row.status}">${row.status}</span></td>
        <td style="text-align:right;">
          ${canCancel ? `<button onclick="cancelLeave('${row.id}')" class="btn-action btn-cancel">Cancel</button>` : ''}
          ${canDelete ? `<button onclick="deleteLeave('${row.id}')" class="btn-action btn-delete">🗑️</button>` : ''}
        </td>
      </tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  // --- GLOBAL ACTIONS ---

  window.updateStatus = async (id, newStatus, targetEmail) => {
    if (!confirm(`Mark as ${newStatus}?`)) return;
    const { error } = await supabaseClient.from('leaves').update({ status: newStatus }).eq('id', id);
    if (error) alert(error.message); 
    else {
      if (targetEmail) openEmailDraft(targetEmail, `Leave Update: ${newStatus}`, `Your request has been ${newStatus}.`);
      location.reload();
    }
  };

  window.cancelLeave = async (id) => {
    if (!confirm("Confirm Cancel? This will restore your leave balance.")) return;
    const { error } = await supabaseClient.from('leaves').update({ status: 'Cancelled' }).eq('id', id);
    if (error) alert(error.message); else location.reload();
  };

  window.deleteLeave = async (id) => {
    if (!confirm("Permanently Delete this record from history?")) return;
    const { error } = await supabaseClient.from('leaves').delete().eq('id', id);
    if (error) alert(error.message); else location.reload();
  };

  function openEmailDraft(to, subject, body) {
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
});