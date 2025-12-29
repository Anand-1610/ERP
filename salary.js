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
    
    // Attach Submit Listener with DOUBLE PAYMENT CHECK
    document.getElementById('salary-form').onsubmit = async (e) => {
      e.preventDefault();
      
      const empId = document.getElementById('employee-id').value;
      const amount = document.getElementById('amount').value;
      const type = document.getElementById('entry-type').value;
      const note = document.getElementById('note').value;

      // --- DOUBLE PAYMENT CHECK START ---
      // Check if this person already got paid this month (from the 1st of current month)
      const startOfMonth = new Date(); 
      startOfMonth.setDate(1); 
      startOfMonth.setHours(0,0,0,0);

      const { data: existing } = await supabaseClient
          .from('salaries')
          .select('id')
          .eq('employee_id', empId)
          .gte('created_at', startOfMonth.toISOString());

      if (existing && existing.length > 0) {
          if(!confirm("⚠️ WARNING: This employee already has a salary entry for this month!\n\nDo you want to pay them AGAIN (Double Pay)?")) {
              return; // Stop execution if user says No
          }
      }
      // --- DOUBLE PAYMENT CHECK END ---

      const { error } = await supabaseClient.from('salaries').insert({
        employee_id: empId,
        amount: amount,
        entry_type: type,
        note: note
      });

      if (error) document.getElementById('salary-error').textContent = error.message; 
      else location.reload();
    };
  }

  // 2. List Entries
  let query = supabaseClient.from('salaries').select('id, amount, entry_type, note, created_at, employees(name, email, id)').order('created_at', { ascending: false });
  if (!canEdit) query = query.eq('employee_id', emp.id); else query = query.limit(20);

  const { data: salaries } = await query;
  let listHtml = `<h3>${canEdit ? 'Recent Entries' : 'My Salary History'}</h3>`;
  
  if (!salaries || salaries.length === 0) {
    listHtml += '<p>No records found.</p>';
  } else {
    // Updated Headers to include PDF column
    listHtml += `<table><tr><th>Employee</th><th>Amount</th><th>Type</th><th>Date</th><th>Slip</th>${isAdmin ? '<th>Action</th>' : ''}</tr>`;
    salaries.forEach(s => {
      listHtml += `<tr>
        <td>${s.employees?.name}</td>
        <td>${s.amount}</td>
        <td>${s.entry_type}</td>
        <td>${s.created_at.split('T')[0]}</td>
        <td><button onclick="downloadPayslip('${s.id}')" style="background:#0d6efd; padding:2px 8px; font-size:0.8em;">📄 PDF</button></td>
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

  // 5. PDF PAYSLIP GENERATOR
  window.downloadPayslip = async (salaryId) => {
    // Check if library is loaded
    if (!window.jspdf) return alert("PDF Library not loaded. Please refresh.");
    
    const { jsPDF } = window.jspdf;
    
    // Fetch full details for this specific slip
    const { data: s } = await supabaseClient.from('salaries').select('*, employees(*)').eq('id', salaryId).single();
    if(!s) return alert("Error finding record");

    const doc = new jsPDF();

    // Design the Slip
    doc.setFontSize(22);
    doc.setTextColor(40, 167, 69); // Green Title
    doc.text("GLBXTNT ERP", 105, 20, null, null, "center");
    
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text("OFFICIAL PAYSLIP", 105, 30, null, null, "center");

    doc.setFontSize(12);
    doc.text(`Transaction ID: ${s.id.split('-')[0]}`, 14, 45);
    doc.text(`Date Issued: ${new Date(s.created_at).toLocaleDateString()}`, 14, 52);

    doc.autoTable({
        startY: 60,
        head: [['Description', 'Details']],
        body: [
            ['Employee Name', s.employees.name],
            ['Employee ID', s.employees.id.split('-')[0]],
            ['Payment Type', s.entry_type.toUpperCase()],
            ['Note/Period', s.note || '-'],
            ['Total Amount Paid', `INR ${s.amount}`]
        ],
        theme: 'grid',
        headStyles: { fillColor: [40, 167, 69] }, // Green Header
        styles: { fontSize: 12, cellPadding: 3 }
    });

    // Footer / Signature Placeholder
    const finalY = doc.lastAutoTable.finalY + 40;
    doc.text("Authorized Signatory", 14, finalY + 10);
    doc.text("___________________", 14, finalY);
    
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text("Generated by GLBXTNT ERP System", 105, 280, null, null, "center");

    doc.save(`Payslip_${s.employees.name}_${s.created_at.split('T')[0]}.pdf`);
  };
});

function downloadCSV(data, filename) {
  if (!data || !data.length) { alert('No data.'); return; }
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row => Object.values(row).map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([headers + "\n" + rows], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = window.URL.createObjectURL(blob); a.download = filename; a.click();
}