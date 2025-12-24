// Dashboard logic: session check, role-based UI, logout
window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return;
  }
  // Get user info
  const user = session.user;
  // Fetch user role from employees table
  let role = '';
  const { data, error } = await supabase
    .from('employees')
    .select('role')
    .eq('email', user.email)
    .single();
  if (data && data.role) {
    role = data.role;
    document.getElementById('user-role').textContent = `Role: ${role}`;
    // Hide Audit/Finance for non-privileged roles
    if (role !== 'Admin' && role !== 'Finance') {
      document.querySelector('a[href="audit.html"]').style.display = 'none';
      document.querySelector('a[href="finance.html"]').style.display = 'none';
    }
  } else {
    document.getElementById('user-role').textContent = 'Role: Unknown';
  }

  // Logout
  document.getElementById('logout-btn').onclick = async (e) => {
    e.preventDefault();
    await supabase.auth.signOut();
    window.location.href = 'index.html';
  };
});
