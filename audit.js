// Audit logs page: restrict to Admin/Finance, show logs
window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return;
  }
  const user = session.user;
  // Get user role
  const { data: emp, error: empErr } = await supabase
    .from('employees')
    .select('role')
    .eq('email', user.email)
    .single();
  if (!emp) {
    document.getElementById('audit-list').textContent = 'Employee record not found.';
    return;
  }
  const role = emp.role;
  if (!["Admin", "Finance"].includes(role)) {
    document.getElementById('audit-list').textContent = 'Access denied.';
    return;
  }
  // Fetch audit logs
  const { data: logs } = await supabase
    .from('audit_logs')
    .select('user_email, action, details, created_at')
    .order('created_at', { ascending: false })
    .limit(20);
  let html = '<table><tr><th>User</th><th>Action</th><th>Details</th><th>Date</th></tr>';
  for (const log of logs) {
    html += `<tr><td>${log.user_email}</td><td>${log.action}</td><td><pre>${JSON.stringify(log.details, null, 2)}</pre></td><td>${log.created_at.split('T')[0]}</td></tr>`;
  }
  html += '</table>';
  document.getElementById('audit-list').innerHTML = html;
});
