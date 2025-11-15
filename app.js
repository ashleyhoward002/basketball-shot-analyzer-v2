/**
 * Basketball Shot Form Analyzer v2.0 - Main Application
 * Real-time CONTINUOUS pose analysis with VOICE + VISUAL COACHING
 */

// DOM Elements
const video = document.getElementById('webcam');
const canvas = document.getElementById('output-canvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('start-btn');
const sessionBtn = document.getElementById('session-btn');
const stopBtn = document.getElementById('stop-btn');
const loadingOverlay = document.getElementById('loading-overlay');
const statusText = document.getElementById('status-text');

// MediaPipe Pose instance
let pose;
let camera;
let isRunning = false;

// Analysis data
let frameCount = 0;
let analysisData = {
    elbowAngles: [],
    releaseHeights: [],
    kneeAngles: [],
    alignmentScores: []
};

// Auto-capture timer for sessions
let lastCaptureTime = 0;
const CAPTURE_COOLDOWN = 3000;

// Voice coaching
let lastSpokenTip = '';
let speechEnabled = true;

/**
 * Initialize MediaPipe Pose
 */
async function initializePose() {
    try {
        statusText.textContent = 'Loading AI Model...';
        
        pose = new Pose({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
            }
        });

        pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            smoothSegmentation: false,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        pose.onResults(onPoseResults);

        statusText.textContent = 'Ready';
        loadingOverlay.classList.add('hidden');
        
        console.log('✅ Pose detection initialized');
        
    } catch (error) {
        console.error('Error initializing pose:', error);
        statusText.textContent = 'Error loading model';
        alert('Failed to load AI model. Please refresh the page.');
    }
}

/**
 * Start camera and pose detection - CONTINUOUS MODE
 */
async function startCamera() {
    try {
        startBtn.disabled = true;
        sessionBtn.disabled = false;
        stopBtn.disabled = false;
        isRunning = true;
        statusText.textContent = 'Analyzing...';

        camera = new Camera(video, {
            onFrame: async () => {
                if (isRunning && pose) {
                    await pose.send({ image: video });
                }
            },
            width: 1280,
            height: 720
        });

        await camera.start();
        
        console.log('✅ Camera started - CONTINUOUS MODE');
        
    } catch (error) {
        console.error('Error starting camera:', error);
        alert('Could not access camera. Please grant camera permissions and try again.');
        resetCamera();
    }
}

/**
 * Stop camera
 */
function stopCamera() {
    isRunning = false;
    
    if (camera) {
        camera.stop();
    }
    
    if (SessionManager.isSessionActive) {
        SessionManager.cancelSession();
    }
    
    startBtn.disabled = false;
    sessionBtn.disabled = true;
    stopBtn.disabled = true;
    statusText.textContent = 'Stopped';
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Clear on-screen coaching
    const overlay = document.getElementById('onscreen-coaching');
    if (overlay) overlay.remove();
    
    // Stop speech
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    
    console.log('⏸️ Camera stopped');
}

/**
 * Process pose detection results - RUNS EVERY FRAME (30 FPS)
 */
function onPoseResults(results) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    if (!results.poseLandmarks) {
        document.getElementById('form-feedback').textContent = 'No person detected. Step into frame.';
        return;
    }

    drawPose(results.poseLandmarks);
    const formData = analyzeShootingForm(results.poseLandmarks);
    
    if (SessionManager.isSessionActive) {
        handleAutoCapture(formData);
    }
    
    frameCount++;
}

/**
 * Handle auto-capture during sessions
 */
function handleAutoCapture(formData) {
    const now = Date.now();
    
    if (now - lastCaptureTime < CAPTURE_COOLDOWN) {
        return;
    }
    
    if (formData.overallScore < 50) {
        return;
    }
    
    if (analysisData.elbowAngles.length < 10) {
        return;
    }
    
    const captured = SessionManager.captureShot(formData);
    if (captured) {
        lastCaptureTime = now;
        flashScreen();
        playBeep();
    }
}

/**
 * Flash screen to indicate capture
 */
function flashScreen() {
    const flash = document.createElement('div');
    flash.style.position = 'fixed';
    flash.style.top = '0';
    flash.style.left = '0';
    flash.style.width = '100%';
    flash.style.height = '100%';
    flash.style.background = 'white';
    flash.style.opacity = '0.8';
    flash.style.zIndex = '1000';
    flash.style.pointerEvents = 'none';
    document.body.appendChild(flash);
    
    setTimeout(() => {
        flash.style.transition = 'opacity 0.2s ease';
        flash.style.opacity = '0';
        setTimeout(() => flash.remove(), 200);
    }, 100);
}

