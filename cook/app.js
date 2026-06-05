const API = '../api';
let editingId = null;

// ================================
// UTILITIES
// ================================
function showMessage(elementId, text, type) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = text;
    el.className = `message ${type}`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 4000);
}

function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('el-GR') + ' ' + d.toLocaleTimeString('el-GR', {hour:'2-digit', minute:'2-digit'});
}

function getStatusBadge(status) {
    const map = {
        active:   ['badge-active',   'Ενεργή'],
        inactive: ['badge-inactive', 'Ανενεργή'],
        expired:  ['badge-inactive', 'Διεγραμμένη'],
        pending:  ['badge-pending',  'Εκκρεμεί'],
        approved: ['badge-approved', 'Εγκρίθηκε'],
        rejected: ['badge-rejected', 'Απορρίφθηκε'],
        pickedup: ['badge-pickedup', 'Παρελήφθη'],
        noshow:   ['badge-noshow',   'Δεν παρελήφθη'],
    };
    const [cls, label] = map[status] || ['', status];
    return `<span class="badge ${cls}">${label}</span>`;
}

function getSelectedAllergens() {
    return [...document.querySelectorAll('.allergens-grid input:checked')]
        .map(cb => cb.value);
}

// ================================
// ΠΌΝΤΟΙ ΧΡΗΣΤΗ
// ================================
async function loadPoints() {
    try {
        const res = await fetch(`${API}/auth.php?action=points`);
        const data = await res.json();
        const el = document.getElementById('user-points');
        if (el) el.textContent = data.points ?? '-';
    } catch (e) {
        console.error('Points error:', e);
    }
}

// ================================
// ΑΓΓΕΛΙΕΣ
// ================================
async function loadListings() {
    const container = document.getElementById('listings-container');
    if (!container) return;

    try {
        const res = await fetch(`${API}/listings.php`);
        const listings = await res.json();

        if (listings.length === 0) {
            container.innerHTML = '<p class="empty">Δεν έχεις δημιουργήσει αγγελίες ακόμα.</p>';
            return;
        }

        container.innerHTML = listings.map(l => {
            const allergens = JSON.parse(l.allergens || '[]');
            const isInactive = l.status === 'inactive';
            return `
                <div class="card ${isInactive ? 'inactive' : ''}" id="listing-${l.id}">
                    <div class="card-header">
                        <span class="card-title">${l.title}</span>
                        ${getStatusBadge(l.status)}
                    </div>
                    <div class="card-meta">
                        📍 ${l.pickup_location} &nbsp;|&nbsp;
                        🕐 ${l.pickup_time} &nbsp;|&nbsp;
                        🍽️ ${l.portions_available}/${l.portions} μερίδες
                    </div>
                    ${l.notes ? `<p style="font-size:0.9rem;color:#555">${l.notes}</p>` : ''}
                    ${allergens.length > 0 ? `<p style="font-size:0.8rem;color:#e65100;margin-top:0.3rem">⚠️ ${allergens.join(', ')}</p>` : ''}
                    <div class="card-meta">📅 ${formatDate(l.created_at)}</div>
                    <div class="card-actions">
                        <button class="btn-small btn-edit" onclick="openEdit(${l.id})">✏️ Επεξεργασία</button>
                        <button class="btn-small btn-delete" onclick="deleteListing(${l.id})">🗑️ Διαγραφή</button>
                    </div>
                </div>
            `;
        }).join('');

    } catch (e) {
        container.innerHTML = '<p class="empty">Σφάλμα φόρτωσης αγγελιών.</p>';
    }
}

