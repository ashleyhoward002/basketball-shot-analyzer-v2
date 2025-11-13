/**
 * Session Manager
 * Handles active shooting sessions and shot tracking
 */
const SessionManager = {
    isSessionActive: false,
    currentShot: 0,
    maxShots: 10,
    shots: [],

    /**
     * Start a new 10-shot session
     */
    startSession() {
        this.isSessionActive = true;
        this.currentShot = 0;
        this.shots = [];

        document.getElementById('session-counter').classList.remove('hidden');
        document.getElementById('session-btn').disabled = true;
        document.getElementById('current-shot').textContent = '0';
        document.getElementById('shot-score-display').textContent = '--';
    },

    /**
     * Capture a shot during session
     */
    captureShot(formData) {
        if (!this.isSessionActive || this.currentShot >= this.maxShots) {
            return false;
        }

        this.currentShot++;
        this.shots.push(formData);

        document.getElementById('current-shot').textContent = this.currentShot;
        document.getElementById('shot-score-display').textContent = formData.overallScore;

        if (this.currentShot >= this.maxShots) {
            this.completeSession();
        }

        return true;
    },

    /**
     * Complete the session
     */
    completeSession() {
        this.isSessionActive = false;

        const sessionStats = this.calculateSessionStats();
        const newAchievements = StorageManager.checkAchievements(
            { averageScore: sessionStats.averageScore },
            StorageManager.getAllSessions()
        );

        StorageManager.saveSession(sessionStats);

        this.showSessionSummary(sessionStats, newAchievements);

        document.getElementById('session-counter').classList.add('hidden');
        document.getElementById('session-btn').disabled = false;

        if (window.updateDashboard) {
            window.updateDashboard();
        }
    },

    /**
     * Calculate session statistics
     */
    calculateSessionStats() {
        const scores = this.shots.map(s => s.overallScore);
        const averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

        const bestShotIndex = scores.indexOf(Math.max(...scores));
        const worstShotIndex = scores.indexOf(Math.min(...scores));

        const metrics = {
            avgElbow: Math.round(this.shots.reduce((sum, s) => sum + s.elbowAngle, 0) / this.shots.length),
            avgRelease: Math.round(this.shots.reduce((sum, s) => sum + s.releaseHeight, 0) / this.shots.length),
            avgKnee: Math.round(this.shots.reduce((sum, s) => sum + s.kneeAngle, 0) / this.shots.length),
            avgAlignment: Math.round(this.shots.reduce((sum, s) => sum + s.alignment, 0) / this.shots.length)
        };

        const variance = this.calculateVariance(scores);
        const consistency = Math.max(0, 100 - variance);

        const tips = this.generateTips(metrics, averageScore);

        return {
            shots: this.shots,
            averageScore,
            bestShot: { number: bestShotIndex + 1, score: scores[bestShotIndex] },
            worstShot: { number: worstShotIndex + 1, score: scores[worstShotIndex] },
            metrics,
            consistency,
            tips
        };
    },

    /**
     * Generate personalized tips
     */
    generateTips(metrics, avgScore) {
        const tips = [];

        if (metrics.avgElbow < 85 || metrics.avgElbow > 95) {
            tips.push({
                icon: '💪',
                title: 'Elbow Position',
                text: `Your average elbow angle is ${metrics.avgElbow}°. Aim for 85-95° for optimal shooting form.`
            });
        }

        if (metrics.avgRelease < 45) {
            tips.push({
                icon: '📐',
                title: 'Release Height',
                text: 'Try releasing the ball higher. A higher release point makes your shot harder to block.'
            });
        }

        if (metrics.avgKnee < 100 || metrics.avgKnee > 130) {
            tips.push({
                icon: '🦵',
                title: 'Knee Bend',
                text: 'Focus on consistent knee bend (100-130°) to generate power from your legs.'
            });
        }

        if (metrics.avgAlignment < 90) {
            tips.push({
                icon: '⚖️',
                title: 'Body Alignment',
                text: 'Keep your shoulders level. Good alignment improves accuracy and consistency.'
            });
        }

        if (avgScore >= 85) {
            tips.push({
                icon: '🎯',
                title: 'Excellent Work!',
                text: 'Your form is excellent! Keep practicing to maintain this level of consistency.'
            });
        } else if (avgScore >= 70) {
            tips.push({
                icon: '👍',
                title: 'Good Progress',
                text: 'You\'re doing well! Focus on the highlighted areas to reach elite level.'
            });
        } else {
            tips.push({
                icon: '💡',
                title: 'Keep Practicing',
                text: 'Focus on one aspect at a time. Slow, deliberate practice builds muscle memory.'
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
