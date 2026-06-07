import { getSupabase } from '../lib/supabaseClient.js';
import { guardAdminRoute } from './auth.js';
import { showToast, sanitize } from './forms.js';

let currentAdmin = null;
let supabase = null;

// ==========================================================================
// INITIALIZERS
// ==========================================================================

export async function initAdminPanel() {
  currentAdmin = await guardAdminRoute();
  if (!currentAdmin) return;
  
  try {
    supabase = await getSupabase();
    
    // Triple Verification: Check RLS policy on admin_logs database side
    const { error: rlsError } = await supabase
      .from('admin_logs')
      .select('id')
      .limit(1);
      
    if (rlsError) {
      console.error('Database RLS block:', rlsError);
      throw new Error('RLS Blocked');
    }
  } catch (err) {
    console.error('Triple verification failure:', err);
    // Force logout and redirect
    const client = await getSupabase();
    await client.auth.signOut();
    window.sessionStorage.clear();
    window.location.href = '../login.html?error=Security check failed. Access Denied.';
    return;
  }
  
  const adminGreeting = document.getElementById('admin-greeting');
  if (adminGreeting) {
    adminGreeting.textContent = sanitize(currentAdmin.user_metadata?.full_name || 'Admin');
  }
  
  if (document.getElementById('admin-stats-dashboard')) {
    initDashboardStats();
  }
  if (document.getElementById('members-table-body')) {
    initMembersManagement();
  }
  if (document.getElementById('inquiries-table-body')) {
    initInquiriesManagement();
  }
  if (document.getElementById('trainers-list-body')) {
    initTrainersManagement();
  }
  if (document.getElementById('testimonials-table-body')) {
    initTestimonialsManagement();
  }
  if (document.getElementById('attendance-log-body')) {
    initAttendanceLog();
  }
  
  loadInquiryBadge();
}

// Admin Activity Logger Helper
async function logAdminAction(action, targetTable = null, targetId = null) {
  try {
    const { error } = await supabase
      .from('admin_logs')
      .insert([{
        admin_id: currentAdmin.id,
        action: sanitize(action),
        target_table: targetTable ? sanitize(targetTable) : null,
        target_id: targetId
      }]);
    if (error) console.error('Database action log failed:', error);
  } catch (err) {
    console.error('Logger exception:', err);
  }
}

async function loadInquiryBadge() {
  try {
    const { count, error } = await supabase
      .from('inquiries')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'new');
      
    if (error) throw error;
    
    const badge = document.getElementById('inquiry-count-badge');
    if (badge) {
      if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }
  } catch (err) {
    console.error(err);
  }
}

// ==========================================================================
// A. DASHBOARD STATISTICS
// ==========================================================================

async function initDashboardStats() {
  const todayStr = new Date().toISOString().split('T')[0];
  
  async function loadStats() {
    try {
      const { count: totalMembers } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true });
        
      const { count: activeMembers, data: activeMembersData } = await supabase
        .from('members')
        .select('plan', { count: 'exact' })
        .eq('status', 'active');
        
      const { count: expiredMembers } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'expired');
        
      const { count: newInquiries } = await supabase
        .from('inquiries')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'new');
        
      const { count: todayAttendance } = await supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .gte('check_in', `${todayStr}T00:00:00`);
        
      const { data: plans } = await supabase
        .from('plans')
        .select('name, price');
        
      const planPrices = {};
      plans?.forEach(p => {
        planPrices[p.name.toLowerCase()] = Number(p.price);
      });
      
      let revenue = 0;
      activeMembersData?.forEach(m => {
        revenue += planPrices[m.plan.toLowerCase()] || 0;
      });
      
      document.getElementById('stat-total-members').textContent = totalMembers || 0;
      document.getElementById('stat-active-members').textContent = activeMembers || 0;
      document.getElementById('stat-expired-members').textContent = expiredMembers || 0;
      document.getElementById('stat-new-inquiries').textContent = newInquiries || 0;
      document.getElementById('stat-today-attendance').textContent = todayAttendance || 0;
      document.getElementById('stat-monthly-revenue').textContent = `$${revenue.toLocaleString()}`;
      
    } catch (err) {
      console.error('Stats metrics exception:', err);
      showToast('Something went wrong.', 'error');
    }
  }
  
  await loadStats();
  
  // Realtime Subscriptions
  supabase
    .channel('realtime-attendance')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance' }, () => {
      const counterEl = document.getElementById('stat-today-attendance');
      if (counterEl) {
        const currentCount = parseInt(counterEl.textContent, 10);
        counterEl.textContent = currentCount + 1;
      }
      showToast('New member checked in!', 'success');
    })
    .subscribe();
    
  supabase
    .channel('realtime-inquiries')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'inquiries' }, () => {
      const counterEl = document.getElementById('stat-new-inquiries');
      if (counterEl) {
        const currentCount = parseInt(counterEl.textContent, 10);
        counterEl.textContent = currentCount + 1;
      }
      loadInquiryBadge();
      showToast('New inquiry form received!', 'success');
    })
    .subscribe();
}

