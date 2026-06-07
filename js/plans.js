import { getSupabase } from '../lib/supabaseClient.js';

function sanitize(input) {
  if (!input) return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(input));
  return div.innerHTML;
}

export async function fetchAndRenderPlans() {
  const pricingGrid = document.querySelector('.pricing-grid');
  if (!pricingGrid) return;
  
  pricingGrid.innerHTML = `
    <div class="spinner-container" style="grid-column: 1 / -1;">
      <div class="spinner"></div>
    </div>
  `;
  
  try {
    const supabase = await getSupabase();
    const { data: plans, error } = await supabase
      .from('plans')
      .select('*')
      .order('price', { ascending: true });
      
    if (error) {
      console.error('Database Exception:', error);
      throw new Error('Database select error');
    }
    
    pricingGrid.innerHTML = '';
    
    plans.forEach(plan => {
      const nameLower = sanitize(plan.name.toLowerCase());
      const isPro = nameLower === 'pro';
      const card = document.createElement('div');
      card.className = `pricing-card ${isPro ? 'popular' : ''}`;
      
      const badgeHtml = isPro ? '<div class="badge">Most Popular</div>' : '';
      const buttonClass = isPro ? 'btn-primary' : 'btn-ghost';
      
      const featuresHtml = plan.features && plan.features.length 
        ? plan.features.map(feat => `<li>${sanitize(feat)}</li>`).join('')
        : '<li>No features listed</li>';
      
      const displayName = sanitize(plan.name.charAt(0).toUpperCase() + plan.name.slice(1));
      
      card.innerHTML = `
        ${badgeHtml}
        <div class="pricing-header">
          <h3>${displayName}</h3>
          <div class="pricing-price">
            <span class="currency">$</span>
            <span class="amount">${sanitize(String(plan.price))}</span>
            <span class="period">/mo</span>
          </div>
        </div>
        <ul class="pricing-features">
          ${featuresHtml}
        </ul>
        <button class="btn ${buttonClass} btn-select-plan" data-plan="${nameLower}">Get Started</button>
      `;
      pricingGrid.appendChild(card);
    });

    // Handle select plan securely (no URL query params)
    document.querySelectorAll('.btn-select-plan').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const planName = e.target.getAttribute('data-plan');
        sessionStorage.setItem('selectedPlan', planName);
        window.location.href = 'register.html';
      });
    });

    if (window.bindScrollAnimations) {
      window.bindScrollAnimations();
    }
  } catch (err) {
    console.error('Plans loading failure:', err);
    pricingGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; color: var(--accent-color); padding: 40px;">
        <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; margin-bottom: 10px;"></i>
        <p>Something went wrong. Please try again.</p>
      </div>
    `;
  }
}

document.addEventListener('DOMContentLoaded', fetchAndRenderPlans);
