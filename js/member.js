import { getSupabase } from '../lib/supabaseClient.js';
import { guardMemberRoute } from './auth.js';
import { showToast, sanitize } from './forms.js';

let currentUser = null;

export async function initDashboard() {
  currentUser = await guardMemberRoute();
  if (!currentUser) return;
  
  const userGreeting = document.getElementById('user-greeting');
  if (userGreeting) {
    userGreeting.textContent = sanitize(currentUser.user_metadata?.full_name || 'Member');
  }
  
  await loadMemberProfile();
  await loadAttendanceHistory();
  await checkTodayAttendance();
  initTestimonialForm();
}

async function loadMemberProfile() {
  const profileContainer = document.getElementById('profile-info');
  if (!profileContainer) return;
  
  try {
    const supabase = await getSupabase();
    const { data: member, error } = await supabase
      .from('members')
      .select('*')
      .eq('id', currentUser.id)
      .single();
      
    if (error) {
      console.error('Database Exception:', error);
      throw new Error('Database select error');
    }
    
    const today = new Date().toISOString().split('T')[0];
    let status = member.status;
    
    if (member.end_date < today && status === 'active') {
      status = 'expired';
      await supabase
        .from('members')
        .update({ status: 'expired' })
        .eq('id', currentUser.id);
    }
    
    const end = new Date(member.end_date);
    const curr = new Date();
    const timeDiff = end.getTime() - curr.getTime();
    const daysRemaining = Math.max(0, Math.ceil(timeDiff / (1000 * 3600 * 24)));
    
    const warningArea = document.getElementById('warning-area');
    if (warningArea) {
      if (status === 'expired') {
        warningArea.innerHTML = `
          <div class="warning-banner" style="background-color: #f8d7da; color: #721c24; border-color: #f5c6cb;">
            <i class="fa-solid fa-circle-xmark" style="color: #721c24;"></i>
            <div>
              <strong>Your membership has expired!</strong> Renew your plan to restore full access to facilities and services.
              <button class="btn btn-primary btn-sm" id="btn-renew" style="margin-left: 15px; margin-top: 5px;">Renew Plan</button>
            </div>
          </div>
        `;
      } else if (daysRemaining <= 7) {
        warningArea.innerHTML = `
          <div class="warning-banner">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <div>
              <strong>Membership Expiring Soon!</strong> You have ${daysRemaining} days left. Renew now to avoid interruption.
              <button class="btn btn-primary btn-sm" id="btn-renew" style="margin-left: 15px;">Renew Plan</button>
            </div>
          </div>
        `;
      } else {
        warningArea.innerHTML = '';
      }
      
      const renewBtn = document.getElementById('btn-renew');
      if (renewBtn) {
        renewBtn.addEventListener('click', handleRenewPlan);
      }
    }
    
    const displayName = sanitize(member.plan.charAt(0).toUpperCase() + member.plan.slice(1));
    const statusClass = status === 'active' ? 'badge-active' : 'badge-expired';
    
    profileContainer.innerHTML = `
      <div class="info-block">
        <h4>Full Name</h4>
        <p>${sanitize(member.full_name)}</p>
      </div>
      <div class="info-block">
        <h4>Email Address</h4>
        <p>${sanitize(member.email)}</p>
      </div>
      <div class="info-block">
        <h4>Phone Number</h4>
        <p>${sanitize(member.phone || 'N/A')}</p>
      </div>
      <div class="info-block">
        <h4>Current Plan</h4>
        <p>${displayName}</p>
      </div>
      <div class="info-block">
        <h4>Membership Status</h4>
        <p><span class="badge-status ${statusClass}">${sanitize(status)}</span></p>
      </div>
      <div class="info-block">
        <h4>Duration Dates</h4>
        <p>${sanitize(member.start_date)} to ${sanitize(member.end_date)}</p>
      </div>
      <div class="info-block" style="grid-column: 1 / -1;">
        <h4>Days Remaining</h4>
        <p style="font-size: 2.25rem; font-weight: 800; color: ${daysRemaining <= 7 ? 'var(--accent-color)' : 'inherit'}; font-family: var(--font-heading);">
          ${daysRemaining} Days
        </p>
      </div>
    `;
    
  } catch (err) {
    console.error('Profile Load failure:', err);
    showToast('Something went wrong. Please try again.', 'error');
  }
}

async function loadAttendanceHistory() {
  const tableBody = document.getElementById('attendance-history');
  if (!tableBody) return;
  
  tableBody.innerHTML = `
    <tr>
      <td colspan="2" class="text-center">
        <i class="fa-solid fa-spinner fa-spin"></i> Loading...
      </td>
    </tr>
  `;
  
  try {
    const supabase = await getSupabase();
    const { data: logs, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('member_id', currentUser.id)
      .order('check_in', { ascending: false })
      .limit(10);
      
    if (error) {
      console.error('Database Exception:', error);
      throw new Error('Database select error');
    }
    
    tableBody.innerHTML = '';
    
    if (!logs || logs.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="2" class="text-center" style="color: var(--text-muted);">No attendance logged yet.</td>
        </tr>
      `;
      return;
    }
    
    logs.forEach(log => {
      const dateObj = new Date(log.check_in);
      const dateStr = dateObj.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
      const timeStr = dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${sanitize(dateStr)}</strong></td>
        <td>${sanitize(timeStr)}</td>
      `;
      tableBody.appendChild(tr);
    });
    
  } catch (err) {
    console.error('Attendance Load failure:', err);
    tableBody.innerHTML = `
      <tr>
        <td colspan="2" class="text-center" style="color: var(--accent-color);">Something went wrong.</td>
      </tr>
    `;
  }
}

