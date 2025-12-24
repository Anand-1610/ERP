// attendance.js
window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return; }
  
  const user = session.user;
  
  // Get Employee ID
  const { data: emp } = await supabaseClient.from('employees').select('id, name, role').eq('email', user.email).single();
  if (!emp) { document.getElementById('attendance-actions').textContent = 'Record not found.'; return; }
  
  const employeeId = emp.id;
  const today = new Date().toISOString().split('T')[0];
  
  // Check Today's Attendance
  const { data: att } = await supabaseClient.from('attendance').select('*').eq('employee_id', employeeId).eq('date', today).single();
  
  let html = '';
  if (!att) {
    html = '<button id="in-btn">IN</button>';
  } else if (!att.out_time) {
    html = `<div>IN: ${new Date(att.in_time).toLocaleTimeString()}</div><button id="out-btn">OUT</button>`;
  } else {
    html = `<div>IN: ${new Date(att.in_time).toLocaleTimeString()}</div><div>OUT: ${new Date(att.out_time).toLocaleTimeString()}</div><div>Done for today.</div>`;
  }
  document.getElementById('attendance-actions').innerHTML = html;

  // Button Logic
  if (document.getElementById('in-btn')) {
    document.getElementById('in-btn').onclick = async () => {
      await supabaseClient.from('attendance').insert({ employee_id: employeeId, in_time: new Date().toISOString(), date: today });
      location.reload();
    };
  }
  if (document.getElementById('out-btn')) {
    document.getElementById('out-btn').onclick = async () => {
      await supabaseClient.from('attendance').update({ out_time: new Date().toISOString() }).eq('id', att.id);
      location.reload();
    };
  }
  
  // Admin View
  if (["Admin", "Manager"].includes(emp.role)) {
    const { data: allAtt } = await supabaseClient.from('attendance').select('in_time, out_time, employees(name)').eq('date', today);
    let table = '<h3>Today\'s Logs</h3><table><tr><th>Name</th><th>IN</th><th>OUT</th></tr>';
    if(allAtt) {
      for (const row of allAtt) {
        table += `<tr><td>${row.employees?.name}</td><td>${row.in_time ? new Date(row.in_time).toLocaleTimeString() : ''}</td><td>${row.out_time ? new Date(row.out_time).toLocaleTimeString() : ''}</td></tr>`;
      }
    }
    table += '</table>';
    document.getElementById('today-attendance').innerHTML = table;
  }
});