// Employees page: Hierarchy, Team View, and Role Restrictions
window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return; }
  
  const user = session.user;
  
  // 1. Get My Role & ID
  const { data: me, error: meErr } = await supabaseClient
    .from('employees')
    .select('id, role, name')
    .eq('email', user.email)
    .single();

  if (!me) {
    document.getElementById('employee-list').innerHTML = '<div class="error">Access denied. User not found.</div>';
    return;
  }

  // 2. Fetch Employees (RLS filters this automatically based on policies we set)
  // We explicitly select manager_id to build the tree
  const { data: employees, error } = await supabaseClient
    .from('employees')
    .select('id, name, email, role, created_at, manager_id')
    .order('role'); // Order so Managers usually appear first in lists

  if (error) {
    document.getElementById('employee-list').textContent = 'Error loading list.';
    return;
  }

  const container = document.getElementById('employee-list');
  
  // --- ADMIN VIEW: HIERARCHY ---
  if (me.role === 'Admin') {
    renderAdminHierarchy(employees, container);
  } 
  // --- MANAGER VIEW: MY TEAM ---
  else if (me.role === 'Manager') {
    container.innerHTML = `<h3>My Team</h3>${renderTable(employees)}`;
  }
  // --- CONSULTANT VIEW: PEERS ---
  else {
    container.innerHTML = `<h3>Consultant Directory</h3>${renderTable(employees)}`;
  }
});

// Helper: Render Standard Table
function renderTable(list) {
  if (!list || list.length === 0) return '<p>No records found.</p>';
  let html = '<table><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th></tr>';
  for (const emp of list) {
    html += `<tr>
      <td>${emp.name}</td>
      <td>${emp.email}</td>
      <td>${emp.role}</td>
      <td>${emp.created_at.split('T')[0]}</td>
    </tr>`;
  }
  html += '</table>';
  return html;
}

// Helper: Render Admin Hierarchy (Tree + Tabs)
function renderAdminHierarchy(allEmployees, container) {
  // Separate Managers and others
  const managers = allEmployees.filter(e => e.role === 'Manager' || e.role === 'Admin');
  
  let html = `
    <div style="margin-bottom: 20px;">
      <button onclick="document.getElementById('view-tree').style.display='block';document.getElementById('view-all').style.display='none'">Hierarchy View</button>
      <button onclick="document.getElementById('view-tree').style.display='none';document.getElementById('view-all').style.display='block'">Full List</button>
    </div>

    <div id="view-tree">
      <h3>Company Hierarchy</h3>
      <div class="hierarchy-container">`;

  managers.forEach(mgr => {
    // Find direct reports for this manager
    const team = allEmployees.filter(e => e.manager_id === mgr.id);
    
    html += `
      <div class="mgr-card" style="background: #fff; border: 1px solid #ddd; margin-bottom: 10px; padding: 10px; border-radius: 5px;">
        <div style="cursor: pointer; font-weight: bold; display: flex; justify-content: space-between;" 
             onclick="toggleTeam('${mgr.id}')">
          <span>📂 ${mgr.name} <span style="font-size:0.8em; color:gray;">(${mgr.role})</span></span>
          <span style="background: #e3f2fd; padding: 2px 8px; border-radius: 10px; font-size: 0.8em;">${team.length} Direct Reports</span>
        </div>
        
        <div id="team-${mgr.id}" style="display: none; margin-top: 10px; padding-left: 20px; border-left: 2px solid #eee;">
          ${team.length > 0 ? renderTable(team) : '<p style="color:#777; font-style:italic;">No direct reports assigned.</p>'}
        </div>
      </div>`;
  });

  // Orphans (No Manager)
  const orphans = allEmployees.filter(e => !e.manager_id && e.role !== 'Admin' && e.role !== 'Manager');
  if (orphans.length > 0) {
    html += `
      <div class="mgr-card" style="background: #fff3e0; border: 1px solid #ffe0b2; padding: 10px; margin-top: 20px;">
        <strong>⚠️ Unassigned Staff</strong>
        ${renderTable(orphans)}
      </div>`;
  }

  html += `</div></div>`; // End view-tree

  // VIEW 2: FULL LIST
  html += `<div id="view-all" style="display:none;"><h3>All Employees</h3>${renderTable(allEmployees)}</div>`;

  container.innerHTML = html;

  // Add Toggle Function to Global Scope so HTML onclick can find it
  window.toggleTeam = (id) => {
    const el = document.getElementById(`team-${id}`);
    if (el.style.display === 'none') {
      el.style.display = 'block';
    } else {
      el.style.display = 'none';
    }
  };
}
