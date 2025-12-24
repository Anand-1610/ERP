// employees.js
window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return; }
  
  const user = session.user;
  
  // Check Role
  const { data: emp } = await supabaseClient.from('employees').select('role').eq('email', user.email).single();
  const role = emp ? emp.role : '';
  
  if (!["Admin", "Manager", "Finance"].includes(role)) {
    document.getElementById('employee-list').textContent = 'Access denied.';
    return;
  }
  
  // Fetch Employees
  const { data: employees, error } = await supabaseClient.from('employees').select('name, email, role, created_at');
  
  if (error) {
    document.getElementById('employee-list').textContent = 'Error loading employees.';
    return;
  }
  
  let html = '<table><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th></tr>';
  for (const e of employees) {
    html += `<tr><td>${e.name}</td><td>${e.email}</td><td>${e.role}</td><td>${e.created_at.split('T')[0]}</td></tr>`;
  }
  html += '</table>';
  document.getElementById('employee-list').innerHTML = html;
});