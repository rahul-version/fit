import { getSupabase } from '../lib/supabaseClient.js';

export function sanitize(input) {
  if (!input) return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(input));
  return div.innerHTML;
}

export function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
  const iconColor = type === 'success' ? '#28a745' : '#dc3545';
  
  toast.innerHTML = `
    <i class="fa-solid ${icon}" style="color: ${iconColor}; font-size: 1.25rem;"></i>
    <span>${sanitize(message)}</span>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'toastSlideIn 0.3s reverse forwards';
    setTimeout(() => {
      toast.remove();
      if (container.children.length === 0) {
        container.remove();
      }
    }, 300);
  }, 4000);
}

export function initContactForm() {
  const contactForm = document.getElementById('contact-form');
  if (!contactForm) return;
  
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nameInput = document.getElementById('contact-name');
    const emailInput = document.getElementById('contact-email');
    const phoneInput = document.getElementById('contact-phone');
    const messageInput = document.getElementById('contact-message');
    const submitBtn = contactForm.querySelector('button[type="submit"]');
    
    const rawName = nameInput.value.trim();
    const rawEmail = emailInput.value.trim();
    const rawPhone = phoneInput.value.trim();
    const rawMessage = messageInput.value.trim();
    
    // 1. Check required fields
    if (!rawName || !rawEmail || !rawMessage) {
      showToast('Name, email, and message are required.', 'error');
      return;
    }
    
    // 2. Prevent HTML / Script tags
    const htmlPattern = /<[^>]*>/;
    if (htmlPattern.test(rawName) || htmlPattern.test(rawEmail) || htmlPattern.test(rawPhone) || htmlPattern.test(rawMessage)) {
      showToast('HTML or script tags are not allowed.', 'error');
      return;
    }
    
    // 3. Name validation (alphabetic + spaces, max 100 characters)
    const nameRegex = /^[a-zA-Z\s]+$/;
    if (!nameRegex.test(rawName)) {
      showToast('Name can only contain letters and spaces.', 'error');
      return;
    }
    if (rawName.length > 100) {
      showToast('Name cannot exceed 100 characters.', 'error');
      return;
    }
    
    // 4. Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(rawEmail)) {
      showToast('Please enter a valid email address.', 'error');
      return;
    }
    
    // 5. Phone validation (exactly 10 digits)
    let cleanPhone = null;
    if (rawPhone) {
      cleanPhone = rawPhone.replace(/\D/g, '');
      if (cleanPhone.length !== 10) {
        showToast('Please enter a valid 10-digit phone number.', 'error');
        return;
      }
    }
    
    // 6. Message validation (max 1000 characters)
    if (rawMessage.length > 1000) {
      showToast('Message cannot exceed 1000 characters.', 'error');
      return;
    }
    
    // 7. Sanitize inputs before DB storage
    const name = sanitize(rawName);
    const email = sanitize(rawEmail);
    const phone = cleanPhone ? sanitize(cleanPhone) : null;
    const message = sanitize(rawMessage);
    
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';
    
    try {
      const supabase = await getSupabase();
      const { error } = await supabase
        .from('inquiries')
        .insert([{ name, email, phone, message }]);
        
      if (error) {
        console.error('Database Exception:', error);
        throw new Error('Database insert error');
      }
      
      showToast("We'll contact you within 24 hours!", 'success');
      contactForm.reset();
    } catch (err) {
      console.error('Contact submit failure:', err);
      showToast('Something went wrong. Please try again.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initContactForm();
});
