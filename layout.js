document.addEventListener("DOMContentLoaded", () => {
    // --- 1. DEFINE HEADER HTML ---
    const headerHTML = `
    <header class="erp-header-global">
        <div class="erp-brand">
            <img src="logo.png" style="height: 35px; width: auto; margin-right: 10px;">
            <div class="erp-title">
                <strong>GLBXTNT</strong> ERP
                <span class="erp-badge">INTERNAL SYSTEM</span>
            </div>
        </div>
        <div class="erp-controls">
            <span class="erp-time" id="erp-clock">--:--</span>
            <span class="erp-divider" style="margin: 0 10px; opacity: 0.5;">|</span>
            <button onclick="handleLogout()" style="background: none; border: none; color: white; cursor: pointer; font-size: 0.9em; text-decoration: underline;">Logout</button>
        </div>
    </header>
    `;

    // --- 2. DEFINE FOOTER HTML ---
    const footerHTML = `
    <footer class="erp-footer-global">
        <div class="footer-content">
            <div class="footer-left">
                <strong>&copy; 2024 GLBXTNT Corp.</strong> All rights reserved.
                <div class="legal-text">
                    ⚠️ Confidential & Proprietary. Unauthorized access is a violation of company policy.
                    System usage is monitored.
                </div>
            </div>
            <div class="footer-right">
                <div>Need Help? <a href="mailto:communications@glbxtnt.com">communications@glbxtnt.com</a></div>
                <div class="sys-version">System Version: v0.14.20 (Beta)</div>
            </div>
        </div>
    </footer>
    `;


    // --- 3. INJECT INTO PAGE ---
    document.body.insertAdjacentHTML('afterbegin', headerHTML);
    document.body.insertAdjacentHTML('beforeend', footerHTML);

    // --- 4. CLOCK FUNCTIONALITY ---
    setInterval(() => {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const dateString = now.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
        const clock = document.getElementById('erp-clock');
        if(clock) clock.innerText = `${dateString} | ${timeString}`;
    }, 1000);

    // --- BUG REPORT WIDGET (Inside layout.js) ---
    const bugBtnHTML = `
    <div id="bug-widget" style="position:fixed; bottom:20px; right:20px; z-index:9999;">
      <button id="bug-btn" style="width:50px; height:50px; border-radius:50%; background:#dc3545; color:white; border:none; box-shadow:0 4px 10px rgba(0,0,0,0.3); cursor:pointer; font-size:1.5em;" title="Report a Bug">🐞</button>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', bugBtnHTML);

    document.getElementById('bug-btn').onclick = async () => {
        const issue = prompt("Describe the bug or issue:");
        if(!issue) return;

        // Get current user if logged in (from Supabase session)
        let email = 'Anonymous';
        // Check if supabaseClient is defined before using it
        if (typeof supabaseClient !== 'undefined') {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if(session) email = session.user.email;
        }

        const { error } = await supabaseClient.from('bug_reports').insert({
            user_email: email,
            page_url: window.location.href,
            issue_text: issue
        });

        if(error) alert("Error sending report: " + error.message);
        else alert("Thanks! Our IT team has been notified.");
    };
});

// Global Logout Helper
async function handleLogout() {
    if(confirm("Secure Logout: Are you sure?")) {
        if(typeof supabaseClient !== 'undefined') {
            await supabaseClient.auth.signOut();
        }
        window.location.href = 'index.html';
    }
}