// ==========================================================================
// B. MEMBERS MANAGEMENT
// ==========================================================================

async function initMembersManagement() {
  const searchInput = document.getElementById('member-search');
  const planFilter = document.getElementById('member-plan-filter');
  const statusFilter = document.getElementById('member-status-filter');
  
  async function loadMembers() {
    const tableBody = document.getElementById('members-table-body');
    tableBody.innerHTML = `<tr><td colspan="6" class="text-center"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</td></tr>`;
    
    let query = supabase.from('members').select('*');
    
    const search = searchInput.value.trim();
    const plan = planFilter.value;
    const status = statusFilter.value;
    
    if (plan) query = query.eq('plan', plan);
    if (status) query = query.eq('status', status);
    
    try {
      let { data: members, error } = await query.order('created_at', { ascending: false });
      if (error) {
        console.error('Database Exception:', error);
        throw new Error('Database select error');
      }
      
      if (search) {
        members = members.filter(m => 
          m.full_name.toLowerCase().includes(search.toLowerCase()) || 
          m.email.toLowerCase().includes(search.toLowerCase())
        );
      }
      
      tableBody.innerHTML = '';
      
      if (members.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center" style="color: var(--text-muted);">No members matching current filters found.</td></tr>`;
        return;
      }
      
      members.forEach(member => {
        const tr = document.createElement('tr');
        const planClass = member.plan === 'elite' ? 'font-weight:700; color:var(--accent-color)' : '';
        const statusClass = member.status === 'active' ? 'badge-active' : 'badge-expired';
        
        tr.innerHTML = `
          <td><strong>${sanitize(member.full_name)}</strong></td>
          <td>${sanitize(member.email)}</td>
          <td style="${planClass}">${sanitize(member.plan.toUpperCase())}</td>
          <td><span class="badge-status ${statusClass}">${sanitize(member.status)}</span></td>
          <td>${sanitize(member.end_date)}</td>
          <td class="admin-action-btn-group">
            <button class="btn btn-ghost btn-sm btn-edit-plan" data-id="${member.id}" data-plan="${member.plan}">Change Plan</button>
            ${member.status === 'active' ? 
              `<button class="btn btn-ghost btn-sm btn-toggle-status" data-id="${member.id}" data-status="inactive">Deactivate</button>` : 
              `<button class="btn btn-ghost btn-sm btn-toggle-status" data-id="${member.id}" data-status="active">Activate</button>`
            }
            <button class="btn btn-danger btn-sm btn-delete-member" data-id="${member.id}">Delete</button>
          </td>
        `;
        tableBody.appendChild(tr);
      });
      
      attachMemberActions();
    } catch (err) {
      console.error('Members fetch failure:', err);
      tableBody.innerHTML = `<tr><td colspan="6" class="text-center" style="color: var(--accent-color);">Something went wrong.</td></tr>`;
    }
  }
  
  function attachMemberActions() {
    // 1. Edit Plan
    document.querySelectorAll('.btn-edit-plan').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        const plan = e.target.getAttribute('data-plan');
        
        document.getElementById('edit-member-id').value = id;
        document.getElementById('edit-plan-select').value = plan;
        document.getElementById('edit-plan-modal').classList.add('active');
      });
    });
    
    // 2. Toggle Status (Confirmation Guard)
    document.querySelectorAll('.btn-toggle-status').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        const newStatus = e.target.getAttribute('data-status');
        
        if (!confirm(`Are you sure you want to change member status to ${newStatus}?`)) return;
        
        try {
          const { error } = await supabase
            .from('members')
            .update({ status: newStatus })
            .eq('id', id);
            
          if (error) throw error;
          
          await logAdminAction(`Changed member status to ${newStatus}`, 'members', id);
          showToast(`Member status updated.`, 'success');
          loadMembers();
        } catch (err) {
          console.error(err);
          showToast('Something went wrong.', 'error');
        }
      });
    });
    
    // 3. Delete Member (Confirmation Guard)
    document.querySelectorAll('.btn-delete-member').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        
        if (!confirm('WARNING: Deleting this member will remove their profile and all attendance records. Proceed?')) return;
        
        try {
          const { error } = await supabase
            .from('members')
            .delete()
            .eq('id', id);
            
          if (error) throw error;
          
          await logAdminAction('Deleted member profile and logs', 'members', id);
          showToast('Member profile deleted.', 'success');
          loadMembers();
        } catch (err) {
          console.error(err);
          showToast('Something went wrong.', 'error');
        }
      });
    });
  }
  
  searchInput.addEventListener('input', loadMembers);
  planFilter.addEventListener('change', loadMembers);
  statusFilter.addEventListener('change', loadMembers);
  
  loadMembers();
  
  const addModal = document.getElementById('add-member-modal');
  const addBtn = document.getElementById('btn-add-member');
  if (addBtn && addModal) {
    addBtn.addEventListener('click', () => addModal.classList.add('active'));
  }
  
  document.querySelectorAll('.modal-close, .btn-modal-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal');
      if (modal) modal.classList.remove('active');
    });
  });
  
  // Edit Plan Save
  const editPlanForm = document.getElementById('edit-plan-form');
  if (editPlanForm) {
    editPlanForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const id = document.getElementById('edit-member-id').value;
      const plan = document.getElementById('edit-plan-select').value;
      const submitBtn = editPlanForm.querySelector('button[type="submit"]');
      
      if (!confirm(`Confirm plan switch to ${plan}?`)) return;
      
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
      
      try {
        const { data: planData } = await supabase
          .from('plans')
          .select('duration_days')
          .eq('name', plan)
          .single();
          
        const days = planData ? planData.duration_days : 30;
        const newEnd = new Date();
        newEnd.setDate(newEnd.getDate() + days);
        const newEndStr = newEnd.toISOString().split('T')[0];
        
        const { error } = await supabase
          .from('members')
          .update({
            plan,
            end_date: newEndStr,
            status: 'active'
          })
          .eq('id', id);
          
        if (error) throw error;
        
        await logAdminAction(`Changed member plan to ${plan}`, 'members', id);
        showToast('Member plan updated successfully!', 'success');
        document.getElementById('edit-plan-modal').classList.remove('active');
        loadMembers();
      } catch (err) {
        console.error(err);
        showToast('Something went wrong.', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Changes';
      }
    });
  }
  
  // Add Member submit
  const addMemberForm = document.getElementById('add-member-form');
  if (addMemberForm) {
    addMemberForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const rawName = document.getElementById('add-member-name').value.trim();
      const rawEmail = document.getElementById('add-member-email').value.trim();
      const rawPhone = document.getElementById('add-member-phone').value.trim();
      const plan = document.getElementById('add-member-plan').value;
      const password = document.getElementById('add-member-password').value;
      const submitBtn = addMemberForm.querySelector('button[type="submit"]');
      
      // Val
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
      
      if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        showToast('Password must meet complexity guidelines.', 'error');
        return;
      }
      
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating...';
      
      try {
        const { data: planData } = await supabase
          .from('plans')
          .select('duration_days')
          .eq('name', plan)
          .single();
          
        const days = planData ? planData.duration_days : 30;
        const start = new Date();
        const end = new Date();
        end.setDate(start.getDate() + days);
        
        const name = sanitize(rawName);
        const email = sanitize(rawEmail);
        const phone = rawPhone ? sanitize(rawPhone.replace(/\D/g, '')) : null;
        
        // Auth Sign Up
        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
              phone: phone,
              role: 'member',
              plan
            }
          }
        });
        
        if (authErr) throw authErr;
        
        // DB Insert
        const { error: profileErr } = await supabase
          .from('members')
          .insert([{
            id: authData.user.id,
            full_name: name,
            email,
            phone,
            plan,
            start_date: start.toISOString().split('T')[0],
            end_date: end.toISOString().split('T')[0],
            status: 'active'
          }]);
          
        if (profileErr) throw profileErr;
        
        await logAdminAction('Manually registered new member', 'members', authData.user.id);
        showToast('New member created successfully!', 'success');
        addMemberForm.reset();
        addModal.classList.remove('active');
        loadMembers();
        
      } catch (err) {
        console.error(err);
        showToast('Something went wrong. Please try again.', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Add Member';
      }
    });
  }
}

