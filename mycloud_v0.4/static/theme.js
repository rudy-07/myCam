/**
 * 
 * theme.js
 * Handles theme (Light/Dark) and Accent color application.
 */

const ThemeManager = {
    init: function() {
        this.applyStoredPreferences();
        this.setupListeners();
    },

    applyStoredPreferences: function() {
        const storedTheme = localStorage.getItem('mycloud_theme') || 'light';
        const storedAccent = localStorage.getItem('mycloud_accent') || 'blue';
        const storedDensity = localStorage.getItem('mycloud_density') || 'default';

        document.documentElement.setAttribute('data-theme', storedTheme);
        document.documentElement.setAttribute('data-density', storedDensity);
        
        // Handle Accent
        if (storedAccent.startsWith('#')) {
            document.documentElement.setAttribute('data-accent', 'custom');
            document.documentElement.style.setProperty('--custom-primary', storedAccent);
        } else {
            document.documentElement.setAttribute('data-accent', storedAccent);
            document.documentElement.style.removeProperty('--custom-primary');
        }

        // Update toggle buttons state if they exist
        this.updateUIState(storedTheme, storedAccent, storedDensity);
    },

    setTheme: function(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('mycloud_theme', theme);
        this.updateUIState(theme, null, null);
    },
    

    setAccent: function(accent) {
        if (accent.startsWith('#')) {
            document.documentElement.setAttribute('data-accent', 'custom');
            document.documentElement.style.setProperty('--custom-primary', accent);
        } else {
            document.documentElement.setAttribute('data-accent', accent);
            document.documentElement.style.removeProperty('--custom-primary');
        }
        localStorage.setItem('mycloud_accent', accent);
        this.updateUIState(null, accent, null);
    },

    setDensity: function(density) {
        document.documentElement.setAttribute('data-density', density);
        localStorage.setItem('mycloud_density', density);
        this.updateUIState(null, null, density);
    },

    toggleTheme: function() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    },

    updateUIState: function(theme, accent, density) {
        // Theme buttons
        if (theme) {
            document.querySelectorAll('[data-action="set-theme"]').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.value === theme);
            });
        }
        
        // Accent buttons
        if (accent) {
            document.querySelectorAll('[data-action="set-accent"]').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.value === accent);
            });
            
            // Sync Custom Inputs
            const picker = document.getElementById('custom-color-picker');
            const hexInput = document.getElementById('custom-color-hex');
            if (accent.startsWith('#')) {
                if(picker) picker.value = accent;
                if(hexInput) hexInput.value = accent;
            }
        }

        // Density buttons
        if (density) {
            document.querySelectorAll('[data-action="set-density"]').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.value === density);
            });
        }
    },

    setupListeners: function() {
        document.addEventListener('click', (e) => {
            const themeBtn = e.target.closest('[data-action="set-theme"]');
            if (themeBtn) {
                this.setTheme(themeBtn.dataset.value);
            }

            const accentBtn = e.target.closest('[data-action="set-accent"]');
            if (accentBtn) {
                this.setAccent(accentBtn.dataset.value);
            }

            const densityBtn = e.target.closest('[data-action="set-density"]');
            if (densityBtn) {
                this.setDensity(densityBtn.dataset.value);
            }
            
            // Custom Color Apply Button
            if (e.target.id === 'apply-custom-color-btn') {
                const hexInput = document.getElementById('custom-color-hex');
                if (hexInput && hexInput.value.startsWith('#')) {
                    this.setAccent(hexInput.value);
                }
            }
        });

        // Custom Color Picker Change
        const picker = document.getElementById('custom-color-picker');
        if (picker) {
            picker.addEventListener('input', (e) => {
                const hexInput = document.getElementById('custom-color-hex');
                if (hexInput) hexInput.value = e.target.value;
            });
            picker.addEventListener('change', (e) => {
                 this.setAccent(e.target.value);
            });
        }
        
        // Custom Hex Input Enter Key
        const hexInput = document.getElementById('custom-color-hex');
        if (hexInput) {
            hexInput.addEventListener('change', (e) => {
                let val = e.target.value;
                if (!val.startsWith('#')) val = '#' + val;
                if (/^#[0-9A-F]{6}$/i.test(val)) {
                    this.setAccent(val);
                }
            });
        }
    }
};

