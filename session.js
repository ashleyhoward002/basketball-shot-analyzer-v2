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
    
    /**
     * Start a new 10-shot session
     */
    startSession() {
        this.isSessionActive = true;
        this.currentShot = 0;
        this.shots = [];
        this.sessionStartTime = Date.now();
        
        const counter = document.getElementById('session-counter');
        counter.classList.remove('hidden');
        
        this.updateSessionUI();
        
        document.getElementById('session-btn').disabled = true;
        
        console.log('✅ 10-shot session started');
    },
    
    /**
     * Capture current shot data
     */
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
        
        console.log(`📸 Shot ${this.currentShot}/10 captured - Score: ${Math.round(shotData.overallScore)}`);
        
        return true;
    },
    
    /**
     * Update session UI
     */
    updateSessionUI() {
        document.getElementById('current-shot').textContent = this.currentShot;
    },
    
    /**
     * Show shot score feedback
     */
    showShotScore(score) {
        const display = document.getElementById('shot-score-display');
        display.textContent = Math.round(score);
        
        display.style.animation = 'none';
        setTimeout(() => {
            display.style.animation = 'pulse 0.5s ease';
        }, 10);
    },
    
    /**
     * Complete the session and show summary
     */
    completeSession() {
        this.isSessionActive = false;
        
        const counter = document.getElementById('session-counter');
        counter.classList.add('hidden');
        
        const stats = this.calculateSessionStats();
        
        const savedSession = StorageManager.saveSession(stats);
        
        const newAchievements = StorageManager.checkAchievements(savedSession, StorageManager.getAllSessions());
        
        this.showSessionSummary(stats, newAchievements);
        
        document.getElementById('session-btn').disabled = false;
        
        if (window.updateDashboard) {
            window.updateDashboard();
        }
        
        console.log('✅ Session complete:', stats);
    },
    
    /**
     * Calculate session statistics
     */
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
    
    /**
     * Calculate consistency score
     */
    calculateConsistency(scores) {
        const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
        const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
        const stdDev = Math.sqrt(variance);
        
        return Math.max(0, 100 - (stdDev * 5));
    },
    
    /**
     * Generate personalized tips
     */
    generateTips(shots) {
        const tips = [];
        
        const elbowAngles = shots.map(s => s.elbowAngle);
        const elbowVariance = this.calculateVariance(elbowAngles);
        const avgElbow = elbowAngles.reduce((a, b) => a + b, 0) / elbowAngles.length;
        
        if (elbowVariance > 50) {
            tips.push({
                icon: '💪',
                title: 'Elbow Consistency',
                text: `Your elbow angle varies by ${Math.round(Math.sqrt(elbowVariance))}°. Practice slow-motion form to build muscle memory.`
            });
        }
        
        if (avgElbow < 85) {
            tips.push({
                icon: '↑',
                title: 'Raise Your Elbow',
                text: 'Your elbow tends to drop. Focus on keeping it at 90° during your release.'
            });
        } else if (avgElbow > 95) {
            tips.push({
                icon: '↓',
                title: 'Lower Your Elbow',
                text: 'Your elbow is too high. Aim for a comfortable 85-95° angle.'
            });
        }
        
        const releases = shots.map(s => s.releaseHeight);
        const avgRelease = releases.reduce((a, b) => a + b, 0) / releases.length;
        
        if (avgRelease < 45) {
            tips.push({
                icon: '🎯',
                title: 'Release Height',
                text: 'Release your shot higher for better arc and accuracy.'
            });
        }
        
        const knees = shots.map(s => s.kneeAngle);
        const avgKnee = knees.reduce((a, b) => a + b, 0) / knees.length;
        
        if (avgKnee > 130) {
            tips.push({
                icon: '💪',
                title: 'Leg Power',
                text: 'Bend your knees more to generate power from your legs, not just your arms.'
            });
        }
        
        const earlyScores = shots.slice(0, 5).map(s => s.overallScore);
        const lateScores = shots.slice(5).map(s => s.overallScore);
        const earlyAvg = earlyScores.reduce((a, b) => a + b, 0) / earlyScores.length;
        const lateAvg = lateScores.reduce((a, b) => a + b, 0) / lateScores.length;
        
        if (lateAvg < earlyAvg - 10) {
            tips.push({
                icon: '⏸️',
                title: 'Fatigue Management',
                text: 'Your form declines in later shots. Take breaks between sets to maintain quality.'
            });
        }
        
        const bestShots = shots.filter(s => s.overallScore >= 90);
        if (bestShots.length > 0) {
            tips.push({
                icon: '⭐',
                title: 'Great Work!',
                text: `You had ${bestShots.length} excellent shot(s) with 90+ scores. You know what good form feels like!`
            });
        }
        
        if (tips.length === 0) {
            tips.push({
                icon: '👍',
                title: 'Keep Practicing',
                text: 'Your form is developing well. Keep practicing consistently to see improvement!'
            });
        }
        
        return tips;
    },
    /**
     * Show session summary modal/overlay
     */
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
                            <span class="summary-stat-label">Worst Shot</span>
                            <span class="summary-stat-value">#${stats.worstShot.number} (${stats.worstShot.score})</span>
                        </div>
                        <div class="summary-stat-item">
                            <span class="summary-stat-label">Consistency</span>
                            <span class="summary-stat-value">${Math.round(stats.consistency)}/100</span>
                        </div>
                    </div>
                    
                    <div class="summary-tips">
                        <h3>💡 Personalized Tips</h3>
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
                    
                    ${newAchievements.length > 0 ? `
                        <div class="summary-achievements">
                            <h3>🏆 New Achievements!</h3>
                            ${newAchievements.map(ach => `
                                <div class="summary-achievement-item">
                                    <span class="achievement-icon">${ach.icon}</span>
                                    <div>
                                        <strong>${ach.title}</strong>
                                        <p>${ach.description}</p>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    <button class="btn btn-primary close-summary">Continue</button>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', summaryHTML);
        
        document.querySelector('.close-summary').addEventListener('click', () => {
            document.querySelector('.session-summary-overlay').remove();
            
            if (stats.averageScore >= 90) {
                CelebrationManager.showCelebration(stats.averageScore);
            }
        });
    },
    
    /**
     * Helper: Calculate variance
     */
    calculateVariance(numbers) {
        const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
        return numbers.reduce((sum, num) => sum + Math.pow(num - mean, 2), 0) / numbers.length;
    },
    
    /**
     * Cancel current session
     */
    cancelSession() {
        if (this.isSessionActive) {
            if (confirm('Are you sure you want to cancel this session? Your progress will be lost.')) {
                this.isSessionActive = false;
                this.currentShot = 0;
                this.shots = [];
                
                document.getElementById('session-counter').classList.add('hidden');
                document.getElementById('session-btn').disabled = false;
                
                console.log('❌ Session cancelled');
            }
        }
    }
};

