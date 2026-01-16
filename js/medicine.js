// ==================== MEDICINE MODULE ====================
// Handles medicine management operations

const MedicineManager = {
    currentFilter: 'all',
    currentMedicine: null,
    isSubmitting: false,  // ADD THIS: Prevent duplicate submissions

    // Initialize medicine form handlers
    init() {
        this.setupFormHandlers();
        this.setupFilterHandlers();
        this.loadMedicines();
        
        console.log('Medicine Manager initialized');
    },

    // Setup form event handlers
    setupFormHandlers() {
        const form = document.getElementById('medicineForm');
        const frequencySelect = document.getElementById('medFrequency');
        
        // Handle form submission
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // UPDATED: Disable button during submission
            const submitBtn = document.querySelector('#medicineForm button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                const originalHTML = submitBtn.innerHTML;
                submitBtn.innerHTML = '<span>⏳</span> Adding...';
                
                await this.saveMedicine();
                
                // Re-enable button
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalHTML;
            } else {
                await this.saveMedicine();
            }
        });

        // Handle frequency change to show/hide time inputs
        frequencySelect.addEventListener('change', (e) => {
            this.updateTimeInputs(e.target.value);
        });

        // Set default start date to today
        document.getElementById('medStartDate').value = Utils.getCurrentDate();
    },

    // Setup filter button handlers
    setupFilterHandlers() {
        const filterButtons = document.querySelectorAll('.filter-btn');
        
        filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Update active state
                filterButtons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                // Apply filter
                const filter = e.target.dataset.filter;
                this.currentFilter = filter;
                this.loadMedicines(filter);
            });
        });
    },

    // Update time inputs based on frequency
    updateTimeInputs(frequency) {
        const timeInputs = document.querySelectorAll('.time-input');
        
        // Hide all first
        timeInputs.forEach(input => {
            input.style.display = 'none';
            input.removeAttribute('required');
        });

        // Show required inputs based on frequency
        const timeCounts = {
            'once': 1,
            'twice': 2,
            'thrice': 3,
            'four': 4,
            'custom': 4
        };

        const count = timeCounts[frequency] || 1;
        
        for (let i = 0; i < count; i++) {
            timeInputs[i].style.display = 'block';
            timeInputs[i].setAttribute('required', 'required');
        }
    },

    // Save medicine
    async saveMedicine() {
        // ADDED: Prevent duplicate submissions
        if (this.isSubmitting) {
            console.log('Already submitting, skipping duplicate call');
            return;
        }

        // Set submitting flag
        this.isSubmitting = true;

        Utils.showLoading(true);

        try {
            // Get form data
            const medicine = {
                name: document.getElementById('medName').value.trim(),
                dosage: document.getElementById('medDosage').value.trim(),
                type: document.getElementById('medType').value,
                frequency: document.getElementById('medFrequency').value,
                startDate: document.getElementById('medStartDate').value,
                duration: parseInt(document.getElementById('medDuration').value) || null,
                instructions: document.getElementById('medInstructions').value.trim(),
                critical: document.getElementById('medCritical').checked,
                times: []
            };

            // Get times based on frequency
            const timeInputs = document.querySelectorAll('.time-input');
            timeInputs.forEach(input => {
                if (input.style.display !== 'none' && input.value) {
                    medicine.times.push(input.value);
                }
            });

            // Validation
            if (!medicine.name || !medicine.dosage || medicine.times.length === 0) {
                Utils.showToast('Please fill in all required fields', 'error');
                Utils.showLoading(false);
                this.isSubmitting = false;  // ADDED: Reset flag on validation error
                return;
            }

            // Save to database
            if (this.currentMedicine) {
                // Update existing
                medicine.id = this.currentMedicine.id;
                medicine.createdAt = this.currentMedicine.createdAt;
                await DataStore.updateMedicine(medicine);
                Utils.showToast('✅ Medicine updated successfully!', 'success');
            } else {
                // Add new
                await DataStore.addMedicine(medicine);
                Utils.showToast('✅ Medicine added successfully!', 'success');
            }

            // Generate schedules
            await DataStore.generateSchedulesForMedicine(medicine);

            // Reset form
            this.resetForm();
            this.loadMedicines(this.currentFilter);

            // Update dashboard if available
            if (window.app) {
                window.app.updateDashboard();
            }

            // ADDED: Check achievements
            if (window.AchievementManager) {
                await AchievementManager.checkAchievements();
            }

        } catch (error) {
            console.error('Error saving medicine:', error);
            Utils.showToast('❌ Failed to save medicine', 'error');
        } finally {
            // ADDED: Always reset flag and hide loading
            Utils.showLoading(false);
            
            // Reset flag after a short delay to prevent rapid re-submissions
            setTimeout(() => {
                this.isSubmitting = false;
            }, 500);
        }
    },

    // Load and display medicines
    async loadMedicines(filter = 'all') {
        const container = document.getElementById('medicineList');
        
        try {
            const medicines = await DataStore.getMedicines(filter);
            
            if (medicines.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 3rem; color: #718096;">
                        <p style="font-size: 3rem; margin-bottom: 1rem;">📦</p>
                        <p style="font-size: 1.2rem;">No medicines found</p>
                        <p>Add your first medicine to get started!</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = medicines.map(medicine => `
                <div class="medicine-item ${medicine.critical ? 'critical' : ''}" data-id="${medicine.id}">
                    <div class="medicine-info">
                        <h3>${Utils.getMedicineIcon(medicine.type)} ${medicine.name}</h3>
                        <p><strong>Dosage:</strong> ${medicine.dosage}</p>
                        <p><strong>Times:</strong> ${medicine.times.map(t => Utils.formatTime(t)).join(', ')}</p>
                        <p><strong>Start Date:</strong> ${Utils.formatDate(medicine.startDate)}</p>
                        ${medicine.duration ? `<p><strong>Duration:</strong> ${medicine.duration} days</p>` : ''}
                        ${medicine.instructions ? `<p><strong>Instructions:</strong> ${medicine.instructions}</p>` : ''}
                        ${medicine.critical ? '<p style="color: var(--danger); font-weight: 600;">⚠️ Critical</p>' : ''}
                    </div>
                    <div class="medicine-actions">
                        <button class="edit-btn" onclick="MedicineManager.editMedicine('${medicine.id}')">
                            ✏️ Edit
                        </button>
                        <button class="delete-btn" onclick="MedicineManager.deleteMedicine('${medicine.id}')">
                            🗑️ Delete
                        </button>
                    </div>
                </div>
            `).join('');

        } catch (error) {
            console.error('Error loading medicines:', error);
            container.innerHTML = '<p style="color: var(--danger);">Error loading medicines</p>';
        }
    },

    // Edit medicine
    async editMedicine(id) {
        try {
            const medicine = await DataStore.get('medicines', id);
            
            if (!medicine) {
                Utils.showToast('Medicine not found', 'error');
                return;
            }

            // Scroll to form
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // Fill form with medicine data
            document.getElementById('medName').value = medicine.name;
            document.getElementById('medDosage').value = medicine.dosage;
            document.getElementById('medType').value = medicine.type;
            document.getElementById('medFrequency').value = medicine.frequency;
            document.getElementById('medStartDate').value = medicine.startDate;
            document.getElementById('medDuration').value = medicine.duration || '';
            document.getElementById('medInstructions').value = medicine.instructions || '';
            document.getElementById('medCritical').checked = medicine.critical || false;

            // Update time inputs
            this.updateTimeInputs(medicine.frequency);
            
            medicine.times.forEach((time, index) => {
                const input = document.getElementById(`medTime${index + 1}`);
                if (input) {
                    input.value = time;
                }
            });

            this.currentMedicine = medicine;

            // Update form button text
            const submitBtn = document.querySelector('#medicineForm button[type="submit"]');
            submitBtn.innerHTML = '<span>💾</span> Update Medicine';

        } catch (error) {
            console.error('Error editing medicine:', error);
            Utils.showToast('Failed to load medicine', 'error');
        }
    },

    // Delete medicine
    async deleteMedicine(id) {
        if (!Utils.confirmAction('Are you sure you want to delete this medicine? This will also delete all related schedules.')) {
            return;
        }

        Utils.showLoading(true);

        try {
            await DataStore.deleteMedicine(id);
            Utils.showToast('✅ Medicine deleted successfully', 'success');
            this.loadMedicines(this.currentFilter);

            // Update dashboard if available
            if (window.app) {
                window.app.updateDashboard();
            }

        } catch (error) {
            console.error('Error deleting medicine:', error);
            Utils.showToast('❌ Failed to delete medicine', 'error');
        }

        Utils.showLoading(false);
    },

    // Reset form
    resetForm() {
        document.getElementById('medicineForm').reset();
        document.getElementById('medStartDate').value = Utils.getCurrentDate();
        
        // Hide extra time inputs
        const timeInputs = document.querySelectorAll('.time-input');
        timeInputs.forEach((input, index) => {
            if (index > 0) {
                input.style.display = 'none';
                input.removeAttribute('required');
            }
        });

        this.currentMedicine = null;

        // Reset form button text
        const submitBtn = document.querySelector('#medicineForm button[type="submit"]');
        submitBtn.innerHTML = '<span>➕</span> Add Medicine';
    },

    // Get medicine statistics
    async getMedicineStats(medicineId) {
        return await DataStore.getMedicineStats(medicineId);
    },

    // Complete medicine course
    async completeMedicine(id) {
        try {
            const medicine = await DataStore.get('medicines', id);
            
            if (!medicine) return;

            medicine.status = 'completed';
            medicine.completedAt = new Date().toISOString();
            
            await DataStore.updateMedicine(medicine);
            
            Utils.showToast(`✅ ${medicine.name} course completed!`, 'success');
            this.loadMedicines(this.currentFilter);

        } catch (error) {
            console.error('Error completing medicine:', error);
        }
    },

    // Reactivate medicine
    async reactivateMedicine(id) {
        try {
            const medicine = await DataStore.get('medicines', id);
            
            if (!medicine) return;

            medicine.status = 'active';
            delete medicine.completedAt;
            
            await DataStore.updateMedicine(medicine);
            
            Utils.showToast(`✅ ${medicine.name} reactivated!`, 'success');
            this.loadMedicines(this.currentFilter);

        } catch (error) {
            console.error('Error reactivating medicine:', error);
        }
    },

    // Search medicines
    async searchMedicines(query) {
        const allMedicines = await DataStore.getMedicines('all');
        const searchTerm = query.toLowerCase();
        
        return allMedicines.filter(medicine => 
            medicine.name.toLowerCase().includes(searchTerm) ||
            medicine.dosage.toLowerCase().includes(searchTerm) ||
            (medicine.instructions && medicine.instructions.toLowerCase().includes(searchTerm))
        );
    },

    // Export medicine data
    async exportMedicineData() {
        try {
            const medicines = await DataStore.getMedicines('all');
            const data = {
                medicines: medicines,
                exportDate: new Date().toISOString(),
                count: medicines.length
            };

            Utils.exportToJSON(data, `medicines-${Utils.getCurrentDate()}.json`);
            Utils.showToast('✅ Medicines exported successfully!', 'success');

        } catch (error) {
            console.error('Error exporting medicines:', error);
            Utils.showToast('❌ Failed to export medicines', 'error');
        }
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    MedicineManager.init();
});

// Make MedicineManager available globally
window.MedicineManager = MedicineManager;