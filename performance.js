window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return; }
  
  const user = session.user;
  const { data: me } = await supabaseClient.from('employees').select('id, name, role').eq('email', user.email).single();
  const isManager = ["Admin", "Manager"].includes(me.role);

  // --- 1. DEFINE FUNCTIONS FIRST (Fixes 'switchTab not defined' error) ---

  window.switchTab = (tab) => {
    if (tab === 'manager') {
      document.getElementById('manager-view').style.display = 'grid';
      document.getElementById('employee-view').style.display = 'none';
      
      // Update Tab Buttons Styling
      const btns = document.querySelectorAll('.tab-btn');
      if(btns.length > 0) {
        btns[0].classList.add('active');
        btns[1].classList.remove('active');
      }
    } else {
      document.getElementById('manager-view').style.display = 'none';
      document.getElementById('employee-view').style.display = 'block';
      
      // Update Tab Buttons Styling
      const btns = document.querySelectorAll('.tab-btn');
      if(btns.length > 0) {
        btns[0].classList.remove('active');
        btns[1].classList.add('active');
      }
      loadMyAchievements(); 
    }
  };

  async function loadMyAchievements() {
    const { data: list, error } = await supabaseClient.from('achievements').select('*').eq('employee_id', me.id).order('created_at', {ascending: false});
    if (error) { console.error(error); return; }

    const container = document.getElementById('my-achievements-list');
    
    if(!list || list.length === 0) { container.innerHTML = "<p>No submissions yet.</p>"; return; }

    let html = '';
    list.forEach(item => {
      html += `<div class="self-card">
        <strong>${item.period}</strong><br>
        ${item.achievement_text}
        <div style="font-size:0.8em; color:#555; margin-top:5px;">Submitted on ${new Date(item.created_at).toLocaleDateString()}</div>
      </div>`;
    });
    container.innerHTML = html;
  }

  async function loadEmployeeList() {
    const { data: employees } = await supabaseClient.from('employees').select('id, name, role').order('name');
    const container = document.getElementById('emp-list');
    
    let html = '';
    employees.forEach(e => {
      const isMe = e.id === me.id ? ' (You)' : '';
      html += `<div class="emp-item" onclick="selectEmployee('${e.id}', '${e.name}')">
        <strong>${e.name}${isMe}</strong><br>
        <span style="font-size:0.8em; color:#666;">${e.role}</span>
      </div>`;
    });
    container.innerHTML = html;
  }

  window.selectEmployee = async (id, name) => {
    document.getElementById('empty-state').style.display = 'none';
    document.getElementById('review-area').style.display = 'block';
    document.getElementById('selected-emp-name').textContent = "Reviewing: " + name;
    document.getElementById('target-id').value = id;

    // SELF REVIEW CHECK
    if (id === me.id) {
      document.getElementById('rating-box').style.display = 'none';
      document.getElementById('self-review-warning').style.display = 'block';
    } else {
      document.getElementById('rating-box').style.display = 'block';
      document.getElementById('self-review-warning').style.display = 'none';
    }

    // Load Claims
    const { data: claims } = await supabaseClient.from('achievements').select('*').eq('employee_id', id).order('created_at', {ascending: false});
    const claimsContainer = document.getElementById('emp-claims-list');
    
    if (claims && claims.length > 0) {
      let html = '<h5>Self-Appraisals:</h5>';
      claims.forEach(c => {
        html += `<div class="self-card" style="background:#f9f9f9; border-left:4px solid #6c757d;">
          <span style="font-weight:bold; color:#333;">${c.period}:</span> ${c.achievement_text}
        </div>`;
      });
      claimsContainer.innerHTML = html;
    } else {
      claimsContainer.innerHTML = '<p style="color:#777; font-style:italic;">No self-appraisals submitted.</p>';
    }

    loadReviews(id);
  };

  async function loadReviews(empId) {
    const { data: reviews, error } = await supabaseClient.from('performance_reviews')
      .select('*, employees!reviewer_id(name)')
      .eq('employee_id', empId)
      .order('created_at', { ascending: false });

    if(error) console.error("Review Load Error:", error);

    const container = document.getElementById('reviews-history');
    if(!reviews || reviews.length === 0) { container.innerHTML = "<p>No official reviews yet.</p>"; return; }

    let html = '';
    reviews.forEach(r => {
      const stars = '⭐'.repeat(r.rating);
      html += `<div class="review-card">
        <div style="display:flex; justify-content:space-between;">
          <span class="star-rating">${stars}</span>
          <span style="font-size:0.9em; font-weight:bold;">${r.review_period}</span>
        </div>
        <p style="margin:8px 0;">${r.feedback}</p>
        <div style="font-size:0.8em; color:#555;">Rated by ${r.employees?.name}</div>
      </div>`;
    });
    container.innerHTML = html;
  }

  // --- 2. INITIALIZATION LOGIC (Now safe to run) ---
  if (isManager) {
    document.getElementById('tabs-container').style.display = 'block';
    switchTab('manager'); // This works now because function is defined above
    loadEmployeeList();
  } else {
    switchTab('employee');
  }

  // --- 3. EVENT LISTENERS ---

  document.getElementById('self-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true; btn.textContent = "Submitting...";

    const { error } = await supabaseClient.from('achievements').insert({
      employee_id: me.id,
      period: document.getElementById('self-period').value,
      achievement_text: document.getElementById('self-text').value
    });

    if (error) { alert(error.message); btn.disabled = false; btn.textContent = "Submit Achievement"; }
    else { alert("Submitted successfully!"); location.reload(); }
  };

  document.getElementById('manager-form').onsubmit = async (e) => {
    e.preventDefault();
    const targetId = document.getElementById('target-id').value;
    
    if (targetId === me.id) { alert("You cannot review yourself!"); return; }

    const btn = e.target.querySelector('button');
    btn.disabled = true; btn.textContent = "Saving...";

    const { error } = await supabaseClient.from('performance_reviews').insert({
      employee_id: targetId,
      reviewer_id: me.id,
      rating: document.getElementById('mgr-rating').value,
      feedback: document.getElementById('mgr-feedback').value,
      review_period: document.getElementById('mgr-period').value
    });

    if(error) { alert(error.message); btn.disabled=false; btn.textContent="Submit Official Review"; }
    else { 
      loadReviews(targetId);
      document.getElementById('mgr-feedback').value = '';
      btn.disabled=false; btn.textContent="Submit Official Review";
    }
  };
});