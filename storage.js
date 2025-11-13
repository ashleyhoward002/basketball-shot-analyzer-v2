/**
 * Storage Manager
 * Handles all LocalStorage operations for sessions, progress, and achievements
 */

const StorageManager = {
    // Storage keys
    KEYS: {
        SESSIONS: 'shotAnalyzer_sessions',
        ACHIEVEMENTS: 'shotAnalyzer_achievements',
        STATS: 'shotAnalyzer_stats'
    },

    /**
     * Save a completed session
     */
    saveSession(sessionData) {
        const sessions = this.getAllSessions();
        
        const session = {
            id: Date.now(),
            date: new Date().toISOString(),
            shots: sessionData.shots,
            averageScore: sessionData.averageScore,
            bestShot: sessionData.bestShot,
            worstShot: sessionData.worstShot,
            metrics: sessionData.metrics
        };
        
        sessions.unshift(session);
        
        if (sessions.length > 50) {
            sessions.length = 50;
        }
        
        localStorage.setItem(this.KEYS.SESSIONS, JSON.stringify(sessions));
        this.updateStats(session);
        this.checkAchievements(session, sessions);
        
        return session;
    },

    /**
     * Get all saved sessions
     */
    getAllSessions() {
        const data = localStorage.getItem(this.KEYS.SESSIONS);
        return data ? JSON.parse(data) : [];
    },

    /**
     * Get sessions for a specific time period
     */
    getSessionsByPeriod(period) {
        const sessions = this.getAllSessions();
        const now = new Date();
        
        return sessions.filter(session => {
            const sessionDate = new Date(session.date);
            const diffDays = Math.floor((now - sessionDate) / (1000 * 60 * 60 * 24));
            
            switch(period) {
                case 'week':
                    return diffDays <= 7;
                case 'month':
                    return diffDays <= 30;
                case 'all':
                default:
                    return true;
            }
        });
    },

    /**
     * Update overall stats
     */
    updateStats(newSession) {
        const stats = this.getStats();
        const sessions = this.getAllSessions();
        
        stats.totalSessions = sessions.length;
        stats.lastSessionDate = newSession.date;
        
        const totalScore = sessions.reduce((sum, s) => sum + s.averageScore, 0);
        stats.averageScore = Math.round(totalScore / sessions.length);
        
        stats.bestScore = Math.max(...sessions.map(s => s.averageScore));
        
        if (sessions.length >= 10) {
            const recent = sessions.slice(0, 5);
            const previous = sessions.slice(5, 10);
            const recentAvg = recent.reduce((sum, s) => sum + s.averageScore, 0) / 5;
            const previousAvg = previous.reduce((sum, s) => sum + s.averageScore, 0) / 5;
            stats.improvement = Math.round(recentAvg - previousAvg);
        } else {
            stats.improvement = 0;
        }
        
        stats.streak = this.calculateStreak(sessions);
        
        localStorage.setItem(this.KEYS.STATS, JSON.stringify(stats));
        return stats;
    },

    /**
     * Get overall stats
     */
    getStats() {
        const data = localStorage.getItem(this.KEYS.STATS);
        return data ? JSON.parse(data) : {
            totalSessions: 0,
            averageScore: 0,
            bestScore: 0,
            improvement: 0,
            streak: 0,
            lastSessionDate: null
        };
    },

    /**
     * Calculate practice streak in days
     */
    calculateStreak(sessions) {
        if (sessions.length === 0) return 0;
        
        let streak = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        for (let i = 0; i < 30; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(checkDate.getDate() - i);
            
            const hasSession = sessions.some(session => {
                const sessionDate = new Date(session.date);
                sessionDate.setHours(0, 0, 0, 0);
                return sessionDate.getTime() === checkDate.getTime();
            });
            
            if (hasSession) {
                streak++;
            } else if (i > 0) {
                break;
            }
        }
        
        return streak;
    },

    /**
     * Check and award achievements
     */
    checkAchievements(newSession, allSessions) {
        const achievements = this.getAchievements();
        const newAchievements = [];
        
        if (allSessions.length === 1 && !achievements.includes('first_session')) {
            newAchievements.push({
                id: 'first_session',
                icon: '🥉',
                title: 'First Session Complete',
                description: 'You completed your first 10-shot session!'
            });
            achievements.push('first_session');
        }
        
        if (allSessions.length === 5 && !achievements.includes('five_sessions')) {
            newAchievements.push({
                id: 'five_sessions',
                icon: '📊',
                title: '5 Sessions Complete',
                description: 'You\'ve completed 5 practice sessions!'
            });
            achievements.push('five_sessions');
        }
        
        if (newSession.averageScore >= 90 && !achievements.includes('first_90')) {
            newAchievements.push({
                id: 'first_90',
                icon: '⭐',
                title: 'Elite Form',
                description: 'You achieved a 90+ form score!'
            });
            achievements.push('first_90');
        }
        
        if (newSession.averageScore >= 95 && !achievements.includes('perfect_form')) {
            newAchievements.push({
                id: 'perfect_form',
                icon: '💎',
                title: 'Perfect Form',
                description: 'You achieved a 95+ form score!'
            });
            achievements.push('perfect_form');
        }
        
        const streak = this.calculateStreak(allSessions);
        if (streak >= 3 && !achievements.includes('three_day_streak')) {
            newAchievements.push({
                id: 'three_day_streak',
                icon: '🔥',
                title: 'Hot Streak',
                description: 'You practiced 3 days in a row!'
            });
            achievements.push('three_day_streak');
        }
        
        if (streak >= 7 && !achievements.includes('seven_day_streak')) {
            newAchievements.push({
                id: 'seven_day_streak',
                icon: '🔥🔥',
                title: 'Week Warrior',
                description: 'You practiced 7 days in a row!'
            });
            achievements.push('seven_day_streak');
        }
        
        const stats = this.getStats();
        if (stats.improvement >= 20 && !achievements.includes('huge_improvement')) {
            newAchievements.push({
                id: 'huge_improvement',
                icon: '📈',
                title: 'Massive Improvement',
                description: 'You improved by 20+ points!'
            });
            achievements.push('huge_improvement');
        }
        
        if (allSessions.length === 10 && !achievements.includes('ten_sessions')) {
            newAchievements.push({
                id: 'ten_sessions',
                icon: '🏆',
                title: 'Dedicated Athlete',
                description: 'You\'ve completed 10 practice sessions!'
            });
            achievements.push('ten_sessions');
        }
        
        localStorage.setItem(this.KEYS.ACHIEVEMENTS, JSON.stringify(achievements));
        
        return newAchievements;
    },

    /**
     * Get all achievements
     */
    getAchievements() {
        const data = localStorage.getItem(this.KEYS.ACHIEVEMENTS);
        return data ? JSON.parse(data) : [];
    },

    /**
     * Get achievement details
     */
    getAchievementDetails() {
        const unlocked = this.getAchievements();
        const allAchievements = [
            { id: 'first_session', icon: '🥉', title: 'First Session Complete', description: 'Complete your first 10-shot session' },
            { id: 'five_sessions', icon: '📊', title: '5 Sessions Complete', description: 'Complete 5 practice sessions' },
            { id: 'ten_sessions', icon: '🏆', title: 'Dedicated Athlete', description: 'Complete 10 practice sessions' },
            { id: 'first_90', icon: '⭐', title: 'Elite Form', description: 'Achieve a 90+ form score' },
            { id: 'perfect_form', icon: '💎', title: 'Perfect Form', description: 'Achieve a 95+ form score' },
            { id: 'three_day_streak', icon: '🔥', title: 'Hot Streak', description: 'Practice 3 days in a row' },
            { id: 'seven_day_streak', icon: '🔥🔥', title: 'Week Warrior', description: 'Practice 7 days in a row' },
            { id: 'huge_improvement', icon: '📈', title: 'Massive Improvement', description: 'Improve by 20+ points' }
        ];
        
        return allAchievements.map(ach => ({
            ...ach,
            unlocked: unlocked.includes(ach.id)
        }));
    },

    /**
     * Generate smart insights
     */
    generateInsights(sessions) {
        if (sessions.length < 3) {
            return [];
        }
        
        const insights = [];
        
        const recentScores = sessions.slice(0, 5).map(s => s.averageScore);
        const olderScores = sessions.slice(5, 10).map(s => s.averageScore);
        
        if (olderScores.length > 0) {
            const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
            const olderAvg = olderScores.reduce((a, b) => a + b, 0) / olderScores.length;
            
            if (recentAvg > olderAvg + 5) {
                insights.push({
                    type: 'positive',
                    text: `🚀 Great progress! Your average score improved by ${Math.round(recentAvg - olderAvg)} points in recent sessions. Keep up the excellent work!`
                });
            } else if (recentAvg < olderAvg - 5) {
                insights.push({
                    type: 'warning',
                    text: `⚠️ Your recent scores are lower than before. Consider taking a break or reviewing form fundamentals.`
                });
            }
        }
        
        const scores = sessions.slice(0, 10).map(s => s.averageScore);
        const variance = this.calculateVariance(scores);
        
        if (variance < 25) {
            insights.push({
                type: 'positive',
                text: `✓ Excellent consistency! Your form is stable with minimal variation between sessions.`
            });
        } else if (variance > 100) {
            insights.push({
                type: 'tip',
                text: `💡 Your scores vary significantly. Focus on building muscle memory with slow, deliberate practice.`
            });
        }
        
        const streak = this.calculateStreak(sessions);
        if (streak >= 5) {
            insights.push({
                type: 'positive',
                text: `🔥 Amazing ${streak}-day practice streak! Consistency is key to improvement.`
            });
        }
        
        return insights;
    },

    /**
     * Calculate variance
     */
    calculateVariance(numbers) {
        const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
        const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
        return squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length;
    },

    /**
     * Clear all data
     */
    clearAllData() {
        if (confirm('Are you sure you want to delete all session history? This cannot be undone.')) {
            localStorage.removeItem(this.KEYS.SESSIONS);
            localStorage.removeItem(this.KEYS.ACHIEVEMENTS);
            localStorage.removeItem(this.KEYS.STATS);
            return true;
        }
        return false;
    },

    /**
     * Get today's session count
     */
    getTodaySessionCount() {
        const sessions = this.getAllSessions();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        return sessions.filter(session => {
            const sessionDate = new Date(session.date);
            sessionDate.setHours(0, 0, 0, 0);
            return sessionDate.getTime() === today.getTime();
        }).length;
    },

    /**
     * Get today's best score
     */
    getTodayBestScore() {
        const sessions = this.getAllSessions();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todaySessions = sessions.filter(session => {
            const sessionDate = new Date(session.date);
            sessionDate.setHours(0, 0, 0, 0);
            return sessionDate.getTime() === today.getTime();
        });
        
        if (todaySessions.length === 0) return null;
        
        return Math.max(...todaySessions.map(s => s.averageScore));
    }
};