// Initialize on load
// We run applyStoredPreferences immediately if possible to prevent FOUC, 
// but setupListeners needs DOM.
ThemeManager.applyStoredPreferences();

document.addEventListener('DOMContentLoaded', () => {
    ThemeManager.setupListeners();
    // Re-apply to ensure UI state is correct after DOM load
    const storedTheme = localStorage.getItem('mycloud_theme') || 'light';
    const storedAccent = localStorage.getItem('mycloud_accent') || 'blue';
    const storedDensity = localStorage.getItem('mycloud_density') || 'default';
    ThemeManager.updateUIState(storedTheme, storedAccent, storedDensity);
    
    // Initialize UI Manager
    UIManager.init();
    
    // Initialize Flash Messages
    UIManager.setupFlashMessages();
});

const UIManager = {
    init: function() {
        this.setupDropdownListeners();
        this.setupOutsideClickListener();
        this.fetchNotifications();
    },

    setupFlashMessages: function() {
        const messages = document.querySelectorAll('.message');
        if (messages.length > 0) {
            setTimeout(() => {
                messages.forEach(msg => {
                    msg.style.transition = 'opacity 0.5s ease-out';
                    msg.style.opacity = '0';
                    setTimeout(() => {
                        msg.remove();
                    }, 500); // Wait for transition to finish
                });
            }, 4000); // 4 seconds delay
        }
    },

    setupDropdownListeners: function() {
        // Notification Bell
        const notifBell = document.querySelector('.notification-bell');
        if (notifBell) {
            notifBell.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                // Toggle Dropdown with specific width
                this.toggleDropdown('notification-dropdown', notifBell, '320px');
                
                // We no longer automatically mark as read when opening.
                // User must explicitely clear them.
            });
        }

        // User Profile
        const userProfile = document.querySelector('.user-profile');
        if (userProfile) {
            userProfile.addEventListener('click', (e) => {
                // Allow links to work
                if (e.target.closest('a') || e.target.closest('button')) {
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                this.toggleDropdown('profile-dropdown', userProfile, '280px');
            });
        }
    },

    toggleDropdown: function(id, triggerBtn, width = '160px') {
        const dropdown = document.getElementById(id);
        if (!dropdown) return;
        
        const wasOpen = dropdown.classList.contains('show');
        this.closeAllDropdowns();
        
        if (!wasOpen) {
            // Anti-flicker: Hide it initially using visibility
            dropdown.style.visibility = 'hidden';
            dropdown.classList.add('show');

            // FORCE REFLOW
            void dropdown.offsetWidth;
            
            if (triggerBtn) {
                const rect = triggerBtn.getBoundingClientRect();
                dropdown.style.position = 'fixed';
                dropdown.style.zIndex = '2147483647';
                dropdown.style.width = width; 
                
                // Position logic (Drop DOWN, Align RIGHT)
                const dropdownWidth = parseInt(width); // assumes 'px'
                
                // Vertical
                dropdown.style.top = (rect.bottom + 8) + 'px';
                dropdown.style.bottom = 'auto'; // Reset
                dropdown.classList.remove('drop-up');

                // Horizontal (Align Right edge with Trigger Right edge)
                let leftPos = rect.right - dropdownWidth;
                
                // Safety check: don't go off-screen left
                if (leftPos < 10) leftPos = 10;
                
                dropdown.style.left = leftPos + 'px';
                
                // FORCE REFLOW AGAIN
                void dropdown.offsetWidth;

                // Move off-screen override reset
                // formatting handled by left/top application
            }

            // Reveal
            dropdown.style.visibility = 'visible';
            dropdown.style.opacity = '1';
        }
    },

    closeAllDropdowns: function() {
        document.querySelectorAll('.dropdown-content.show').forEach(el => {
            el.classList.remove('show');
            // Reset styles to defaults (mostly specifically visibility to ensure cleaner re-opening)
            el.style.visibility = '';
            el.style.opacity = '';
        });
    },

    setupOutsideClickListener: function() {
        window.addEventListener('click', (e) => {
            // Close dropdowns if clicking outside
            if (!e.target.closest('.notification-bell') && !e.target.closest('.user-profile') && !e.target.closest('.dropdown-content')) {
                this.closeAllDropdowns();
            }
        });
    },

    // Notification Logic
    notificationIds: [],

    fetchNotifications: async function() {
        try {
            const response = await fetch('/api/notifications');
            if (response.ok) {
                const notifications = await response.json();
                this.updateNotificationUI(notifications);
            }
        } catch (error) {
            console.error("Error fetching notifications:", error);
        }
    },

    updateNotificationUI: function(notifications) {
        const badge = document.querySelector('.notification-badge');
        const list = document.querySelector('.notification-list');
        const footer = document.querySelector('.notification-footer');
        
        if (!list || !badge) return;

        this.notificationIds = []; // Sync with current view
        
        if (notifications.length > 0) {
            badge.textContent = notifications.length;
            badge.style.display = 'flex';
            list.innerHTML = '';
            
            notifications.forEach(n => {
                const item = document.createElement('div'); // Changed to div for easier layout control
                item.className = 'notification-item';
                
                // Content
                const content = document.createElement('a'); 
                content.className = 'notification-content';
                content.href = n.link_url || '#';
                content.innerHTML = `<div>${n.message}</div><small>${n.created_at}</small>`;
                content.style.textDecoration = 'none';
                content.style.color = 'inherit';

                // Close Button
                const closeBtn = document.createElement('button');
                closeBtn.className = 'notification-close-btn';
                closeBtn.innerHTML = '<i class="fas fa-times"></i>';
                closeBtn.title = 'Clear notification';
                closeBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.clearNotification(n.id, item);
                };

                item.appendChild(content);
                item.appendChild(closeBtn);
                list.appendChild(item);
                
                this.notificationIds.push(n.id);
            });
            
            if (footer) {
                footer.textContent = 'Clear all notifications';
                footer.style.cursor = 'pointer';
                footer.onclick = () => this.markNotificationsAsRead(); // Logic name kept, but UI implies "Clear All"
            }
        } else {
            badge.style.display = 'none';
            list.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-muted); font-size:14px;">No new notifications</div>';
            if (footer) {
                footer.textContent = '';
                footer.onclick = null;
                footer.style.cursor = 'default';
            }
        }
    },

    // Clear a single notification
    clearNotification: async function(id, element) {
        try {
            await fetch('/api/notifications/mark_read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: [id] })
            });
            
            // Remove from DOM
            if (element) {
                element.remove();
            }
            
            // Update local ID list
            this.notificationIds = this.notificationIds.filter(nid => nid !== id);
            
            // Update Badge
            const badge = document.querySelector('.notification-badge');
            if (badge) {
                const count = this.notificationIds.length;
                badge.textContent = count;
                if (count === 0) {
                    badge.style.display = 'none';
                    // Update list to show "No new notifications"
                    const list = document.querySelector('.notification-list');
                    if (list) list.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-muted); font-size:14px;">No new notifications</div>';
                    
                    const footer = document.querySelector('.notification-footer');
                    if (footer) {
                        footer.textContent = '';
                        footer.onclick = null;
                        footer.style.cursor = 'default';
                    }
                }
            }
        } catch (e) {
            console.error(e);
        }
    },

    // Clear ALL notifications
    markNotificationsAsRead: async function() {
        if (this.notificationIds.length === 0) return;

        try {
            await fetch('/api/notifications/mark_read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: this.notificationIds })
            });

            // Clear UI immediately
            const badge = document.querySelector('.notification-badge');
            if (badge) badge.style.display = 'none';
            
            const list = document.querySelector('.notification-list');
            if (list) list.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-muted); font-size:14px;">No new notifications</div>';
            
            const footer = document.querySelector('.notification-footer');
            if (footer) {
                footer.textContent = 'Notifications cleared';
                footer.onclick = null;
                footer.style.cursor = 'default';
                setTimeout(() => {
                    if(footer.textContent === 'Notifications cleared') footer.textContent = '';
                }, 2000);
            }
            
            this.notificationIds = []; 
        } catch (e) {
            console.error(e);
        }
    }
};

