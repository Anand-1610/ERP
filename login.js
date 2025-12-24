const form = document.getElementById('login-form');
const errorDiv = document.getElementById('login-error');

// LOGIN LOGIC
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorDiv.textContent = 'Logging in...';
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    // Uses the fixed 'supabase' variable
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      errorDiv.textContent = error.message;
      return;
    }
    window.location.href = 'main.html';
  });
}

// SIGN UP LOGIC
const signupBtn = document.getElementById('signup-btn');
if (signupBtn) {
  signupBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    errorDiv.textContent = 'Signing up...';
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
      errorDiv.textContent = 'Enter email and password first.';
      return;
    }

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      errorDiv.textContent = error.message;
      return;
    }

    // Immediate Redirect if session exists
    if (data.session) {
      window.location.href = 'main.html';
    } else {
      errorDiv.style.color = 'green';
      errorDiv.textContent = 'Sign up successful! Check your email to confirm.';
    }
  });
}