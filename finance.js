// Finance page: credit/debit entries, role-based access
window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return;
  }
  const user = session.user;
  // Get user role
  const { data: emp, error: empErr } = await supabase
    .from('employees')
    .select('role')
    .eq('email', user.email)
    .single();
  if (!emp) {
    document.getElementById('finance-form-container').textContent = 'Employee record not found.';
    return;
  }
  const role = emp.role;
  // Only Admin/Finance can add transactions
  if (!["Admin", "Finance"].includes(role)) {
    document.getElementById('finance-form-container').textContent = 'Access denied.';
    return;
  }
  // Transaction form
  let formHtml = `<form id="finance-form">
    <label>Type:</label>
    <select id="type">
      <option value="credit">Credit</option>
      <option value="debit">Debit</option>
    </select><br>
    <label>Amount:</label>
    <input type="number" id="amount" required><br>
    <label>Description:</label>
    <input type="text" id="description"><br>
    <button type="submit">Add Transaction</button>
  </form><div id="finance-error" class="error"></div>`;
  document.getElementById('finance-form-container').innerHTML = formHtml;

  document.getElementById('finance-form').onsubmit = async (e) => {
    e.preventDefault();
    const type = document.getElementById('type').value;
    const amount = document.getElementById('amount').value;
    const description = document.getElementById('description').value;
    const { error } = await supabase.from('finance_transactions').insert({
      type, amount, description
    });
    if (error) {
      document.getElementById('finance-error').textContent = error.message;
    } else {
      document.getElementById('finance-error').textContent = '';
      location.reload();
    }
  };

  // List recent transactions
  const { data: txs } = await supabase
    .from('finance_transactions')
    .select('type, amount, description, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
  let listHtml = '<h3>Recent Transactions</h3><table><tr><th>Type</th><th>Amount</th><th>Description</th><th>Date</th></tr>';
  for (const t of txs) {
    listHtml += `<tr><td>${t.type}</td><td>${t.amount}</td><td>${t.description || ''}</td><td>${t.created_at.split('T')[0]}</td></tr>`;
  }
  listHtml += '</table>';
  document.getElementById('finance-list').innerHTML = listHtml;
});
