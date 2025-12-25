window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return; }
  
  const user = session.user;
  const { data: emp } = await supabaseClient.from('employees').select('role').eq('email', user.email).single();
  const isAdmin = emp.role === 'Admin';
  
  if (!emp || !["Admin", "Finance"].includes(emp.role)) { document.getElementById('finance-form-container').textContent = 'Access denied.'; return; }

  // 1. Form (Hidden for brevity, same as before)
  let formHtml = `<form id="finance-form" style="background:#fff; padding:15px; border-radius:8px; margin-bottom:20px;">
    <h3>New Transaction</h3>
    <select id="type"><option value="credit">Credit (+)</option><option value="debit">Debit (-)</option></select>
    <select id="category"><option value="General">General</option><option value="Rent">Rent</option><option value="Sales">Sales</option></select>
    <br><input type="number" id="amount" placeholder="Amount" required> <input type="text" id="description" placeholder="Description">
    <button type="submit">Add</button></form>
    <div style="display:flex; gap:10px;"><div id="year-net" style="flex:1; background:#e3f2fd; padding:10px; text-align:center;">-</div><div id="life-net" style="flex:1; background:#e8f5e9; padding:10px; text-align:center;">-</div></div>`;
  document.getElementById('finance-form-container').innerHTML = formHtml;

  document.getElementById('finance-form').onsubmit = async (e) => {
    e.preventDefault();
    const { error } = await supabaseClient.from('finance_transactions').insert({
      type: document.getElementById('type').value, amount: document.getElementById('amount').value,
      description: document.getElementById('description').value, category: document.getElementById('category').value
    });
    if (error) alert(error.message); else location.reload();
  };

  // 2. Data & List
  const { data: allTxs } = await supabaseClient.from('finance_transactions').select('*').order('created_at', { ascending: false });
  
  let netYear=0, netLife=0; const curYear = new Date().getFullYear();
  allTxs.forEach(t => { 
    const val = t.type==='credit'? +t.amount : -t.amount; 
    netLife+=val; if(new Date(t.created_at).getFullYear()===curYear) netYear+=val; 
  });
  document.getElementById('year-net').textContent = netYear.toFixed(2);
  document.getElementById('life-net').textContent = netLife.toFixed(2);

  let listHtml = '<h3>Transactions</h3><table><tr><th>Type</th><th>Cat</th><th>Amt</th><th>Desc</th><th>Date</th>'+(isAdmin?'<th>Action</th>':'')+'</tr>';
  allTxs.slice(0, 20).forEach(t => {
    listHtml += `<tr>
      <td style="color:${t.type==='credit'?'green':'red'}">${t.type.toUpperCase()}</td>
      <td>${t.category||'-'}</td>
      <td>${t.amount}</td>
      <td>${t.description||'-'}</td>
      <td>${t.created_at.split('T')[0]}</td>
      ${isAdmin ? `<td><button onclick="deleteTx('${t.id}')" style="background:none; border:none; cursor:pointer;">🗑️</button></td>` : ''}
    </tr>`;
  });
  listHtml += '</table><button id="exp-btn">Export CSV</button>';
  document.getElementById('finance-list').innerHTML = listHtml;

  // 3. Delete Function
  window.deleteTx = async (id) => {
    if(!confirm("Are you sure you want to delete this transaction?")) return;
    const { error } = await supabaseClient.from('finance_transactions').delete().eq('id', id);
    if(error) alert(error.message); else location.reload();
  };
});