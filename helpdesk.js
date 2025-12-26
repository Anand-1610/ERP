window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return; }
  
  const user = session.user;
  const { data: emp } = await supabaseClient.from('employees').select('id, role').eq('email', user.email).single();
  const isAdmin = ["Admin", "Manager"].includes(emp.role);

  loadTickets();

  document.getElementById('ticket-form').onsubmit = async (e) => {
    e.preventDefault();
    const { error } = await supabaseClient.from('tickets').insert({
      category: document.getElementById('cat').value,
      query: document.getElementById('query').value,
      employee_id: emp.id
    });
    if(error) alert(error.message); else location.reload();
  };

  async function loadTickets() {
    const { data: tickets } = await supabaseClient.from('tickets').select('*, employees(name, email)').order('created_at', { ascending: false });
    const container = document.getElementById('ticket-list');
    
    if (!tickets || !tickets.length) { container.innerHTML = "<p>No tickets found.</p>"; return; }

    let html = '';
    tickets.forEach(t => {
      let actionHtml = '';
      if (t.status === 'Resolved') {
        actionHtml = `<div class="reply-box"><strong>✅ Resolution:</strong> ${t.reply}</div>`;
      } else if (isAdmin) {
        if (t.category === 'Password Reset') {
          actionHtml = `<div style="background:#fff5f5; padding:10px; border:1px dashed #feb2b2; margin-top:5px;">
            <strong style="color:#c53030;">Security:</strong> User requesting reset.<br>
            <button onclick="approveReset('${t.id}', '${t.employees?.email}')" style="background:#c53030; color:white; border:none; padding:5px 10px; cursor:pointer; margin-top:5px;">Approve & Send Link</button>
          </div>`;
        } else {
          actionHtml = `<div style="margin-top:10px; display:flex; gap:5px;">
            <input type="text" id="reply-${t.id}" placeholder="Reply..." style="flex:1;">
            <button onclick="solve('${t.id}')" style="background:#28a745; color:white; border:none; padding:5px;">Reply</button>
          </div>`;
        }
      } else {
        actionHtml = `<div style="color:#777; font-style:italic;">⏳ Waiting for approval...</div>`;
      }

      html += `<div class="ticket-card">
        <strong>${t.category}</strong> • ${t.employees?.name}
        <div style="font-size:1.1em;">"${t.query}"</div>
        ${actionHtml}
      </div>`;
    });
    container.innerHTML = html;
  }

  window.solve = async (id) => {
    const reply = document.getElementById(`reply-${id}`).value;
    const { error } = await supabaseClient.from('tickets').update({ reply, status: 'Resolved' }).eq('id', id);
    if(error) alert(error.message); else location.reload();
  };

  window.approveReset = async (ticketId, userEmail) => {
    if(!confirm(`Send reset link to ${userEmail}?`)) return;
    const { error } = await supabaseClient.auth.resetPasswordForEmail(userEmail, { redirectTo: window.location.origin + '/index.html' });
    if (error) { alert(error.message); return; }
    
    await supabaseClient.from('tickets').update({ reply: 'System: Link sent.', status: 'Resolved' }).eq('id', ticketId);
    alert("✅ Reset link sent!"); location.reload();
  };
});