// Add CSS for session summary
const summaryStyles = `
<style>
.session-summary-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    animation: fadeIn 0.3s ease;
}

.session-summary-card {
    background: white;
    border-radius: 20px;
    padding: 40px;
    max-width: 600px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    animation: slideUp 0.4s ease;
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes slideUp {
    from {
        opacity: 0;
        transform: translateY(50px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.session-summary-card h2 {
    text-align: center;
    color: #667eea;
    font-size: 2rem;
    margin-bottom: 30px;
}

.summary-score {
    text-align: center;
    margin-bottom: 30px;
}

.summary-score-circle {
    display: inline-flex;
    align-items: baseline;
    gap: 5px;
}

.summary-score-value {
    font-size: 4rem;
    font-weight: 800;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.summary-score-label {
    font-size: 1.5rem;
    color: #999;
}

.summary-score-text {
    color: #666;
    font-size: 1.1rem;
    margin-top: 10px;
}

.summary-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    margin-bottom: 30px;
    padding: 20px;
    background: rgba(102, 126, 234, 0.05);
    border-radius: 15px;
}

.summary-stat-item {
    text-align: center;
}

.summary-stat-label {
    display: block;
    font-size: 0.9rem;
    color: #666;
    margin-bottom: 8px;
}

.summary-stat-value {
    display: block;
    font-size: 1.3rem;
    font-weight: 700;
    color: #667eea;
}

.summary-tips {
    margin-bottom: 30px;
}

.summary-tips h3 {
    color: #667eea;
    margin-bottom: 15px;
}

.summary-tip-item {
    display: flex;
    gap: 15px;
    padding: 15px;
    background: rgba(102, 126, 234, 0.05);
    border-radius: 10px;
    margin-bottom: 10px;
}

.tip-icon {
    font-size: 1.5rem;
}

.tip-content strong {
    display: block;
    color: #333;
    margin-bottom: 5px;
}

.tip-content p {
    color: #666;
    font-size: 0.95rem;
    line-height: 1.5;
}

.summary-achievements {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
    padding: 20px;
    border-radius: 15px;
    margin-bottom: 30px;
}

.summary-achievements h3 {
    color: #667eea;
    margin-bottom: 15px;
}

.summary-achievement-item {
    display: flex;
    align-items: center;
    gap: 15px;
    padding: 15px;
    background: white;
    border-radius: 10px;
    margin-bottom: 10px;
}

.summary-achievement-item .achievement-icon {
    font-size: 2rem;
}

.summary-achievement-item strong {
    display: block;
    color: #667eea;
    margin-bottom: 5px;
}

.summary-achievement-item p {
    color: #666;
    font-size: 0.9rem;
}

.close-summary {
    width: 100%;
    justify-content: center;
}
</style>
`;

document.head.insertAdjacentHTML('beforeend', summaryStyles);

console.log('✅ SessionManager loaded successfully');