// ==========================================================================
// C. INQUIRIES MANAGEMENT
// ==========================================================================

async function initInquiriesManagement() {
  async function loadInquiries() {
    const tableBody = document.getElementById('inquiries-table-body');
    tableBody.innerHTML = `<tr><td colspan="6" class="text-center"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</td></tr>`;
    
    try {
      const { data: inquiries, error } = await supabase
        .from('inquiries')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('Database Exception:', error);
        throw new Error('Database select error');
      }
      
      tableBody.innerHTML = '';
      
      if (!inquiries || inquiries.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center" style="color: var(--text-muted);">No inquiries logged.</td></tr>`;
        return;
      }
      
      inquiries.forEach(inq => {
        const tr = document.createElement('tr');
        const dateObj = new Date(inq.created_at);
        const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        let statusBadge = 'badge-new';
        if (inq.status === 'contacted') statusBadge = 'badge-contacted';
        if (inq.status === 'resolved') statusBadge = 'badge-resolved';
        
        tr.innerHTML = `
          <td><strong>${sanitize(inq.name)}</strong></td>
          <td>${sanitize(inq.email)}<br><span style="font-size:0.8rem; color:var(--text-muted);">${sanitize(inq.phone || 'No phone')}</span></td>
          <td><div style="max-width:250px; word-break:break-word;">${sanitize(inq.message)}</div></td>
          <td><span class="badge-status ${statusBadge}">${sanitize(inq.status)}</span></td>
          <td style="font-size:0.85rem; color:var(--text-muted);">${sanitize(dateStr)}</td>
          <td class="admin-action-btn-group">
            <select class="form-input form-input-bottom-border select-change-status" data-id="${inq.id}" style="width:120px; font-size:0.8rem; padding:4px;">
              <option value="new" ${inq.status === 'new' ? 'selected' : ''}>New</option>
              <option value="contacted" ${inq.status === 'contacted' ? 'selected' : ''}>Contacted</option>
              <option value="resolved" ${inq.status === 'resolved' ? 'selected' : ''}>Resolved</option>
            </select>
            <button class="btn btn-danger btn-sm btn-delete-inquiry" data-id="${inq.id}">Delete</button>
          </td>
        `;
        tableBody.appendChild(tr);
      });
      
      attachInquiryActions();
    } catch (err) {
      console.error(err);
      tableBody.innerHTML = `<tr><td colspan="6" class="text-center" style="color: var(--accent-color);">Something went wrong.</td></tr>`;
    }
  }
  
  function attachInquiryActions() {
    document.querySelectorAll('.select-change-status').forEach(select => {
      select.addEventListener('change', async (e) => {
        const id = e.target.getAttribute('data-id');
        const status = e.target.value;
        
        if (!confirm(`Change status to ${status}?`)) return;
        
        try {
          const { error } = await supabase
            .from('inquiries')
            .update({ status })
            .eq('id', id);
            
          if (error) throw error;
          
          await logAdminAction(`Updated inquiry status to ${status}`, 'inquiries', id);
          showToast(`Inquiry status updated.`, 'success');
          loadInquiryBadge();
          loadInquiries();
        } catch (err) {
          console.error(err);
          showToast('Something went wrong.', 'error');
        }
      });
    });
    
    document.querySelectorAll('.btn-delete-inquiry').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        if (!confirm('Are you sure you want to delete this inquiry?')) return;
        
        try {
          const { error } = await supabase
            .from('inquiries')
            .delete()
            .eq('id', id);
            
          if (error) throw error;
          
          await logAdminAction('Deleted inquiry record', 'inquiries', id);
          showToast('Inquiry deleted.', 'success');
          loadInquiryBadge();
          loadInquiries();
        } catch (err) {
          console.error(err);
          showToast('Something went wrong.', 'error');
        }
      });
    });
  }
  
  loadInquiries();
}

