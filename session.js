/**
 * Session Manager
 * Handles 10-shot session tracking and analysis
 */

const SessionManager = {
    isSessionActive: false,
    currentShot: 0,
    maxShots: 10,
    shots: [],
    sessionStartTime: null,
    
    startSession() {
        this.isSessionActive = true;
        this.currentShot = 0;
        this.shots = [];
        this.sessionStartTime = Date.now();
        
        const counter = document.getElementById('session-counter');
        if (counter) counter.classList.remove('hidden');
        
        this.updateSessionUI();
        
        const sessionBtn = document.getElementById('session-btn');
        if (sessionBtn) sessionBtn.disabled = true;
        
        console.log('✅ 10-shot session started');
    },
    
    captureShot(formData) {
        if (!this.isSessionActive || this.currentShot >= this.maxShots) {
            return false;
        }
        
        this.currentShot++;
        
        const shotData = {
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
        this.showShotScore(shotData.overallScore);
        
        if (this.currentShot >= this.maxShots) {
            setTimeout(() => this.completeSession(), 1500);
        }
        
        console.log(`📸 Shot ${this.currentShot}/10 - Score: ${Math.round(shotData.overallScore)}`);
        return true;
    },
    
    updateSessionUI() {
        const elem = document.getElementById('current-shot');
        if (elem) elem.textContent = this.currentShot;
    },
    
    showShotScore(score) {
        const display = document.getElementById('shot-score-display');
        if (!display) return;
        
        display.textContent = Math.round(score);
        display.style.animation = 'none';
        setTimeout(() => {
            display.style.animation = 'pulse 0.5s ease';
        }, 10);
    },
    
    completeSession() {
        this.isSessionActive = false;
        
        const counter = document.getElementById('session-counter');
        if (counter) counter.classList.add('hidden');
        
        const stats = this.calculateSessionStats();
        const savedSession = StorageManager.saveSession(stats);
        const newAchievements = StorageManager.checkAchievements(savedSession, StorageManager.getAllSessions());
        
        this.showSessionSummary(stats, newAchievements);
        
        const sessionBtn = document.getElementById('session-btn');
        if (sessionBtn) sessionBtn.disabled = false;
        
        if (window.updateDashboard) {
            window.updateDashboard();
        }
        
        console.log('✅ Session complete');
    },
    
    calculateSessionStats() {
        const scores = this.shots.map(s => s.overallScore);
        const elbowAngles = this.shots.map(s => s.elbowAngle);
        const releaseHeights = this.shots.map(s => s.releaseHeight);
        const kneeAngles = this.shots.map(s => s.kneeAngle);
        const alignments = this.shots.map(s => s.alignment);
        
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        const bestShot = this.shots.reduce((best, shot) => 
            shot.overallScore > best.overallScore ? shot : best
        );
        const worstShot = this.shots.reduce((worst, shot) => 
            shot.overallScore < worst.overallScore ? shot : worst
        );
        
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
                avgElbow: Math.round(elbowAngles.reduce((a, b) => a + b, 0) / elbowAngles.length),
                avgRelease: Math.round(releaseHeights.reduce((a, b) => a + b, 0) / releaseHeights.length),
                avgKnee: Math.round(kneeAngles.reduce((a, b) => a + b, 0) / kneeAngles.length),
                avgAlignment: Math.round(alignments.reduce((a, b) => a + b, 0) / alignments.length)
            },
            consistency: this.calculateConsistency(scores),
            duration: Date.now() - this.sessionStartTime,
            tips: this.generateTips(this.shots)
        };
    },
    
    calculateConsistency(scores) {
        const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
        const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
        const stdDev = Math.sqrt(variance);
        return Math.max(0, 100 - (stdDev * 5));
    },
    
    calculateVariance(numbers) {
        const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
        return numbers.reduce((sum, num) => sum + Math.pow(num - mean, 2), 0) / numbers.length;
    },
    
    generateTips(shots) {
        const tips = [];
        
        const elbowAngles = shots.map(s => s.elbowAngle);
        const avgElbow = elbowAngles.reduce((a, b) => a + b, 0) / elbowAngles.length;
        
        if (avgElbow < 85) {
            tips.push({
                icon: '↑',
                title: 'Raise Your Elbow',
                text: 'Your elbow tends to drop. Focus on keeping it at 90° during release.'
            });
        } else if (avgElbow > 95) {
            tips.push({
                icon: '↓',
                title: 'Lower Your Elbow',
                text: 'Your elbow is too high. Aim for 85-95° angle.'
            });
        }
        
        const releases = shots.map(s => s.releaseHeight);
        const avgRelease = releases.reduce((a, b) => a + b, 0) / releases.length;
        
        if (avgRelease < 45) {
            tips.push({
                icon: '🎯',
                title: 'Release Height',
                text: 'Release higher for better arc and accuracy.'
            });
        }
        
        const bestShots = shots.filter(s => s.overallScore >= 90);
        if (bestShots.length > 0) {
            tips.push({
                icon: '⭐',
                title: 'Great Work!',
                text: `You had ${bestShots.length} excellent shot(s) with 90+ scores!`
            });
        }
        
        if (tips.length === 0) {
            tips.push({
                icon: '👍',
                title: 'Keep Practicing',
                text: 'Your form is developing well. Keep it up!'
            });
        }
        
        return tips;
    },
    
    showSessionSummary(stats, newAchievements) {
        const summaryHTML = `
            <div class="session-summary-overlay">
                <div class="session-summary-card">
                    <h2>🎯 Session Complete!</h2>
                    <div class="summary-score">
                        <div class="summary-score-circle">
                            <span class="summary-score-value">${stats.averageScore}</span>
                            <span class="summary-score-label">/100</span>
                        </div>
                        <p class="summary-score-text">Average Score</p>
                    </div>
                    <div class="summary-stats">
                        <div class="summary-stat-item">
                            <span class="summary-stat-label">Best Shot</span>
                            <span class="summary-stat-value">#${stats.bestShot.number} (${stats.bestShot.score})</span>
                        </div>
                        <div class="summary-stat-item">
                            <span class="summary-stat-label">Consistency</span>
                            <span class="summary-stat-value">${Math.round(stats.consistency)}/100</span>
                        </div>
                    </div>
                    <div class="summary-tips">
                        <h3>💡 Tips</h3>
                        ${stats.tips.map(tip => `
                            <div class="summary-tip-item">
                                <span class="tip-icon">${tip.icon}</span>
                                <div class="tip-content">
                                    <strong>${tip.title}</strong>
                                    <p>${tip.text}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <button class="btn btn-primary close-summary">Continue</button>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', summaryHTML);
        
        const closeBtn = document.querySelector('.close-summary');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                const overlay = document.querySelector('.session-summary-overlay');
                if (overlay) overlay.remove();
                
                if (stats.averageScore >= 90 && window.CelebrationManager) {
                    CelebrationManager.showCelebration(stats.averageScore);
                }
            });
        }
    },
    
    cancelSession() {
        if (this.isSessionActive) {
            if (confirm('Cancel session? Progress will be lost.')) {
                this.isSessionActive = false;
                this.currentShot = 0;
                this.shots = [];
                
                const counter = document.getElementById('session-counter');
                if (counter) counter.classList.add('hidden');
                
                const sessionBtn = document.getElementById('session-btn');
                if (sessionBtn) sessionBtn.disabled = false;
                
                console.log('❌ Session cancelled');
            }
        }
    }
};

console.log('✅ SessionManager loaded');
