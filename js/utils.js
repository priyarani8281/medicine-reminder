// ==================== UTILITY FUNCTIONS ====================

const Utils = {
    // Date and Time Utilities
    formatDate(date) {
        const d = new Date(date);
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return d.toLocaleDateString('en-US', options);
    },

    formatTime(time) {
        if (!time) return '';
        const [hours, minutes] = time.split(':');
        const h = parseInt(hours);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const displayHour = h % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    },

    getCurrentDate() {
        return new Date().toISOString().split('T')[0];
    },

    getCurrentTime() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    },

    getTimeDifference(time1, time2) {
        const [h1, m1] = time1.split(':').map(Number);
        const [h2, m2] = time2.split(':').map(Number);
        const diff = Math.abs((h1 * 60 + m1) - (h2 * 60 + m2));
        return diff;
    },

    addDaysToDate(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result.toISOString().split('T')[0];
    },

    getDayOfWeek(date) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const d = new Date(date);
        return days[d.getDay()];
    },

    isToday(date) {
        const today = new Date();
        const checkDate = new Date(date);
        return today.toDateString() === checkDate.toDateString();
    },

    isPastTime(date, time) {
        const now = new Date();
        const checkDateTime = new Date(`${date}T${time}`);
        return checkDateTime < now;
    },

    // String Utilities
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    },

    truncate(str, length) {
        return str.length > length ? str.substring(0, length) + '...' : str;
    },

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    // Number Utilities
    roundToDecimal(num, decimals = 2) {
        return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
    },

    // Array Utilities
    sortByProperty(array, property, ascending = true) {
        return array.sort((a, b) => {
            if (ascending) {
                return a[property] > b[property] ? 1 : -1;
            } else {
                return a[property] < b[property] ? 1 : -1;
            }
        });
    },

    groupBy(array, key) {
        return array.reduce((result, item) => {
            const group = item[key];
            if (!result[group]) {
                result[group] = [];
            }
            result[group].push(item);
            return result;
        }, {});
    },

    // Validation Utilities
    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    validatePhone(phone) {
        const re = /^[\d\s\-\+\(\)]+$/;
        return re.test(phone) && phone.replace(/\D/g, '').length >= 10;
    },

    isEmpty(value) {
        return value === null || value === undefined || value === '' || 
               (Array.isArray(value) && value.length === 0) ||
               (typeof value === 'object' && Object.keys(value).length === 0);
    },

    // UI Utilities
    showToast(message, type = 'info', duration = 3000) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type}`;
        
        setTimeout(() => toast.classList.add('show'), 100);
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    },

    showLoading(show = true) {
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            overlay.classList.add('show');
        } else {
            overlay.classList.remove('show');
        }
    },

    confirmAction(message) {
        return confirm(message);
    },

    // Storage Utilities
    saveToLocalStorage(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Error saving to localStorage:', e);
            return false;
        }
    },

    getFromLocalStorage(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Error reading from localStorage:', e);
            return null;
        }
    },

    removeFromLocalStorage(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.error('Error removing from localStorage:', e);
            return false;
        }
    },

    clearLocalStorage() {
        try {
            localStorage.clear();
            return true;
        } catch (e) {
            console.error('Error clearing localStorage:', e);
            return false;
        }
    },

    // Export/Import Utilities
    exportToJSON(data, filename) {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    importFromJSON(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    resolve(data);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    },

    // Color Utilities
    getStatusColor(status) {
        const colors = {
            taken: '#48bb78',
            pending: '#ed8936',
            missed: '#f56565',
            skipped: '#718096',
            active: '#667eea',
            completed: '#38a169'
        };
        return colors[status] || '#718096';
    },

    // Notification Utilities
    playSound(type = 'notification') {
        const sounds = {
            notification: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
            success: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
            error: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'
        };

        const audio = new Audio(sounds[type]);
        audio.volume = 0.5;
        audio.play().catch(e => console.log('Could not play sound:', e));
    },

    vibrate(pattern = [200]) {
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    },

    // Statistics Utilities
    calculateAverage(numbers) {
        if (numbers.length === 0) return 0;
        const sum = numbers.reduce((a, b) => a + b, 0);
        return sum / numbers.length;
    },

    calculatePercentage(part, total) {
        if (total === 0) return 0;
        return (part / total) * 100;
    },

    // Week Utilities
    getWeekDates(weekOffset = 0) {
        const today = new Date();
        const currentDay = today.getDay();
        const diff = today.getDate() - currentDay + (weekOffset * 7);
        
        const weekStart = new Date(today.setDate(diff));
        const dates = [];
        
        for (let i = 0; i < 7; i++) {
            const date = new Date(weekStart);
            date.setDate(weekStart.getDate() + i);
            dates.push(date.toISOString().split('T')[0]);
        }
        
        return dates;
    },

    getWeekLabel(weekOffset = 0) {
        const dates = this.getWeekDates(weekOffset);
        const start = this.formatDate(dates[0]);
        const end = this.formatDate(dates[6]);
        return `${start} - ${end}`;
    },

    // Medicine Type Icons
    getMedicineIcon(type) {
        const icons = {
            tablet: '💊',
            capsule: '⚫',
            syrup: '🧪',
            injection: '💉',
            drops: '💧',
            inhaler: '🌬️',
            other: '🔹'
        };
        return icons[type] || '💊';
    },

    // Streak Calculation
    calculateStreak(history) {
        if (!history || history.length === 0) return 0;
        
        // Sort history by date descending
        const sorted = history.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        let streak = 0;
        let currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);
        
        for (let record of sorted) {
            const recordDate = new Date(record.date);
            recordDate.setHours(0, 0, 0, 0);
            
            const diffDays = Math.floor((currentDate - recordDate) / (1000 * 60 * 60 * 24));
            
            if (diffDays === streak && record.status === 'taken') {
                streak++;
            } else if (diffDays > streak) {
                break;
            }
        }
        
        return streak;
    },

    // Random Motivational Messages
    getMotivationalMessage() {
        const messages = [
            "Great job staying on track! 🎉",
            "You're doing amazing! Keep it up! 💪",
            "Consistency is key to better health! 🌟",
            "Your health journey is inspiring! 🚀",
            "Every dose counts towards a healthier you! 💖",
            "You're building great health habits! 🏆",
            "Keep up the excellent work! ⭐",
            "Your commitment to health is admirable! 👏",
            "One step at a time, you're getting healthier! 🌈",
            "Proud of your dedication! 💚"
        ];
        return messages[Math.floor(Math.random() * messages.length)];
    },

    // Time-based Greeting
    getGreeting() {
        const hour = new Date().getHours();
        if (hour < 12) return "Good Morning";
        if (hour < 17) return "Good Afternoon";
        if (hour < 21) return "Good Evening";
        return "Good Night";
    },

    // Debounce Function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Copy to Clipboard
    copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                this.showToast('Copied to clipboard!', 'success');
            }).catch(err => {
                console.error('Failed to copy:', err);
            });
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                this.showToast('Copied to clipboard!', 'success');
            } catch (err) {
                console.error('Failed to copy:', err);
            }
            document.body.removeChild(textArea);
        }
    },

    // Share Functionality
    shareData(data) {
        if (navigator.share) {
            navigator.share(data).catch(err => {
                console.log('Error sharing:', err);
            });
        } else {
            this.showToast('Sharing not supported on this device', 'warning');
        }
    },

    // Check if online
    isOnline() {
        return navigator.onLine;
    },

    // Request Notification Permission
    async requestNotificationPermission() {
        if (!('Notification' in window)) {
            console.log('This browser does not support notifications');
            return false;
        }

        if (Notification.permission === 'granted') {
            return true;
        }

        if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }

        return false;
    }
};

// Make Utils available globally
window.Utils = Utils;