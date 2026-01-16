// ==================== DATA STORE MODULE ====================
// IndexedDB wrapper for offline-first data storage

const DataStore = {
    dbName: 'MedicineReminderDB',
    version: 1,
    db: null,

    // Initialize IndexedDB
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Medicines Store
                if (!db.objectStoreNames.contains('medicines')) {
                    const medicineStore = db.createObjectStore('medicines', { keyPath: 'id' });
                    medicineStore.createIndex('name', 'name', { unique: false });
                    medicineStore.createIndex('status', 'status', { unique: false });
                    medicineStore.createIndex('critical', 'critical', { unique: false });
                }

                // Schedule/History Store
                if (!db.objectStoreNames.contains('schedule')) {
                    const scheduleStore = db.createObjectStore('schedule', { keyPath: 'id' });
                    scheduleStore.createIndex('medicineId', 'medicineId', { unique: false });
                    scheduleStore.createIndex('date', 'date', { unique: false });
                    scheduleStore.createIndex('status', 'status', { unique: false });
                }

                // Settings Store
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }

                // Emergency Contacts Store
                if (!db.objectStoreNames.contains('emergencyContacts')) {
                    db.createObjectStore('emergencyContacts', { keyPath: 'id' });
                }

                // Achievements Store
                if (!db.objectStoreNames.contains('achievements')) {
                    const achievementStore = db.createObjectStore('achievements', { keyPath: 'id' });
                    achievementStore.createIndex('unlocked', 'unlocked', { unique: false });
                }

                // Medical Info Store
                if (!db.objectStoreNames.contains('medicalInfo')) {
                    db.createObjectStore('medicalInfo', { keyPath: 'key' });
                }
            };
        });
    },

    // Generic CRUD operations
    async add(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(data);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async get(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async getAll(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async update(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async delete(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    async clear(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    // Medicine-specific operations
    async addMedicine(medicine) {
        medicine.id = Utils.generateId();
        medicine.createdAt = new Date().toISOString();
        medicine.status = 'active';
        return await this.add('medicines', medicine);
    },

    async getMedicines(filter = 'all') {
        const medicines = await this.getAll('medicines');
        
        if (filter === 'all') return medicines;
        if (filter === 'active') return medicines.filter(m => m.status === 'active');
        if (filter === 'completed') return medicines.filter(m => m.status === 'completed');
        if (filter === 'critical') return medicines.filter(m => m.critical === true);
        
        return medicines;
    },

    async updateMedicine(medicine) {
        medicine.updatedAt = new Date().toISOString();
        return await this.update('medicines', medicine);
    },

    async deleteMedicine(id) {
        // Also delete related schedule entries
        const schedules = await this.getScheduleByMedicine(id);
        for (let schedule of schedules) {
            await this.delete('schedule', schedule.id);
        }
        return await this.delete('medicines', id);
    },

    // Schedule-specific operations
    async addSchedule(schedule) {
        schedule.id = Utils.generateId();
        schedule.createdAt = new Date().toISOString();
        return await this.add('schedule', schedule);
    },

    async getScheduleByDate(date) {
        const allSchedules = await this.getAll('schedule');
        return allSchedules.filter(s => s.date === date);
    },

    async getScheduleByMedicine(medicineId) {
        const allSchedules = await this.getAll('schedule');
        return allSchedules.filter(s => s.medicineId === medicineId);
    },

    async getScheduleByDateRange(startDate, endDate) {
        const allSchedules = await this.getAll('schedule');
        return allSchedules.filter(s => s.date >= startDate && s.date <= endDate);
    },

    async updateSchedule(schedule) {
        schedule.updatedAt = new Date().toISOString();
        return await this.update('schedule', schedule);
    },

    async markScheduleTaken(id, takenAt = null) {
        const schedule = await this.get('schedule', id);
        if (schedule) {
            schedule.status = 'taken';
            schedule.takenAt = takenAt || new Date().toISOString();
            return await this.update('schedule', schedule);
        }
    },

    async markScheduleSkipped(id) {
        const schedule = await this.get('schedule', id);
        if (schedule) {
            schedule.status = 'skipped';
            schedule.skippedAt = new Date().toISOString();
            return await this.update('schedule', schedule);
        }
    },

    // Settings operations
    async saveSetting(key, value) {
        return await this.update('settings', { key, value });
    },

    async getSetting(key) {
        const setting = await this.get('settings', key);
        return setting ? setting.value : null;
    },

    async getAllSettings() {
        const settings = await this.getAll('settings');
        const settingsObj = {};
        settings.forEach(s => {
            settingsObj[s.key] = s.value;
        });
        return settingsObj;
    },

    // Emergency Contacts operations
    async addEmergencyContact(contact) {
        contact.id = Utils.generateId();
        contact.createdAt = new Date().toISOString();
        return await this.add('emergencyContacts', contact);
    },

    async getEmergencyContacts() {
        return await this.getAll('emergencyContacts');
    },

    async deleteEmergencyContact(id) {
        return await this.delete('emergencyContacts', id);
    },

    // Achievements operations
    async addAchievement(achievement) {
        achievement.id = Utils.generateId();
        achievement.unlocked = false;
        achievement.progress = 0;
        achievement.createdAt = new Date().toISOString();
        return await this.add('achievements', achievement);
    },

    async getAchievements() {
        return await this.getAll('achievements');
    },

    async unlockAchievement(id) {
        const achievement = await this.get('achievements', id);
        if (achievement && !achievement.unlocked) {
            achievement.unlocked = true;
            achievement.unlockedAt = new Date().toISOString();
            await this.update('achievements', achievement);
            return achievement;
        }
        return null;
    },

    async updateAchievementProgress(id, progress) {
        const achievement = await this.get('achievements', id);
        if (achievement) {
            achievement.progress = progress;
            if (progress >= achievement.target && !achievement.unlocked) {
                achievement.unlocked = true;
                achievement.unlockedAt = new Date().toISOString();
            }
            return await this.update('achievements', achievement);
        }
    },

    // Medical Info operations
    async saveMedicalInfo(key, value) {
        return await this.update('medicalInfo', { key, value });
    },

    async getMedicalInfo(key) {
        const info = await this.get('medicalInfo', key);
        return info ? info.value : null;
    },

    async getAllMedicalInfo() {
        const info = await this.getAll('medicalInfo');
        const infoObj = {};
        info.forEach(i => {
            infoObj[i.key] = i.value;
        });
        return infoObj;
    },

    // Analytics and Statistics
    async getAdherenceRate(startDate, endDate) {
        const schedules = await this.getScheduleByDateRange(startDate, endDate);
        if (schedules.length === 0) return 0;

        const taken = schedules.filter(s => s.status === 'taken').length;
        return Utils.calculatePercentage(taken, schedules.length);
    },

    async getTodayStats() {
        const today = Utils.getCurrentDate();
        const todaySchedules = await this.getScheduleByDate(today);
        
        const total = todaySchedules.length;
        const taken = todaySchedules.filter(s => s.status === 'taken').length;
        const pending = todaySchedules.filter(s => s.status === 'pending').length;
        const missed = todaySchedules.filter(s => s.status === 'missed').length;
        
        return {
            total,
            taken,
            pending,
            missed,
            completion: total > 0 ? Utils.calculatePercentage(taken, total) : 0
        };
    },

    async getWeeklyStats(weekOffset = 0) {
        const weekDates = Utils.getWeekDates(weekOffset);
        const startDate = weekDates[0];
        const endDate = weekDates[6];
        
        const schedules = await this.getScheduleByDateRange(startDate, endDate);
        
        const dailyStats = {};
        weekDates.forEach(date => {
            const daySchedules = schedules.filter(s => s.date === date);
            const total = daySchedules.length;
            const taken = daySchedules.filter(s => s.status === 'taken').length;
            
            dailyStats[date] = {
                total,
                taken,
                completion: total > 0 ? Utils.calculatePercentage(taken, total) : 0
            };
        });
        
        return dailyStats;
    },

    async getMedicineStats(medicineId) {
        const schedules = await this.getScheduleByMedicine(medicineId);
        
        const total = schedules.length;
        const taken = schedules.filter(s => s.status === 'taken').length;
        const missed = schedules.filter(s => s.status === 'missed').length;
        const skipped = schedules.filter(s => s.status === 'skipped').length;
        
        return {
            total,
            taken,
            missed,
            skipped,
            adherence: total > 0 ? Utils.calculatePercentage(taken, total) : 0
        };
    },

    // Data Export/Import
    async exportAllData() {
        const data = {
            medicines: await this.getAll('medicines'),
            schedule: await this.getAll('schedule'),
            settings: await this.getAll('settings'),
            emergencyContacts: await this.getAll('emergencyContacts'),
            achievements: await this.getAll('achievements'),
            medicalInfo: await this.getAll('medicalInfo'),
            exportDate: new Date().toISOString()
        };
        return data;
    },

    async importAllData(data) {
        try {
            // Clear existing data
            await this.clear('medicines');
            await this.clear('schedule');
            await this.clear('settings');
            await this.clear('emergencyContacts');
            await this.clear('achievements');
            await this.clear('medicalInfo');

            // Import new data
            for (let medicine of data.medicines || []) {
                await this.add('medicines', medicine);
            }
            for (let schedule of data.schedule || []) {
                await this.add('schedule', schedule);
            }
            for (let setting of data.settings || []) {
                await this.add('settings', setting);
            }
            for (let contact of data.emergencyContacts || []) {
                await this.add('emergencyContacts', contact);
            }
            for (let achievement of data.achievements || []) {
                await this.add('achievements', achievement);
            }
            for (let info of data.medicalInfo || []) {
                await this.add('medicalInfo', info);
            }

            return true;
        } catch (error) {
            console.error('Import failed:', error);
            return false;
        }
    },

    async clearAllData() {
        await this.clear('medicines');
        await this.clear('schedule');
        await this.clear('settings');
        await this.clear('emergencyContacts');
        await this.clear('achievements');
        await this.clear('medicalInfo');
    },

    // Generate schedules for a medicine
    async generateSchedulesForMedicine(medicine) {
        const schedules = [];
        const startDate = new Date(medicine.startDate);
        const endDate = medicine.duration 
            ? new Date(startDate.getTime() + medicine.duration * 24 * 60 * 60 * 1000)
            : new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year default

        let currentDate = new Date(startDate);
        
        while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            
            for (let time of medicine.times) {
                const schedule = {
                    medicineId: medicine.id,
                    medicineName: medicine.name,
                    dosage: medicine.dosage,
                    date: dateStr,
                    time: time,
                    status: 'pending',
                    critical: medicine.critical || false
                };
                
                await this.addSchedule(schedule);
            }
            
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        return schedules;
    }
};

// Initialize DataStore on load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await DataStore.init();
        console.log('DataStore initialized successfully');
    } catch (error) {
        console.error('Failed to initialize DataStore:', error);
    }
});

// Make DataStore available globally
window.DataStore = DataStore;