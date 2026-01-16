// ==================== ACHIEVEMENTS MODULE ====================
// Handles gamification, achievements, and rewards

const AchievementManager = {
    achievements: [],
    totalPoints: 0,

    // Initialize achievements system
    async init() {
        await this.loadAchievements();
        await this.calculatePoints();
        this.displayAchievements();
        
        console.log('Achievement Manager initialized');
    },

    // Load achievements from database
    async loadAchievements() {
        let achievements = await DataStore.getAchievements();
        
        // Initialize default achievements if none exist
        if (achievements.length === 0) {
            await this.initializeDefaultAchievements();
            achievements = await DataStore.getAchievements();
        }
        
        this.achievements = achievements;
    },

    // Initialize default achievements
    async initializeDefaultAchievements() {
        const defaultAchievements = [
            {
                title: 'First Step',
                description: 'Add your first medicine',
                icon: '🎯',
                target: 1,
                type: 'medicines_added',
                points: 10
            },
            {
                title: 'Medicine Cabinet',
                description: 'Add 5 medicines',
                icon: '💊',
                target: 5,
                type: 'medicines_added',
                points: 50
            },
            {
                title: 'Perfect Day',
                description: 'Take all medicines on time for 1 day',
                icon: '⭐',
                target: 1,
                type: 'perfect_days',
                points: 25
            },
            {
                title: 'Week Warrior',
                description: 'Maintain 100% adherence for 7 days',
                icon: '🏆',
                target: 7,
                type: 'perfect_days',
                points: 100
            },
            {
                title: 'Monthly Master',
                description: 'Maintain 90%+ adherence for 30 days',
                icon: '👑',
                target: 30,
                type: 'high_adherence_days',
                points: 200
            },
            {
                title: 'Early Bird',
                description: 'Take 10 medicines within 5 minutes of scheduled time',
                icon: '🐦',
                target: 10,
                type: 'on_time_doses',
                points: 50
            },
            {
                title: 'Consistency King',
                description: 'Build a 30-day streak',
                icon: '🔥',
                target: 30,
                type: 'streak_days',
                points: 150
            },
            {
                title: 'Century Club',
                description: 'Take 100 doses',
                icon: '💯',
                target: 100,
                type: 'total_doses',
                points: 100
            },
            {
                title: 'Dedicated',
                description: 'Take 500 doses',
                icon: '🌟',
                target: 500,
                type: 'total_doses',
                points: 250
            },
            {
                title: 'Health Champion',
                description: 'Take 1000 doses',
                icon: '🏅',
                target: 1000,
                type: 'total_doses',
                points: 500
            },
            {
                title: 'Punctual Pro',
                description: 'Take 50 medicines on time',
                icon: '⏰',
                target: 50,
                type: 'on_time_doses',
                points: 100
            },
            {
                title: 'Safety First',
                description: 'Add emergency contact',
                icon: '🚨',
                target: 1,
                type: 'emergency_contacts',
                points: 20
            }
        ];

        for (let achievement of defaultAchievements) {
            await DataStore.addAchievement(achievement);
        }
    },

    // Calculate total points
    async calculatePoints() {
        this.totalPoints = 0;
        
        for (let achievement of this.achievements) {
            if (achievement.unlocked) {
                this.totalPoints += achievement.points || 0;
            }
        }

        // Update UI
        const pointsElement = document.getElementById('totalPoints');
        if (pointsElement) {
            pointsElement.textContent = this.totalPoints;
        }
    },

    // Display achievements
    displayAchievements() {
        const container = document.getElementById('achievementsList');
        if (!container) return;

        container.innerHTML = this.achievements.map(achievement => `
            <div class="achievement-card ${achievement.unlocked ? 'unlocked' : ''}">
                <span class="achievement-icon">${achievement.icon}</span>
                <h3 class="achievement-title">${achievement.title}</h3>
                <p class="achievement-description">${achievement.description}</p>
                <p style="font-weight: 600; color: var(--primary);">
                    ${achievement.points} Points
                </p>
                ${achievement.unlocked ? 
                    `<p style="color: var(--success); font-weight: 600;">✅ Unlocked!</p>` :
                    `<div class="achievement-progress">
                        <p style="font-size: 0.9rem; margin-bottom: 0.5rem;">
                            ${achievement.progress || 0} / ${achievement.target}
                        </p>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${((achievement.progress || 0) / achievement.target * 100)}%"></div>
                        </div>
                    </div>`
                }
            </div>
        `).join('');
    },

    // Check and update achievements
    async checkAchievements() {
        const medicines = await DataStore.getMedicines('all');
        const schedules = await DataStore.getAll('schedule');
        const takenSchedules = schedules.filter(s => s.status === 'taken');
        const emergencyContacts = await DataStore.getEmergencyContacts();

        // Calculate statistics
        const stats = {
            medicines_added: medicines.length,
            total_doses: takenSchedules.length,
            on_time_doses: await this.countOnTimeDoses(),
            perfect_days: await this.countPerfectDays(),
            high_adherence_days: await this.countHighAdherenceDays(),
            streak_days: await this.calculateCurrentStreak(),
            emergency_contacts: emergencyContacts.length
        };

        // Check each achievement
        for (let achievement of this.achievements) {
            if (achievement.unlocked) continue;

            const currentProgress = stats[achievement.type] || 0;
            achievement.progress = currentProgress;

            // Check if achievement should be unlocked
            if (currentProgress >= achievement.target) {
                const unlocked = await DataStore.unlockAchievement(achievement.id);
                if (unlocked) {
                    this.showAchievementUnlocked(achievement);
                }
            } else {
                // Update progress
                await DataStore.updateAchievementProgress(achievement.id, currentProgress);
            }
        }

        // Reload achievements and update display
        await this.loadAchievements();
        await this.calculatePoints();
        this.displayAchievements();
    },

    // Count on-time doses (within 5 minutes)
    async countOnTimeDoses() {
        const schedules = await DataStore.getAll('schedule');
        let count = 0;

        for (let schedule of schedules) {
            if (schedule.status === 'taken' && schedule.takenAt) {
                const scheduledTime = new Date(`${schedule.date}T${schedule.time}`);
                const takenTime = new Date(schedule.takenAt);
                const diffMinutes = Math.abs((takenTime - scheduledTime) / (1000 * 60));
                
                if (diffMinutes <= 5) {
                    count++;
                }
            }
        }

        return count;
    },

    // Count perfect days (100% adherence)
    async countPerfectDays() {
        const allSchedules = await DataStore.getAll('schedule');
        const dateGroups = Utils.groupBy(allSchedules, 'date');
        let perfectDays = 0;

        for (let date in dateGroups) {
            const daySchedules = dateGroups[date];
            const total = daySchedules.length;
            const taken = daySchedules.filter(s => s.status === 'taken').length;

            if (total > 0 && taken === total) {
                perfectDays++;
            }
        }

        return perfectDays;
    },

    // Count high adherence days (90%+)
    async countHighAdherenceDays() {
        const allSchedules = await DataStore.getAll('schedule');
        const dateGroups = Utils.groupBy(allSchedules, 'date');
        let highAdherenceDays = 0;

        for (let date in dateGroups) {
            const daySchedules = dateGroups[date];
            const total = daySchedules.length;
            const taken = daySchedules.filter(s => s.status === 'taken').length;
            const adherence = total > 0 ? (taken / total * 100) : 0;

            if (adherence >= 90) {
                highAdherenceDays++;
            }
        }

        return highAdherenceDays;
    },

    // Calculate current streak
    async calculateCurrentStreak() {
        const allSchedules = await DataStore.getAll('schedule');
        if (allSchedules.length === 0) return 0;

        // Group by date and sort
        const dateGroups = Utils.groupBy(allSchedules, 'date');
        const dates = Object.keys(dateGroups).sort().reverse();

        let streak = 0;
        let checkDate = new Date();

        for (let i = 0; i < dates.length; i++) {
            const dateStr = checkDate.toISOString().split('T')[0];
            
            if (!dateGroups[dateStr]) break;

            const daySchedules = dateGroups[dateStr];
            const total = daySchedules.length;
            const taken = daySchedules.filter(s => s.status === 'taken').length;

            // Consider it a streak day if adherence is 100%
            if (total > 0 && taken === total) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }

        return streak;
    },

    // Show achievement unlocked notification
    showAchievementUnlocked(achievement) {
        // Play sound
        if (window.NotificationManager && window.NotificationManager.settings.sound) {
            Utils.playSound('success');
        }

        // Vibrate
        if (window.NotificationManager && window.NotificationManager.settings.vibration) {
            Utils.vibrate([200, 100, 200, 100, 200]);
        }

        // Show toast
        Utils.showToast(
            `🎉 Achievement Unlocked: ${achievement.title}! +${achievement.points} points`,
            'success',
            5000
        );

        // Show browser notification
        if (window.NotificationManager && window.NotificationManager.permission === 'granted') {
            new Notification('🎉 Achievement Unlocked!', {
                body: `${achievement.icon} ${achievement.title} - +${achievement.points} points`,
                icon: '/icon-192.png'
            });
        }
    },

    // Display current goals
    displayCurrentGoals() {
        const container = document.getElementById('currentGoals');
        if (!container) return;

        const incompleteAchievements = this.achievements
            .filter(a => !a.unlocked)
            .sort((a, b) => {
                const aProgress = ((a.progress || 0) / a.target) * 100;
                const bProgress = ((b.progress || 0) / b.target) * 100;
                return bProgress - aProgress;
            })
            .slice(0, 5);

        if (incompleteAchievements.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem;">
                    <p style="font-size: 3rem;">🏆</p>
                    <p style="font-size: 1.2rem; color: var(--success);">
                        All achievements unlocked! You're amazing!
                    </p>
                </div>
            `;
            return;
        }

        container.innerHTML = incompleteAchievements.map(achievement => `
            <div class="achievement-card" style="margin-bottom: 1rem;">
                <span class="achievement-icon">${achievement.icon}</span>
                <h3 class="achievement-title">${achievement.title}</h3>
                <p class="achievement-description">${achievement.description}</p>
                <div class="achievement-progress">
                    <p style="font-size: 0.9rem; margin-bottom: 0.5rem;">
                        ${achievement.progress || 0} / ${achievement.target}
                    </p>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${((achievement.progress || 0) / achievement.target * 100)}%"></div>
                    </div>
                </div>
            </div>
        `).join('');
    },

    // Get user level based on points
    getUserLevel() {
        const levels = [
            { level: 1, minPoints: 0, title: 'Beginner' },
            { level: 2, minPoints: 50, title: 'Novice' },
            { level: 3, minPoints: 150, title: 'Intermediate' },
            { level: 4, minPoints: 300, title: 'Advanced' },
            { level: 5, minPoints: 500, title: 'Expert' },
            { level: 6, minPoints: 800, title: 'Master' },
            { level: 7, minPoints: 1200, title: 'Champion' },
            { level: 8, minPoints: 1800, title: 'Legend' }
        ];

        for (let i = levels.length - 1; i >= 0; i--) {
            if (this.totalPoints >= levels[i].minPoints) {
                return levels[i];
            }
        }

        return levels[0];
    },

    // Refresh achievements display
    async refresh() {
        await this.checkAchievements();
        this.displayCurrentGoals();
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
    await AchievementManager.init();
    AchievementManager.displayCurrentGoals();
});

// Make AchievementManager available globally
window.AchievementManager = AchievementManager;