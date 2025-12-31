window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return; }

  const user = session.user;
  
  // Fetch Employee Details
  const { data: emp, error } = await supabaseClient
    .from('employees')
    .select('name, role')
    .eq('email', user.email)
    .single();

  if (emp) {
    document.getElementById('welcome-msg').textContent = `Welcome, ${emp.name}`;
    const role = emp.role;

    // --- PERMISSION / VISIBILITY LOGIC ---

    // 1. Employees Button: Visible to Admin, Manager, HR
    if (["Admin", "Manager", "HR"].includes(role)) {
      const empLink = document.getElementById('employees-link');
      if(empLink) empLink.style.display = 'block';
    }

    // 2. Finance Link: Visible to Admin, Finance, Manager
    if (["Admin", "Finance", "Manager"].includes(role)) {
      const finLink = document.getElementById('finance-link');
      if(finLink) finLink.style.display = 'block';
    }

    // 3. Master Records & Audit Logs: Visible to Admin Only
    if (role === 'Admin') {
      const histLink = document.getElementById('history-link');
      if(histLink) histLink.style.display = 'block';

      const auditLink = document.getElementById('audit-link');
      if(auditLink) auditLink.style.display = 'block';
    }

    // --- NOTICE BOARD LOGIC ---
    const { data: notices } = await supabaseClient
      .from('notices')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    const noticeContainer = document.getElementById('notice-list');

    if (notices && notices.length > 0) {
      let html = '';
      notices.forEach(n => {
        const isUrgent = n.is_urgent ? '<span style="background:#dc3545; color:white; padding:2px 6px; font-size:0.7em; border-radius:4px; margin-right:5px; font-weight:bold;">URGENT</span>' : '';
        
        // Check if user has permission to delete (Admin/Manager/HR)
        const canDelete = ["Admin", "Manager", "HR"].includes(role);
        
        html += `<div style="border-bottom:1px solid #eee; padding:8px 0;">
          <div style="font-weight:bold; font-size:0.95em; color:#333;">
            ${isUrgent} ${n.title} 
            <span style="font-weight:normal; color:#888; font-size:0.8em; margin-left:5px;">- ${new Date(n.created_at).toLocaleDateString()}</span>
          </div>
          <div style="color:#555; font-size:0.9em; margin-top:2px;">${n.message}</div>
          ${canDelete ? `<button onclick="deleteNotice('${n.id}')" style="font-size:0.7em; color:red; background:none; border:none; cursor:pointer; padding:0;">[Delete]</button>` : ''}
        </div>`;
      });
      noticeContainer.innerHTML = html;
    } else {
      noticeContainer.innerHTML = '<div style="color:#777; font-style:italic; padding:5px;">No recent announcements.</div>';
    }

    // --- POST NOTICE LOGIC (Admin/Manager/HR) ---
    if (["Admin", "Manager", "HR"].includes(role)) {
      const btn = document.getElementById('post-notice-btn');
      if(btn) {
        btn.style.display = 'block';
        
        btn.onclick = async () => {
          const title = prompt("Headline:");
          if (!title) return;
          const msg = prompt("Message:");
          if (!msg) return;
          const urgent = confirm("Is this URGENT? (Click OK for Yes)");
          
          const { error } = await supabaseClient.from('notices').insert({ title: title, message: msg, is_urgent: urgent });
          if(error) alert(error.message); else location.reload();
        };
      }

      window.deleteNotice = async (id) => {
        if(confirm("Delete this notice?")) {
          await supabaseClient.from('notices').delete().eq('id', id);
          location.reload();
        }
      };
    }
  }

  // Logout
  document.getElementById('logout-btn').onclick = async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'index.html';
  };
});