/**
 * Play beep sound when shot captured
 */
function playBeep() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
        console.log('Audio not supported');
    }
}

/**
 * Draw pose skeleton - CALLED EVERY FRAME
 */
function drawPose(landmarks) {
    const connections = [
        [11, 13], [13, 15],
        [12, 14], [14, 16],
        [11, 12],
        [11, 23], [12, 24],
        [23, 24],
        [23, 25], [25, 27],
        [24, 26], [26, 28]
    ];

    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 3;
    
    connections.forEach(([start, end]) => {
        const startPoint = landmarks[start];
        const endPoint = landmarks[end];
        
        if (startPoint && endPoint) {
            ctx.beginPath();
            ctx.moveTo(startPoint.x * canvas.width, startPoint.y * canvas.height);
            ctx.lineTo(endPoint.x * canvas.width, endPoint.y * canvas.height);
            ctx.stroke();
        }
    });

    landmarks.forEach((landmark, index) => {
        if (index > 10 && index < 29) {
            ctx.fillStyle = '#667eea';
            ctx.beginPath();
            ctx.arc(
                landmark.x * canvas.width,
                landmark.y * canvas.height,
                6,
                0,
                2 * Math.PI
            );
            ctx.fill();
        }
    });
}
/**
 * Analyze shooting form - UPDATES EVERY FRAME
 */
function analyzeShootingForm(landmarks) {
    const rightShoulder = landmarks[12];
    const rightElbow = landmarks[14];
    const rightWrist = landmarks[16];
    const rightHip = landmarks[24];
    const rightKnee = landmarks[26];
    const rightAnkle = landmarks[28];
    const leftShoulder = landmarks[11];

    const elbowAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);
    const releaseHeight = calculateReleaseAngle(rightShoulder, rightWrist);
    const kneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
    const alignmentScore = calculateAlignment(leftShoulder, rightShoulder);

    analysisData.elbowAngles.push(elbowAngle);
    analysisData.releaseHeights.push(releaseHeight);
    analysisData.kneeAngles.push(kneeAngle);
    analysisData.alignmentScores.push(alignmentScore);

    if (analysisData.elbowAngles.length > 30) {
        analysisData.elbowAngles.shift();
        analysisData.releaseHeights.shift();
        analysisData.kneeAngles.shift();
        analysisData.alignmentScores.shift();
    }

    const avgElbow = average(analysisData.elbowAngles);
    const avgRelease = average(analysisData.releaseHeights);
    const avgKnee = average(analysisData.kneeAngles);
    const avgAlignment = average(analysisData.alignmentScores);

    updateMetricDisplay('elbow-angle', Math.round(avgElbow) + '°');
    updateMetricDisplay('release-height', Math.round(avgRelease) + '°');
    updateMetricDisplay('knee-angle', Math.round(avgKnee) + '°');
    updateMetricDisplay('alignment-score', Math.round(avgAlignment));

    const elbowScore = scoreElbowAngle(avgElbow);
    const releaseScore = scoreReleaseHeight(avgRelease);
    const kneeScore = scoreKneeAngle(avgKnee);
    const alignmentScoreValue = avgAlignment;

    const overallScore = Math.round(
        (elbowScore * 0.3) + 
        (releaseScore * 0.3) + 
        (kneeScore * 0.2) + 
        (alignmentScoreValue * 0.2)
    );

    updateMetricDisplay('overall-score', overallScore);
    updateScoreRing(overallScore);
    updateProgressBars(elbowScore, releaseScore, kneeScore, alignmentScoreValue);
    updateFeedback(overallScore, elbowScore, releaseScore, kneeScore, alignmentScoreValue);
    updateStatusMessages(avgElbow, avgRelease, avgKnee, avgAlignment);
    drawAngleIndicator(rightShoulder, rightElbow, rightWrist, avgElbow);
    
    // UPDATE LIVE COACHING WITH VOICE + VISUAL
    updateLiveCoaching(avgElbow, avgRelease, avgKnee, avgAlignment, overallScore);
    
    return {
        overallScore,
        elbowAngle: avgElbow,
        releaseHeight: avgRelease,
        kneeAngle: avgKnee,
        alignment: avgAlignment,
        elbowScore,
        releaseScore,
        kneeScore,
        alignmentScore: alignmentScoreValue
    };
}

