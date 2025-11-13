/**
 * Basketball Shot Form Analyzer v2.0 - Main Application
 * Real-time pose analysis with session tracking and progress monitoring
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
let isProcessingFrame = false;

// Analysis data
let frameCount = 0;
let analysisData = {
    elbowAngles: [],
    releaseHeights: [],
    kneeAngles: [],
    alignmentScores: []
};

// Auto-capture timer for sessions
let autoCaptureTimer = null;
let lastCaptureTime = 0;
const CAPTURE_COOLDOWN = 3000;

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
        
    } catch (error) {
        console.error('Error initializing pose:', error);
        statusText.textContent = 'Error loading model';
        alert('Failed to load AI model. Please refresh the page.');
    }
}

/**
 * Start camera and pose detection
 */
async function startCamera() {
    try {
        startBtn.disabled = true;
        sessionBtn.disabled = false;
        stopBtn.disabled = false;
        isRunning = true;
        isProcessingFrame = false;
        statusText.textContent = 'Analyzing...';

        camera = new Camera(video, {
            onFrame: async () => {
                if (isRunning && !isProcessingFrame) {
                    isProcessingFrame = true;
                    try {
                        await pose.send({ image: video });
                    } catch (error) {
                        console.error('Error processing frame:', error);
                    } finally {
                        isProcessingFrame = false;
                    }
                }
            },
            width: 1280,
            height: 720
        });

        await camera.start();

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
    isProcessingFrame = false;

    if (camera) {
        camera.stop();
    }

    // Properly stop all video tracks
    if (video.srcObject) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;
    }

    if (SessionManager.isSessionActive) {
        SessionManager.cancelSession();
    }

    startBtn.disabled = false;
    sessionBtn.disabled = true;
    stopBtn.disabled = true;
    statusText.textContent = 'Stopped';

    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/**
 * Process pose detection results
 */
function onPoseResults(results) {
    // Safety check: ensure video is ready
    if (!video.videoWidth || !video.videoHeight) {
        return;
    }

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
    flash.style.opacity = '0.7';
    flash.style.zIndex = '1000';
    flash.style.pointerEvents = 'none';
    document.body.appendChild(flash);
    
    setTimeout(() => {
        flash.style.transition = 'opacity 0.3s ease';
        flash.style.opacity = '0';
        setTimeout(() => flash.remove(), 300);
    }, 100);
}

/**
 * Draw pose skeleton
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
 * Analyze shooting form
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
/**
 * Calculate angle between three points
 */
function calculateAngle(point1, point2, point3) {
    const radians = Math.atan2(point3.y - point2.y, point3.x - point2.x) -
                    Math.atan2(point1.y - point2.y, point1.x - point2.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    
    if (angle > 180.0) {
        angle = 360 - angle;
    }
    
    return angle;
}

/**
 * Calculate release angle
 */
function calculateReleaseAngle(shoulder, wrist) {
    const deltaY = shoulder.y - wrist.y;
    const deltaX = Math.abs(shoulder.x - wrist.x);
    const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
    return Math.max(0, angle);
}

/**
 * Calculate body alignment
 */
function calculateAlignment(leftShoulder, rightShoulder) {
    const shoulderDiff = Math.abs(leftShoulder.y - rightShoulder.y);
    const alignmentScore = Math.max(0, 100 - (shoulderDiff * 1000));
    return alignmentScore;
}

/**
 * Score elbow angle
 */
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

/**
 * Score release height
 */
function scoreReleaseHeight(angle) {
    if (angle >= 45 && angle <= 60) {
        return 100;
    } else if (angle < 45) {
        return Math.max(0, angle / 45 * 100);
    } else {
        return Math.max(0, 100 - ((angle - 60) * 3));
    }
}

/**
 * Score knee bend
 */
function scoreKneeAngle(angle) {
    if (angle >= 100 && angle <= 130) {
        return 100;
    } else if (angle < 100) {
        return Math.max(0, angle / 100 * 100);
    } else {
        return Math.max(0, 100 - ((angle - 130) * 2));
    }
}

/**
 * Draw angle indicator
 */
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

/**
 * Update metric display
 */
function updateMetricDisplay(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}

/**
 * Update score ring
 */
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

/**
 * Update progress bars
 */
function updateProgressBars(elbowScore, releaseScore, kneeScore, alignmentScore) {
    updateBar('elbow-bar', elbowScore);
    updateBar('release-bar', releaseScore);
    updateBar('knee-bar', kneeScore);
    updateBar('alignment-bar', alignmentScore);
}

/**
 * Update individual bar
 */
function updateBar(barId, score) {
    const bar = document.getElementById(barId);
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

/**
 * Update feedback text
 */
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

/**
 * Update status messages
 */
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

/**
 * Calculate average
 */
function average(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Reset camera
 */
function resetCamera() {
    isRunning = false;
    isProcessingFrame = false;
    startBtn.disabled = false;
    sessionBtn.disabled = true;
    stopBtn.disabled = true;
    statusText.textContent = 'Ready';
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
    document.getElementById('clear-history').addEventListener('click', () => {
        if (StorageManager.clearAllData()) {
            updateHistoryView();
            updateDashboard();
            if (window.ProgressManager) {
                ProgressManager.updateProgress();
            }
        }
    });
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

// Initialize on page load
window.addEventListener('load', () => {
    initializePose();
    setupNavigation();
    setupClearHistory();
    updateDashboard();
});

// Expose updateDashboard globally for session manager
window.updateDashboard = updateDashboard;
