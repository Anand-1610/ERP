// Attendance page: IN/OUT actions and today's attendance
window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return;
  }
  const user = session.user;
  // Get employee record
  const { data: emp, error: empErr } = await supabase
    .from('employees')
    .select('id, name')
    .eq('email', user.email)
    .single();
  if (!emp) {
    document.getElementById('attendance-actions').textContent = 'Employee record not found.';
    return;
  }
  const employeeId = emp.id;
  // Today's date
  const today = new Date().toISOString().split('T')[0];
  // Fetch today's attendance
  const { data: att, error: attErr } = await supabase
    .from('attendance')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('date', today)
    .single();
  let html = '';
  if (!att) {
    html += '<button id="in-btn">IN</button>';
  } else if (att && !att.out_time) {
    html += `<div>IN: ${new Date(att.in_time).toLocaleTimeString()}</div>`;
    html += '<button id="out-btn">OUT</button>';
  } else if (att && att.out_time) {
    html += `<div>IN: ${new Date(att.in_time).toLocaleTimeString()}</div>`;
    html += `<div>OUT: ${new Date(att.out_time).toLocaleTimeString()}</div>`;
    html += '<div>Attendance complete for today.</div>';
  }
  document.getElementById('attendance-actions').innerHTML = html;

  // IN button
  const inBtn = document.getElementById('in-btn');
  if (inBtn) {
    inBtn.onclick = async () => {
      await supabase.from('attendance').insert({
        employee_id: employeeId,
        in_time: new Date().toISOString(),
        date: today
      });
      location.reload();
    };
  }
  // OUT button
  const outBtn = document.getElementById('out-btn');
  if (outBtn) {
    outBtn.onclick = async () => {
      await supabase.from('attendance')
        .update({ out_time: new Date().toISOString() })
        .eq('id', att.id);
      location.reload();
    };
  }

  // Show today's attendance for all (Admin/Manager only)
  const { data: empRole } = await supabase
    .from('employees')
    .select('role')
    .eq('email', user.email)
    .single();
  if (empRole && ["Admin", "Manager"].includes(empRole.role)) {
    const { data: allAtt } = await supabase
      .from('attendance')
      .select('in_time, out_time, employees(name)')
      .eq('date', today);
    let table = '<h3>Today\'s Attendance</h3><table><tr><th>Name</th><th>IN</th><th>OUT</th></tr>';
    for (const row of allAtt) {
      table += `<tr><td>${row.employees?.name || ''}</td><td>${row.in_time ? new Date(row.in_time).toLocaleTimeString() : ''}</td><td>${row.out_time ? new Date(row.out_time).toLocaleTimeString() : ''}</td></tr>`;
    }
    table += '</table>';
    document.getElementById('today-attendance').innerHTML = table;
  }
});