function calculateAngle(point1, point2, point3) {
    const radians = Math.atan2(point3.y - point2.y, point3.x - point2.x) -
                    Math.atan2(point1.y - point2.y, point1.x - point2.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    
    if (angle > 180.0) {
        angle = 360 - angle;
    }
    
    return angle;
}

function calculateReleaseAngle(shoulder, wrist) {
    const deltaY = shoulder.y - wrist.y;
    const deltaX = Math.abs(shoulder.x - wrist.x);
    const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
    return Math.max(0, angle);
}

function calculateAlignment(leftShoulder, rightShoulder) {
    const shoulderDiff = Math.abs(leftShoulder.y - rightShoulder.y);
    const alignmentScore = Math.max(0, 100 - (shoulderDiff * 1000));
    return alignmentScore;
}

function scoreElbowAngle(angle) {
    const optimal = 90;
    const tolerance = 10;
    const diff = Math.abs(angle - optimal);
    
    if (diff <= tolerance) {
        return 100 - (diff * 5);
    } else {
        return Math.max(0, 50 - ((diff - tolerance) * 2));
    }
}

function scoreReleaseHeight(angle) {
    if (angle >= 45 && angle <= 60) {
        return 100;
    } else if (angle < 45) {
        return Math.max(0, angle / 45 * 100);
    } else {
        return Math.max(0, 100 - ((angle - 60) * 3));
    }
}

function scoreKneeAngle(angle) {
    if (angle >= 100 && angle <= 130) {
        return 100;
    } else if (angle < 100) {
        return Math.max(0, angle / 100 * 100);
    } else {
        return Math.max(0, 100 - ((angle - 130) * 2));
    }
}

function drawAngleIndicator(point1, vertex, point3, angle) {
    const x = vertex.x * canvas.width;
    const y = vertex.y * canvas.height;
    
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 30, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(Math.round(angle) + '°', x + 35, y - 10);
}

function updateMetricDisplay(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}

function updateScoreRing(score) {
    const ring = document.getElementById('score-ring');
    const circumference = 2 * Math.PI * 52;
    const offset = circumference - (score / 100) * circumference;
    
    ring.style.strokeDashoffset = offset;
    
    if (score >= 80) {
        ring.style.stroke = '#4ade80';
    } else if (score >= 60) {
        ring.style.stroke = '#fbbf24';
    } else {
        ring.style.stroke = '#ef4444';
    }
}

function updateProgressBars(elbowScore, releaseScore, kneeScore, alignmentScore) {
    updateBar('elbow-bar', elbowScore);
    updateBar('release-bar', releaseScore);
    updateBar('knee-bar', kneeScore);
    updateBar('alignment-bar', alignmentScore);
}

function updateBar(barId, score) {
    const bar = document.getElementById(barId);
    if (!bar) return;
    
    bar.style.width = score + '%';
    
    bar.classList.remove('good', 'warning', 'poor');
    
    if (score >= 80) {
        bar.classList.add('good');
    } else if (score >= 60) {
        bar.classList.add('warning');
    } else {
        bar.classList.add('poor');
    }
}

function updateFeedback(overall, elbow, release, knee, alignment) {
    const feedback = document.getElementById('form-feedback');
    
    if (overall >= 85) {
        feedback.textContent = '🎯 Excellent form! Your technique is on point!';
    } else if (overall >= 70) {
        feedback.textContent = '👍 Good form! Keep practicing for consistency.';
    } else if (overall >= 50) {
        feedback.textContent = '⚠️ Fair form. Focus on the metrics highlighted below.';
    } else {
        feedback.textContent = '💡 Needs improvement. Review the technique tips.';
    }
}

function updateStatusMessages(elbow, release, knee, alignment) {
    const elbowStatus = document.getElementById('elbow-status');
    if (elbow >= 85 && elbow <= 95) {
        elbowStatus.textContent = '✓ Perfect!';
        elbowStatus.style.color = '#4ade80';
    } else if (elbow < 85) {
        elbowStatus.textContent = '↑ Raise elbow';
        elbowStatus.style.color = '#f59e0b';
    } else {
        elbowStatus.textContent = '↓ Lower elbow';
        elbowStatus.style.color = '#f59e0b';
    }

    const releaseStatus = document.getElementById('release-status');
    if (release >= 45 && release <= 60) {
        releaseStatus.textContent = '✓ Optimal!';
        releaseStatus.style.color = '#4ade80';
    } else if (release < 45) {
        releaseStatus.textContent = '↑ Too low';
        releaseStatus.style.color = '#f59e0b';
    } else {
        releaseStatus.textContent = '↓ Too high';
        releaseStatus.style.color = '#f59e0b';
    }

    const kneeStatus = document.getElementById('knee-status');
    if (knee >= 100 && knee <= 130) {
        kneeStatus.textContent = '✓ Good bend!';
        kneeStatus.style.color = '#4ade80';
    } else if (knee < 100) {
        kneeStatus.textContent = 'Bend more';
        kneeStatus.style.color = '#f59e0b';
    } else {
        kneeStatus.textContent = 'Too bent';
        kneeStatus.style.color = '#f59e0b';
    }

    const alignmentStatus = document.getElementById('alignment-status');
    if (alignment >= 90) {
        alignmentStatus.textContent = '✓ Perfect!';
        alignmentStatus.style.color = '#4ade80';
    } else {
        alignmentStatus.textContent = 'Check level';
        alignmentStatus.style.color = '#f59e0b';
    }
}

function average(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function resetCamera() {
    isRunning = false;
    startBtn.disabled = false;
    sessionBtn.disabled = true;
    stopBtn.disabled = true;
    statusText.textContent = 'Ready';
}
/**
 * Update live coaching tips based on current form
 * NOW WITH VOICE + BIG ON-SCREEN DISPLAY
 */
function updateLiveCoaching(elbow, release, knee, alignment, overallScore) {
    const priorityFix = document.getElementById('priority-fix');
    const priorityTitle = document.getElementById('priority-title');
    const priorityTip = document.getElementById('priority-tip');
    const priorityIcon = document.querySelector('.priority-icon');
    
    const tipGood = document.getElementById('tip-good-text');
    const tipWarning = document.getElementById('tip-warning-text');
    const tipFocus = document.getElementById('tip-focus-text');
    
    // Determine priority issue
    let priority = null;
    let priorityScore = 100;
    
    // Check elbow
    const elbowScore = scoreElbowAngle(elbow);
    if (elbowScore < priorityScore) {
        priorityScore = elbowScore;
        if (elbow < 85) {
            priority = {
                icon: '💪',
                title: 'RAISE YOUR ELBOW',
                tip: `Your elbow is at ${Math.round(elbow)}° - aim for 85-95°. Lift your elbow up to shoulder height.`
            };
        } else if (elbow > 95) {
            priority = {
                icon: '⬇️',
                title: 'LOWER YOUR ELBOW',
                tip: `Your elbow is at ${Math.round(elbow)}° - aim for 85-95°. Bring your elbow down slightly.`
            };
        }
    }
    
    // Check release
    const releaseScore = scoreReleaseHeight(release);
    if (releaseScore < priorityScore) {
        priorityScore = releaseScore;
        if (release < 45) {
            priority = {
                icon: '⬆️',
                title: 'RELEASE HIGHER',
                tip: `Release at ${Math.round(release)}° is too low. Shoot upward at 45-60° for better arc.`
            };
        } else if (release > 60) {
            priority = {
                icon: '📐',
                title: 'FLATTEN YOUR ARC',
                tip: `Release at ${Math.round(release)}° is too high. Aim for 45-60°.`
            };
        }
    }
    
    // Check knees
    const kneeScore = scoreKneeAngle(knee);
    if (kneeScore < priorityScore) {
        priorityScore = kneeScore;
        if (knee > 130) {
            priority = {
                icon: '🦵',
                title: 'BEND YOUR KNEES',
                tip: `Knees at ${Math.round(knee)}° are too straight. Squat down to 100-130° for power!`
            };
        } else if (knee < 100) {
            priority = {
                icon: '⬆️',
                title: 'STAND TALLER',
                tip: `Knees at ${Math.round(knee)}° are too bent. Straighten up to 100-130°.`
            };
        }
    }
    
    // Check alignment
    if (alignment < 85 && alignment < priorityScore) {
        priority = {
            icon: '⚖️',
            title: 'LEVEL YOUR SHOULDERS',
            tip: 'Your shoulders are uneven. Keep them level and square to the basket.'
        };
    }
    
    // Update priority fix panel
    if (priority) {
        priorityIcon.textContent = priority.icon;
        priorityTitle.textContent = priority.title;
        priorityTip.textContent = priority.tip;
        
        if (priorityScore < 50) {
            priorityFix.classList.add('critical');
        } else {
            priorityFix.classList.remove('critical');
        }
        
        // SPEAK IT + SHOW ON SCREEN
        speakCoachingTip(priority.title);
        updateOnScreenCoaching(priority.title, priority.icon);
        
    } else {
        priorityIcon.textContent = '🎯';
        priorityTitle.textContent = 'EXCELLENT FORM!';
        priorityTip.textContent = 'All metrics are in the optimal range. Keep this up!';
        priorityFix.classList.remove('critical');
        
        // SPEAK IT + SHOW ON SCREEN
        speakCoachingTip('EXCELLENT FORM!');
        updateOnScreenCoaching('EXCELLENT FORM!', '🎯');
    }
    
    // Update quick tips
    if (overallScore >= 80) {
        tipGood.textContent = `Overall form is excellent (${overallScore}/100)`;
    } else if (elbowScore >= 80) {
        tipGood.textContent = `Elbow angle is perfect at ${Math.round(elbow)}°`;
    } else if (releaseScore >= 80) {
        tipGood.textContent = `Release height is great at ${Math.round(release)}°`;
    } else if (kneeScore >= 80) {
        tipGood.textContent = `Knee bend is good at ${Math.round(knee)}°`;
    } else if (alignment >= 90) {
        tipGood.textContent = 'Shoulders are level and aligned';
    } else {
        tipGood.textContent = 'Keep practicing - form is developing!';
    }
    
    if (elbowScore < 70 && elbowScore < releaseScore && elbowScore < kneeScore) {
        tipWarning.textContent = `Watch elbow position (${Math.round(elbow)}° - target: 85-95°)`;
    } else if (releaseScore < 70) {
        tipWarning.textContent = `Work on release height (${Math.round(release)}° - target: 45-60°)`;
    } else if (kneeScore < 70) {
        tipWarning.textContent = `Focus on knee bend (${Math.round(knee)}° - target: 100-130°)`;
    } else {
        tipWarning.textContent = 'Minor adjustments needed - stay focused';
    }
    
    if (overallScore < 60) {
        tipFocus.textContent = 'Work on fundamentals slowly - quality over quantity';
    } else if (overallScore < 80) {
        tipFocus.textContent = 'Good progress! Focus on consistency';
    } else {
        tipFocus.textContent = 'Maintain this form - practice makes permanent!';
    }
}

/**
 * Text-to-speech for coaching tips
 */
function speakCoachingTip(title) {
    if (!speechEnabled) return;
    if (lastSpokenTip === title) return; // Don't repeat
    
    lastSpokenTip = title;
    
    try {
        // Cancel any ongoing speech
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
        
        const utterance = new SpeechSynthesisUtterance(title);
        utterance.rate = 0.85; // Slightly slower for clarity
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        window.speechSynthesis.speak(utterance);
        
        console.log('🔊 Speaking: ' + title);
    } catch (error) {
        console.log('Speech not supported:', error);
    }
}

/**
 * Update big on-screen coaching overlay
 */
function updateOnScreenCoaching(title, icon) {
    let overlay = document.getElementById('onscreen-coaching');
    
    if (!overlay) {
        // Create overlay if it doesn't exist
        overlay = document.createElement('div');
        overlay.id = 'onscreen-coaching';
        overlay.className = 'onscreen-coaching';
        document.querySelector('.video-wrapper').appendChild(overlay);
    }
    
    overlay.innerHTML = `
        <div class="onscreen-icon">${icon}</div>
        <div class="onscreen-text">${title}</div>
    `;
    
    // Make it pulse
    overlay.style.animation = 'none';
    setTimeout(() => {
        overlay.style.animation = 'coaching-pulse 2s infinite';
    }, 10);
}
/**
 * Update dashboard stats
 */
function updateDashboard() {
    const sessionsToday = StorageManager.getTodaySessionCount();
    const bestToday = StorageManager.getTodayBestScore();
    const stats = StorageManager.getStats();
    
    document.getElementById('sessions-today').textContent = sessionsToday;
    document.getElementById('best-today').textContent = bestToday || '--';
    document.getElementById('streak-days').textContent = stats.streak;
    
    updateRecentAchievements();
}

/**
 * Update recent achievements display
 */
function updateRecentAchievements() {
    const achievements = StorageManager.getAchievementDetails();
    const unlocked = achievements.filter(a => a.unlocked);
    const container = document.getElementById('recent-achievements');
    
    if (unlocked.length === 0) {
        container.innerHTML = '<p class="no-achievements">Complete sessions to unlock achievements!</p>';
        return;
    }
    
    const recent = unlocked.slice(0, 3);
    container.innerHTML = recent.map(ach => `
        <div class="achievement-item">
            <span class="achievement-icon">${ach.icon}</span>
            <div class="achievement-text">
                <div class="achievement-title">${ach.title}</div>
                <div class="achievement-desc">${ach.description}</div>
            </div>
        </div>
    `).join('');
}

/**
 * Setup view navigation
 */
function setupNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const view = e.target.dataset.view;
            
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            document.querySelectorAll('.view-container').forEach(v => v.classList.remove('active'));
            document.getElementById(view + '-view').classList.add('active');
            
            if (view === 'progress' && window.ProgressManager) {
                ProgressManager.updateProgress();
            }
            
            if (view === 'history') {
                updateHistoryView();
            }
        });
    });
}

