// Employees page: fetch and display employees, restrict by role
window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return;
  }
  // Get user info
  const user = session.user;
  // Fetch user role
  let role = '';
  const { data: emp, error: empErr } = await supabase
    .from('employees')
    .select('role')
    .eq('email', user.email)
    .single();
  if (emp && emp.role) {
    role = emp.role;
  }
  // Only allow Admin, Manager, Finance to view
  if (!["Admin", "Manager", "Finance"].includes(role)) {
    document.getElementById('employee-list').textContent = 'Access denied.';
    return;
  }
  // Fetch all employees
  const { data: employees, error } = await supabase
    .from('employees')
    .select('name, email, role, created_at');
  if (error) {
    document.getElementById('employee-list').textContent = 'Error loading employees.';
    return;
  }
  let html = '<table><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th></tr>';
  for (const emp of employees) {
    html += `<tr><td>${emp.name}</td><td>${emp.email}</td><td>${emp.role}</td><td>${emp.created_at.split('T')[0]}</td></tr>`;
  }
  html += '</table>';
  document.getElementById('employee-list').innerHTML = html;
});
