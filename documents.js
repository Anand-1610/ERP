window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return; }
  
  const { data: emp } = await supabaseClient.from('employees').select('role').eq('email', session.user.email).single();
  const isAdmin = ["Admin", "Manager"].includes(emp.role);

  // Show Upload Box only for Admins
  if (isAdmin) document.getElementById('upload-section').style.display = 'block';

  loadDocs();

  // UPLOAD LOGIC
  window.uploadDoc = async () => {
    const fileInput = document.getElementById('doc-file');
    const titleInput = document.getElementById('doc-title');
    const file = fileInput.files[0];
    const title = titleInput.value;

    if (!file || !title) return alert("Please select a file and enter a title.");

    // 1. Upload to Storage
    const fileName = `${Date.now()}_${file.name.replace(/\s/g, '_')}`; // Clean filename
    const { error: upErr } = await supabaseClient.storage.from('company_docs').upload(fileName, file);
    
    if (upErr) return alert("Upload Error: " + upErr.message);

    // 2. Get Public Link
    const { data: { publicUrl } } = supabaseClient.storage.from('company_docs').getPublicUrl(fileName);

    // 3. Save to Database
    const { error: dbErr } = await supabaseClient.from('documents').insert({ title: title, file_url: publicUrl });

    if (dbErr) alert("Database Error: " + dbErr.message);
    else location.reload();
  };

  async function loadDocs() {
    const { data: docs } = await supabaseClient.from('documents').select('*').order('created_at', { ascending: false });
    const container = document.getElementById('doc-list');
    
    if(!docs || !docs.length) { container.innerHTML = "<p>No documents found.</p>"; return; }

    let html = '';
    docs.forEach(d => {
      html += `<div style="background:#fff; border:1px solid #ddd; padding:20px; text-align:center; border-radius:8px; transition:transform 0.2s; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
        <div style="font-size:2.5em; margin-bottom:10px;">📄</div>
        <div style="font-weight:bold; margin-bottom:15px; min-height:40px;">${d.title}</div>
        
        <a href="${d.file_url}" target="_blank" style="display:inline-block; padding:8px 20px; background:#007bff; color:#fff; text-decoration:none; border-radius:4px; font-size:0.9em;">Download</a>
        
        ${isAdmin ? `<div style="margin-top:15px; border-top:1px solid #eee; padding-top:10px;">
          <button onclick="deleteDoc('${d.id}')" style="color:#dc3545; background:none; border:none; cursor:pointer; font-size:0.8em;">🗑️ Delete</button>
        </div>` : ''}
      </div>`;
    });
    container.innerHTML = html;
  }

  window.deleteDoc = async (id) => {
    if(confirm("Are you sure you want to delete this document?")) {
      const { error } = await supabaseClient.from('documents').delete().eq('id', id);
      if(error) alert(error.message); else location.reload();
    }
  };
});