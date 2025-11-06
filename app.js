/**
 * Basketball Shot Analyzer v2.0 - Final Clean Version
 * Features: 4 working filters, auto-capture, simple celebration
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
const filterNameDisplay = document.getElementById('filter-name');
const shotFlash = document.getElementById('shot-flash');
const completeSessionBtn = document.getElementById('complete-session-btn');
const celebrationOverlay = document.getElementById('celebration-overlay');
const celebrationClose = document.getElementById('celebration-close');

// State
let pose;
let camera;
let isRunning = false;
let currentFilter = 'normal';
let sessionMode = false;
let capturedShots = [];
let opencvReady = false;
let lastCaptureTime = 0;
let isInFollowThrough = false;

// Analysis Data
let analysisData = {
    elbowAngles: [],
    releaseHeights: [],
    kneeAngles: [],
    alignmentScores: []
};

// Progress Data
let progressData = {
    sessions: [],
    dailyScores: {}
};

let progressChart = null;

/**
 * Initialize Application
 */
async function initialize() {
    console.log('🚀 Initializing Shot Analyzer v2.0...');
    
    try {
        statusText.textContent = 'Loading AI...';
        
        // Wait for OpenCV
        await waitForOpenCV();
        console.log('✅ OpenCV ready');
        
        // Initialize MediaPipe
        await initializePose();
        console.log('✅ MediaPipe ready');
        
        // Load saved progress
        loadProgressData();
        
        // Initialize chart
        initializeChart();
        
        // Setup events
        setupEventListeners();
        
        statusText.textContent = 'Ready!';
        loadingOverlay.classList.add('hidden');
        
        console.log('✅ App initialized successfully!');
        
    } catch (error) {
        console.error('❌ Init error:', error);
        statusText.textContent = 'Error - refresh page';
        alert('Failed to load. Please refresh and try again.');
    }
}

/**
 * Wait for OpenCV to load
 */
function waitForOpenCV() {
    return new Promise((resolve) => {
        if (typeof cv !== 'undefined') {
            opencvReady = true;
            console.log('OpenCV already loaded');
            resolve();
        } else {
            console.log('Waiting for OpenCV...');
            const checkInterval = setInterval(() => {
                if (typeof cv !== 'undefined') {
                    opencvReady = true;
                    console.log('OpenCV loaded');
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
            
            // Timeout after 20 seconds
            setTimeout(() => {
                clearInterval(checkInterval);
                if (!opencvReady) {
                    console.warn('⚠️ OpenCV timeout - continuing without filters');
                    resolve();
                }
            }, 20000);
        }
    });
}

/**
 * Initialize MediaPipe Pose
 */
async function initializePose() {
    pose = new Pose({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
        }
    });

    pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    pose.onResults(onPoseResults);
}

/**
 * Setup Event Listeners
 */
function setupEventListeners() {
    startBtn.addEventListener('click', startCamera);
    sessionBtn.addEventListener('click', startSession);
    stopBtn.addEventListener('click', stopCamera);
    completeSessionBtn.addEventListener('click', completeSession);
    celebrationClose.addEventListener('click', closeCelebration);
    
    // Filter buttons
    document.querySelectorAll('.filter-btn-compact').forEach(btn => {
        btn.addEventListener('click', () => {
            switchFilter(btn.dataset.filter);
        });
    });
    
    // Keyboard
    document.addEventListener('keydown', handleKeyboard);
}

/**
 * Keyboard Controls
 */
function handleKeyboard(e) {
    if (!isRunning) return;
    
    const key = e.key.toLowerCase();
    
    switch(key) {
        case 'n': switchFilter('normal'); break;
        case 'e': switchFilter('sobel'); break;
        case 'c': switchFilter('canny'); break;
        case 'b': switchFilter('blur'); break;
        case 's': switchFilter('sharpen'); break;
    }
}

/**
 * Switch Filter
 */
function switchFilter(filterName) {
    currentFilter = filterName;
    
    const filterNames = {
        'normal': '👁️ Normal View',
        'sobel': '📐 Sobel Edges',
        'canny': '✨ Canny Edges',
        'blur': '🌫️ Blur View',
        'sharpen': '🔪 Sharp View'
    };
    
    filterNameDisplay.textContent = filterNames[filterName] || 'Normal View';
    
    // Update buttons
    document.querySelectorAll('.filter-btn-compact').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === filterName) {
            btn.classList.add('active');
        }
    });
    
    console.log(`🎨 Filter: ${filterName}`);
}