// ==========================================================================
// D. TRAINERS MANAGEMENT
// ==========================================================================

async function initTrainersManagement() {
  async function loadTrainers() {
    const listBody = document.getElementById('trainers-list-body');
    listBody.innerHTML = `<tr><td colspan="5" class="text-center"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</td></tr>`;
    
    try {
      const { data: trainers, error } = await supabase
        .from('trainers')
        .select('*')
        .order('created_at', { ascending: true });
        
      if (error) {
        console.error('Database Exception:', error);
        throw new Error('Database select error');
      }
      
      listBody.innerHTML = '';
      
      if (!trainers || trainers.length === 0) {
        listBody.innerHTML = `<tr><td colspan="5" class="text-center" style="color: var(--text-muted);">No trainers listed.</td></tr>`;
        return;
      }
      
      trainers.forEach(tr => {
        const row = document.createElement('tr');
        const photo = sanitize(tr.photo_url || 'https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=100');
        row.innerHTML = `
          <td><img src="${photo}" style="width:50px; height:50px; border-radius:4px; object-fit:cover;"></td>
          <td><strong>${sanitize(tr.name)}</strong></td>
          <td>${sanitize(tr.specialization || 'N/A')}</td>
          <td>${sanitize(String(tr.experience_years || 0))} Years</td>
          <td class="admin-action-btn-group">
            <button class="btn btn-ghost btn-sm btn-edit-trainer" data-id="${tr.id}" data-name="${tr.name}" data-spec="${tr.specialization}" data-exp="${tr.experience_years}" data-photo="${tr.photo_url}" data-bio="${tr.bio}">Edit</button>
            <button class="btn btn-danger btn-sm btn-delete-trainer" data-id="${tr.id}">Delete</button>
          </td>
        `;
        listBody.appendChild(row);
      });
      
      attachTrainerActions();
    } catch (err) {
      console.error(err);
      listBody.innerHTML = `<tr><td colspan="5" class="text-center" style="color: var(--accent-color);">Something went wrong.</td></tr>`;
    }
  }
  
  function attachTrainerActions() {
    document.querySelectorAll('.btn-edit-trainer').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        const name = e.target.getAttribute('data-name');
        const spec = e.target.getAttribute('data-spec');
        const exp = e.target.getAttribute('data-exp');
        const photo = e.target.getAttribute('data-photo');
        const bio = e.target.getAttribute('data-bio');
        
        document.getElementById('edit-trainer-id').value = id;
        document.getElementById('edit-trainer-name').value = name;
        document.getElementById('edit-trainer-spec').value = spec;
        document.getElementById('edit-trainer-exp').value = exp;
        document.getElementById('edit-trainer-photo').value = photo;
        document.getElementById('edit-trainer-bio').value = bio;
        
        document.getElementById('edit-trainer-modal').classList.add('active');
      });
    });
    
    document.querySelectorAll('.btn-delete-trainer').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        if (!confirm('Are you sure you want to delete this trainer?')) return;
        
        try {
          const { error } = await supabase
            .from('trainers')
            .delete()
            .eq('id', id);
            
          if (error) throw error;
          
          await logAdminAction('Deleted trainer profile', 'trainers', id);
          showToast('Trainer deleted.', 'success');
          loadTrainers();
        } catch (err) {
          console.error(err);
          showToast('Something went wrong.', 'error');
        }
      });
    });
  }
  
  const addBtn = document.getElementById('btn-add-trainer');
  const addModal = document.getElementById('add-trainer-modal');
  if (addBtn && addModal) {
    addBtn.addEventListener('click', () => addModal.classList.add('active'));
  }
  
  document.querySelectorAll('.modal-close, .btn-modal-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal');
      if (modal) modal.classList.remove('active');
    });
  });
  
  // Add trainer Submit
  const addForm = document.getElementById('add-trainer-form');
  if (addForm) {
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const rawName = document.getElementById('add-trainer-name').value.trim();
      const rawSpec = document.getElementById('add-trainer-spec').value.trim();
      const rawExp = parseInt(document.getElementById('add-trainer-exp').value, 10);
      const rawPhoto = document.getElementById('add-trainer-photo').value.trim();
      const rawBio = document.getElementById('add-trainer-bio').value.trim();
      const submitBtn = addForm.querySelector('button[type="submit"]');
      
      if (!rawName) {
        showToast('Name is required.', 'error');
        return;
      }
      
      const htmlPattern = /<[^>]*>/;
      if (htmlPattern.test(rawName) || htmlPattern.test(rawSpec) || htmlPattern.test(rawPhoto) || htmlPattern.test(rawBio)) {
        showToast('HTML tags are not allowed.', 'error');
        return;
      }
      
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
      
      try {
        const name = sanitize(rawName);
        const specialization = sanitize(rawSpec);
        const photo_url = sanitize(rawPhoto);
        const bio = sanitize(rawBio);
        
        const { data, error } = await supabase
          .from('trainers')
          .insert([{
            name,
            specialization: specialization || null,
            experience_years: isNaN(rawExp) ? null : rawExp,
            photo_url: photo_url || null,
            bio: bio || null
          }])
          .select();
          
        if (error) throw error;
        
        await logAdminAction('Created trainer record', 'trainers', data[0].id);
        showToast('Trainer added successfully!', 'success');
        addForm.reset();
        addModal.classList.remove('active');
        loadTrainers();
      } catch (err) {
        console.error(err);
        showToast('Something went wrong.', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Add Trainer';
      }
    });
  }
  
  // Edit trainer Submit
  const editForm = document.getElementById('edit-trainer-form');
  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const id = document.getElementById('edit-trainer-id').value;
      const rawName = document.getElementById('edit-trainer-name').value.trim();
      const rawSpec = document.getElementById('edit-trainer-spec').value.trim();
      const rawExp = parseInt(document.getElementById('edit-trainer-exp').value, 10);
      const rawPhoto = document.getElementById('edit-trainer-photo').value.trim();
      const rawBio = document.getElementById('edit-trainer-bio').value.trim();
      const submitBtn = editForm.querySelector('button[type="submit"]');
      
      if (!rawName) {
        showToast('Trainer name is required.', 'error');
        return;
      }
      
      const htmlPattern = /<[^>]*>/;
      if (htmlPattern.test(rawName) || htmlPattern.test(rawSpec) || htmlPattern.test(rawPhoto) || htmlPattern.test(rawBio)) {
        showToast('HTML tags are not allowed.', 'error');
        return;
      }
      
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
      
      try {
        const name = sanitize(rawName);
        const specialization = sanitize(rawSpec);
        const photo_url = sanitize(rawPhoto);
        const bio = sanitize(rawBio);
        
        const { error } = await supabase
          .from('trainers')
          .update({
            name,
            specialization: specialization || null,
            experience_years: isNaN(rawExp) ? null : rawExp,
            photo_url: photo_url || null,
            bio: bio || null
          })
          .eq('id', id);
          
        if (error) throw error;
        
        await logAdminAction('Updated trainer details', 'trainers', id);
        showToast('Trainer updated successfully!', 'success');
        document.getElementById('edit-trainer-modal').classList.remove('active');
        loadTrainers();
      } catch (err) {
        console.error(err);
        showToast('Something went wrong.', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Changes';
      }
    });
  }
  
  loadTrainers();
}

