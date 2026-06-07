import { getSupabase } from '../lib/supabaseClient.js';
import { showToast, sanitize } from './forms.js';

// ==========================================================================
// SESSION CHECKERS & GUARDS
// ==========================================================================

export async function guardMemberRoute() {
  try {
    const supabase = await getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      window.location.href = 'login.html';
      return null;
    }
    
    // Check if email is verified
    if (!session.user.email_confirmed_at) {
      await supabase.auth.signOut();
      window.location.href = 'login.html?error=Please verify your email address before logging in.';
      return null;
    }
    
    // Start inactivity monitor
    initInactivityTimer();
    return session.user;
  } catch (err) {
    console.error('Session guard failure:', err);
    window.location.href = 'login.html';
    return null;
  }
}

export async function guardAdminRoute() {
  try {
    const supabase = await getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      window.location.href = '../login.html';
      return null;
    }
    
    // Secure RLS Policy check using the SECURITY DEFINER RPC helper
    const { data: isAdmin, error } = await supabase.rpc('is_admin');
    
    if (error || !isAdmin) {
      console.warn('Unauthorized admin access attempt. Logging out...');
      await supabase.auth.signOut();
      window.sessionStorage.clear();
      window.location.href = '../login.html?error=Access Denied.';
      return null;
    }
    
    // Start inactivity monitor
    initInactivityTimer();
    return session.user;
  } catch (err) {
    console.error('Admin guard failure:', err);
    window.location.href = '../login.html';
    return null;
  }
}

// 30 Minutes Inactivity Auto-Logout
let inactivityTimer = null;
const TIMEOUT_DURATION = 30 * 60 * 1000; // 30 minutes

function initInactivityTimer() {
  if (inactivityTimer) return; // Prevent multiple listeners
  
  const resetTimer = () => {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(async () => {
      console.warn('Session expired due to inactivity.');
      const supabase = await getSupabase();
      await supabase.auth.signOut();
      window.sessionStorage.clear();
      window.location.href = window.location.pathname.includes('/pages/') ? 'login.html?error=Session timed out due to inactivity.' : '../login.html?error=Session timed out due to inactivity.';
    }, TIMEOUT_DURATION);
  };
  
  // Events list
  const events = ['mousemove', 'keypress', 'mousedown', 'scroll', 'click'];
  events.forEach(event => {
    window.addEventListener(event, resetTimer, { passive: true });
  });
  
  resetTimer();
}

export async function updateNavbarAuth() {
  try {
    const supabase = await getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    const navCta = document.querySelector('.nav-cta');
    const navMenu = document.getElementById('nav-menu');
    
    if (!navCta || !navMenu) return;
    
    if (session && session.user.email_confirmed_at) {
      const user = session.user;
      const fullName = sanitize(user.user_metadata?.full_name || 'Member');
      
      // Secure RLS Policy check using the SECURITY DEFINER RPC helper
      const { data: isAdmin } = await supabase.rpc('is_admin');
      const role = isAdmin ? 'admin' : 'member';
      
      if (!document.getElementById('link-dashboard')) {
        const dashboardLi = document.createElement('li');
        dashboardLi.id = 'link-dashboard';
        
        const relativeDashboardHref = window.location.pathname.includes('/pages/') 
          ? (role === 'admin' ? 'mgmt-gx91/index.html' : 'dashboard.html') 
          : (role === 'admin' ? 'pages/mgmt-gx91/index.html' : 'pages/dashboard.html');

        dashboardLi.innerHTML = `<a href="${relativeDashboardHref}" class="nav-link">Dashboard</a>`;
        navMenu.appendChild(dashboardLi);
      }
      
      const logoutBtnId = 'btn-nav-logout';
      navCta.innerHTML = `
        <span class="user-name-tag" style="margin-right: 15px;">
          <i class="fa-solid fa-user-check" style="color: var(--accent-color);"></i> ${fullName}
        </span>
        <button class="btn btn-primary btn-sm" id="${logoutBtnId}">Logout</button>
      `;
      
      document.getElementById(logoutBtnId).addEventListener('click', handleLogout);
    }
  } catch (err) {
    console.error('Navbar update error:', err);
  }
}

// ==========================================================================
// AUTH HANDLERS
// ==========================================================================

// Password Strength Checker Helper
export function checkPasswordStrength(password) {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
  return score;
}

