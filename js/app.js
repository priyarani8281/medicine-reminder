// ==================== MAIN APPLICATION ====================
// Core application logic and coordination

const app = {
    currentSection: 'dashboard',
    weekOffset: 0,
    // ==================== AUTHENTICATION CHECK ====================
    checkAuth() {
        const session = localStorage.getItem('medreminder_session') || 
                    sessionStorage.getItem('medreminder_session');
        
        if (!session) {
            // Not logged in, redirect to login page
            window.location.href = 'login.html';
            return false;
        }
        
        try {
            const sessionData = JSON.parse(session);
            this.currentUser = sessionData;
            return true;
        } catch (error) {
            console.error('Invalid session:', error);
            window.location.href = 'login.html';
            return false;
        }
    },

    logout() {
        if (Utils.confirmAction('Are you sure you want to logout?')) {
            localStorage.removeItem('medreminder_session');
            sessionStorage.removeItem('medreminder_session');
            window.location.href = 'login.html';
        }
    },
    // Initialize application
    async init() {
        console.log('Initializing Medicine Reminder Pro...');

        // CHECK AUTHENTICATION FIRST
        if (!this.checkAuth()) {
            return; // Stop initialization if not authenticated
        }
        try {
            // Wait for DataStore to be ready
            await DataStore.init();

            // Initialize all modules
            await this.initializeModules();

            // Setup event listeners
            this.setupEventListeners();

            // Load initial data
            await this.loadInitialData();

            // Setup auto-refresh
            this.setupAutoRefresh();

            // Apply theme
            this.applyTheme();

            console.log('Application initialized successfully!');

            // Hide loading page after everything is loaded
            setTimeout(() => {
                const loadingPage = document.getElementById('loadingPage');
                if (loadingPage) {
                    loadingPage.classList.add('hide');
                    // Remove from DOM after animation completes
                    setTimeout(() => {
                        loadingPage.remove();
                    }, 500);
                }
            }, 1500); // Show loading for at least 1.5 seconds

        } catch (error) {
            console.error('Initialization error:', error);
            // Hide loading page even if there's an error
            const loadingPage = document.getElementById('loadingPage');
            if (loadingPage) {
                loadingPage.classList.add('hide');
            }
        }
    },

    // Initialize all modules
    async initializeModules() {
        // These are initialized in their respective files
        // Just check they're ready
        if (window.NotificationManager) {
            await NotificationManager.init();
        }

        if (window.MedicineManager) {
            MedicineManager.init();
        }

        if (window.VoiceManager) {
            VoiceManager.init();
        }

        if (window.AnalyticsManager) {
            AnalyticsManager.init();
        }

        if (window.AchievementManager) {
            await AchievementManager.init();
        }
    },

    // Setup event listeners
    setupEventListeners() {
        // Navigation
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect) {
            themeSelect.addEventListener('change', async (e) => {
                const theme = e.target.value;
                await DataStore.saveSetting('theme', theme);
                this.applyTheme();
            });
        }
        const navButtons = document.querySelectorAll('.nav-btn');
        navButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = e.currentTarget.dataset.section;
                this.showSection(section);
            });
        });

        // Window events
        window.addEventListener('online', () => {
            Utils.showToast('✅ Back online', 'success');
        });

        window.addEventListener('offline', () => {
            Utils.showToast('⚠️ You are offline', 'warning');
        });

        // Before unload - remind about pending doses
        window.addEventListener('beforeunload', async (e) => {
            const stats = await DataStore.getTodayStats();
            if (stats.pending > 0) {
                e.preventDefault();
                e.returnValue = `You have ${stats.pending} pending dose(s) today. Are you sure you want to leave?`;
            }
        });
    },

    // Load initial data
    async loadInitialData() {
        await this.updateDashboard();
        await this.updateHeaderStats();
        this.updateWelcomeMessage();
    },

    // Setup auto-refresh (every 5 minutes)
    setupAutoRefresh() {
        setInterval(async () => {
            await this.updateDashboard();
            await this.updateHeaderStats();
        }, 5 * 60 * 1000);
    },

    // Show section
    showSection(sectionName) {
        // Hide all sections
        const sections = document.querySelectorAll('.section');
        sections.forEach(section => section.classList.remove('active'));

        // Show selected section
        const targetSection = document.getElementById(sectionName);
        if (targetSection) {
            targetSection.classList.add('active');
        }

        // Update navigation
        const navButtons = document.querySelectorAll('.nav-btn');
        navButtons.forEach(btn => {
            if (btn.dataset.section === sectionName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        this.currentSection = sectionName;

        // Load section-specific data
        this.loadSectionData(sectionName);

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    // Load section-specific data
    async loadSectionData(sectionName) {
        switch (sectionName) {
            case 'dashboard':
                await this.updateDashboard();
                break;

            case 'medicines':
                if (window.MedicineManager) {
                    MedicineManager.loadMedicines(MedicineManager.currentFilter);
                }
                break;

            case 'schedule':
                await this.loadScheduleView();
                break;

            case 'analytics':
                if (window.AnalyticsManager) {
                    await AnalyticsManager.refreshCharts();
                }
                break;

            case 'achievements':
                if (window.AchievementManager) {
                    await AchievementManager.refresh();
                }
                break;
            case 'emergency':
                await this.loadEmergencyContacts();
                await this.loadMedicalInfo();
                break;

            case 'settings':
                await this.loadSettings();
                break;
        }
    },

    // Update dashboard
    async updateDashboard() {
        await this.loadTodaySchedule();
        await this.loadUpcomingReminders();
        await this.updateQuickStats();
    },

    // Update header statistics
    async updateHeaderStats() {
        const medicines = await DataStore.getMedicines('active');
        const todayStats = await DataStore.getTodayStats();
        const last30Days = Utils.addDaysToDate(Utils.getCurrentDate(), -30);
        const adherenceRate = await DataStore.getAdherenceRate(last30Days, Utils.getCurrentDate());

        // Calculate streak
        const allSchedules = await DataStore.getAll('schedule');
        const streak = window.AchievementManager ? 
            await AchievementManager.calculateCurrentStreak() : 0;

        // Update UI
        document.getElementById('totalMeds').textContent = medicines.length;
        document.getElementById('todayDoses').textContent = todayStats.total;
        document.getElementById('adherenceRate').textContent = Math.round(adherenceRate) + '%';
        document.getElementById('streak').textContent = streak;
    },
    // Wellcome messsage
    updateWelcomeMessage() {
        const message = document.getElementById('welcomeMessage');
        if (message) {
            const greeting = Utils.getGreeting();
            const userName = this.currentUser ? this.currentUser.name : 'there';
            const motivational = Utils.getMotivationalMessage();
            message.textContent = `${greeting}, ${userName}! ${motivational}`;
        }
    },

    // Load today's schedule
    async loadTodaySchedule() {
        const container = document.getElementById('todaySchedule');
        if (!container) return;

        const today = Utils.getCurrentDate();
        const schedules = await DataStore.getScheduleByDate(today);

        if (schedules.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #718096;">
                    <p style="font-size: 2rem;">📅</p>
                    <p>No medicines scheduled for today</p>
                </div>
            `;
            return;
        }

        // Sort by time
        schedules.sort((a, b) => a.time.localeCompare(b.time));

        container.innerHTML = schedules.map(schedule => `
            <div class="schedule-time ${schedule.status}" style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong>${Utils.formatTime(schedule.time)}</strong> - ${schedule.medicineName} (${schedule.dosage})
                    <br>
                    <small style="color: #718096;">Status: ${Utils.capitalize(schedule.status)}</small>
                </div>
                ${schedule.status === 'pending' ? `
                    <button class="btn btn-success" style="padding: 0.5rem 1rem;" onclick="app.markScheduleTaken('${schedule.id}')">
                        ✓ Take
                    </button>
                ` : ''}
            </div>
        `).join('');
    },

    // Load upcoming reminders
    async loadUpcomingReminders() {
        const container = document.getElementById('upcomingReminders');
        if (!container) return;

        const today = Utils.getCurrentDate();
        const schedules = await DataStore.getScheduleByDate(today);
        const currentTime = Utils.getCurrentTime();

        // Get upcoming reminders (next 4 hours)
        const upcoming = schedules.filter(schedule => {
            if (schedule.status !== 'pending') return false;
            const timeDiff = Utils.getTimeDifference(schedule.time, currentTime);
            return timeDiff >= 0 && timeDiff <= 240; // Next 4 hours
        }).slice(0, 5);

        if (upcoming.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #718096;">
                    <p style="font-size: 2rem;">⏰</p>
                    <p>No upcoming reminders</p>
                </div>
            `;
            return;
        }

        container.innerHTML = upcoming.map(schedule => {
            const timeDiff = Utils.getTimeDifference(schedule.time, currentTime);
            const minutesText = timeDiff === 0 ? 'Now' : `in ${timeDiff} min`;

            return `
                <div class="schedule-time" style="background: ${schedule.critical ? '#fff5f5' : 'white'};">
                    <strong>${Utils.formatTime(schedule.time)}</strong> (${minutesText})
                    <br>
                    ${schedule.medicineName} - ${schedule.dosage}
                    ${schedule.critical ? '<br><span style="color: var(--danger);">⚠️ Critical</span>' : ''}
                </div>
            `;
        }).join('');
    },

    // Update quick stats
    async updateQuickStats() {
        const todayStats = await DataStore.getTodayStats();
        const allSchedules = await DataStore.getAll('schedule');
        const takenSchedules = allSchedules.filter(s => s.status === 'taken');

        // Calculate average time deviation
        let totalDeviation = 0;
        let count = 0;

        for (let schedule of takenSchedules) {
            if (schedule.takenAt) {
                const scheduledTime = new Date(`${schedule.date}T${schedule.time}`);
                const takenTime = new Date(schedule.takenAt);
                const diffMinutes = Math.abs((takenTime - scheduledTime) / (1000 * 60));
                totalDeviation += diffMinutes;
                count++;
            }
        }

        const avgDeviation = count > 0 ? Math.round(totalDeviation / count) : 0;

        // Update UI
        document.getElementById('completionToday').textContent = Math.round(todayStats.completion) + '%';
        document.getElementById('totalDosesTaken').textContent = takenSchedules.length;
        document.getElementById('avgTimeTaken').textContent = avgDeviation + 'm';
    },

    // Mark schedule as taken
    async markScheduleTaken(scheduleId) {
        await DataStore.markScheduleTaken(scheduleId);
        Utils.showToast('✅ Medicine marked as taken!', 'success');
        
        await this.updateDashboard();
        await this.updateHeaderStats();

        // Check achievements
        if (window.AchievementManager) {
            await AchievementManager.checkAchievements();
        }
    },

    // Mark all today's pending doses as taken
    async markAllTodayTaken() {
        if (!Utils.confirmAction('Mark all pending doses for today as taken?')) {
            return;
        }

        const today = Utils.getCurrentDate();
        const schedules = await DataStore.getScheduleByDate(today);
        const pending = schedules.filter(s => s.status === 'pending');

        for (let schedule of pending) {
            await DataStore.markScheduleTaken(schedule.id);
        }

        Utils.showToast(`✅ ${pending.length} dose(s) marked as taken!`, 'success');
        
        await this.updateDashboard();
        await this.updateHeaderStats();

        if (window.AchievementManager) {
            await AchievementManager.checkAchievements();
        }
    },

    // Load schedule view
    async loadScheduleView() {
        const container = document.getElementById('scheduleView');
        const weekLabel = document.getElementById('currentWeek');
        
        if (!container) return;

        // Update week label
        if (weekLabel) {
            weekLabel.textContent = Utils.getWeekLabel(this.weekOffset);
        }

        const weekDates = Utils.getWeekDates(this.weekOffset);
        
        container.innerHTML = weekDates.map(date => {
            return `
                <div class="day-schedule">
                    <h3>${Utils.getDayOfWeek(date)}</h3>
                    <p style="font-size: 0.9rem; color: #718096; margin-bottom: 1rem;">
                        ${Utils.formatDate(date)}
                    </p>
                    <div id="schedule-${date}"></div>
                </div>
            `;
        }).join('');

        // Load schedules for each day
        for (let date of weekDates) {
            const dayContainer = document.getElementById(`schedule-${date}`);
            const schedules = await DataStore.getScheduleByDate(date);

            if (schedules.length === 0) {
                dayContainer.innerHTML = '<p style="font-size: 0.85rem; color: #718096;">No doses</p>';
                continue;
            }

            dayContainer.innerHTML = schedules.map(schedule => `
                <div class="schedule-time ${schedule.status}">
                    <small>${Utils.formatTime(schedule.time)}</small><br>
                    <strong style="font-size: 0.85rem;">${schedule.medicineName}</strong>
                </div>
            `).join('');
        }

        // Update summary
        await this.updateScheduleSummary();
    },

    // Update schedule summary
    async updateScheduleSummary() {
        const container = document.getElementById('scheduleSummary');
        if (!container) return;

        const weekDates = Utils.getWeekDates(this.weekOffset);
        const startDate = weekDates[0];
        const endDate = weekDates[6];

        const schedules = await DataStore.getScheduleByDateRange(startDate, endDate);
        
        const total = schedules.length;
        const taken = schedules.filter(s => s.status === 'taken').length;
        const missed = schedules.filter(s => s.status === 'missed').length;
        const pending = schedules.filter(s => s.status === 'pending').length;

        container.innerHTML = `
            <div class="stat-item">
                <span class="stat-icon">📊</span>
                <span class="stat-value">${total}</span>
                <span class="stat-label">Total Doses</span>
            </div>
            <div class="stat-item">
                <span class="stat-icon">✅</span>
                <span class="stat-value">${taken}</span>
                <span class="stat-label">Taken</span>
            </div>
            <div class="stat-item">
                <span class="stat-icon">❌</span>
                <span class="stat-value">${missed}</span>
                <span class="stat-label">Missed</span>
            </div>
            <div class="stat-item">
                <span class="stat-icon">⏳</span>
                <span class="stat-value">${pending}</span>
                <span class="stat-label">Pending</span>
            </div>
        `;
    },

    // Change week
    async changeWeek(offset) {
        this.weekOffset += offset;
        await this.loadScheduleView();
    },

    // Load emergency contacts
    async loadEmergencyContacts() {
        const container = document.getElementById('emergencyList');
        if (!container) return;

        const contacts = await DataStore.getEmergencyContacts();

        if (contacts.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #718096;">
                    <p>No emergency contacts added yet</p>
                </div>
            `;
            return;
        }

        container.innerHTML = contacts.map(contact => `
            <div class="emergency-contact">
                <div class="emergency-contact-info">
                    <h3>${contact.name}</h3>
                    <p>${contact.phone}</p>
                    <p style="text-transform: capitalize;">${contact.relation}</p>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="call-btn" onclick="app.callContact('${contact.phone}')">
                        📞 Call
                    </button>
                    <button class="btn btn-danger" onclick="app.deleteEmergencyContact('${contact.id}')">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');
    },

    // Save emergency contact
    async saveEmergencyContact() {
        const name = document.getElementById('emergencyName').value.trim();
        const phone = document.getElementById('emergencyPhone').value.trim();
        const relation = document.getElementById('emergencyRelation').value;

        if (!name || !phone) {
            Utils.showToast('Please fill in all fields', 'error');
            return;
        }

        if (!Utils.validatePhone(phone)) {
            Utils.showToast('Please enter a valid phone number', 'error');
            return;
        }

        await DataStore.addEmergencyContact({ name, phone, relation });
        
        Utils.showToast('✅ Emergency contact saved!', 'success');
        
        // Clear form
        document.getElementById('emergencyName').value = '';
        document.getElementById('emergencyPhone').value = '';
        
        await this.loadEmergencyContacts();

        // Check achievements
        if (window.AchievementManager) {
            await AchievementManager.checkAchievements();
        }
    },

    // Delete emergency contact
    async deleteEmergencyContact(id) {
        if (!Utils.confirmAction('Delete this emergency contact?')) {
            return;
        }

        await DataStore.deleteEmergencyContact(id);
        Utils.showToast('✅ Contact deleted', 'success');
        await this.loadEmergencyContacts();
    },

    // Call contact
    callContact(phone) {
        window.location.href = `tel:${phone}`;
    },

    // Load medical info
    async loadMedicalInfo() {
        const info = await DataStore.getAllMedicalInfo();

        if (info.bloodType) {
            document.getElementById('bloodType').value = info.bloodType;
        }
        if (info.allergies) {
            document.getElementById('allergies').value = info.allergies;
        }
        if (info.conditions) {
            document.getElementById('conditions').value = info.conditions;
        }
    },

    // Save medical info
    async saveMedicalInfo() {
        const bloodType = document.getElementById('bloodType').value;
        const allergies = document.getElementById('allergies').value.trim();
        const conditions = document.getElementById('conditions').value.trim();

        await DataStore.saveMedicalInfo('bloodType', bloodType);
        await DataStore.saveMedicalInfo('allergies', allergies);
        await DataStore.saveMedicalInfo('conditions', conditions);

        Utils.showToast('✅ Medical information saved!', 'success');
    },

    // Find nearby pharmacies
    findNearbyPharmacies() {
        const resultsContainer = document.getElementById('locationResults');
        
        if (!navigator.geolocation) {
            Utils.showToast('Geolocation is not supported by your browser', 'error');
            return;
        }

        Utils.showLoading(true);
        resultsContainer.innerHTML = '<p>Getting your location...</p>';

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                
                // Open Google Maps with nearby pharmacies
                const url = `https://www.google.com/maps/search/pharmacies/@${latitude},${longitude},15z`;
                window.open(url, '_blank');
                
                resultsContainer.innerHTML = `
                    <p style="color: var(--success);">✅ Opening Google Maps...</p>
                    <p style="font-size: 0.9rem; color: #718096; margin-top: 0.5rem;">
                        Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}
                    </p>
                `;
                
                Utils.showLoading(false);
            },
            (error) => {
                console.error('Geolocation error:', error);
                Utils.showToast('Unable to get your location', 'error');
                resultsContainer.innerHTML = '<p style="color: var(--danger);">Unable to get location</p>';
                Utils.showLoading(false);
            }
        );
    },

    // Load settings
    async loadSettings() {
        const settings = await DataStore.getAllSettings();

        document.getElementById('notificationEnabled').checked = settings.notificationEnabled ?? true;
        document.getElementById('soundEnabled').checked = settings.soundEnabled ?? true;
        document.getElementById('vibrationEnabled').checked = settings.vibrationEnabled ?? true;
        document.getElementById('reminderAdvance').value = settings.reminderAdvance ?? 15;
        document.getElementById('voiceEnabled').checked = settings.voiceEnabled ?? true;
        document.getElementById('themeSelect').value = settings.theme ?? 'light';
    // Display user email
        const userEmailElement = document.getElementById('userEmail');
        if (userEmailElement && this.currentUser) {
            userEmailElement.textContent = this.currentUser.email;
        }
    },
    // Save settings
    async saveSettings() {
        const settings = {
            enabled: document.getElementById('notificationEnabled').checked,
            sound: document.getElementById('soundEnabled').checked,
            vibration: document.getElementById('vibrationEnabled').checked,
            advanceTime: parseInt(document.getElementById('reminderAdvance').value)
        };

        // Save notification settings
        if (window.NotificationManager) {
            await NotificationManager.saveSettings(settings);
        }

        // Save voice setting
        const voiceEnabled = document.getElementById('voiceEnabled').checked;
        await DataStore.saveSetting('voiceEnabled', voiceEnabled);
        
        if (window.VoiceManager) {
            VoiceManager.setEnabled(voiceEnabled);
        }

        // Save theme
        const theme = document.getElementById('themeSelect').value;
        await DataStore.saveSetting('theme', theme);
        this.applyTheme();

        Utils.showToast('✅ Settings saved!', 'success');
    },

    // Apply theme
    async applyTheme() {
        const theme = await DataStore.getSetting('theme') || 'light';
        
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else if (theme === 'auto') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    },

    // Export data
    async exportData() {
        Utils.showLoading(true);
        
        try {
            const data = await DataStore.exportAllData();
            Utils.exportToJSON(data, `medicine-reminder-backup-${Utils.getCurrentDate()}.json`);
            Utils.showToast('✅ Data exported successfully!', 'success');
        } catch (error) {
            console.error('Export error:', error);
            Utils.showToast('❌ Failed to export data', 'error');
        }
        
        Utils.showLoading(false);
    },

    // Import data
    importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            Utils.showLoading(true);

            try {
                const data = await Utils.importFromJSON(file);
                const success = await DataStore.importAllData(data);
                
                if (success) {
                    Utils.showToast('✅ Data imported successfully!', 'success');
                    
                    // Reload all data
                    await this.loadInitialData();
                    await this.loadSectionData(this.currentSection);
                    
                    // Reinitialize modules
                    if (window.MedicineManager) {
                        MedicineManager.loadMedicines();
                    }
                    if (window.AchievementManager) {
                        await AchievementManager.init();
                    }
                } else {
                    Utils.showToast('❌ Failed to import data', 'error');
                }
            } catch (error) {
                console.error('Import error:', error);
                Utils.showToast('❌ Invalid data file', 'error');
            }

            Utils.showLoading(false);
        };

        input.click();
    },

    // Clear all data
    async clearAllData() {
        if (!Utils.confirmAction('⚠️ WARNING: This will delete ALL your data permanently. Are you absolutely sure?')) {
            return;
        }

        if (!Utils.confirmAction('This action cannot be undone. Continue?')) {
            return;
        }

        Utils.showLoading(true);

        try {
            await DataStore.clearAllData();
            
            // Clear notification reminders
            if (window.NotificationManager) {
                NotificationManager.clearAllReminders();
            }

            Utils.showToast('✅ All data cleared', 'success');
            
            // Reload page
            setTimeout(() => {
                window.location.reload();
            }, 1000);

        } catch (error) {
            console.error('Clear data error:', error);
            Utils.showToast('❌ Failed to clear data', 'error');
        }

        Utils.showLoading(false);
    },

    // Share progress
    async shareProgress() {
        const stats = await DataStore.getTodayStats();
        const last30Days = Utils.addDaysToDate(Utils.getCurrentDate(), -30);
        const adherenceRate = await DataStore.getAdherenceRate(last30Days, Utils.getCurrentDate());
        const streak = window.AchievementManager ? 
            await AchievementManager.calculateCurrentStreak() : 0;

        const shareText = `My Medicine Adherence Stats:\n📊 30-Day Adherence: ${Math.round(adherenceRate)}%\n🔥 Current Streak: ${streak} days\n✅ Today: ${stats.taken}/${stats.total} doses taken\n\nStay healthy with Medicine Reminder Pro!`;

        Utils.shareData({
            title: 'My Health Progress',
            text: shareText
        });
    },

    // Generate report
    async generateReport() {
        if (window.AnalyticsManager) {
            await AnalyticsManager.generateReport();
        }
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    await app.init();
});

// Make app available globally
window.app = app;