/**
 * Progress Manager
 * Handles progress view, charts, and statistics
 */

const ProgressManager = {
    chart: null,
    currentPeriod: 'week',
    
    /**
     * Initialize progress view
     */
    init() {
        this.setupEventListeners();
        this.updateProgress();
    },
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentPeriod = e.target.dataset.period;
                this.updateProgress();
            });
        });
    },
    
    /**
     * Update all progress displays
     */
    updateProgress() {
        this.updateStats();
        this.updateChart();
        this.updateMetricsBreakdown();
        this.updateInsights();
    },
    
    /**
     * Update overall statistics
     */
    updateStats() {
        const sessions = StorageManager.getSessionsByPeriod(this.currentPeriod);
        const stats = StorageManager.getStats();
        
        document.getElementById('total-sessions').textContent = sessions.length;
        
        if (sessions.length > 0) {
            const avgScore = sessions.reduce((sum, s) => sum + s.averageScore, 0) / sessions.length;
            document.getElementById('avg-score').textContent = Math.round(avgScore);
        } else {
            document.getElementById('avg-score').textContent = '--';
        }
        
        if (sessions.length > 0) {
            const bestScore = Math.max(...sessions.map(s => s.averageScore));
            document.getElementById('best-score').textContent = bestScore;
        } else {
            document.getElementById('best-score').textContent = '--';
        }
        
        const improvement = stats.improvement;
        const improvementEl = document.getElementById('improvement');
        if (improvement > 0) {
            improvementEl.textContent = '+' + improvement;
            improvementEl.style.color = '#4ade80';
        } else if (improvement < 0) {
            improvementEl.textContent = improvement;
            improvementEl.style.color = '#ef4444';
        } else {
            improvementEl.textContent = '--';
            improvementEl.style.color = '#666';
        }
    },
    
    /**
     * Update progress chart
     */
    updateChart() {
        const sessions = StorageManager.getSessionsByPeriod(this.currentPeriod);
        
        if (sessions.length === 0) {
            if (this.chart) {
                this.chart.destroy();
                this.chart = null;
            }
            return;
        }
        
        const reversedSessions = [...sessions].reverse();
        const labels = reversedSessions.map((s, index) => {
            const date = new Date(s.date);
            if (this.currentPeriod === 'week') {
                return date.toLocaleDateString('en-US', { weekday: 'short' });
            } else {
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }
        });
        
        const scores = reversedSessions.map(s => s.averageScore);
        
        const ctx = document.getElementById('progress-chart').getContext('2d');
        
        if (this.chart) {
            this.chart.destroy();
        }
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Form Score',
                    data: scores,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    pointBackgroundColor: '#667eea',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        titleFont: {
                            size: 14,
                            weight: 'bold'
                        },
                        bodyFont: {
                            size: 13
                        },
                        callbacks: {
                            label: function(context) {
                                return 'Score: ' + context.parsed.y + '/100';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        min: Math.max(0, Math.min(...scores) - 10),
                        max: 100,
                        ticks: {
                            font: {
                                size: 12
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    x: {
                        ticks: {
                            font: {
                                size: 12
                            }
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    },
    
    /**
     * Update metrics breakdown
     */
    updateMetricsBreakdown() {
        const sessions = StorageManager.getSessionsByPeriod(this.currentPeriod);
        
        if (sessions.length === 0) {
            document.getElementById('elbow-avg').textContent = '--°';
            document.getElementById('release-avg').textContent = '--°';
            document.getElementById('knee-avg').textContent = '--°';
            document.getElementById('alignment-avg').textContent = '--';
            
            document.getElementById('elbow-fill').style.width = '0%';
            document.getElementById('release-fill').style.width = '0%';
            document.getElementById('knee-fill').style.width = '0%';
            document.getElementById('alignment-fill').style.width = '0%';
            return;
        }
        
        const avgElbow = sessions.reduce((sum, s) => sum + s.metrics.avgElbow, 0) / sessions.length;
        const avgRelease = sessions.reduce((sum, s) => sum + s.metrics.avgRelease, 0) / sessions.length;
        const avgKnee = sessions.reduce((sum, s) => sum + s.metrics.avgKnee, 0) / sessions.length;
        const avgAlignment = sessions.reduce((sum, s) => sum + s.metrics.avgAlignment, 0) / sessions.length;
        
        document.getElementById('elbow-avg').textContent = Math.round(avgElbow) + '°';
        document.getElementById('release-avg').textContent = Math.round(avgRelease) + '°';
        document.getElementById('knee-avg').textContent = Math.round(avgKnee) + '°';
        document.getElementById('alignment-avg').textContent = Math.round(avgAlignment);
        
        const elbowScore = this.scoreMetric(avgElbow, 85, 95);
        const releaseScore = this.scoreMetric(avgRelease, 45, 60);
        const kneeScore = this.scoreMetric(avgKnee, 100, 130);
        const alignmentScore = avgAlignment;
        
        document.getElementById('elbow-fill').style.width = elbowScore + '%';
        document.getElementById('release-fill').style.width = releaseScore + '%';
        document.getElementById('knee-fill').style.width = kneeScore + '%';
        document.getElementById('alignment-fill').style.width = alignmentScore + '%';
    },
    
    /**
     * Score a metric based on optimal range
     */
    scoreMetric(value, min, max) {
        const optimal = (min + max) / 2;
        const range = max - min;
        
        if (value >= min && value <= max) {
            const distanceFromOptimal = Math.abs(value - optimal);
            return 100 - (distanceFromOptimal / range * 50);
        } else {
            const distanceFromRange = value < min ? min - value : value - max;
            return Math.max(0, 50 - (distanceFromRange * 2));
        }
    },
    
    /**
     * Update insights section
     */
    updateInsights() {
        const sessions = StorageManager.getSessionsByPeriod(this.currentPeriod);
        const container = document.getElementById('insights-container');
        
        if (sessions.length < 3) {
            container.innerHTML = '<p class="no-insights">Complete more sessions to get personalized insights!</p>';
            return;
        }
        
        const insights = StorageManager.generateInsights(sessions);
        
        if (insights.length === 0) {
            container.innerHTML = '<p class="no-insights">Keep practicing! More insights coming soon.</p>';
            return;
        }
        
        container.innerHTML = insights.map(insight => `
            <div class="insight-item">
                <p class="insight-text">${insight.text}</p>
            </div>
        `).join('');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    ProgressManager.init();
});