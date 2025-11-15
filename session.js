const SessionManager = {
    isSessionActive: false,
    currentShot: 0,
    maxShots: 10,
    shots: [],
    sessionStartTime: null,
    
    startSession: function() {
        this.isSessionActive = true;
        this.currentShot = 0;
        this.shots = [];
        this.sessionStartTime = Date.now();
        
        var counter = document.getElementById('session-counter');
        if (counter) counter.classList.remove('hidden');
        
        this.updateSessionUI();
        
        var sessionBtn = document.getElementById('session-btn');
        if (sessionBtn) sessionBtn.disabled = true;
        
        console.log('Session started');
    },
    
    captureShot: function(formData) {
        if (!this.isSessionActive || this.currentShot >= this.maxShots) {
            return false;
        }
        
        this.currentShot++;
        
        var shotData = {
            shotNumber: this.currentShot,
            timestamp: Date.now(),
            overallScore: formData.overallScore,
            elbowAngle: formData.elbowAngle,
            releaseHeight: formData.releaseHeight,
            kneeAngle: formData.kneeAngle,
            alignment: formData.alignment,
            elbowScore: formData.elbowScore,
            releaseScore: formData.releaseScore,
            kneeScore: formData.kneeScore,
            alignmentScore: formData.alignmentScore
        };
        
        this.shots.push(shotData);
        this.updateSessionUI();
        
        if (this.currentShot >= this.maxShots) {
            var self = this;
            setTimeout(function() { self.completeSession(); }, 1500);
        }
        
        console.log('Shot ' + this.currentShot + '/10 captured');
        return true;
    },
    
    updateSessionUI: function() {
        var elem = document.getElementById('current-shot');
        if (elem) elem.textContent = this.currentShot;
    },
    
    completeSession: function() {
        this.isSessionActive = false;
        
        var counter = document.getElementById('session-counter');
        if (counter) counter.classList.add('hidden');
        
        var stats = this.calculateSessionStats();
        
        if (window.StorageManager) {
            var savedSession = StorageManager.saveSession(stats);
        }
        
        this.showSessionSummary(stats);
        
        var sessionBtn = document.getElementById('session-btn');
        if (sessionBtn) sessionBtn.disabled = false;
        
        if (window.updateDashboard) {
            window.updateDashboard();
        }
        
        console.log('Session complete');
    },
    
    calculateSessionStats: function() {
        var scores = this.shots.map(function(s) { return s.overallScore; });
        var avgScore = scores.reduce(function(a, b) { return a + b; }, 0) / scores.length;
        
        var bestShot = this.shots[0];
        var worstShot = this.shots[0];
        
        for (var i = 0; i < this.shots.length; i++) {
            if (this.shots[i].overallScore > bestShot.overallScore) {
                bestShot = this.shots[i];
            }
            if (this.shots[i].overallScore < worstShot.overallScore) {
                worstShot = this.shots[i];
            }
        }
        
        return {
            shots: this.shots,
            averageScore: Math.round(avgScore),
            bestShot: {
                number: bestShot.shotNumber,
                score: Math.round(bestShot.overallScore)
            },
            worstShot: {
                number: worstShot.shotNumber,
                score: Math.round(worstShot.overallScore)
            },
            metrics: {
                avgElbow: 90,
                avgRelease: 50,
                avgKnee: 120,
                avgAlignment: 95
            },
            consistency: 85,
            duration: Date.now() - this.sessionStartTime,
            tips: []
        };
    },
    
    showSessionSummary: function(stats) {
        var summaryHTML = '<div class="session-summary-overlay">' +
            '<div class="session-summary-card">' +
            '<h2>Session Complete!</h2>' +
            '<div class="summary-score">' +
            '<div class="summary-score-circle">' +
            '<span class="summary-score-value">' + stats.averageScore + '</span>' +
            '<span class="summary-score-label">/100</span>' +
            '</div>' +
            '<p class="summary-score-text">Average Score</p>' +
            '</div>' +
            '<button class="btn btn-primary close-summary">Continue</button>' +
            '</div>' +
            '</div>';
        
        document.body.insertAdjacentHTML('beforeend', summaryHTML);
        
        var closeBtn = document.querySelector('.close-summary');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                var overlay = document.querySelector('.session-summary-overlay');
                if (overlay) overlay.remove();
            });
        }
    },
    
    cancelSession: function() {
        if (this.isSessionActive) {
            if (confirm('Cancel session?')) {
                this.isSessionActive = false;
                this.currentShot = 0;
                this.shots = [];
                
                var counter = document.getElementById('session-counter');
                if (counter) counter.classList.add('hidden');
                
                var sessionBtn = document.getElementById('session-btn');
                if (sessionBtn) sessionBtn.disabled = false;
            }
        }
    }
};

console.log('SessionManager loaded');
