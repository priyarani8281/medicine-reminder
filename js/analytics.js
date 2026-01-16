// ==================== ANALYTICS MODULE ====================
// Handles data visualization and reporting

const AnalyticsManager = {
    charts: {},

    // Initialize analytics
    init() {
        this.loadCharts();
        console.log('Analytics Manager initialized');
    },

    // Load all charts
    async loadCharts() {
        await this.loadAdherenceChart();
        await this.loadWeeklyChart();
        await this.loadMedicineChart();
    },

    // Adherence trend chart (30 days)
    async loadAdherenceChart() {
        const canvas = document.getElementById('adherenceChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        // Get data for last 30 days
        const dates = [];
        const adherenceData = [];
        
        for (let i = 29; i >= 0; i--) {
            const date = Utils.addDaysToDate(Utils.getCurrentDate(), -i);
            dates.push(Utils.formatDate(date));
            
            const schedules = await DataStore.getScheduleByDate(date);
            const total = schedules.length;
            const taken = schedules.filter(s => s.status === 'taken').length;
            const adherence = total > 0 ? (taken / total * 100) : 0;
            
            adherenceData.push(adherence);
        }

        // Destroy existing chart
        if (this.charts.adherence) {
            this.charts.adherence.destroy();
        }

        // Create new chart
        this.charts.adherence = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Adherence Rate (%)',
                    data: adherenceData,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 3,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.parsed.y.toFixed(1)}%`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: (value) => value + '%'
                        }
                    }
                }
            }
        });
    },

    // Weekly overview chart
    async loadWeeklyChart() {
        const canvas = document.getElementById('weeklyChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        const weekDates = Utils.getWeekDates(0);
        const labels = weekDates.map(date => Utils.getDayOfWeek(date).substring(0, 3));
        
        const takenData = [];
        const missedData = [];
        const pendingData = [];
        
        for (let date of weekDates) {
            const schedules = await DataStore.getScheduleByDate(date);
            takenData.push(schedules.filter(s => s.status === 'taken').length);
            missedData.push(schedules.filter(s => s.status === 'missed').length);
            pendingData.push(schedules.filter(s => s.status === 'pending').length);
        }

        // Destroy existing chart
        if (this.charts.weekly) {
            this.charts.weekly.destroy();
        }

        // Create new chart
        this.charts.weekly = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Taken',
                        data: takenData,
                        backgroundColor: '#48bb78'
                    },
                    {
                        label: 'Missed',
                        data: missedData,
                        backgroundColor: '#f56565'
                    },
                    {
                        label: 'Pending',
                        data: pendingData,
                        backgroundColor: '#ed8936'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    x: {
                        stacked: true
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true
                    }
                }
            }
        });
    },

    // Medicine-wise performance chart
    async loadMedicineChart() {
        const canvas = document.getElementById('medicineChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        const medicines = await DataStore.getMedicines('active');
        const labels = [];
        const adherenceData = [];
        const colors = [];
        
        for (let medicine of medicines.slice(0, 10)) { // Limit to 10 medicines
            labels.push(medicine.name);
            
            const stats = await DataStore.getMedicineStats(medicine.id);
            adherenceData.push(stats.adherence);
            
            // Color based on adherence
            if (stats.adherence >= 80) {
                colors.push('#48bb78'); // Green
            } else if (stats.adherence >= 60) {
                colors.push('#ed8936'); // Orange
            } else {
                colors.push('#f56565'); // Red
            }
        }

        // Destroy existing chart
        if (this.charts.medicine) {
            this.charts.medicine.destroy();
        }

        // Create new chart
        this.charts.medicine = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Adherence Rate (%)',
                    data: adherenceData,
                    backgroundColor: colors
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: (value) => value + '%'
                        }
                    }
                }
            }
        });
    },

    // Generate PDF report
    async generateReport() {
        Utils.showLoading(true);

        try {
            const reportType = document.getElementById('reportType').value;
            let startDate, endDate, title;

            if (reportType === 'weekly') {
                const weekDates = Utils.getWeekDates(0);
                startDate = weekDates[0];
                endDate = weekDates[6];
                title = 'Weekly Health Report';
            } else if (reportType === 'monthly') {
                const today = new Date();
                startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
                endDate = Utils.getCurrentDate();
                title = 'Monthly Health Report';
            } else {
                // Custom - for now use last 30 days
                startDate = Utils.addDaysToDate(Utils.getCurrentDate(), -30);
                endDate = Utils.getCurrentDate();
                title = 'Custom Health Report';
            }

            // Generate report data
            const medicines = await DataStore.getMedicines('all');
            const schedules = await DataStore.getScheduleByDateRange(startDate, endDate);
            const adherenceRate = await DataStore.getAdherenceRate(startDate, endDate);

            const totalDoses = schedules.length;
            const takenDoses = schedules.filter(s => s.status === 'taken').length;
            const missedDoses = schedules.filter(s => s.status === 'missed').length;

            // Create PDF using jsPDF
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            // Title
            doc.setFontSize(20);
            doc.text(title, 105, 20, { align: 'center' });

            // Date range
            doc.setFontSize(12);
            doc.text(`Period: ${Utils.formatDate(startDate)} to ${Utils.formatDate(endDate)}`, 105, 30, { align: 'center' });

            // Summary section
            doc.setFontSize(16);
            doc.text('Summary', 20, 50);

            doc.setFontSize(12);
            doc.text(`Total Medicines: ${medicines.length}`, 20, 60);
            doc.text(`Total Doses Scheduled: ${totalDoses}`, 20, 70);
            doc.text(`Doses Taken: ${takenDoses}`, 20, 80);
            doc.text(`Doses Missed: ${missedDoses}`, 20, 90);
            doc.text(`Adherence Rate: ${Math.round(adherenceRate)}%`, 20, 100);

            // Medicines section
            doc.setFontSize(16);
            doc.text('Active Medicines', 20, 120);

            doc.setFontSize(10);
            let yPos = 130;
            const activeMedicines = medicines.filter(m => m.status === 'active');
            
            for (let medicine of activeMedicines.slice(0, 10)) {
                doc.text(`• ${medicine.name} - ${medicine.dosage}`, 25, yPos);
                yPos += 7;
                
                if (yPos > 270) {
                    doc.addPage();
                    yPos = 20;
                }
            }

            // Performance section
            if (yPos > 200) {
                doc.addPage();
                yPos = 20;
            }

            doc.setFontSize(16);
            doc.text('Medicine-wise Performance', 20, yPos);
            yPos += 15;

            doc.setFontSize(10);
            for (let medicine of activeMedicines.slice(0, 10)) {
                const stats = await DataStore.getMedicineStats(medicine.id);
                doc.text(`${medicine.name}: ${Math.round(stats.adherence)}% adherence`, 25, yPos);
                yPos += 7;
                
                if (yPos > 270) {
                    doc.addPage();
                    yPos = 20;
                }
            }

            // Footer
            doc.setFontSize(8);
            doc.text('Generated by Medicine Reminder Pro', 105, 285, { align: 'center' });
            doc.text(new Date().toLocaleString(), 105, 290, { align: 'center' });

            // Save PDF
            const filename = `health-report-${Utils.getCurrentDate()}.pdf`;
            doc.save(filename);

            Utils.showToast('✅ Report generated successfully!', 'success');

        } catch (error) {
            console.error('Error generating report:', error);
            Utils.showToast('❌ Failed to generate report', 'error');
        }

        Utils.showLoading(false);
    },

    // Get statistics summary
    async getStatsSummary() {
        const today = Utils.getCurrentDate();
        const last30Days = Utils.addDaysToDate(today, -30);
        
        return {
            totalMedicines: (await DataStore.getMedicines('all')).length,
            activeMedicines: (await DataStore.getMedicines('active')).length,
            adherenceRate: await DataStore.getAdherenceRate(last30Days, today),
            todayStats: await DataStore.getTodayStats()
        };
    },

    // Refresh all charts
    async refreshCharts() {
        await this.loadCharts();
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    AnalyticsManager.init();
});

// Make AnalyticsManager available globally
window.AnalyticsManager = AnalyticsManager;