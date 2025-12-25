window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return; }
  
  const user = session.user;
  const { data: emp } = await supabaseClient.from('employees').select('id, role').eq('email', user.email).single();
  const isAdmin = ["Admin", "Manager"].includes(emp.role);

  loadTickets();

  // SUBMIT TICKET
  document.getElementById('ticket-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true; btn.textContent = "Sending...";

    const { error } = await supabaseClient.from('tickets').insert({
      category: document.getElementById('cat').value,
      query: document.getElementById('query').value,
      employee_id: emp.id
    });

    if(error) {
      alert(error.message);
      btn.disabled = false; btn.textContent = "Submit Ticket";
    } else {
      location.reload();
    }
  };

  async function loadTickets() {
    let query = supabaseClient.from('tickets').select('*, employees(name)').order('created_at', { ascending: false });
    
    // Fetch data
    const { data: tickets } = await query;
    const container = document.getElementById('ticket-list');
    
    if (!tickets || !tickets.length) { container.innerHTML = "<p>No tickets found.</p>"; return; }

    let html = '';
    tickets.forEach(t => {
      // Logic: If resolved, show answer. If open & Admin, show input box.
      let replyHtml = '';
      
      if (t.status === 'Resolved') {
        replyHtml = `<div class="reply-box"><strong>✅ Admin Reply:</strong> ${t.reply}</div>`;
      } else if (isAdmin) {
        replyHtml = `<div style="margin-top:10px; display:flex; gap:5px;">
          <input type="text" id="reply-${t.id}" placeholder="Type solution..." style="flex:1; padding:5px;">
          <button onclick="solve('${t.id}')" style="background:#28a745; padding:5px 10px; font-size:0.9em;">Reply & Close</button>
        </div>`;
      } else {
        replyHtml = `<div style="color:#777; font-style:italic; margin-top:5px;">⏳ Waiting for support team...</div>`;
      }

      html += `<div class="ticket-card">
        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
          <strong>${t.category} <span style="font-weight:normal; color:#666;">• ${t.employees?.name || 'Me'}</span></strong>
          <span class="status-${t.status}">${t.status}</span>
        </div>
        <div style="font-size:1.1em; margin-bottom:5px;">"${t.query}"</div>
        <div style="font-size:0.8em; color:#999;">${new Date(t.created_at).toLocaleString()}</div>
        ${replyHtml}
      </div>`;
    });
    container.innerHTML = html;
  }

  // Admin Action
  window.solve = async (id) => {
    const reply = document.getElementById(`reply-${id}`).value;
    if(!reply) return alert("Please write a reply.");
    
    const { error } = await supabaseClient.from('tickets').update({ reply: reply, status: 'Resolved' }).eq('id', id);
    if(error) alert(error.message); else location.reload();
  };
});