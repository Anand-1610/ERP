// dashboard.js

window.addEventListener('DOMContentLoaded', async () => {
  // CHANGE: Use 'supabaseClient'
  const { data: { session } } = await supabaseClient.auth.getSession();
  
  if (!session) {
    window.location.href = 'index.html';
    return;
  }
  
  const user = session.user;
  
  // CHANGE: Use 'supabaseClient'
  const { data, error } = await supabaseClient
    .from('employees')
    .select('role')
    .eq('email', user.email)
    .single();
    
  let role = '';
  if (data && data.role) {
    role = data.role;
    document.getElementById('user-role').textContent = `Role: ${role}`;
    
    if (role !== 'Admin' && role !== 'Finance') {
      const auditLink = document.querySelector('a[href="audit.html"]');
      const financeLink = document.querySelector('a[href="finance.html"]');
      if(auditLink) auditLink.style.display = 'none';
      if(financeLink) financeLink.style.display = 'none';
    }
  } else {
    document.getElementById('user-role').textContent = 'Role: Unknown';
  }

  document.getElementById('logout-btn').onclick = async (e) => {
    e.preventDefault();
    // CHANGE: Use 'supabaseClient'
    await supabaseClient.auth.signOut();
    window.location.href = 'index.html';
  };
});