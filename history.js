// history.js - Master Records Logic (Updated with Absent Count)

window.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = 'index.html'; return; }
  
    // SECURITY: Ensure only Admin can access
    const { data: emp } = await supabaseClient.from('employees').select('role').eq('email', session.user.email).single();
    if (emp.role !== 'Admin') {
        document.body.innerHTML = "<div style='display:flex; height:100vh; justify-content:center; align-items:center;'><h2 style='color:#dc3545;'>⛔ Access Denied: Admins Only</h2></div>";
        return;
    }
  
    // HELPER: IST FORMATTER
    const toIST = (isoString, includeTime = false) => {
        if (!isoString) return '-';
        const date = new Date(isoString);
        const options = { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' };
        if (includeTime) { options.hour = '2-digit'; options.minute = '2-digit'; }
        return date.toLocaleString('en-IN', options);
    };

    // Initialize Month Picker to Current Month
    const todayObj = new Date();
    const currentMonthStr = todayObj.getFullYear() + "-" + String(todayObj.getMonth() + 1).padStart(2, '0');
    document.getElementById('month-picker').value = currentMonthStr;

    // STATE
    let currentData = [];
    let currentTab = 'summary'; 

    // --- MAIN TAB LOADER ---
    window.loadTab = async (tab) => {
        currentTab = tab;
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        event.target.classList.add('active'); 

        const monthControl = document.getElementById('month-control');
        monthControl.style.display = ['summary', 'tracker'].includes(tab) ? 'block' : 'none';

        fetchData();
    };

    // --- DATA FETCHING ---
    async function fetchData() {
        const container = document.getElementById('data-container');
        container.innerHTML = '<div style="padding:40px; text-align:center; color:#555;">🔄 Fetching records...</div>';

        const monthVal = document.getElementById('month-picker').value; // YYYY-MM
        const [year, month] = monthVal.split('-');
        
        const startDate = `${monthVal}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${monthVal}-${lastDay}`;
        
        // GET TODAY IN IST (For Real-Time Calculation)
        const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

        // -----------------------------------------------------------
        // 1. MONTHLY SUMMARY (PAYROLL VIEW)
        // -----------------------------------------------------------
        if (currentTab === 'summary') {
            const [emps, atts, leaves, hols] = await Promise.all([
                supabaseClient.from('employees').select('id, name, role').order('name'),
                supabaseClient.from('attendance').select('employee_id, date').gte('date', startDate).lte('date', endDate),
                supabaseClient.from('leaves').select('employee_id, leave_type, start_date, end_date').eq('status', 'Approved').lte('start_date', endDate).gte('end_date', startDate),
                supabaseClient.from('holidays').select('date').gte('date', startDate).lte('date', endDate)
            ]);

            const summaryData = emps.data.map(e => {
                const presentCount = atts.data.filter(a => a.employee_id === e.id).length;
                const holidayCount = hols.data.length;
                
                // Count Leave Types
                let sick=0, casual=0, earned=0, unpaid=0, wfh=0;
                
                leaves.data.filter(l => l.employee_id === e.id).forEach(l => {
                    let start = new Date(l.start_date < startDate ? startDate : l.start_date);
                    let end = new Date(l.end_date > endDate ? endDate : l.end_date);
                    let days = 0;
                    while(start <= end) { days++; start.setDate(start.getDate()+1); }

                    if(l.leave_type === 'Sick') sick += days;
                    else if(l.leave_type === 'Casual') casual += days;
                    else if(l.leave_type === 'Earned') earned += days;
                    else if(l.leave_type === 'Unpaid') unpaid += days;
                    else if(l.leave_type === 'Work From Home') wfh += days;
                });

                // --- NEW: CALCULATE ABSENT COUNT ---
                let absentCount = 0;
                for(let d=1; d<=lastDay; d++) {
                    const dayStr = `${monthVal}-${String(d).padStart(2,'0')}`;
                    
                    // Rule 1: Ignore Future Days
                    if(dayStr > todayIST) continue;

                    // Rule 2: Ignore if Holiday
                    if(hols.data.some(h => h.date === dayStr)) continue;

                    // Rule 3: Ignore if Present
                    if(atts.data.some(a => a.employee_id === e.id && a.date === dayStr)) continue;

                    // Rule 4: Ignore if on ANY Leave
                    const onLeave = leaves.data.some(l => l.employee_id === e.id && l.start_date <= dayStr && l.end_date >= dayStr);
                    if(onLeave) continue;

                    // If none of the above, they are Absent
                    absentCount++;
                }
                // -----------------------------------

                const payable = presentCount + sick + casual + earned + holidayCount + wfh;

                return {
                    'Employee': e.name, 'Role': e.role,
                    'Present': presentCount, 
                    'Absent': absentCount, // Added here
                    'WFH': wfh,
                    'Sick': sick, 'Casual': casual, 'Earned': earned, 'Unpaid': unpaid,
                    'Holidays': holidayCount, 'Total Payable': payable
                };
            });
            
            // Render with new Absent Column
            renderTable(summaryData, Object.keys(summaryData[0]), (row) => `
                <td><strong>${row.Employee}</strong></td><td><small>${row.Role}</small></td>
                <td class="st-Green">${row.Present}</td>
                <td class="st-Red" style="background:#fff5f5;">${row.Absent}</td>
                <td class="st-Blue">${row.WFH}</td>
                <td>${row.Sick}</td><td>${row.Casual}</td><td>${row.Earned}</td><td class="st-Red">${row.Unpaid}</td>
                <td>${row.Holidays}</td><td style="background:#e8f5e9; font-weight:bold; color:#155724;">${row['Total Payable']}</td>
            `);

        // -----------------------------------------------------------
        // 2. MASTER TRACKER (MUSTER ROLL)
        // -----------------------------------------------------------
        } else if (currentTab === 'tracker') {
            const [emps, atts, leaves, hols] = await Promise.all([
                supabaseClient.from('employees').select('id, name').order('name'),
                supabaseClient.from('attendance').select('employee_id, date').gte('date', startDate).lte('date', endDate),
                supabaseClient.from('leaves').select('employee_id, leave_type, start_date, end_date').eq('status', 'Approved').lte('start_date', endDate).gte('end_date', startDate),
                supabaseClient.from('holidays').select('date, name').gte('date', startDate).lte('date', endDate)
            ]);

            let headers = ['Employee'];
            const daysInMonth = [];
            for(let d=1; d<=lastDay; d++) {
                headers.push(d); 
                daysInMonth.push(`${monthVal}-${String(d).padStart(2,'0')}`);
            }

            const trackerData = emps.data.map(e => {
                let row = { 'Employee': e.name };
                
                daysInMonth.forEach((dayStr, idx) => {
                    const dayNum = idx + 1;
                    
                    const hol = hols.data.find(h => h.date === dayStr);
                    if(hol) { row[dayNum] = 'H'; return; }

                    const l = leaves.data.find(lv => lv.employee_id === e.id && lv.start_date <= dayStr && lv.end_date >= dayStr);
                    if(l) {
                        if(l.leave_type==='Sick') row[dayNum] = 'SL';
                        else if(l.leave_type==='Casual') row[dayNum] = 'CL';
                        else if(l.leave_type==='Work From Home') row[dayNum] = 'WFH';
                        else row[dayNum] = 'L';
                        return;
                    }

                    const att = atts.data.find(a => a.employee_id === e.id && a.date === dayStr);
                    if(att) { row[dayNum] = 'P'; return; }

                    if (dayStr > todayIST) { row[dayNum] = '-'; } 
                    else { row[dayNum] = 'A'; }
                });
                return row;
            });

            renderTable(trackerData, headers, (row) => {
                let html = `<td style="position:sticky; left:0; background:white; z-index:10; border-right:2px solid #ddd;"><strong>${row.Employee}</strong></td>`;
                for(let d=1; d<=lastDay; d++) {
                    const val = row[d];
                    let cls = '';
                    if(val === 'P') cls = 'cell-p';
                    else if(val === 'A') cls = 'cell-a';
                    else if(val === 'H') cls = 'cell-h';
                    else if(val === 'WFH') cls = 'cell-w';
                    else if(val === 'SL' || val === 'CL') cls = 'cell-sl';
                    else if(val === '-') cls = ''; 
                    else cls = 'cell-l';
                    html += `<td class="${cls}" style="${val === '-' ? 'color:#ccc;' : ''}">${val}</td>`;
                }
                return html;
            });

        // -----------------------------------------------------------
        // 3. OTHER TABS (Standard Lists)
        // -----------------------------------------------------------
        } else if (currentTab === 'attendance') {
            const { data } = await supabaseClient.from('attendance').select('*, employees(name)').order('date', {ascending: false}).limit(100);
            renderTable(data, ['Date', 'Employee', 'In Time', 'Out Time'], (row) => 
                `<td>${toIST(row.date)}</td><td><strong>${row.employees?.name}</strong></td><td>${toIST(row.in_time, true).split(',')[1]||'-'}</td><td>${toIST(row.out_time, true).split(',')[1]||'-'}</td>`
            );
        } else if (currentTab === 'leaves') {
            const { data } = await supabaseClient.from('leaves').select('*, employees(name)').order('created_at', {ascending: false});
            renderTable(data, ['Applied On', 'Name', 'Type', 'From', 'To', 'Status'], (row) => 
                `<td>${toIST(row.created_at)}</td><td>${row.employees?.name}</td><td>${row.leave_type}</td><td>${row.start_date}</td><td>${row.end_date}</td><td><span class="${row.status === 'Approved' ? 'st-Green' : (row.status === 'Rejected' ? 'st-Red' : 'st-Orange')}">${row.status}</span></td>`
            );
        } else if (currentTab === 'salary') {
            const { data } = await supabaseClient.from('salaries').select('*, employees(name)').order('created_at', {ascending: false});
            renderTable(data, ['Date Paid', 'Name', 'Amount', 'Type'], (row) => 
                `<td>${toIST(row.created_at)}</td><td>${row.employees?.name}</td><td class="st-Green">₹${row.amount}</td><td>${row.entry_type}</td>`
            );
        } else if (currentTab === 'finance') {
            const { data } = await supabaseClient.from('finance_transactions').select('*').order('created_at', {ascending: false});
            renderTable(data, ['Date', 'Category', 'Description', 'Amount'], (row) => 
                `<td>${toIST(row.created_at)}</td><td>${row.category}</td><td>${row.description}</td><td style="color:${row.type==='credit'?'green':'red'}; font-weight:bold;">₹${row.amount}</td>`
            );
        } else if (currentTab === 'expenses') {
             const { data } = await supabaseClient.from('expenses').select('*, employees(name)').order('created_at', {ascending: false});
             renderTable(data, ['Date', 'Name', 'Category', 'Amount', 'Status'], (row) => 
                `<td>${toIST(row.created_at)}</td><td>${row.employees?.name}</td><td>${row.category}</td><td>₹${row.amount}</td><td class="${row.status === 'Reimbursed' ? 'st-Green' : 'st-Orange'}">${row.status}</td>`
             );
        } else if (currentTab === 'audit') {
            const { data } = await supabaseClient.from('audit_logs').select('*').order('created_at', {ascending: false}).limit(50);
            renderTable(data, ['Time', 'User Email', 'Action', 'Details'], (row) => 
                `<td>${toIST(row.created_at, true)}</td><td>${row.user_email}</td><td><b>${row.action}</b></td><td><code style="font-size:0.8em;">${JSON.stringify(row.details)}</code></td>`
            );
        } else if (currentTab === 'employees') {
            const { data } = await supabaseClient.from('employees').select('name, role, email, leave_balances(sick_left, casual_left, earned_left)').order('name');
             renderTable(data, ['Name', 'Role', 'Email', 'Sick Left', 'Casual Left', 'Earned Left'], (row) => {
                const b = row.leave_balances || {sick_left:'-', casual_left:'-', earned_left:'-'};
                return `<td><b>${row.name}</b></td><td>${row.role}</td><td>${row.email}</td><td class="st-Blue">${b.sick_left}</td><td class="st-Blue">${b.casual_left}</td><td class="st-Blue">${b.earned_left}</td>`;
            });
        }
    }

    document.getElementById('month-picker').addEventListener('change', fetchData);

    function renderTable(data, headers, rowGen) {
        currentData = data;
        const container = document.getElementById('data-container');
        if(!data || !data.length) { container.innerHTML = '<div style="padding:40px; text-align:center; color:#888;">No records found.</div>'; return; }

        let html = `<table class="data-table"><thead><tr>`;
        headers.forEach(h => html += `<th>${h}</th>`);
        html += `</tr></thead><tbody id="table-body">`;
        data.forEach(row => html += `<tr>${rowGen(row)}</tr>`);
        html += `</tbody></table>`;
        container.innerHTML = html;
    }

    document.getElementById('search-input').addEventListener('keyup', (e) => {
        const term = e.target.value.toLowerCase();
        document.querySelectorAll('#table-body tr').forEach(r => r.style.display = r.innerText.toLowerCase().includes(term) ? '' : 'none');
    });

    window.exportCurrentView = () => {
        if (!currentData || !currentData.length) return alert("No data to export.");
        const headers = Object.keys(currentData[0]);
        const csv = [headers.join(',')];
        currentData.forEach(row => {
            csv.push(headers.map(h => `"${(typeof row[h]==='object' ? JSON.stringify(row[h]).replace(/"/g,"'") : row[h])}"`).join(','));
        });
        const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = window.URL.createObjectURL(blob); a.download = `report_${currentTab}.csv`; a.click();
    };

    loadTab('summary');
});