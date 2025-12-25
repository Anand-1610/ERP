window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return; }
  
  const user = session.user;
  const { data: emp } = await supabaseClient.from('employees').select('id, role').eq('email', user.email).single();
  
  // Define Permissions
  const isAdmin = emp.role === 'Admin';
  const isFinance = emp.role === 'Finance';
  const canEdit = isAdmin || isFinance;

  // 1. UI CLEANUP: Hide the Entry Form for regular users
  const formContainer = document.getElementById('salary-form-container');
  if (!canEdit) {
    // Completely hide the container so "Loading..." or headers don't show
    formContainer.style.display = 'none'; 
  } else {
    // Render Form for Admins
    const { data: employees } = await supabaseClient.from('employees').select('id, name');
    let formHtml = `<form id="salary-form">
      <h3>Add Salary / Bonus</h3>
      <label>Employee:</label>
      <select id="employee-id">${employees.map(e => `<option value="${e.id}">${e.name}</option>`).join('')}</select><br>
      <label>Amount:</label><input type="number" id="amount" required><br>
      <label>Type:</label><select id="entry-type"><option value="manual">Salary (Manual)</option><option value="bonus">Bonus</option><option value="refund">Refund</option></select><br>
      <label>Note:</label><input type="text" id="note"><br>
      <button type="submit">Add Entry</button>
    </form><div id="salary-error" class="error"></div>`;
    formContainer.innerHTML = formHtml;
    
    // Attach Submit Listener
    document.getElementById('salary-form').onsubmit = async (e) => {
      e.preventDefault();
      const { error } = await supabaseClient.from('salaries').insert({
        employee_id: document.getElementById('employee-id').value,
        amount: document.getElementById('amount').value,
        entry_type: document.getElementById('entry-type').value,
        note: document.getElementById('note').value
      });
      if (error) document.getElementById('salary-error').textContent = error.message; else location.reload();
    };
  }

  // 2. List Entries
  let query = supabaseClient.from('salaries').select('id, amount, entry_type, note, created_at, employees(name, email)').order('created_at', { ascending: false });
  if (!canEdit) query = query.eq('employee_id', emp.id); else query = query.limit(20);

  const { data: salaries } = await query;
  let listHtml = `<h3>${canEdit ? 'Recent Entries' : 'My Salary History'}</h3>`;
  
  if (!salaries || salaries.length === 0) {
    listHtml += '<p>No records found.</p>';
  } else {
    listHtml += `<table><tr><th>Employee</th><th>Amount</th><th>Type</th><th>Date</th>${isAdmin ? '<th>Action</th>' : ''}</tr>`;
    salaries.forEach(s => {
      listHtml += `<tr>
        <td>${s.employees?.name}</td>
        <td>${s.amount}</td>
        <td>${s.entry_type}</td>
        <td>${s.created_at.split('T')[0]}</td>
        ${isAdmin ? `<td><button onclick="revertSalary('${s.id}')" style="background:#dc3545; padding:2px 8px; font-size:0.8em;">Revert</button></td>` : ''}
      </tr>`;
    });
    listHtml += '</table>';
  }
  
  // Add Export Button
  listHtml += `<div style="margin-top: 20px;"><button id="export-salary-btn" style="background:#28a745;">Export Data (CSV)</button></div>`;
  document.getElementById('salary-list').innerHTML = listHtml;

  // 3. Export Logic
  document.getElementById('export-salary-btn').onclick = async () => {
    let exportQuery = supabaseClient.from('salaries').select('amount, entry_type, note, created_at, employees(name, email)').order('created_at', { ascending: false });
    if (!canEdit) exportQuery = exportQuery.eq('employee_id', emp.id);
    const { data } = await exportQuery;
    const flatData = data.map(row => ({ Date: row.created_at.split('T')[0], Name: row.employees?.name, Type: row.entry_type, Amount: row.amount, Note: row.note||'' }));
    downloadCSV(flatData, `salary_report.csv`);
  };

  // 4. Revert Function
  window.revertSalary = async (id) => {
    if(!confirm("CONFIRM REVERT: This will delete the salary record AND remove the transaction from Finance. Continue?")) return;
    const { error } = await supabaseClient.from('salaries').delete().eq('id', id);
    if(error) alert(error.message); else location.reload();
  };
});

function downloadCSV(data, filename) {
  if (!data || !data.length) { alert('No data.'); return; }
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row => Object.values(row).map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([headers + "\n" + rows], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = window.URL.createObjectURL(blob); a.download = filename; a.click();
}