/**
 * Update history view
 */
function updateHistoryView() {
    const sessions = StorageManager.getAllSessions();
    const container = document.getElementById('sessions-list');
    
    if (sessions.length === 0) {
        container.innerHTML = `
            <div class="no-sessions">
                <p>No sessions recorded yet.</p>
                <p>Start a 10-shot session to begin tracking your progress!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = sessions.map(session => {
        const date = new Date(session.date);
        return `
            <div class="session-card">
                <div class="session-header">
                    <span class="session-date">${date.toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    })}</span>
                    <span class="session-score">${session.averageScore}/100</span>
                </div>
                <div class="session-stats">
                    <div class="session-stat">
                        <div class="session-stat-value">${session.metrics.avgElbow}°</div>
                        <div class="session-stat-label">Elbow</div>
                    </div>
                    <div class="session-stat">
                        <div class="session-stat-value">${session.metrics.avgRelease}°</div>
                        <div class="session-stat-label">Release</div>
                    </div>
                    <div class="session-stat">
                        <div class="session-stat-value">${session.metrics.avgKnee}°</div>
                        <div class="session-stat-label">Knee</div>
                    </div>
                    <div class="session-stat">
                        <div class="session-stat-value">${session.metrics.avgAlignment}</div>
                        <div class="session-stat-label">Alignment</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Setup clear history button
 */