async function checkTodayAttendance() {
  const checkinBtn = document.getElementById('btn-checkin');
  if (!checkinBtn) return;
  
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const supabase = await getSupabase();
    const { data: attendance, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('member_id', currentUser.id)
      .gte('check_in', `${todayStr}T00:00:00`)
      .lte('check_in', `${todayStr}T23:59:59`);
      
    if (error) throw error;
    
    if (attendance && attendance.length > 0) {
      checkinBtn.disabled = true;
      checkinBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i><span style="font-size:0.8rem; margin-top:5px;">Checked In</span>';
    } else {
      checkinBtn.disabled = false;
      checkinBtn.addEventListener('click', handleCheckIn);
    }
  } catch (err) {
    console.error('Checkin validation check error:', err);
  }
}

async function handleCheckIn() {
  const checkinBtn = document.getElementById('btn-checkin');
  if (!checkinBtn) return;
  
  checkinBtn.disabled = true;
  checkinBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
  
  try {
    const supabase = await getSupabase();
    const { error } = await supabase
      .from('attendance')
      .insert([{ member_id: currentUser.id }]);
      
    if (error) {
      console.error('Database Exception:', error);
      throw new Error('Database insert error');
    }
    
    showToast('Check-in logged successfully!', 'success');
    checkinBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i><span style="font-size:0.8rem; margin-top:5px;">Checked In</span>';
    
    await loadAttendanceHistory();
    
  } catch (err) {
    console.error('Check-in Log failure:', err);
    showToast('Something went wrong. Please try again.', 'error');
    checkinBtn.disabled = false;
    checkinBtn.innerHTML = '<i class="fa-solid fa-fingerprint"></i><span style="font-size:0.8rem; margin-top:5px;">Check In</span>';
  }
}

async function handleRenewPlan() {
  const renewBtn = document.getElementById('btn-renew');
  const originalHtml = renewBtn.innerHTML;
  renewBtn.disabled = true;
  renewBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
  
  try {
    const supabase = await getSupabase();
    const { data: member, error: profileErr } = await supabase
      .from('members')
      .select('plan')
      .eq('id', currentUser.id)
      .single();
      
    if (profileErr) throw profileErr;
    
    const { data: planData, error: planErr } = await supabase
      .from('plans')
      .select('duration_days')
      .eq('name', member.plan)
      .single();
      
    if (planErr) throw planErr;
    
    const newEnd = new Date();
    newEnd.setDate(newEnd.getDate() + planData.duration_days);
    const newEndStr = newEnd.toISOString().split('T')[0];
    
    const { error: updateErr } = await supabase
      .from('members')
      .update({
        end_date: newEndStr,
        status: 'active'
      })
      .eq('id', currentUser.id);
      
    if (updateErr) throw updateErr;
    
    showToast('Plan renewed successfully!', 'success');
    await loadMemberProfile();
    
  } catch (err) {
    console.error('Renewal failure:', err);
    showToast('Something went wrong.', 'error');
    renewBtn.disabled = false;
    renewBtn.innerHTML = originalHtml;
  }
}

function initTestimonialForm() {
  const form = document.getElementById('testimonial-form');
  if (!form) return;
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const reviewInput = document.getElementById('testimonial-review');
    const ratingInput = document.getElementById('testimonial-rating');
    const submitBtn = form.querySelector('button[type="submit"]');
    
    const rawReview = reviewInput.value.trim();
    const rating = parseInt(ratingInput.value, 10);
    
    if (!rawReview || isNaN(rating) || rating < 1 || rating > 5) {
      showToast('Please enter a review and select a rating between 1 and 5.', 'error');
      return;
    }
    
    // Validate: block HTML / script tags
    const htmlPattern = /<[^>]*>/;
    if (htmlPattern.test(rawReview)) {
      showToast('HTML or script tags are not allowed.', 'error');
      return;
    }
    
    // Sanitize review
    const review = sanitize(rawReview);
    const memberName = sanitize(currentUser.user_metadata?.full_name || 'Anonymous Member');
    
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';
    
    try {
      const supabase = await getSupabase();
      const { error } = await supabase
        .from('testimonials')
        .insert([{
          member_name: memberName,
          rating,
          review,
          approved: false
        }]);
        
      if (error) {
        console.error('Database Exception:', error);
        throw new Error('Database insert error');
      }
      
      showToast('Testimonial submitted! Pending moderator approval.', 'success');
      form.reset();
    } catch (err) {
      console.error('Testimonial submit failure:', err);
      showToast('Something went wrong. Please try again.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('profile-info')) {
    initDashboard();
  }
});
