// login.js - With Math Captcha & Redirect Fixes

// Elements
const form = document.getElementById('auth-form');
const emailInput = document.getElementById('email');
const passInput = document.getElementById('password');
const nameInput = document.getElementById('full-name');
const nameContainer = document.getElementById('name-field-container');
const submitBtn = document.getElementById('submit-btn');
const toggleBtn = document.getElementById('toggle-mode-btn');
const errorDiv = document.getElementById('auth-error');
const subText = document.getElementById('sub-text');

// Captcha Elements
const capNum1 = document.getElementById('captcha-num1');
const capNum2 = document.getElementById('captcha-num2');
const capInput = document.getElementById('captcha-input');
const refreshCapBtn = document.getElementById('refresh-captcha');

// State
let isSignup = false;
let currentCaptchaAnswer = 0;

// --- 0. CAPTCHA FUNCTIONS ---
function generateCaptcha() {
    const n1 = Math.floor(Math.random() * 10) + 1; // 1 to 10
    const n2 = Math.floor(Math.random() * 10) + 1; // 1 to 10
    currentCaptchaAnswer = n1 + n2;
    
    if(capNum1 && capNum2) {
        capNum1.textContent = n1;
        capNum2.textContent = n2;
    }
    if(capInput) capInput.value = ''; // Clear previous answer
}

// Initialize Captcha on Load
generateCaptcha();

// Allow manual refresh
if(refreshCapBtn) refreshCapBtn.onclick = generateCaptcha;


// --- 1. TOGGLE LOGIN <-> SIGNUP ---
if (toggleBtn) {
  toggleBtn.addEventListener('click', () => {
    isSignup = !isSignup;
    if (isSignup) {
      if (nameContainer) nameContainer.classList.remove('hidden'); // Show Name Field
      submitBtn.textContent = "Sign Up";
      toggleBtn.textContent = "Back to Login";
      subText.textContent = "Create Profile";
    } else {
      if (nameContainer) nameContainer.classList.add('hidden'); // Hide Name Field
      submitBtn.textContent = "Login";
      toggleBtn.textContent = "New here? Create Account";
      subText.textContent = "Secure Employee Portal";
    }
    errorDiv.textContent = "";
    generateCaptcha(); // New puzzle on toggle
  });
}

// --- 2. AUTH SUBMISSION ---
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorDiv.textContent = 'Processing...';
    errorDiv.style.color = '#666';
    submitBtn.disabled = true;

    // A. VALIDATE CAPTCHA
    const userAnswer = parseInt(capInput.value);
    if (userAnswer !== currentCaptchaAnswer) {
        errorDiv.style.color = 'red';
        errorDiv.textContent = "Incorrect Math Answer. Please try again.";
        submitBtn.disabled = false;
        generateCaptcha(); // Reset to prevent brute force
        return;
    }
    
    const email = emailInput.value.trim();
    const password = passInput.value;
    const name = nameInput ? nameInput.value.trim() : "";

    if (isSignup) {
      // --- SIGN UP LOGIC ---
      if (!name) { 
        errorDiv.style.color = 'red'; 
        errorDiv.textContent = "Please enter your Full Name."; 
        submitBtn.disabled = false;
        return; 
      }
      
      const { error } = await supabaseClient.auth.signUp({
        email: email, 
        password: password, 
        options: { 
            // FIXED: Explicit Redirect to your GitHub Pages Repo
            emailRedirectTo: 'https://anand-1610.github.io/ERP/index.html',
            data: { full_name: name } 
        }
      });

      if (error) { 
        errorDiv.style.color = 'red'; 
        errorDiv.textContent = error.message; 
        generateCaptcha(); // Reset on error
      } else { 
        errorDiv.style.color = 'green'; 
        errorDiv.innerHTML = "<b>Success!</b> Verification email sent.<br>Check your inbox."; 
        form.reset(); 
      }
      submitBtn.disabled = false;

    } else {
      // --- LOGIN LOGIC ---
      try {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        // Check Employee Profile
        const { data: emp, error: empErr } = await supabaseClient
          .from('employees')
          .select('id')
          .ilike('email', email) 
          .maybeSingle();

        if (empErr) throw empErr;

        if (!emp) {
          await supabaseClient.auth.signOut();
          throw new Error("Account verified, but Employee Profile missing. Contact Admin.");
        }
        
        window.location.href = 'main.html';

      } catch (err) {
        errorDiv.style.color = 'red';
        if (err.message.includes("Email not confirmed")) {
          errorDiv.textContent = "Please verify your email first.";
        } else if (err.message.includes("Invalid login")) {
          errorDiv.textContent = "Invalid email or password.";
        } else {
          errorDiv.textContent = err.message;
        }
        generateCaptcha(); // Reset on error
      } finally {
        submitBtn.disabled = false;
      }
    }
  });
}

// ... (Keep the Reset Password & RPC Logic from your original file below this line) ...
// 3. RESET PASSWORD REQUEST UI HANDLERS
const forgotBtn = document.getElementById('forgot-btn');
const forgotForm = document.getElementById('forgot-form');
const loginBox = document.getElementById('login-box');
const backToLogin = document.getElementById('back-to-login');
const resetForm = document.getElementById('reset-request-form');

if (forgotBtn) {
    forgotBtn.onclick = () => { 
      if (loginBox) loginBox.classList.add('hidden'); 
      if (forgotForm) forgotForm.classList.remove('hidden'); 
      errorDiv.textContent = ""; 
    };
}
  
if (backToLogin) {
    backToLogin.onclick = () => { 
      if (forgotForm) forgotForm.classList.add('hidden'); 
      if (loginBox) loginBox.classList.remove('hidden'); 
      errorDiv.textContent = ""; 
    };
}

// 4. SUBMIT TICKET FOR RESET (Using Secure RPC)
if (resetForm) {
    resetForm.onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button');
      const email = document.getElementById('reset-email').value.trim();
      
      btn.disabled = true; btn.textContent = "Requesting...";
      
      try {
        const { error } = await supabaseClient.rpc('request_password_reset', { 
          user_email: email 
        });
  
        if (error) throw error;
  
        errorDiv.style.color = 'green'; 
        errorDiv.innerHTML = "Request sent to Admin.<br>Wait for approval.";
        e.target.reset();
  
      } catch (err) {
        errorDiv.style.color = 'red'; 
        errorDiv.textContent = err.message.replace('P0001:', '').trim();
      } finally {
        btn.disabled = false; btn.textContent = "Request Reset";
      }
    };
}

// 5. HANDLE PASSWORD RECOVERY LINK
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      if (loginBox) loginBox.classList.add('hidden');
      if (forgotForm) forgotForm.classList.add('hidden');
      const updateBox = document.getElementById('update-password-box');
      if (updateBox) updateBox.classList.remove('hidden');
      errorDiv.textContent = "";
    }
});

// 6. SUBMIT NEW PASSWORD
const updateForm = document.getElementById('update-pass-form');
if (updateForm) {
    updateForm.onsubmit = async (e) => {
      e.preventDefault();
      const newPass = document.getElementById('new-password').value;
      const btn = e.target.querySelector('button');
  
      btn.disabled = true; btn.textContent = "Updating...";
  
      const { error } = await supabaseClient.auth.updateUser({ password: newPass });
  
      if (error) {
        errorDiv.style.color = 'red';
        errorDiv.textContent = error.message;
        btn.disabled = false; btn.textContent = "Update Password";
      } else {
        errorDiv.style.color = 'green';
        errorDiv.textContent = "✅ Password updated! Logging you in...";
        setTimeout(() => { window.location.href = 'main.html'; }, 1000);
      }
    };
}