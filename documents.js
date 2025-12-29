window.addEventListener('DOMContentLoaded', async () => {
  // 1. Session Check
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return; }
  
  // 2. Get User Role & ID
  const { data: emp } = await supabaseClient.from('employees').select('id, role').eq('email', session.user.email).single();
  const isAdmin = ["Admin", "Manager"].includes(emp.role);

  // 3. Show Upload Box (Admins Only)
  // Note: If you want Employees to upload their own ID proofs, remove the 'if(isAdmin)' check.
  if (isAdmin) {
      document.getElementById('upload-section').style.display = 'block';
  }

  // --- UPLOAD LOGIC ---
  const uploadBtn = document.getElementById('upload-btn');
  if(uploadBtn) uploadBtn.onclick = async () => {
    const fileInput = document.getElementById('doc-file');
    const nameInput = document.getElementById('doc-name');
    const catInput = document.getElementById('doc-category');
    const msg = document.getElementById('upload-msg');

    if (!fileInput.files.length || !nameInput.value) {
        msg.textContent = "❌ Please select a file and enter a name.";
        msg.style.color = "red";
        return;
    }

    const file = fileInput.files[0];
    const fileName = `${Date.now()}_${file.name.replace(/\s/g, '_')}`; // Unique, safe filename
    
    msg.textContent = "⏳ Uploading to Vault...";
    msg.style.color = "blue";
    uploadBtn.disabled = true;

    try {
        // A. Upload to Supabase Storage (Bucket: 'vault')
        const { error: upErr } = await supabaseClient.storage.from('vault').upload(fileName, file);
        if (upErr) throw upErr;

        // B. Get Public URL
        const { data: { publicUrl } } = supabaseClient.storage.from('vault').getPublicUrl(fileName);

        // C. Save Metadata to DB
        const { error: dbErr } = await supabaseClient.from('documents').insert({ 
            name: nameInput.value, 
            url: publicUrl,
            category: catInput.value,
            uploaded_by: emp.id 
        });

        if (dbErr) throw dbErr;

        msg.textContent = "✅ Upload Successful!";
        msg.style.color = "green";
        setTimeout(() => location.reload(), 1000);

    } catch (err) {
        console.error(err);
        msg.textContent = "❌ Error: " + err.message;
        msg.style.color = "red";
        uploadBtn.disabled = false;
    }
  };

  // --- LOAD DOCUMENTS LOGIC ---
  async function loadDocs() {
    let query = supabaseClient.from('documents').select('*, employees(name)').order('created_at', { ascending: false });

    // PERMISSION LOGIC:
    // Admins see EVERYTHING.
    // Employees see: 1. Their own uploads OR 2. Public docs (Policy/General)
    if (!isAdmin) {
        // Syntax: uploaded_by equals MY_ID --OR-- category is in (Policy, General)
        const filter = `uploaded_by.eq.${emp.id},category.in.("Policy","General")`;
        query = query.or(filter);
    }

    const { data: docs, error } = await query;
    const container = document.getElementById('doc-list');
    
    if (error) {
        container.innerHTML = `<p style="color:red">Error loading docs: ${error.message}</p>`;
        return;
    }

    if (!docs || !docs.length) { 
        container.innerHTML = "<p>No documents found in the vault.</p>"; 
        return; 
    }

    let html = '';
    docs.forEach(d => {
      const uploaderName = d.employees ? d.employees.name : 'Unknown';
      const isOwner = d.uploaded_by === emp.id;

      html += `
      <div class="doc-card">
        <div>
           <span class="tag tag-${d.category}">${d.category}</span>
           <div style="font-weight:bold; font-size:1.1em; margin-bottom:5px;">${d.name}</div>
           <div style="font-size:0.85em; color:#666; margin-bottom:15px;">
             By: ${uploaderName}<br>
             On: ${new Date(d.created_at).toLocaleDateString()}
           </div>
        </div>
        
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #eee; padding-top:10px;">
           <a href="${d.url}" target="_blank" style="text-decoration:none; color:#0d6efd; font-weight:bold; font-size:0.9em;">⬇ Download</a>
           
           ${(isAdmin || isOwner) ? `
             <button onclick="deleteDoc('${d.id}')" style="color:#dc3545; background:none; border:none; cursor:pointer; font-size:1.2em;" title="Delete">🗑️</button>
           ` : ''}
        </div>
      </div>`;
    });
    container.innerHTML = html;
  }

  // --- FILTER LOGIC ---
  window.filterDocs = (category) => {
    const cards = document.querySelectorAll('.doc-card');
    cards.forEach(card => {
        // Check if the card HTML contains the specific tag class
        if (category === 'All' || card.innerHTML.includes(`tag-${category}`)) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
  };

  // --- DELETE LOGIC ---
  window.deleteDoc = async (id) => {
    if(confirm("Are you sure you want to permanently delete this document?")) {
      const { error } = await supabaseClient.from('documents').delete().eq('id', id);
      if(error) alert(error.message); else location.reload();
    }
  };

  // Initial Load
  loadDocs();
});