// ==========================================================================
// E. TESTIMONIALS MANAGEMENT
// ==========================================================================

async function initTestimonialsManagement() {
  async function loadTestimonials() {
    const tableBody = document.getElementById('testimonials-table-body');
    tableBody.innerHTML = `<tr><td colspan="5" class="text-center"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</td></tr>`;
    
    try {
      const { data: testimonials, error } = await supabase
        .from('testimonials')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('Database Exception:', error);
        throw new Error('Database select error');
      }
      
      tableBody.innerHTML = '';
      
      if (!testimonials || testimonials.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center" style="color: var(--text-muted);">No testimonials.</td></tr>`;
        return;
      }
      
      testimonials.forEach(t => {
        const tr = document.createElement('tr');
        const starsHtml = '<i class="fa-solid fa-star" style="color:#ffc107;"></i>'.repeat(t.rating);
        
        tr.innerHTML = `
          <td><strong>${sanitize(t.member_name)}</strong></td>
          <td>${starsHtml} (${sanitize(String(t.rating))}/5)</td>
          <td><div style="max-width:300px; word-break:break-word;">"${sanitize(t.review)}"</div></td>
          <td>
            <span class="badge-status ${t.approved ? 'badge-active' : 'badge-expired'}">
              ${t.approved ? 'Approved' : 'Pending'}
            </span>
          </td>
          <td class="admin-action-btn-group">
            ${!t.approved ? 
              `<button class="btn btn-ghost btn-sm btn-approve" data-id="${t.id}" data-action="approve">Approve</button>` : 
              `<button class="btn btn-ghost btn-sm btn-approve" data-id="${t.id}" data-action="reject">Reject</button>`
            }
            <button class="btn btn-danger btn-sm btn-delete-testimonial" data-id="${t.id}">Delete</button>
          </td>
        `;
        tableBody.appendChild(tr);
      });
      
      attachTestimonialActions();
    } catch (err) {
      console.error(err);
      tableBody.innerHTML = `<tr><td colspan="5" class="text-center" style="color: var(--accent-color);">Something went wrong.</td></tr>`;
    }
  }
  
  function attachTestimonialActions() {
    document.querySelectorAll('.btn-approve').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        const action = e.target.getAttribute('data-action');
        const approveBool = action === 'approve';
        
        if (!confirm(`Are you sure you want to ${action} this testimonial?`)) return;
        
        try {
          const { error } = await supabase
            .from('testimonials')
            .update({ approved: approveBool })
            .eq('id', id);
            
          if (error) throw error;
          
          await logAdminAction(`${approveBool ? 'Approved' : 'Rejected'} testimonial`, 'testimonials', id);
          showToast(`Testimonial has been ${approveBool ? 'approved' : 'rejected'}.`, 'success');
          loadTestimonials();
        } catch (err) {
          console.error(err);
          showToast('Something went wrong.', 'error');
        }
      });
    });
    
    document.querySelectorAll('.btn-delete-testimonial').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        if (!confirm('Are you sure you want to delete this testimonial?')) return;
        
        try {
          const { error } = await supabase
            .from('testimonials')
            .delete()
            .eq('id', id);
            
          if (error) throw error;
          
          await logAdminAction('Deleted testimonial record', 'testimonials', id);
          showToast('Testimonial deleted.', 'success');
          loadTestimonials();
        } catch (err) {
          console.error(err);
          showToast('Something went wrong.', 'error');
        }
      });
    });
  }
  
  loadTestimonials();
}

