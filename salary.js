// Salary page: manual, bonus, refund entries, role-based access
//
window.addEventListener('DOMContentLoaded', async () => {
  // CHANGE: Used 'supabaseClient'
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return;
  }
  const user = session.user;
  
  // Get user role
  // CHANGE: Used 'supabaseClient'
  const { data: emp, error: empErr } = await supabaseClient
    .from('employees')
    .select('id, role')
    .eq('email', user.email)
    .single();
    
  if (!emp) {
    document.getElementById('salary-form-container').textContent = 'Employee record not found.';
    return;
  }
  const role = emp.role;
  
  // Only Admin/Finance can add salary entries
  if (!["Admin", "Finance"].includes(role)) {
    document.getElementById('salary-form-container').textContent = 'Access denied.';
    return;
  }
  
  // Fetch all employees for dropdown
  // CHANGE: Used 'supabaseClient'
  const { data: employees } = await supabaseClient
    .from('employees')
    .select('id, name');
    
  let formHtml = `<form id="salary-form">
    <label>Employee:</label>
    <select id="employee-id">${employees.map(e => `<option value="${e.id}">${e.name}</option>`).join('')}</select><br>
    <label>Amount:</label>
    <input type="number" id="amount" required><br>
    <label>Type:</label>
    <select id="entry-type">
      <option value="manual">Manual</option>
      <option value="bonus">Bonus</option>
      <option value="refund">Refund</option>
    </select><br>
    <label>Note:</label>
    <input type="text" id="note"><br>
    <button type="submit">Add Entry</button>
  </form><div id="salary-error" class="error"></div>`;
  document.getElementById('salary-form-container').innerHTML = formHtml;

  document.getElementById('salary-form').onsubmit = async (e) => {
    e.preventDefault();
    const employee_id = document.getElementById('employee-id').value;
    const amount = document.getElementById('amount').value;
    const entry_type = document.getElementById('entry-type').value;
    const note = document.getElementById('note').value;
    
    // CHANGE: Used 'supabaseClient'
    const { error } = await supabaseClient.from('salaries').insert({
      employee_id, amount, entry_type, note
    });
    
    if (error) {
      document.getElementById('salary-error').textContent = error.message;
    } else {
      document.getElementById('salary-error').textContent = '';
      location.reload();
    }
  };

  // List recent salary entries
  // CHANGE: Used 'supabaseClient'
  const { data: salaries } = await supabaseClient
    .from('salaries')
    .select('amount, entry_type, note, created_at, employees(name)')
    .order('created_at', { ascending: false })
    .limit(10);
    
  let listHtml = '<h3>Recent Salary Entries</h3><table><tr><th>Employee</th><th>Amount</th><th>Type</th><th>Note</th><th>Date</th></tr>';
  for (const s of salaries) {
    listHtml += `<tr><td>${s.employees?.name || ''}</td><td>${s.amount}</td><td>${s.entry_type}</td><td>${s.note || ''}</td><td>${s.created_at.split('T')[0]}</td></tr>`;
  }
  listHtml += '</table>';
  document.getElementById('salary-list').innerHTML = listHtml;
});