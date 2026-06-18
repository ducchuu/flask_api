import { api } from './api.js';

// -----------------------------------------------------------------------------
// Authentication & Session
// -----------------------------------------------------------------------------

export function checkAuth() {
    const token = localStorage.getItem('pulse_token');
    const isAuthPage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/';
    
    if (!token && !isAuthPage) {
        window.location.href = '/index.html';
        return false;
    }
    
    if (token && isAuthPage) {
        window.location.href = '/timeline.html';
        return false;
    }
    
    return true;
}

export function logout() {
    localStorage.removeItem('pulse_token');
    localStorage.removeItem('pulse_user');
    window.location.href = '/index.html';
}

export async function fetchCurrentUser() {
    try {
        const data = await api.get('/api/users/me');
        localStorage.setItem('pulse_user', JSON.stringify(data.user));
        return data.user;
    } catch (e) {
        console.error("Failed to fetch user profile", e);
        return null;
    }
}

// -----------------------------------------------------------------------------
// DOM Helpers & UI Feedback
// -----------------------------------------------------------------------------

export function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`; // type: 'success', 'error', 'warning', 'info'
    
    // Icon based on type
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';
    if (type === 'warning') icon = 'fa-exclamation-triangle';

    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
    
    container.appendChild(toast);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 3000);
}

export function renderSpinner(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = `
        <div class="card mb-4" style="pointer-events: none; border-color: rgba(255,255,255,0.05); box-shadow: none;">
            <div class="card-header">
                <div style="width: 100%;">
                    <div class="skeleton skeleton-title"></div>
                    <div class="flex gap-2">
                        <div class="skeleton skeleton-badge"></div>
                        <div class="skeleton skeleton-badge" style="width: 100px;"></div>
                    </div>
                </div>
            </div>
            <div class="card-body">
                <div class="skeleton skeleton-text"></div>
                <div class="skeleton skeleton-text"></div>
                <div class="skeleton skeleton-text short"></div>
            </div>
        </div>
        <div class="card mb-4" style="pointer-events: none; border-color: rgba(255,255,255,0.05); box-shadow: none;">
            <div class="card-header">
                <div style="width: 100%;">
                    <div class="skeleton skeleton-title" style="width: 60%;"></div>
                    <div class="flex gap-2">
                        <div class="skeleton skeleton-badge"></div>
                        <div class="skeleton skeleton-badge" style="width: 100px;"></div>
                    </div>
                </div>
            </div>
            <div class="card-body">
                <div class="skeleton skeleton-text"></div>
                <div class="skeleton skeleton-text short"></div>
            </div>
        </div>
    `;
}

export function renderEmptyState(containerId, message, iconClass = 'fa-inbox') {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = `
        <div class="empty-state">
            <i class="fas ${iconClass}"></i>
            <h3>Nothing to see here</h3>
            <p>${message}</p>
        </div>
    `;
}

// -----------------------------------------------------------------------------
// Initialization
// -----------------------------------------------------------------------------

export function initApp() {
    // Check auth on load
    if (!checkAuth()) return;

    // Bind common elements
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }

    // Set user info if available
    const userNameDisplay = document.getElementById('user-name-display');
    if (userNameDisplay) {
        const user = JSON.parse(localStorage.getItem('pulse_user') || '{}');
        if (user.username) {
            userNameDisplay.textContent = user.username;
        } else {
            // Fetch and set
            fetchCurrentUser().then(u => {
                if (u) userNameDisplay.textContent = u.username;
            });
        }
    }
}

// Run init on DOMContentLoaded
document.addEventListener('DOMContentLoaded', initApp);
