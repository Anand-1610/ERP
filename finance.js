// Finance page: credit/debit entries, role-based access, and financial summaries
window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return;
  }
  const user = session.user;

  // 1. Get user role
  const { data: emp, error: empErr } = await supabaseClient
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

  // 2. Transaction Form
  let formHtml = `<form id="finance-form" style="margin-bottom: 20px; padding: 15px; background: #fff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h3 style="margin-top:0;">New Transaction</h3>
    <label>Type:</label>
    <select id="type">
      <option value="credit">Credit (+)</option>
      <option value="debit">Debit (-)</option>
    </select><br>
    <label>Amount:</label>
    <input type="number" id="amount" required><br>
    <label>Description:</label>
    <input type="text" id="description"><br>
    <button type="submit">Add Transaction</button>
  </form><div id="finance-error" class="error"></div>`;
  
  // Container for the counters
  formHtml += `<div id="finance-stats" style="display: flex; gap: 10px; margin-bottom: 20px;">
    <div style="flex: 1; background: #e3f2fd; padding: 15px; border-radius: 8px; text-align: center;">
      <strong>Yearly Net</strong><br><span id="year-net">Loading...</span>
    </div>
    <div style="flex: 1; background: #e8f5e9; padding: 15px; border-radius: 8px; text-align: center;">
      <strong>Lifetime Net</strong><br><span id="life-net">Loading...</span>
    </div>
  </div>`;
  
  document.getElementById('finance-form-container').innerHTML = formHtml;

  // Handle Form Submit
  document.getElementById('finance-form').onsubmit = async (e) => {
    e.preventDefault();
    const type = document.getElementById('type').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const description = document.getElementById('description').value;

    const { error } = await supabaseClient.from('finance_transactions').insert({
      type, amount, description
    });

    if (error) {
      document.getElementById('finance-error').textContent = error.message;
    } else {
      document.getElementById('finance-error').textContent = '';
      location.reload();
    }
  };

  // 3. Fetch ALL transactions to calculate totals
  // We fetch all columns to calculate totals, but we will only display the recent ones.
  const { data: allTxs } = await supabaseClient
    .from('finance_transactions')
    .select('type, amount, description, created_at')
    .order('created_at', { ascending: false });

  if (!allTxs) {
    document.getElementById('finance-list').innerHTML = "No transactions found.";
    return;
  }

  // 4. Calculate Totals (Month, Year, Lifetime)
  let netMonth = 0;
  let netYear = 0;
  let netLifetime = 0;
  
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-11
  const currentYear = now.getFullYear();

  for (const t of allTxs) {
    const amount = parseFloat(t.amount);
    const txDate = new Date(t.created_at);
    
    // Determine sign based on type
    const val = (t.type === 'credit') ? amount : -amount;

    // Lifetime Total
    netLifetime += val;

    // Yearly Total
    if (txDate.getFullYear() === currentYear) {
      netYear += val;
    }

    // Monthly Total (Resets naturally when month changes)
    if (txDate.getFullYear() === currentYear && txDate.getMonth() === currentMonth) {
      netMonth += val;
    }
  }

  // Update Stats UI
  document.getElementById('year-net').textContent = netYear.toFixed(2);
  document.getElementById('life-net').textContent = netLifetime.toFixed(2);
  
  // Color coding for stats
  document.getElementById('year-net').style.color = netYear >= 0 ? 'green' : 'red';
  document.getElementById('life-net').style.color = netLifetime >= 0 ? 'green' : 'red';

  // 5. Render Table (Show only top 10 for cleanliness, but sum row shows Monthly Total)
  const recentTxs = allTxs.slice(0, 10); // Display only last 10
  const monthName = now.toLocaleString('default', { month: 'long' });

  let listHtml = `<h3>Recent Transactions (${monthName})</h3>
  <table style="width: 100%; border-collapse: collapse;">
    <tr style="background: #f4f4f4; text-align: left;">
      <th style="padding: 8px;">Type</th>
      <th style="padding: 8px;">Amount</th>
      <th style="padding: 8px;">Description</th>
      <th style="padding: 8px;">Date</th>
    </tr>`;

  for (const t of recentTxs) {
    const color = t.type === 'credit' ? 'green' : 'red';
    listHtml += `<tr style="border-bottom: 1px solid #ddd;">
      <td style="padding: 8px; color: ${color}; font-weight: bold;">${t.type.toUpperCase()}</td>
      <td style="padding: 8px;">${t.amount}</td>
      <td style="padding: 8px;">${t.description || '-'}</td>
      <td style="padding: 8px;">${t.created_at.split('T')[0]}</td>
    </tr>`;
  }

  // Add the Monthly Summary Row at the end
  const monthColor = netMonth >= 0 ? 'green' : 'red';
  listHtml += `<tr style="background: #fff3e0; font-weight: bold;">
    <td style="padding: 8px;">NET (${monthName.toUpperCase()})</td>
    <td style="padding: 8px; color: ${monthColor}; font-size: 1.1em;">${netMonth.toFixed(2)}</td>
    <td colspan="2" style="padding: 8px; font-size: 0.9em; color: #666;">
      (Calculation resets next month)
    </td>
  </tr>`;

  listHtml += '</table>';
  document.getElementById('finance-list').innerHTML = listHtml;
});