// ================================
// ΔΗΜΙΟΥΡΓΙΑ ΑΓΓΕΛΙΑΣ
// ================================
const listingForm = document.getElementById('listing-form');
if (listingForm) {
    listingForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const data = {
            title:           document.getElementById('title').value,
            portions:        parseInt(document.getElementById('portions').value),
            pickup_location: document.getElementById('pickup-location').value,
            pickup_time:     document.getElementById('pickup-time').value,
            notes:           document.getElementById('notes').value,
            photo:           document.getElementById('photo').value,
            allergens:       getSelectedAllergens()
        };

        try {
            const res = await fetch(`${API}/listings.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();

            if (result.success) {
                showMessage('form-message', '✅ Η αγγελία δημιουργήθηκε επιτυχώς!', 'success');
                listingForm.reset();
            } else {
                showMessage('form-message', '❌ Σφάλμα κατά τη δημιουργία.', 'error');
            }
        } catch (e) {
            showMessage('form-message', '❌ Σφάλμα σύνδεσης με τον server.', 'error');
        }
    });
}

// ================================
// ΔΙΑΓΡΑΦΗ ΑΓΓΕΛΙΑΣ
// ================================
async function deleteListing(id) {
    if (!confirm('Σίγουρα θέλεις να διαγράψεις αυτή την αγγελία;')) return;

    try {
        const res = await fetch(`${API}/listings.php?id=${id}`, { method: 'DELETE' });
        const result = await res.json();

        if (result.success) {
            document.getElementById(`listing-${id}`)?.remove();
        }
    } catch (e) {
        alert('Σφάλμα κατά τη διαγραφή.');
    }
}

// ================================
// ΕΠΕΞΕΡΓΑΣΙΑ ΑΓΓΕΛΙΑΣ
// ================================
let allListings = [];

async function openEdit(id) {
    try {
        const res = await fetch(`${API}/listings.php`);
        allListings = await res.json();
        const l = allListings.find(x => x.id == id);
        if (!l) return;

        editingId = id;
        document.getElementById('edit-title').value    = l.title;
        document.getElementById('edit-portions').value = l.portions_available;
        document.getElementById('edit-location').value = l.pickup_location;
        document.getElementById('edit-time').value     = l.pickup_time;
        document.getElementById('edit-notes').value    = l.notes || '';

        // Τσεκάρισμα αλλεργιογόνων
        const allergens = JSON.parse(l.allergens || '[]');
        document.querySelectorAll('#edit-allergens-grid input').forEach(cb => {
            cb.checked = allergens.includes(cb.value);
        });

        document.getElementById('edit-modal').classList.remove('hidden');
    } catch (e) {
        alert('Σφάλμα φόρτωσης αγγελίας.');
    }
}

document.getElementById('cancel-edit-btn')?.addEventListener('click', () => {
    document.getElementById('edit-modal').classList.add('hidden');
    editingId = null;
});

document.getElementById('save-edit-btn')?.addEventListener('click', async () => {
    if (!editingId) return;

    const allergens = [...document.querySelectorAll('#edit-allergens-grid input:checked')]
        .map(cb => cb.value);

    const data = {
        title:              document.getElementById('edit-title').value,
        portions_available: parseInt(document.getElementById('edit-portions').value),
        pickup_location:    document.getElementById('edit-location').value,
        pickup_time:        document.getElementById('edit-time').value,
        notes:              document.getElementById('edit-notes').value,
        allergens
    };

    try {
        const res = await fetch(`${API}/listings.php?id=${editingId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();

        if (result.success) {
            document.getElementById('edit-modal').classList.add('hidden');
            editingId = null;
            loadListings();
        } else {
            showMessage('edit-message', '❌ Σφάλμα αποθήκευσης.', 'error');
        }
    } catch (e) {
        showMessage('edit-message', '❌ Σφάλμα σύνδεσης.', 'error');
    }
});

// ================================
// ΑΙΤΗΜΑΤΑ
// ================================
async function loadRequests() {
    const container = document.getElementById('requests-container');
    if (!container) return;

    try {
        const res = await fetch(`${API}/requests.php?action=mine`);
        const requests = await res.json();

        if (requests.length === 0) {
            container.innerHTML = '<p class="empty">Δεν υπάρχουν αιτήματα ακόμα.</p>';
            return;
        }

        container.innerHTML = requests.map(r => `
            <div class="card" id="request-${r.id}">
                <div class="card-header">
                    <span class="card-title">👤 ${r.consumer_name}</span>
                    ${getStatusBadge(r.status)}
                </div>
                <div class="card-meta">
                    🍽️ ${r.listing_title} &nbsp;|&nbsp;
                    📅 ${formatDate(r.created_at)}
                </div>
                <div class="card-actions">
                    ${r.status === 'pending' ? `
                        <button class="btn-small btn-approve" onclick="handleRequest(${r.id}, 'approve')">✅ Αποδοχή</button>
                        <button class="btn-small btn-reject"  onclick="handleRequest(${r.id}, 'reject')">❌ Απόρριψη</button>
                    ` : ''}
                    ${r.status === 'approved' ? `
                        <button class="btn-small btn-pickup" onclick="handleRequest(${r.id}, 'pickup')">📦 Παρελήφθη</button>
                        <button class="btn-small btn-noshow" onclick="handleRequest(${r.id}, 'noshow')">🚫 Δεν παρελήφθη</button>
                    ` : ''}
                </div>
            </div>
        `).join('');

    } catch (e) {
        container.innerHTML = '<p class="empty">Σφάλμα φόρτωσης αιτημάτων.</p>';
    }
}

async function handleRequest(id, action) {
    try {
        const res = await fetch(`${API}/requests.php?action=${action}&id=${id}`, {
            method: 'POST'
        });
        const result = await res.json();

        if (result.success) {
            loadRequests();
            loadPoints();
        }
    } catch (e) {
        alert('Σφάλμα επεξεργασίας αιτήματος.');
    }
}

// ================================
// INIT
// ================================
document.addEventListener('DOMContentLoaded', () => {
    loadPoints();
    loadListings();
    loadRequests();
});