export async function handleSignUp(e) {
  e.preventDefault();
  
  const nameInput = document.getElementById('register-name');
  const emailInput = document.getElementById('register-email');
  const phoneInput = document.getElementById('register-phone');
  const planSelect = document.getElementById('register-plan');
  const passwordInput = document.getElementById('register-password');
  const confirmPasswordInput = document.getElementById('register-confirm-password');
  const submitBtn = e.target.querySelector('button[type="submit"]');
  
  const rawName = nameInput.value.trim();
  const rawEmail = emailInput.value.trim();
  const rawPhone = phoneInput.value.trim();
  const plan = planSelect.value;
  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;
  
  // Validation
  if (!rawName || !rawEmail || !plan || !password) {
    showToast('Please fill in all required fields.', 'error');
    return;
  }
  
  const htmlPattern = /<[^>]*>/;
  if (htmlPattern.test(rawName) || htmlPattern.test(rawEmail) || htmlPattern.test(rawPhone) || htmlPattern.test(password)) {
    showToast('HTML or script tags are not allowed.', 'error');
    return;
  }
  
  const nameRegex = /^[a-zA-Z\s]+$/;
  if (!nameRegex.test(rawName) || rawName.length > 100) {
    showToast('Name must contain letters only, up to 100 characters.', 'error');
    return;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(rawEmail)) {
    showToast('Please enter a valid email address.', 'error');
    return;
  }
  
  if (rawPhone) {
    const cleanPhone = rawPhone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      showToast('Please enter a valid 10-digit phone number.', 'error');
      return;
    }
  }
  
  // Enforce strong password guidelines
  if (password.length < 8) {
    showToast('Password must be at least 8 characters.', 'error');
    return;
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    showToast('Password must contain uppercase, lowercase, number, and special character.', 'error');
    return;
  }
  
  if (password !== confirmPassword) {
    showToast('Passwords do not match.', 'error');
    return;
  }
  
  // Sanitize
  const name = sanitize(rawName);
  const email = sanitize(rawEmail);
  const phone = rawPhone ? sanitize(rawPhone.replace(/\D/g, '')) : null;
  
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registering...';
  
  try {
    const supabase = await getSupabase();
    
    // 1. Plan duration
    const { data: planData, error: planError } = await supabase
      .from('plans')
      .select('duration_days')
      .eq('name', plan)
      .single();
      
    if (planError) throw new Error('Selected plan data not found.');
    
    const durationDays = planData.duration_days;
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + durationDays);
    
    // 2. Sign Up Auth
    const { data: signUpData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          phone: phone,
          role: 'member',
          plan: plan
        }
      }
    });
    
    if (authError) throw authError;
    if (!signUpData.user) throw new Error('Signup failed. Contact support.');
    
    // 3. Save profile
    const { error: dbError } = await supabase
      .from('members')
      .insert([{
        id: signUpData.user.id,
        full_name: name,
        email,
        phone,
        plan,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        status: 'active'
      }]);
      
    if (dbError) throw dbError;
    
    showToast('Welcome! Please verify your email before logging in.', 'success');
    
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 3000);
    
  } catch (err) {
    console.error('Signup Failure:', err);
    showToast(err.message || 'Something went wrong. Please try again.', 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Join Now';
  }
}

export async function handleLogin(e) {
  e.preventDefault();
  
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const submitBtn = e.target.querySelector('button[type="submit"]');
  
  const rawEmail = emailInput.value.trim();
  const password = passwordInput.value;
  
  if (!rawEmail || !password) {
    showToast('Please fill in both fields.', 'error');
    return;
  }
  
  const email = sanitize(rawEmail);
  
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Logging in...';
  
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      if (error.message.toLowerCase().includes('confirm')) {
        throw new Error('Please verify your email address before logging in.');
      }
      throw error;
    }
    
    const user = data.user;
    
    // Secure RLS Policy check using the SECURITY DEFINER RPC helper
    const { data: isAdmin } = await supabase.rpc('is_admin');
    const role = isAdmin ? 'admin' : 'member';
    
    // Expired dates auto check
    if (role !== 'admin') {
      const { data: memberProfile } = await supabase
        .from('members')
        .select('end_date, status')
        .eq('id', user.id)
        .single();
        
      if (memberProfile) {
        const today = new Date().toISOString().split('T')[0];
        if (memberProfile.end_date < today && memberProfile.status === 'active') {
          await supabase
            .from('members')
            .update({ status: 'expired' })
            .eq('id', user.id);
        }
      }
    }
    
    showToast('Login successful!', 'success');
    
    setTimeout(() => {
      if (role === 'admin') {
        window.location.href = 'mgmt-gx91/index.html';
      } else {
        window.location.href = 'dashboard.html';
      }
    }, 1000);
    
  } catch (err) {
    console.error('Login Failure:', err);
    showToast(err.message || 'Invalid email or password.', 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Log In';
  }
}

export async function handleLogout() {
  try {
    const supabase = await getSupabase();
    await supabase.auth.signOut();
    window.sessionStorage.clear();
    showToast('Logged out successfully.', 'success');
    
    setTimeout(() => {
      window.location.href = window.location.pathname.includes('/mgmt-gx91/') ? '../../index.html' : '../index.html';
    }, 1000);
  } catch (err) {
    console.error('Logout error:', err);
  }
}

// Attach events dynamically
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);
  
  const registerForm = document.getElementById('register-form');
  if (registerForm) registerForm.addEventListener('submit', handleSignUp);
  
  const registerPassword = document.getElementById('register-password');
  if (registerPassword) {
    const container = document.getElementById('password-strength-container');
    const bar = document.getElementById('password-strength-bar');
    const text = document.getElementById('password-strength-text');
    
    registerPassword.addEventListener('input', () => {
      const val = registerPassword.value;
      if (!val) {
        container.style.display = 'none';
        return;
      }
      
      container.style.display = 'block';
      const score = checkPasswordStrength(val);
      const percentage = score * 20;
      
      bar.style.width = `${percentage}%`;
      
      if (score <= 1) {
        bar.style.backgroundColor = '#ff3333';
        text.textContent = 'Weak password';
        text.style.color = '#ff3333';
      } else if (score === 2) {
        bar.style.backgroundColor = '#ff8800';
        text.textContent = 'Fair password';
        text.style.color = '#ff8800';
      } else if (score === 3) {
        bar.style.backgroundColor = '#ffcc00';
        text.textContent = 'Good password (medium)';
        text.style.color = '#ffcc00';
      } else if (score === 4) {
        bar.style.backgroundColor = '#88cc00';
        text.textContent = 'Strong password';
        text.style.color = '#88cc00';
      } else if (score === 5) {
        bar.style.backgroundColor = '#2ebd59';
        text.textContent = 'Very strong password!';
        text.style.color = '#2ebd59';
      }
    });
  }
  
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
  
  updateNavbarAuth();
});