/**
 * Start Camera
 */
async function startCamera() {
    try {
        startBtn.disabled = true;
        sessionBtn.disabled = false;
        stopBtn.disabled = false;
        isRunning = true;
        statusText.textContent = 'Camera active';

        camera = new Camera(video, {
            onFrame: async () => {
                if (isRunning) {
                    await pose.send({ image: video });
                }
            },
            width: 1280,
            height: 720
        });

        await camera.start();
        console.log('✅ Camera started');
        
    } catch (error) {
        console.error('❌ Camera error:', error);
        alert('Could not access camera. Please allow camera permission.');
        resetCamera();
    }
}

/**
 * Stop Camera
 */
function stopCamera() {
    isRunning = false;
    
    if (camera) {
        camera.stop();
    }
    
    startBtn.disabled = false;
    sessionBtn.disabled = true;
    stopBtn.disabled = true;
    statusText.textContent = 'Stopped';
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/**
 * Start Session
 */
function startSession() {
    if (!isRunning) {
        alert('Start training first!');
        return;
    }
    
    sessionMode = true;
    capturedShots = [];
    lastCaptureTime = 0;
    
    document.getElementById('session-counter').classList.remove('hidden');
    document.getElementById('session-panel').classList.remove('hidden');
    
    // Create shot grid
    const shotsGrid = document.getElementById('shots-grid');
    shotsGrid.innerHTML = '';
    for (let i = 0; i < 10; i++) {
        const shotDiv = document.createElement('div');
        shotDiv.className = 'shot-compact';
        shotDiv.id = `shot-${i}`;
        shotDiv.innerHTML = `<span>${i + 1}</span><span class="shot-score-compact">--</span>`;
        shotsGrid.appendChild(shotDiv);
    }
    
    updateSessionCounter();
    
    sessionBtn.disabled = true;
    statusText.textContent = 'Shoot! Auto-captures shots';
    
    console.log('🎯 Session started - auto-capture enabled');
}

/**
 * Capture Shot (Auto or Manual)
 */
function captureShot() {
    if (!sessionMode || capturedShots.length >= 10) return;
    
    const now = Date.now();
    if (now - lastCaptureTime < 2000) return; // Min 2 seconds between shots
    
    const shotIndex = capturedShots.length;
    const currentScore = parseInt(document.getElementById('overall-score').textContent) || 0;
    
    capturedShots.push({
        index: shotIndex,
        score: currentScore,
        timestamp: now
    });
    
    lastCaptureTime = now;
    
    // Update UI
    const shotDiv = document.getElementById(`shot-${shotIndex}`);
    if (shotDiv) {
        shotDiv.classList.add('captured');
        shotDiv.querySelector('.shot-score-compact').textContent = currentScore;
    }
    
    // Show flash
    showShotFlash(shotIndex + 1, currentScore);
    
    // Play sound
    playSound('capture-sound');
    
    updateSessionCounter();
    updateSessionStats();
    
    console.log(`📸 Shot ${shotIndex + 1}/10 - Score: ${currentScore}`);
    
    if (capturedShots.length === 10) {
        completeSessionBtn.disabled = false;
        statusText.textContent = 'All shots captured! Click finish';
    }
}

/**
 * Show Shot Flash
 */
function showShotFlash(shotNum, score) {
    document.getElementById('shot-number-display').textContent = `Shot ${shotNum}/10`;
    document.getElementById('flash-score-val').textContent = score;
    shotFlash.classList.remove('hidden');
    
    setTimeout(() => {
        shotFlash.classList.add('hidden');
    }, 1000);
}

/**
 * Update Session Counter
 */
function updateSessionCounter() {
    document.getElementById('current-shot').textContent = capturedShots.length;
}

/**
 * Update Session Stats
 */
function updateSessionStats() {
    if (capturedShots.length === 0) return;
    
    const scores = capturedShots.map(s => s.score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const bestShot = Math.max(...scores);
    
    document.getElementById('best-shot').textContent = bestShot;
    document.getElementById('session-avg').textContent = Math.round(avgScore);
}

/**
 * Complete Session
 */
function completeSession() {
    sessionMode = false;
    
    const avgScore = capturedShots.reduce((sum, s) => sum + s.score, 0) / capturedShots.length;
    
    saveSessionToProgress(avgScore);
    updateProgressChart();
    
    if (avgScore >= 85) {
        showCelebration(avgScore);
    } else {
        alert(`Session Complete!\n\nAverage: ${Math.round(avgScore)}/100\n\nKeep practicing to improve!`);
    }
    
    document.getElementById('session-counter').classList.add('hidden');
    completeSessionBtn.disabled = true;
    sessionBtn.disabled = false;
    
    console.log('✅ Session complete');
}

/**
 * Show Celebration
 */
function showCelebration(score) {
    document.getElementById('celebration-score').textContent = Math.round(score);
    
    if (score >= 95) {
        document.getElementById('celebration-message').textContent = "You've mastered the perfect shot!";
    } else if (score >= 90) {
        document.getElementById('celebration-message').textContent = "Outstanding form!";
    } else {
        document.getElementById('celebration-message').textContent = "Great job!";
    }
    
    celebrationOverlay.classList.remove('hidden');
    createConfetti();
    playSound('success-sound');
    
    console.log('🎉 Celebration!');
}

/**
 * Close Celebration
 */
function closeCelebration() {
    celebrationOverlay.classList.add('hidden');
}

/**
 * Create Confetti
 */
function createConfetti() {
    const container = document.getElementById('confetti-container');
    container.innerHTML = '';
    
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#ffd700'];
    
    for (let i = 0; i < 60; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 2 + 's';
        confetti.style.animationDuration = (Math.random() * 2 + 3) + 's';
        container.appendChild(confetti);
    }
}

/**
 * Play Sound
 */
function playSound(soundId) {
    const sound = document.getElementById(soundId);
    if (sound) {
        sound.volume = 0.3;
        sound.currentTime = 0;
        sound.play().catch(e => console.log('Sound blocked'));
    }
}

/**
 * Process Pose Results - Apply Filters
 */
function onPoseResults(results) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply filter or draw normal
    if (opencvReady && currentFilter !== 'normal') {
        try {
            applyFilterToFrame(results.image);
        } catch (error) {
            console.error('Filter error:', error);
            ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
        }
    } else {
        ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
    }

    if (!results.poseLandmarks) {
        document.getElementById('form-feedback').textContent = 'Step into frame!';
        updateImprovementTips(['Get in position!']);
        return;
    }

    // Draw skeleton
    drawPose(results.poseLandmarks);

    // Analyze form
    analyzeShootingForm(results.poseLandmarks);
}

/**
 * Apply OpenCV Filters to Frame
 */
function applyFilterToFrame(imageElement) {
    const src = cv.imread(imageElement);
    let dst = new cv.Mat();
    
    try {
        switch(currentFilter) {
            case 'sobel':
                applySobelFilter(src, dst);
                break;
            case 'canny':
                applyCannyFilter(src, dst);
                break;
            case 'blur':
                applyGaussianBlur(src, dst);
                break;
            case 'sharpen':
                applySharpenFilter(src, dst);
                break;
            default:
                dst = src.clone();
        }
        
        cv.imshow(canvas, dst);
        
    } catch (error) {
        console.error('Filter application error:', error);
        ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
    } finally {
        src.delete();
        dst.delete();
    }
}

/**
 * Sobel Edge Detection
 */
function applySobelFilter(src, dst) {
    const gray = new cv.Mat();
    const gradX = new cv.Mat();
    const gradY = new cv.Mat();
    const absGradX = new cv.Mat();
    const absGradY = new cv.Mat();
    
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.Sobel(gray, gradX, cv.CV_16S, 1, 0, 3);
    cv.Sobel(gray, gradY, cv.CV_16S, 0, 1, 3);
    cv.convertScaleAbs(gradX, absGradX);
    cv.convertScaleAbs(gradY, absGradY);
    cv.addWeighted(absGradX, 0.5, absGradY, 0.5, 0, dst);
    cv.cvtColor(dst, dst, cv.COLOR_GRAY2RGBA);
    
    gray.delete();
    gradX.delete();
    gradY.delete();
    absGradX.delete();
    absGradY.delete();
}

/**
 * Canny Edge Detection
 */
function applyCannyFilter(src, dst) {
    const gray = new cv.Mat();
    const edges = new cv.Mat();
    
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
    cv.Canny(gray, edges, 80, 150);
    cv.cvtColor(edges, dst, cv.COLOR_GRAY2RGBA);
    
    gray.delete();
    edges.delete();
}

/**
 * Gaussian Blur
 */
function applyGaussianBlur(src, dst) {
    cv.GaussianBlur(src, dst, new cv.Size(11, 11), 0);
}

/**
 * Sharpen Filter
 */
function applySharpenFilter(src, dst) {
    const blurred = new cv.Mat();
    cv.GaussianBlur(src, blurred, new cv.Size(5, 5), 0);
    cv.addWeighted(src, 2.0, blurred, -1.0, 0, dst);
    blurred.delete();
}

/**
 * Draw Pose Skeleton
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
 * Analyze Form & Auto-Capture
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

    const overallScore = Math.round(
        (elbowScore * 0.3) + 
        (releaseScore * 0.3) + 
        (kneeScore * 0.2) + 
        (avgAlignment * 0.2)
    );

    updateMetricDisplay('overall-score', overallScore);
    updateScoreRing(overallScore);
    updateBars(elbowScore, releaseScore, kneeScore, avgAlignment);
    updateFeedback(overallScore);
    updateImprovementTips(avgElbow, avgRelease, avgKnee, avgAlignment);
    
    // AUTO-CAPTURE during session
    if (sessionMode && capturedShots.length < 10) {
        // Detect follow-through (wrist drops below shoulder after high position)
        const wristBelowShoulder = rightWrist.y > rightShoulder.y + 0.1;
        const wristAboveShoulder = rightWrist.y < rightShoulder.y - 0.1;
        
        if (wristAboveShoulder) {
            isInFollowThrough = false;
        }
        
        if (wristBelowShoulder && !isInFollowThrough) {
            isInFollowThrough = true;
            captureShot();
        }
    }
}

// Math Functions
function calculateAngle(p1, p2, p3) {
    const radians = Math.atan2(p3.y - p2.y, p3.x - p2.x) -
                    Math.atan2(p1.y - p2.y, p1.x - p2.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return angle;
}

function calculateReleaseAngle(shoulder, wrist) {
    const deltaY = shoulder.y - wrist.y;
    const deltaX = Math.abs(shoulder.x - wrist.x);
    return Math.max(0, Math.atan2(deltaY, deltaX) * 180 / Math.PI);
}

function calculateAlignment(leftShoulder, rightShoulder) {
    const diff = Math.abs(leftShoulder.y - rightShoulder.y);
    return Math.max(0, 100 - (diff * 1000));
}

function scoreElbowAngle(angle) {
    const diff = Math.abs(angle - 90);
    if (diff <= 10) return 100 - (diff * 5);
    return Math.max(0, 50 - ((diff - 10) * 2));
}

function scoreReleaseHeight(angle) {
    if (angle >= 45 && angle <= 60) return 100;
    if (angle < 45) return Math.max(0, angle / 45 * 100);
    return Math.max(0, 100 - ((angle - 60) * 3));
}

function scoreKneeAngle(angle) {
    if (angle >= 100 && angle <= 130) return 100;
    if (angle < 100) return Math.max(0, angle / 100 * 100);
    return Math.max(0, 100 - ((angle - 130) * 2));
}

function average(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// UI Updates
function updateMetricDisplay(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function updateScoreRing(score) {
    const ring = document.getElementById('score-ring');
    if (!ring) return;
    
    const circumference = 2 * Math.PI * 42;
    const offset = circumference - (score / 100) * circumference;
    ring.style.strokeDashoffset = offset;
    
    if (score >= 80) ring.style.stroke = '#4ade80';
    else if (score >= 60) ring.style.stroke = '#fbbf24';
    else ring.style.stroke = '#ef4444';
}

function updateBars(elbow, release, knee, alignment) {
    updateBar('elbow-bar', elbow);
    updateBar('release-bar', release);
    updateBar('knee-bar', knee);
    updateBar('alignment-bar', alignment);
}

function updateBar(id, score) {
    const bar = document.getElementById(id);
    if (!bar) return;
    
    bar.style.width = score + '%';
    bar.classList.remove('good', 'warning', 'poor');
    
    if (score >= 80) bar.classList.add('good');
    else if (score >= 60) bar.classList.add('warning');
    else bar.classList.add('poor');
}

function updateFeedback(score) {
    const el = document.getElementById('form-feedback');
    if (!el) return;
    
    if (score >= 90) el.textContent = '🔥 Excellent!';
    else if (score >= 80) el.textContent = '🎯 Great form!';
    else if (score >= 70) el.textContent = '👍 Good job!';
    else if (score >= 60) el.textContent = '💪 Keep going!';
    else el.textContent = '📚 Check tips';
}

function updateImprovementTips(elbow, release, knee, alignment) {
    const list = document.getElementById('improvement-list');
    if (!list) return;
    
    const tips = [];
    
    if (elbow < 85) tips.push('Raise elbow to 90°');
    else if (elbow > 95) tips.push('Lower elbow slightly');
    
    if (release < 45) tips.push('Release ball higher');
    else if (release > 60) tips.push('Release point too high');
    
    if (knee < 100) tips.push('Bend knees more');
    else if (knee > 130) tips.push('Knees too bent');
    
    if (alignment < 90) tips.push('Keep shoulders level');
    
    if (tips.length === 0) tips.push('Form looks great!');
    
    list.innerHTML = tips.map(t => `<li>${t}</li>`).join('');
}

// Progress Tracking
function saveSessionToProgress(avgScore) {
    const today = new Date().toDateString();
    
    if (!progressData.dailyScores[today]) {
        progressData.dailyScores[today] = [];
    }
    
    progressData.dailyScores[today].push(avgScore);
    progressData.sessions.push({
        date: Date.now(),
        score: avgScore
    });
    
    if (progressData.sessions.length > 30) {
        progressData.sessions = progressData.sessions.slice(-30);
    }
    
    localStorage.setItem('shotAnalyzerProgress', JSON.stringify(progressData));
    updateProgressStats();
}

function loadProgressData() {
    const saved = localStorage.getItem('shotAnalyzerProgress');
    if (saved) {
        progressData = JSON.parse(saved);
        updateProgressStats();
    }
}

function updateProgressStats() {
    const today = new Date().toDateString();
    const sessionsToday = (progressData.dailyScores[today] || []).length;
    
    const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const sessionsWeek = progressData.sessions.filter(s => s.date > weekAgo).length;
    
    updateMetricDisplay('sessions-today', sessionsToday);
    updateMetricDisplay('sessions-week', sessionsWeek);
    
    if (progressData.sessions.length >= 2) {
        const recent = progressData.sessions.slice(-5);
        const older = progressData.sessions.slice(-10, -5);
        
        if (older.length > 0) {
            const recentAvg = recent.reduce((sum, s) => sum + s.score, 0) / recent.length;
            const olderAvg = older.reduce((sum, s) => sum + s.score, 0) / older.length;
            const improvement = recentAvg - olderAvg;
            
            const el = document.getElementById('improvement');
            if (el) {
                el.textContent = (improvement >= 0 ? '+' : '') + Math.round(improvement);
                el.style.color = improvement >= 0 ? '#4ade80' : '#ef4444';
            }
        }
    }
}

function initializeChart() {
    const canvas = document.getElementById('progress-chart');
    if (!canvas) return;
    
    progressChart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Score',
                data: [],
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, max: 100 }
            }
        }
    });
    
    updateProgressChart();
}

function updateProgressChart() {
    if (!progressChart) return;
    
    const sessions = progressData.sessions.slice(-10);
    const labels = sessions.map((s, i) => `${i + 1}`);
    const scores = sessions.map(s => Math.round(s.score));
    
    progressChart.data.labels = labels;
    progressChart.data.datasets[0].data = scores;
    progressChart.update();
}

function resetCamera() {
    isRunning = false;
    startBtn.disabled = false;
    sessionBtn.disabled = true;
    stopBtn.disabled = true;
}

// Initialize
window.addEventListener('load', initialize);

console.log('🏀 Shot Analyzer v2.0 Loaded!');
