// Employees page: fetch and display employees, restrict by role
//
window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return;
  }
  
  const user = session.user;
  
  // 1. Check Role
  const { data: emp, error: empErr } = await supabaseClient
    .from('employees')
    .select('role')
    .eq('email', user.email)
    .single();

  let role = '';
  if (emp && emp.role) {
    role = emp.role;
  }
  
  // Only allow Admin, Manager, Finance to view
  if (!["Admin", "Manager", "Finance"].includes(role)) {
    document.getElementById('employee-list').textContent = 'Access denied.';
    return;
  }

  // 2. Fetch all employees (No sorting by role to avoid crashes)
  const { data: employees, error } = await supabaseClient
    .from('employees')
    .select('name, email, role, created_at')
    .order('created_at', { ascending: false }); // Sort by newest joined instead

  if (error) {
    document.getElementById('employee-list').textContent = 'Error loading employees.';
    return;
  }

  // 3. Render Simple Table
  let html = '<table><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th></tr>';
  for (const emp of employees) {
    html += `<tr>
      <td>${emp.name}</td>
      <td>${emp.email}</td>
      <td>${emp.role}</td>
      <td>${emp.created_at.split('T')[0]}</td>
    </tr>`;
  }
  html += '</table>';
  document.getElementById('employee-list').innerHTML = html;
});