// ==========================================================================
// F. ATTENDANCE LOG
// ==========================================================================

async function initAttendanceLog() {
  const dateInput = document.getElementById('attendance-date-filter');
  
  async function loadLogs() {
    const tableBody = document.getElementById('attendance-log-body');
    tableBody.innerHTML = `<tr><td colspan="4" class="text-center"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</td></tr>`;
    
    let query = supabase
      .from('attendance')
      .select('*, members(full_name, plan)');
      
    const dateVal = dateInput.value;
    
    if (dateVal) {
      query = query
        .gte('check_in', `${dateVal}T00:00:00`)
        .lte('check_in', `${dateVal}T23:59:59`);
    }
    
    try {
      const { data: logs, error } = await query.order('check_in', { ascending: false });
      if (error) {
        console.error('Database Exception:', error);
        throw new Error('Database select error');
      }
      
      tableBody.innerHTML = '';
      
      if (!logs || logs.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center" style="color: var(--text-muted);">No attendance logged.</td></tr>`;
        return;
      }
      
      logs.forEach(log => {
        const tr = document.createElement('tr');
        const dateObj = new Date(log.check_in);
        const dateStr = dateObj.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
        const timeStr = dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        
        const memberName = sanitize(log.members?.full_name || 'Deleted Member');
        const memberPlan = sanitize(log.members?.plan ? log.members.plan.toUpperCase() : 'N/A');
        
        tr.innerHTML = `
          <td><strong>${memberName}</strong></td>
          <td>${memberPlan}</td>
          <td>${sanitize(dateStr)}</td>
          <td>${sanitize(timeStr)}</td>
        `;
        tableBody.appendChild(tr);
      });
      
    } catch (err) {
      console.error(err);
      tableBody.innerHTML = `<tr><td colspan="4" class="text-center" style="color: var(--accent-color);">Something went wrong.</td></tr>`;
    }
  }
  
  dateInput.addEventListener('change', loadLogs);
  loadLogs();
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('.admin-layout')) {
    initAdminPanel();
  }
});