function setupClearHistory() {
    const clearBtn = document.getElementById('clear-history');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (StorageManager.clearAllData()) {
                updateHistoryView();
                updateDashboard();
                if (window.ProgressManager) {
                    ProgressManager.updateProgress();
                }
            }
        });
    }
}

// Event Listeners
startBtn.addEventListener('click', startCamera);

sessionBtn.addEventListener('click', () => {
    if (!isRunning) {
        alert('Please start the camera first!');
        return;
    }
    SessionManager.startSession();
});

stopBtn.addEventListener('click', stopCamera);

// Voice toggle button
const voiceToggle = document.getElementById('voice-toggle');
if (voiceToggle) {
    voiceToggle.addEventListener('click', () => {
        speechEnabled = !speechEnabled;
        voiceToggle.textContent = speechEnabled ? '🔊' : '🔇';
        voiceToggle.classList.toggle('muted');
        
        if (speechEnabled) {
            console.log('🔊 Voice coaching: ON');
        } else {
            console.log('🔇 Voice coaching: OFF');
            // Cancel any ongoing speech
            if (window.speechSynthesis) {
                window.speechSynthesis.cancel();
            }
        }
    });
}

// Initialize on page load
window.addEventListener('load', () => {
    console.log('🏀 Shot Analyzer v2.0 - Voice + Visual Coaching Mode');
    initializePose();
    setupNavigation();
    setupClearHistory();
    updateDashboard();
});

// Expose updateDashboard globally for session manager
window.updateDashboard = updateDashboard;

console.log('✅ App.js loaded - VOICE + VISUAL COACHING ENABLED');
