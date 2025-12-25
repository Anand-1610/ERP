window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return; }
  
  const user = session.user;
  const { data: emp } = await supabaseClient.from('employees').select('id, name, role').eq('email', user.email).single();
  
  const canApprove = ["Admin", "Manager"].includes(emp.role);
  const canPay = ["Admin", "Finance"].includes(emp.role);
  const isAdmin = emp.role === 'Admin';

  // 1. UI CLEANUP: Hide Admin Section for regular users
  const adminInbox = document.getElementById('admin-inbox');
  if (canApprove || canPay) {
    adminInbox.style.display = 'block'; // Only reveal if authorized
    loadInbox();
  } else {
    adminInbox.style.display = 'none'; // Ensure it stays hidden
  }

  // 2. Load My Claims (Everyone sees this)
  loadMyClaims();

  // --- SUBMIT CLAIM ---
  document.getElementById('expense-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const msg = document.getElementById('form-msg');
    const fileInput = document.getElementById('receipt-file');
    
    btn.disabled = true; btn.textContent = "Uploading..."; msg.textContent = "";

    let publicUrl = null;
    if (fileInput.files.length > 0) {
      const file = fileInput.files[0];
      const fileName = `${Date.now()}_${emp.id}.${file.name.split('.').pop()}`;
      const { error: upErr } = await supabaseClient.storage.from('receipts').upload(fileName, file);
      if (upErr) { msg.innerHTML = `<span class="error">Upload Failed</span>`; btn.disabled=false; return; }
      publicUrl = supabaseClient.storage.from('receipts').getPublicUrl(fileName).data.publicUrl;
    }

    const { error } = await supabaseClient.from('expenses').insert({
      employee_id: emp.id, category: document.getElementById('category').value,
      amount: document.getElementById('amount').value, description: document.getElementById('desc').value,
      receipt_url: publicUrl, status: 'Pending'
    });
    if (error) { msg.innerHTML = `<span class="error">${error.message}</span>`; btn.disabled=false; } 
    else { alert("Claim Submitted!"); location.reload(); }
  };

  // --- FUNCTIONS ---
  async function loadMyClaims() {
    const { data: list } = await supabaseClient.from('expenses').select('*').eq('employee_id', emp.id).order('created_at', {ascending: false});
    document.getElementById('my-list').innerHTML = renderTable(list);
  }

  async function loadInbox() {
    let statusFilter = canPay ? ['Approved', 'Pending'] : ['Pending'];
    if (isAdmin) statusFilter = ['Pending', 'Approved', 'Reimbursed'];

    const { data: list } = await supabaseClient.from('expenses').select('*, employees(name)').in('status', statusFilter).order('created_at');
    const container = document.getElementById('inbox-list');
    
    if(!list || list.length === 0) { container.textContent = "No pending actions."; return; }

    let html = '';
    list.forEach(row => {
      let buttons = '';
      if (row.status === 'Pending' && canApprove) {
        buttons = `<button onclick="updateExp('${row.id}', 'Approved')" style="background:#28a745;">Approve</button> <button onclick="updateExp('${row.id}', 'Rejected')" style="background:#dc3545;">Reject</button>`;
      } else if (row.status === 'Approved' && canPay) {
        buttons = `<button onclick="updateExp('${row.id}', 'Reimbursed')" style="background:#17a2b8;">Mark Paid</button> <button onclick="updateExp('${row.id}', 'Rejected')" style="background:#dc3545; margin-left:5px;">❌ Cancel</button>`;
      } else if (row.status === 'Reimbursed' && isAdmin) {
        buttons = `<button onclick="updateExp('${row.id}', 'Approved')" style="background:#6610f2;">↩ Revert Payment</button>`;
      }

      const receiptLink = row.receipt_url ? `<a href="${row.receipt_url}" target="_blank" style="color:blue">View Receipt</a>` : 'No Receipt';
      html += `<div style="background:#fff; border:1px solid #ddd; padding:15px; margin-bottom:10px; display:flex; justify-content:space-between;">
        <div><strong>${row.employees?.name}</strong> - $${row.amount}<br>${row.description} | ${receiptLink}<br>Status: ${row.status}</div>
        <div>${buttons}</div>
      </div>`;
    });
    container.innerHTML = html;
  }

  function renderTable(list) {
    if(!list || list.length === 0) return "No claims found.";
    let html = `<table><tr><th>Date</th><th>Category</th><th>Amount</th><th>Status</th></tr>`;
    list.forEach(r => html += `<tr><td>${r.created_at.split('T')[0]}</td><td>${r.category}</td><td>${r.amount}</td><td><span class="status-${r.status}">${r.status}</span></td></tr>`);
    return html + '</table>';
  }

  window.updateExp = async (id, status) => {
    let confirmMsg = `Mark as ${status}?`;
    if (status === 'Approved' && confirm("Is this a REVERT? (Click OK to undo payment)")) confirmMsg = "Confirm Revert: Money will be removed from Finance.";
    if(!confirm(confirmMsg)) return;
    const { error } = await supabaseClient.from('expenses').update({ status: status }).eq('id', id);
    if(error) alert(error.message); else location.reload();
  };
});