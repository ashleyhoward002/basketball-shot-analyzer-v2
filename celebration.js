/**
 * Celebration Manager
 * Handles stadium celebration animations and effects
 */

const CelebrationManager = {
    /**
     * Show celebration overlay based on score
     */
    showCelebration(score) {
        const overlay = document.getElementById('celebration-overlay');
        const title = overlay.querySelector('.celebration-title');
        const message = overlay.querySelector('.celebration-message');
        const scoreDisplay = overlay.querySelector('#celebration-score-value');
        
        let celebrationLevel;
        if (score >= 95) {
            celebrationLevel = 'elite';
        } else if (score >= 90) {
            celebrationLevel = 'great';
        } else {
            return;
        }
        
        const messages = {
            elite: {
                title: '🏆 NBA ARENA! 🏆',
                message: 'ELITE FORM! You\'re ready for the big leagues!',
                sound: 'elite'
            },
            great: {
                title: '🎉 COLLEGE ARENA! 🎉',
                message: 'Excellent form! Keep up the great work!',
                sound: 'great'
            }
        };
        
        const msg = messages[celebrationLevel];
        title.textContent = msg.title;
        message.textContent = msg.message;
        scoreDisplay.textContent = score;
        
        overlay.classList.remove('hidden');
        
        this.createConfetti();
        
        this.playCelebrationSound(msg.sound);
        
        this.addStadiumEffect(celebrationLevel);
    },
    
    /**
     * Create confetti animation
     */
    createConfetti() {
        const container = document.getElementById('confetti-container');
        container.innerHTML = '';
        
        const colors = ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#f7dc6f', '#bb8fce'];
        const confettiCount = 50;
        
        for (let i = 0; i < confettiCount; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDelay = Math.random() * 3 + 's';
            confetti.style.animationDuration = (Math.random() * 2 + 3) + 's';
            
            if (Math.random() > 0.5) {
                confetti.style.borderRadius = '50%';
            }
            
            container.appendChild(confetti);
        }
    },
    
    /**
     * Play celebration sound effect
     */
    playCelebrationSound(level) {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            if (level === 'elite') {
                this.playSuccessSound(audioContext, [523.25, 659.25, 783.99]);
            } else {
                this.playSuccessSound(audioContext, [392, 493.88, 587.33]);
            }
            
            setTimeout(() => {
                this.playCrowdCheer(audioContext);
            }, 500);
            
        } catch (error) {
            console.log('Audio not supported:', error);
        }
    },
    
    /**
     * Play success chord
     */
    playSuccessSound(audioContext, frequencies) {
        const now = audioContext.currentTime;
        
        frequencies.forEach((freq, index) => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = freq;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
            
            oscillator.start(now + (index * 0.1));
            oscillator.stop(now + 0.6);
        });
    },
    
    /**
     * Simulate crowd cheer sound
     */
    playCrowdCheer(audioContext) {
        const bufferSize = audioContext.sampleRate * 1;
        const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            const decay = 1 - (i / bufferSize);
            data[i] = (Math.random() * 2 - 1) * 0.1 * decay;
        }
        
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        
        const filter = audioContext.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1000;
        
        source.connect(filter);
        filter.connect(audioContext.destination);
        
        source.start();
    },
    
    /**
     * Add stadium effect overlay
     */
    addStadiumEffect(level) {
        const videoWrapper = document.querySelector('.video-wrapper');
        
        let stadiumOverlay = document.getElementById('stadium-overlay');
        if (!stadiumOverlay) {
            stadiumOverlay = document.createElement('div');
            stadiumOverlay.id = 'stadium-overlay';
            stadiumOverlay.className = 'stadium-overlay';
            videoWrapper.appendChild(stadiumOverlay);
        }
        
        const stadiumImages = {
            elite: 'linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.5))',
            great: 'linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.4))'
        };
        
        stadiumOverlay.style.background = stadiumImages[level];
        stadiumOverlay.style.opacity = '0';
        
        setTimeout(() => {
            stadiumOverlay.style.transition = 'opacity 0.5s ease';
            stadiumOverlay.style.opacity = '1';
        }, 100);
        
        this.addCrowdPulse(stadiumOverlay);
        
        this.addFlashEffects();
    },
    
    /**
     * Add pulsing crowd effect
     */
    addCrowdPulse(overlay) {
        let pulseCount = 0;
        const maxPulses = 5;
        
        const pulse = setInterval(() => {
            overlay.style.opacity = overlay.style.opacity === '1' ? '0.8' : '1';
            pulseCount++;
            
            if (pulseCount >= maxPulses * 2) {
                clearInterval(pulse);
            }
        }, 300);
    },
    
    /**
     * Add camera flash effects
     */
    addFlashEffects() {
        const videoWrapper = document.querySelector('.video-wrapper');
        
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                const flash = document.createElement('div');
                flash.className = 'camera-flash';
                flash.style.position = 'absolute';
                flash.style.top = Math.random() * 80 + 10 + '%';
                flash.style.left = Math.random() * 80 + 10 + '%';
                flash.style.width = '20px';
                flash.style.height = '20px';
                flash.style.background = 'white';
                flash.style.borderRadius = '50%';
                flash.style.opacity = '0';
                flash.style.animation = 'flash 0.3s ease';
                flash.style.zIndex = '15';
                
                videoWrapper.appendChild(flash);
                
                setTimeout(() => flash.remove(), 300);
            }, i * 400);
        }
    },
    
    /**
     * Close celebration overlay
     */
    closeCelebration() {
        const overlay = document.getElementById('celebration-overlay');
        overlay.classList.add('hidden');
        
        const stadiumOverlay = document.getElementById('stadium-overlay');
        if (stadiumOverlay) {
            stadiumOverlay.style.opacity = '0';
            setTimeout(() => {
                stadiumOverlay.remove();
            }, 500);
        }
        
        const container = document.getElementById('confetti-container');
        container.innerHTML = '';
    }
};

// Add flash animation CSS
const flashStyles = `
<style>
@keyframes flash {
    0% {
        opacity: 0;
        transform: scale(0);
    }
    50% {
        opacity: 1;
        transform: scale(1);
    }
    100% {
        opacity: 0;
        transform: scale(0);
    }
}

.stadium-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 3;
}

.confetti {
    animation-timing-function: ease-in;
}

.confetti:nth-child(odd) {
    animation-timing-function: ease-out;
}
</style>
`;

document.head.insertAdjacentHTML('beforeend', flashStyles);

document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('close-celebration');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            CelebrationManager.closeCelebration();
        });
    }
});