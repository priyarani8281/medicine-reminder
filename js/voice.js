// ==================== VOICE COMMANDS MODULE ====================
// Handles voice recognition and voice commands

const VoiceManager = {
    recognition: null,
    isListening: false,
    enabled: true,
    
    // Initialize voice recognition
    init() {
        // Check browser support
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            console.log('Speech recognition not supported in this browser');
            this.enabled = false;
            return;
        }

        this.recognition = new SpeechRecognition();
        this.setupRecognition();
        this.setupUI();
        
        console.log('Voice Manager initialized');
    },

    // Setup recognition settings
    setupRecognition() {
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';

        this.recognition.onstart = () => {
            this.isListening = true;
            this.updateUI();
            Utils.showToast('🎤 Listening...', 'info');
        };

        this.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript.toLowerCase();
            console.log('Heard:', transcript);
            this.processCommand(transcript);
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.isListening = false;
            this.updateUI();
            
            if (event.error === 'no-speech') {
                Utils.showToast('No speech detected. Please try again.', 'warning');
            } else {
                Utils.showToast('Voice recognition error. Please try again.', 'error');
            }
        };

        this.recognition.onend = () => {
            this.isListening = false;
            this.updateUI();
        };
    },

    // Setup UI controls
    setupUI() {
        const voiceBtn = document.getElementById('voiceBtn');
        
        if (voiceBtn) {
            voiceBtn.addEventListener('click', () => {
                this.toggleListening();
            });
        }
    },

    // Toggle listening state
    toggleListening() {
        if (!this.enabled) {
            Utils.showToast('Voice commands are not supported in this browser', 'warning');
            return;
        }

        if (this.isListening) {
            this.stopListening();
        } else {
            this.startListening();
        }
    },

    // Start listening
    startListening() {
        try {
            this.recognition.start();
        } catch (error) {
            console.error('Failed to start recognition:', error);
            Utils.showToast('Failed to start voice recognition', 'error');
        }
    },

    // Stop listening
    stopListening() {
        try {
            this.recognition.stop();
        } catch (error) {
            console.error('Failed to stop recognition:', error);
        }
    },

    // Update UI based on listening state
    updateUI() {
        const voiceBtn = document.getElementById('voiceBtn');
        const voiceIcon = document.getElementById('voiceIcon');
        
        if (voiceBtn && voiceIcon) {
            if (this.isListening) {
                voiceBtn.classList.add('listening');
                voiceIcon.textContent = '🔴';
            } else {
                voiceBtn.classList.remove('listening');
                voiceIcon.textContent = '🎤';
            }
        }
    },

    // Process voice command
    async processCommand(transcript) {
        const command = transcript.toLowerCase().trim();

        // Navigate to sections
        if (command.includes('show') || command.includes('open') || command.includes('go to')) {
            if (command.includes('medicine') || command.includes('medication')) {
                this.executeCommand('showMedicines');
            } else if (command.includes('schedule')) {
                this.executeCommand('showSchedule');
            } else if (command.includes('dashboard') || command.includes('home')) {
                this.executeCommand('showDashboard');
            } else if (command.includes('analytics') || command.includes('report')) {
                this.executeCommand('showAnalytics');
            } else if (command.includes('achievement') || command.includes('trophy')) {
                this.executeCommand('showAchievements');
            } else if (command.includes('emergency')) {
                this.executeCommand('showEmergency');
            } else if (command.includes('setting')) {
                this.executeCommand('showSettings');
            }
        }
        
        // Add medicine
        else if (command.includes('add medicine') || command.includes('new medicine')) {
            this.executeCommand('addMedicine');
        }
        
        // Mark as taken
        else if (command.includes('mark') && command.includes('taken')) {
            const medicineName = this.extractMedicineName(command);
            if (medicineName) {
                this.executeCommand('markTaken', medicineName);
            } else {
                Utils.showToast('Please specify which medicine to mark as taken', 'warning');
                this.speak('Please specify which medicine to mark as taken');
            }
        }
        
        // Adherence rate
        else if (command.includes('adherence') || command.includes('compliance')) {
            this.executeCommand('showAdherence');
        }
        
        // Today's schedule
        else if (command.includes('today')) {
            this.executeCommand('showToday');
        }
        
        // Help
        else if (command.includes('help') || command.includes('what can you do')) {
            this.executeCommand('help');
        }
        
        // Unknown command
        else {
            Utils.showToast('Command not recognized. Say "help" for available commands.', 'warning');
            this.speak('I did not understand that command. Say help for available commands.');
        }
    },

    // Execute command
    async executeCommand(action, data = null) {
        switch (action) {
            case 'showDashboard':
                if (window.app) window.app.showSection('dashboard');
                this.speak('Showing dashboard');
                break;

            case 'showMedicines':
                if (window.app) window.app.showSection('medicines');
                this.speak('Showing medicines');
                break;

            case 'showSchedule':
                if (window.app) window.app.showSection('schedule');
                this.speak('Showing schedule');
                break;

            case 'showAnalytics':
                if (window.app) window.app.showSection('analytics');
                this.speak('Showing analytics');
                break;

            case 'showAchievements':
                if (window.app) window.app.showSection('achievements');
                this.speak('Showing achievements');
                break;

            case 'showEmergency':
                if (window.app) window.app.showSection('emergency');
                this.speak('Showing emergency contacts');
                break;

            case 'showSettings':
                if (window.app) window.app.showSection('settings');
                this.speak('Showing settings');
                break;

            case 'addMedicine':
                if (window.app) window.app.showSection('medicines');
                window.scrollTo({ top: 0, behavior: 'smooth' });
                this.speak('Opening add medicine form');
                break;

            case 'markTaken':
                await this.markMedicineAsTaken(data);
                break;

            case 'showAdherence':
                await this.announceAdherence();
                break;

            case 'showToday':
                if (window.app) {
                    window.app.showSection('dashboard');
                    await this.announceTodaySchedule();
                }
                break;

            case 'help':
                this.showHelp();
                break;

            default:
                Utils.showToast('Unknown command', 'warning');
        }
    },

    // Extract medicine name from command
    extractMedicineName(command) {
        // Remove common words to isolate medicine name
        const words = ['mark', 'as', 'taken', 'medicine', 'medication', 'dose'];
        let cleanCommand = command;
        
        words.forEach(word => {
            cleanCommand = cleanCommand.replace(new RegExp(word, 'gi'), '').trim();
        });
        
        return cleanCommand || null;
    },

    // Mark medicine as taken via voice
    async markMedicineAsTaken(medicineName) {
        try {
            const today = Utils.getCurrentDate();
            const schedules = await DataStore.getScheduleByDate(today);
            
            // Find matching schedule
            const schedule = schedules.find(s => 
                s.medicineName.toLowerCase().includes(medicineName.toLowerCase()) &&
                s.status === 'pending'
            );

            if (schedule) {
                await DataStore.markScheduleTaken(schedule.id);
                Utils.showToast(`✅ ${schedule.medicineName} marked as taken!`, 'success');
                this.speak(`${schedule.medicineName} marked as taken`);
                
                if (window.app) window.app.updateDashboard();
            } else {
                Utils.showToast('No pending dose found for that medicine', 'warning');
                this.speak('No pending dose found for that medicine');
            }

        } catch (error) {
            console.error('Error marking medicine as taken:', error);
            Utils.showToast('Failed to mark medicine as taken', 'error');
        }
    },

    // Announce adherence rate
    async announceAdherence() {
        try {
            const startDate = Utils.addDaysToDate(Utils.getCurrentDate(), -30);
            const endDate = Utils.getCurrentDate();
            const rate = await DataStore.getAdherenceRate(startDate, endDate);
            
            const message = `Your adherence rate for the past 30 days is ${Math.round(rate)} percent`;
            Utils.showToast(message, 'info');
            this.speak(message);

        } catch (error) {
            console.error('Error getting adherence rate:', error);
        }
    },

    // Announce today's schedule
    async announceTodaySchedule() {
        try {
            const stats = await DataStore.getTodayStats();
            const message = `You have ${stats.total} doses scheduled today. ${stats.taken} taken, ${stats.pending} pending`;
            
            Utils.showToast(message, 'info');
            this.speak(message);

        } catch (error) {
            console.error('Error getting today schedule:', error);
        }
    },

    // Show help commands
    showHelp() {
        const helpText = `
            Available voice commands:
            - "Show my medicines"
            - "Show schedule"
            - "Show dashboard"
            - "Add new medicine"
            - "Mark [medicine name] as taken"
            - "What's my adherence rate?"
            - "Show today's schedule"
        `;
        
        Utils.showToast(helpText, 'info', 8000);
        this.speak('Available commands include: show my medicines, show schedule, add new medicine, and mark medicine as taken');
    },

    // Text-to-speech
    speak(text) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.9;
            utterance.pitch = 1;
            utterance.volume = 0.8;
            
            window.speechSynthesis.speak(utterance);
        }
    },

    // Enable/disable voice commands
    setEnabled(enabled) {
        this.enabled = enabled;
        
        if (!enabled && this.isListening) {
            this.stopListening();
        }
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    VoiceManager.init();
});

// Make VoiceManager available globally
window.VoiceManager = VoiceManager;