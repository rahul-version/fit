import { getSupabase } from '../lib/supabaseClient.js';

function sanitize(input) {
  if (!input) return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(input));
  return div.innerHTML;
}

export async function fetchAndRenderTrainers() {
  const trainersGrid = document.querySelector('.trainers-grid');
  if (!trainersGrid) return;
  
  trainersGrid.innerHTML = `
    <div class="spinner-container" style="grid-column: 1 / -1;">
      <div class="spinner"></div>
    </div>
  `;
  
  try {
    const supabase = await getSupabase();
    const { data: trainers, error } = await supabase
      .from('trainers')
      .select('*')
      .order('created_at', { ascending: true });
      
    if (error) {
      console.error('Database Exception:', error);
      throw new Error('Database select error');
    }
    
    trainersGrid.innerHTML = '';
    
    if (!trainers || trainers.length === 0) {
      trainersGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 40px;">
          <p>No trainers listed yet. Check back soon!</p>
        </div>
      `;
      return;
    }
    
    trainers.forEach(trainer => {
      const card = document.createElement('div');
      card.className = 'trainer-card';
      
      const photo = sanitize(trainer.photo_url || 'https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=400');
      
      card.innerHTML = `
        <div class="trainer-img-container">
          <img src="${photo}" alt="${sanitize(trainer.name)}" loading="lazy">
        </div>
        <div class="trainer-details">
          <h3>${sanitize(trainer.name)}</h3>
          <p class="trainer-specialty">${sanitize(trainer.specialization || 'Fitness Coach')}</p>
          <p class="trainer-exp">${sanitize(String(trainer.experience_years || '0'))}+ Years Experience</p>
          <p class="trainer-bio">${sanitize(trainer.bio || '')}</p>
        </div>
      `;
      
      trainersGrid.appendChild(card);
    });

    if (window.bindScrollAnimations) {
      window.bindScrollAnimations();
    }
  } catch (err) {
    console.error('Trainers loading failure:', err);
    trainersGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; color: var(--accent-color); padding: 40px;">
        <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; margin-bottom: 10px;"></i>
        <p>Something went wrong. Please try again.</p>
      </div>
    `;
  }
}

document.addEventListener('DOMContentLoaded', fetchAndRenderTrainers);
