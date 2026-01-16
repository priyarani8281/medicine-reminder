// ==================== NOTIFICATIONS MODULE ====================
// Handles all notification and reminder functionality

const NotificationManager = {
    permission: 'default',
    intervalId: null,
    checkInterval: 60000, // Check every minute
    activeReminders: new Map(),
    snoozedReminders: new Map(),

    // Initialize notification system
    async init() {
        await this.requestPermission();
        this.startChecking();
        this.loadSettings();
        
        console.log('Notification Manager initialized');
    },

    // Request notification permission
    async requestPermission() {
        if (!('Notification' in window)) {
            console.log('This browser does not support notifications');
            return false;
        }

        this.permission = Notification.permission;

        if (this.permission === 'default') {
            this.permission = await Notification.requestPermission();
        }

        return this.permission === 'granted';
    },

    // Load notification settings
    async loadSettings() {
        this.settings = {
            enabled: await DataStore.getSetting('notificationEnabled') ?? true,
            sound: await DataStore.getSetting('soundEnabled') ?? true,
            vibration: await DataStore.getSetting('vibrationEnabled') ?? true,
            advanceTime: await DataStore.getSetting('reminderAdvance') ?? 15
        };
    },

    // Save notification settings
    async saveSettings(settings) {
        await DataStore.saveSetting('notificationEnabled', settings.enabled);
        await DataStore.saveSetting('soundEnabled', settings.sound);
        await DataStore.saveSetting('vibrationEnabled', settings.vibration);
        await DataStore.saveSetting('reminderAdvance', settings.advanceTime);
        
        this.settings = settings;
    },

    // Start checking for reminders
    startChecking() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }

        this.intervalId = setInterval(() => {
            this.checkReminders();
        }, this.checkInterval);

        // Check immediately
        this.checkReminders();
    },

    // Stop checking for reminders
    stopChecking() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    },

    // Check for upcoming reminders
    async checkReminders() {
        if (!this.settings.enabled) return;

        const today = Utils.getCurrentDate();
        const todaySchedules = await DataStore.getScheduleByDate(today);
        const currentTime = Utils.getCurrentTime();

        for (let schedule of todaySchedules) {
            // Skip if already taken, skipped, or missed
            if (schedule.status !== 'pending') continue;

            // Check if it's time for reminder
            const timeDiff = Utils.getTimeDifference(schedule.time, currentTime);
            
            // Show reminder if it's within advance time
            if (timeDiff <= this.settings.advanceTime && timeDiff >= 0) {
                const reminderKey = `${schedule.id}-${schedule.time}`;
                
                // Don't show if already shown or snoozed
                if (!this.activeReminders.has(reminderKey) && 
                    !this.snoozedReminders.has(reminderKey)) {
                    await this.showReminder(schedule);
                    this.activeReminders.set(reminderKey, schedule);
                }
            }

            // Mark as missed if past time
            if (Utils.isPastTime(schedule.date, schedule.time)) {
                schedule.status = 'missed';
                await DataStore.updateSchedule(schedule);
            }
        }
    },

    // Show reminder notification
    async showReminder(schedule) {
        const medicine = await DataStore.get('medicines', schedule.medicineId);
        
        const title = '💊 Medicine Reminder';
        const body = `Time to take ${schedule.medicineName} (${schedule.dosage})`;
        const icon = Utils.getMedicineIcon(medicine?.type || 'tablet');

        // Show browser notification
        if (this.permission === 'granted') {
            const notification = new Notification(title, {
                body: body,
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                tag: schedule.id,
                requireInteraction: true,
                actions: [
                    { action: 'taken', title: 'Mark as Taken' },
                    { action: 'snooze', title: 'Snooze' }
                ]
            });

            notification.onclick = () => {
                window.focus();
                this.showReminderModal(schedule);
                notification.close();
            };
        }

        // Play sound
        if (this.settings.sound) {
            Utils.playSound('notification');
        }

        // Vibrate
        if (this.settings.vibration) {
            Utils.vibrate([200, 100, 200]);
        }

        // Show modal
        this.showReminderModal(schedule);

        // Show toast
        Utils.showToast(`${icon} Time to take ${schedule.medicineName}!`, 'info', 5000);
    },

    // Show reminder modal
    showReminderModal(schedule) {
        const modal = document.getElementById('reminderModal');
        const message = document.getElementById('modalMessage');
        const medicineInfo = document.getElementById('modalMedicineInfo');

        message.textContent = `It's time to take your medicine!`;
        medicineInfo.innerHTML = `
            <div style="margin-top: 1rem; padding: 1rem; background: var(--light); border-radius: var(--radius);">
                <h3 style="margin-bottom: 0.5rem;">${schedule.medicineName}</h3>
                <p style="margin: 0.25rem 0;"><strong>Dosage:</strong> ${schedule.dosage}</p>
                <p style="margin: 0.25rem 0;"><strong>Time:</strong> ${Utils.formatTime(schedule.time)}</p>
                ${schedule.critical ? '<p style="color: var(--danger); font-weight: 600;">⚠️ Critical Medicine</p>' : ''}
            </div>
        `;

        modal.classList.add('show');
        modal.dataset.scheduleId = schedule.id;

        // Auto-play alert sound if enabled
        if (this.settings.sound) {
            const alertSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBi+G0fPTgjMGHm7A7+OZSA0PWKzn77BdGQg+ltryxnMpBSl+zPLaizsIGGS76+mhVRQLRJzh8r1vIwYthdDz1IAyBhxsvO7mnEoPEVqt6O+uWhkIP5jY88p1KgYpgM3y2Yc8CBlmu+rqoFYUC0Wd4PK+byMGLoXQ89WAMgYcbLzu5p1KDxFarejvrlsYCD+Y2PTJdSoGKX/M8tmIPAkZZrvq6aFWFAtFneDyvW8jBi6F0PPVgDIGHGy77uadSg8RWq3n76xbGAhAmNj0yXQpBip/zPLZhzwJGWa76umhVRQLRZ3g8rxtJAYuhc/z1YExBh1swu7mnEoPEVqt5+6sWxkIQJjZ88p0KQYqfsvy2Yc8CRlmu+rpoVQVDEWd4fK8bSMGLoTP89R/MgYdbMLv5pxJDxBbrufur1sYCECY2fPKcykGKn3L8tiHOwkaZ7vq6KFUFQ1Fnd/yvG4iBi+Ez/PUfzIGHW3C7+acSQ8QWq7n7q9bGAlAmNnzym8pBit9y/LYhzsJGme76umgVBYNRZ3f8rxuIgYvhM7z1H4yBhxtwu/mm0kPEFuv5+6vWRgJQZjZ88ltKQYrfcvy2IY8CRpnu+rpn1QWDUWd3/K7biMGMITP89R+MQYcbcPv5ppKDxBbrufur1gZCUKY2PPJbSkGK33L8tiGPAkZZ7zq6J9WFg1End/yu24jBjCEz/PTfjAGHG3D7+abSg8QW6/n7q5ZGAlCmNnzyW4oBiuAy/HYhzwJGWe76+ifVhYMRp3f8rpvJAYxhM/z034wBhxuxO/mm0kOEFuw5+6uWRgJQpjZ88luKAYrfsrx2Ic8CRhnvOrpoVYWDEad3/K6bSQGMYXP89N9MAYdbsTv5ppJDhBbsOburlkZCUOY2fPJbCcGLIDK8deHOwkaZ7zq6KBWFw1GnuDyum0kBjGFz/PTfS8GHW7F7+aaSQ4QW7Dm7q5ZGQlDmdnyyWwnBiyAyvHYhzwJGWe76+ifVhcNRp7g8rptJQYyhc/y030vBh1txu/mmUkNEVux5++uWBkJQ5nZ8sptJwYrfsrx2Ig8CRhnvOvooFYXDUae3/K6bSUGMoXO8tN9LgYdbsfv5ppIDRFbs+bvr1gZCUSZ2fLKbCcGK37K8diIPQkYZ73r6KBVFw5HnuDyum0kBjKEzvLSfS4GHW7H7+eaSA0RWrPm769YGAlEmNryynAmBit+yvHYiD0JGGe96+ifVRcOR57g8rptJAYyhM7y0n0vBh1ux+/mmUgNEVqz5++vVxkJRJjZ8spwJgYrfsrx2Ig9CRdovevnn1UXDkee4PK6bSQGMoPO8tJ9LwYdbsfu55lJDRBasufvr1cZCUSY2fLKcCYGK37K8diIPQkXZ73r559VFw5HnuDyum4kBjKDzvLSfC8GHW7H7+eaSg0RWrLn76xYGQlEmNnyyXEm');
            alertSound.play();
        }
    },

    // Close reminder modal
    closeReminderModal() {
        const modal = document.getElementById('reminderModal');
        modal.classList.remove('show');
        delete modal.dataset.scheduleId;
    },

    // Mark medicine as taken from modal
    async markTakenFromModal() {
        const modal = document.getElementById('reminderModal');
        const scheduleId = modal.dataset.scheduleId;
        
        if (scheduleId) {
            await DataStore.markScheduleTaken(scheduleId);
            
            // Remove from active reminders
            for (let [key, schedule] of this.activeReminders) {
                if (schedule.id === scheduleId) {
                    this.activeReminders.delete(key);
                    break;
                }
            }
            
            Utils.showToast('✅ Medicine marked as taken!', 'success');
            this.closeReminderModal();
            
            // Update UI if app is available
            if (window.app) {
                window.app.updateDashboard();
            }

            // Check for achievements
            if (window.AchievementManager) {
                window.AchievementManager.checkAchievements();
            }
        }
    },

    // Snooze reminder
    async snoozeReminder(minutes = 10) {
        const modal = document.getElementById('reminderModal');
        const scheduleId = modal.dataset.scheduleId;
        
        if (scheduleId) {
            const schedule = await DataStore.get('schedule', scheduleId);
            const reminderKey = `${schedule.id}-${schedule.time}`;
            
            // Remove from active and add to snoozed
            this.activeReminders.delete(reminderKey);
            this.snoozedReminders.set(reminderKey, schedule);
            
            // Set timeout to re-show after snooze period
            setTimeout(() => {
                this.snoozedReminders.delete(reminderKey);
                this.showReminder(schedule);
            }, minutes * 60 * 1000);
            
            Utils.showToast(`⏰ Reminder snoozed for ${minutes} minutes`, 'info');
            this.closeReminderModal();
        }
    },

    // Skip dose
    async skipDose() {
        const modal = document.getElementById('reminderModal');
        const scheduleId = modal.dataset.scheduleId;
        
        if (scheduleId) {
            if (Utils.confirmAction('Are you sure you want to skip this dose?')) {
                await DataStore.markScheduleSkipped(scheduleId);
                
                // Remove from active reminders
                for (let [key, schedule] of this.activeReminders) {
                    if (schedule.id === scheduleId) {
                        this.activeReminders.delete(key);
                        break;
                    }
                }
                
                Utils.showToast('❌ Dose skipped', 'warning');
                this.closeReminderModal();
                
                // Update UI if app is available
                if (window.app) {
                    window.app.updateDashboard();
                }
            }
        }
    },

    // Schedule a specific notification
    scheduleNotification(schedule, medicine) {
        // For future implementation with service workers
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            // This would integrate with service worker for background notifications
            console.log('Scheduling notification for:', schedule);
        }
    },

    // Send test notification
    async sendTestNotification() {
        if (this.permission !== 'granted') {
            await this.requestPermission();
        }

        if (this.permission === 'granted') {
            const notification = new Notification('💊 Test Notification', {
                body: 'Notifications are working correctly!',
                icon: '/icon-192.png',
                badge: '/icon-192.png'
            });

            setTimeout(() => notification.close(), 5000);
            
            if (this.settings.sound) {
                Utils.playSound('notification');
            }
            
            if (this.settings.vibration) {
                Utils.vibrate([200, 100, 200]);
            }
        } else {
            Utils.showToast('Please enable notifications in your browser settings', 'warning');
        }
    },

    // Get notification status
    getStatus() {
        return {
            permission: this.permission,
            enabled: this.settings.enabled,
            activeReminders: this.activeReminders.size,
            snoozedReminders: this.snoozedReminders.size
        };
    },

    // Clear all active reminders
    clearAllReminders() {
        this.activeReminders.clear();
        this.snoozedReminders.clear();
        this.closeReminderModal();
    },

    // Daily summary notification
    async sendDailySummary() {
        const stats = await DataStore.getTodayStats();
        
        if (this.permission === 'granted') {
            const notification = new Notification('📊 Daily Summary', {
                body: `Taken: ${stats.taken}/${stats.total} | Completion: ${Math.round(stats.completion)}%`,
                icon: '/icon-192.png'
            });

            setTimeout(() => notification.close(), 10000);
        }
    },

    // Missed dose alert
    async alertMissedDoses() {
        const today = Utils.getCurrentDate();
        const schedules = await DataStore.getScheduleByDate(today);
        const missed = schedules.filter(s => s.status === 'missed');

        if (missed.length > 0 && this.permission === 'granted') {
            const notification = new Notification('⚠️ Missed Doses Alert', {
                body: `You have ${missed.length} missed dose(s) today`,
                icon: '/icon-192.png',
                requireInteraction: true
            });

            notification.onclick = () => {
                window.focus();
                if (window.app) {
                    window.app.showSection('dashboard');
                }
                notification.close();
            };
        }
    },

    // Medication refill reminder
    async checkRefillReminders() {
        const medicines = await DataStore.getMedicines('active');
        const today = new Date();

        for (let medicine of medicines) {
            if (medicine.duration) {
                const startDate = new Date(medicine.startDate);
                const endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + medicine.duration);
                
                const daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
                
                // Alert 7 days before medicine ends
                if (daysRemaining === 7 && this.permission === 'granted') {
                    new Notification('🔔 Refill Reminder', {
                        body: `${medicine.name} will run out in 7 days. Consider refilling.`,
                        icon: '/icon-192.png'
                    });
                }
            }
        }
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await NotificationManager.init();
        console.log('Notification Manager ready');
    } catch (error) {
        console.error('Failed to initialize Notification Manager:', error);
    }
});

// Make NotificationManager available globally
window.NotificationManager = NotificationManager;