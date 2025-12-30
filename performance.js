window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return; }
  
  const user = session.user;
  
  // --- FETCH MY ROLE ---
  const { data: me, error: meError } = await supabaseClient
    .from('employees')
    .select('id, name, role')
    .eq('email', user.email)
    .single();

  if (meError) { console.error("Error fetching user role:", meError); return; }
  
  const isAdmin = me.role === 'Admin';
  // "Officials" are Admins, Managers, and HR who can do formal appraisals
  const isOfficial = ["Admin", "Manager", "HR"].includes(me.role);

  // --- 1. TAB LOGIC ---
  window.switchTab = (tab) => {
    const btns = document.querySelectorAll('.tab-btn');
    if (tab === 'manager') {
      document.getElementById('manager-view').style.display = 'grid';
      document.getElementById('employee-view').style.display = 'none';
      btns[0].classList.add('active');
      btns[1].classList.remove('active');
    } else {
      document.getElementById('manager-view').style.display = 'none';
      document.getElementById('employee-view').style.display = 'block';
      btns[0].classList.remove('active');
      btns[1].classList.add('active');
      loadMyAchievements(); 
    }
  };

  // --- 2. SELF APPRAISAL LOGIC ---
  async function loadMyAchievements() {
    const { data: list } = await supabaseClient.from('achievements').select('*').eq('employee_id', me.id).order('created_at', {ascending: false});
    const container = document.getElementById('my-achievements-list');
    
    if(!list || list.length === 0) { container.innerHTML = "<p>No submissions.</p>"; return; }

    container.innerHTML = list.map(item => `
      <div class="self-card">
        <strong>${item.period}</strong><br>${item.achievement_text}
        <div style="font-size:0.8em; color:#555; margin-top:5px;">${new Date(item.created_at).toLocaleDateString()}</div>
      </div>`).join('');
  }

  document.getElementById('self-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true; btn.textContent = "Submitting...";

    const { error } = await supabaseClient.from('achievements').insert({
      employee_id: me.id,
      period: document.getElementById('self-period').value,
      achievement_text: document.getElementById('self-text').value
    });

    if (error) { alert(error.message); }
    else { alert("Saved!"); location.reload(); }
    
    btn.disabled = false; btn.textContent = "Submit Achievement";
  };

  // --- 3. MAIN REVIEW LOGIC ---

  // [FIX 1] Updated Employee List Loader to be more robust
  async function loadEmployeeList() {
    // Select all employees to populate the sidebar list
    const { data: employees, error } = await supabaseClient
      .from('employees')
      .select('id, name, role')
      .order('name');
      
    const container = document.getElementById('emp-list');

    if (error) {
        console.error("Error loading list:", error);
        container.innerHTML = '<p style="padding:10px; color:red;">Error loading list. Check DB Permissions.</p>';
        return;
    }
    
    if (!employees || employees.length === 0) {
        container.innerHTML = '<p style="padding:10px;">No employees found.</p>';
        return;
    }

    let html = '';
    employees.forEach(e => {
      const isMe = e.id === me.id ? ' (You)' : '';
      // Highlight: Add a visual cue if it's the current user
      const bgStyle = e.id === me.id ? 'background:#e3f2fd;' : '';

      html += `<div class="emp-item" style="${bgStyle}" onclick="selectEmployee('${e.id}', '${e.name}')">
        <strong>${e.name}${isMe}</strong><br>
        <span style="font-size:0.8em; color:#666;">${e.role}</span>
      </div>`;
    });
    container.innerHTML = html;
  }

  window.selectEmployee = async (id, name) => {
    document.getElementById('empty-state').style.display = 'none';
    document.getElementById('review-area').style.display = 'block';
    document.getElementById('selected-emp-name').textContent = name;
    
    // Set Target IDs for forms
    document.getElementById('target-id-official').value = id;
    document.getElementById('target-id-anon').value = id;

    const isSelf = (id === me.id);

    // --- A. OFFICIAL REVIEW PERMISSIONS ---
    // Only Managers/Admins can SEE the official form. Can't review self officially.
    if (isOfficial && !isSelf) {
      document.getElementById('official-form-container').style.display = 'block';
    } else {
      document.getElementById('official-form-container').style.display = 'none';
    }

    // --- B. ANONYMOUS REVIEW PERMISSIONS ---
    // ANYONE can rate ANYONE, except themselves.
    if (!isSelf) {
      document.getElementById('anon-form-container').style.display = 'block';
    } else {
      document.getElementById('anon-form-container').style.display = 'none';
    }

    // Load Data
    loadAchievements(id);
    loadReviews(id);
  };

  async function loadAchievements(id) {
    const { data: claims } = await supabaseClient.from('achievements').select('*').eq('employee_id', id).order('created_at', {ascending: false});
    const div = document.getElementById('emp-claims-list');
    if (!claims || claims.length === 0) div.innerHTML = "<em>No self-appraisals submitted.</em>";
    else div.innerHTML = "<strong>Recent Self-Appraisals:</strong><br>" + claims.map(c => `• ${c.period}: ${c.achievement_text}`).join('<br>');
  }

  // [FIX 2] Updated Review Loader to handle undefined names
  async function loadReviews(targetId) {
    // Fetch ALL reviews for this person
    const { data: allReviews, error } = await supabaseClient.from('performance_reviews')
      .select('*, employees!reviewer_id(name, role)') 
      .eq('employee_id', targetId)
      .order('created_at', { ascending: false });

    if(error) console.error(error);

    const officialHistory = document.getElementById('official-history');
    const anonHistory = document.getElementById('anon-history');
    const anonStats = document.getElementById('anon-stats');
    const anonBtn = document.getElementById('view-anon-btn');

    if (!allReviews) { return; }

    // 1. Separate the reviews
    // Fallback: If 'type' is missing in DB for old rows, treat as 'official'
    const officialReviews = allReviews.filter(r => r.type === 'official' || !r.type);
    const anonReviews = allReviews.filter(r => r.type === 'anonymous');

    // 2. Render Official Reviews (Visible to Manager & Employee)
    if (officialReviews.length === 0) {
      officialHistory.innerHTML = "<p style='color:#777'>No official reviews yet.</p>";
    } else {
      officialHistory.innerHTML = officialReviews.map(r => {
        // [FIX 2 IMPLEMENTATION] Handle missing names
        const reviewerName = r.employees?.name || "Unknown Manager";
        const reviewerRole = r.employees?.role || "Approver";
        
        return `
        <div class="review-card review-official">
          <div style="display:flex; justify-content:space-between;">
            <span class="star-rating">${'⭐'.repeat(r.rating)}</span>
            <strong>${r.review_period}</strong>
          </div>
          <p>${r.feedback}</p>
          <div style="font-size:0.8em; color:#0056b3;">
            Approved by: ${reviewerName} (${reviewerRole})
          </div>
        </div>
      `}).join('');
    }

    // 3. Render Anonymous Stats
    anonStats.style.display = 'block'; // Always show stats container
    
    if (anonReviews.length > 0) {
      // Calculate Average
      const total = anonReviews.reduce((sum, r) => sum + r.rating, 0);
      const avg = (total / anonReviews.length).toFixed(1);
      
      document.getElementById('anon-avg-score').textContent = avg;
      document.getElementById('anon-count').textContent = `(${anonReviews.length} reviews)`;
      
      // Admin Button Visibility
      if (isAdmin) {
        anonBtn.style.display = 'inline-block';
        anonBtn.textContent = "View All Feedback (Admin Only)";
      } else {
        anonBtn.style.display = 'none';
      }

      // Render the hidden list for Admins
      anonHistory.innerHTML = anonReviews.map(r => `
        <div class="review-card review-anon">
          <div style="display:flex; justify-content:space-between;">
            <span class="star-rating">${'⭐'.repeat(r.rating)}</span>
            <span style="font-size:0.8em; color:#666;">${new Date(r.created_at).toLocaleDateString()}</span>
          </div>
          <p>${r.feedback}</p>
          <div style="font-size:0.8em; color:#888;">Example ID: ${r.reviewer_id} (Hidden from user)</div>
        </div>
      `).join('');

    } else {
      document.getElementById('anon-avg-score').textContent = "-";
      document.getElementById('anon-count').textContent = "(No ratings yet)";
      anonBtn.style.display = 'none';
      anonHistory.innerHTML = "";
    }
    
    // Ensure detail list is hidden initially
    anonHistory.style.display = 'none';
  }

  // Toggle function for Admin to see anonymous details
  window.toggleAnonDetails = () => {
    const hist = document.getElementById('anon-history');
    if (hist.style.display === 'none') hist.style.display = 'block';
    else hist.style.display = 'none';
  };

  // --- SUBMIT OFFICIAL FORM ---
  document.getElementById('official-form').onsubmit = async (e) => {
    e.preventDefault();
    if (!isOfficial) return alert("Unauthorized");
    
    const targetId = document.getElementById('target-id-official').value;
    
    const { error } = await supabaseClient.from('performance_reviews').insert({
      employee_id: targetId,
      reviewer_id: me.id,
      rating: document.getElementById('off-rating').value,
      feedback: document.getElementById('off-feedback').value,
      review_period: document.getElementById('off-period').value,
      type: 'official' 
    });

    if (error) alert(error.message);
    else {
      alert("Official Review Submitted");
      document.getElementById('off-feedback').value = '';
      loadReviews(targetId);
    }
  };

  // --- SUBMIT ANONYMOUS FORM ---
  document.getElementById('anon-form').onsubmit = async (e) => {
    e.preventDefault();
    const targetId = document.getElementById('target-id-anon').value;
    if (targetId === me.id) return alert("You cannot rate yourself.");

    const { error } = await supabaseClient.from('performance_reviews').insert({
      employee_id: targetId,
      reviewer_id: me.id,
      rating: document.getElementById('anon-rating').value,
      feedback: document.getElementById('anon-feedback').value,
      review_period: 'Continuous',
      type: 'anonymous' 
    });

    if (error) alert(error.message);
    else {
      alert("Anonymous Rating Submitted");
      document.getElementById('anon-feedback').value = '';
      loadReviews(targetId);
    }
  };

  // Init
  switchTab('manager');
  loadEmployeeList();
});