// ... (window.toggleDropdown remains)

// Global toggleDropdown for Kebab menus (using window to be accessible from inline HTML)
    // Global toggleDropdown for Kebab menus (using window to be accessible from inline HTML)
window.toggleDropdown = function(event, idSuffix) {
    if (event) {
        event.preventDefault(); 
        event.stopPropagation();
    }
    
    const dropdown = document.getElementById('dropdown-' + idSuffix);
    if (!dropdown) {
        console.warn('Dropdown not found for idSuffix:', idSuffix);
        return;
    }

    const wasOpen = dropdown.classList.contains('show');
    
    UIManager.closeAllDropdowns();
    
    // Anti-flicker: Hide it initially using visibility to avoid FOUC
    dropdown.style.visibility = 'hidden';
    dropdown.classList.add('show');

    // FORCE REFLOW: Reading offsetWidth forces the browser to calculate layout immediately
    // This ensures the browser knows the element is there (for dimensions) but hidden
    void dropdown.offsetWidth;

    // Use Fixed Positioning for ALL dropdowns to escape overflow containers
    let btn = null;
    if (event) {
        btn = event.currentTarget || (event.target ? event.target.closest('button') || event.target.closest('.user-profile') || event.target.closest('.notification-bell') : null);
    }
    
    if (btn) {
        const rect = btn.getBoundingClientRect();
        dropdown.style.position = 'fixed';
        dropdown.style.zIndex = '2147483647'; // Max Z-Index
        dropdown.style.width = '160px'; // Standard width
        
        const spaceBelow = window.innerHeight - rect.bottom;
        // Estimate height based on children or default
        const dropdownHeight = dropdown.scrollHeight > 50 ? dropdown.scrollHeight : 200; 
        
        if (spaceBelow < dropdownHeight) {
            // Drop UP
            dropdown.style.top = 'auto';
            dropdown.style.bottom = (window.innerHeight - rect.top + 5) + 'px';
            dropdown.classList.add('drop-up');
        } else {
            // Drop DOWN
            dropdown.style.bottom = 'auto';
            dropdown.style.top = (rect.bottom + 5) + 'px';
            dropdown.classList.remove('drop-up');
        }

        // Align right edge with button
        let leftPos = rect.right - 160;
        
        // Ensure it doesn't go off screen left
        if (leftPos < 10) leftPos = 10;
        
        dropdown.style.left = leftPos + 'px';
        
        // FORCE REFLOW AGAIN: Ensure the new position is registered before revealing
        void dropdown.offsetWidth;

        // Synchronous Reveal
        dropdown.style.visibility = 'visible';
        dropdown.style.opacity = '1'; 
        
    } else {
        console.warn('Button trigger not found for dropdown positioning');
        // Fallback reveal
        dropdown.style.visibility = 'visible';
        dropdown.style.opacity = '1';
    }
};

// Make UIManager and ThemeManager global
window.UIManager = UIManager;
window.ThemeManager = ThemeManager;
// window.toggleDropdown is already defined above with specific logic for kebab menus
window.closeAllDropdowns = function() { UIManager.closeAllDropdowns(); };
window.toggleTheme = function() { ThemeManager.toggleTheme(); };

// Global closeAllDropdowns to match the usage in templates
window.closeAllDropdowns = function() {
    UIManager.closeAllDropdowns();
};
