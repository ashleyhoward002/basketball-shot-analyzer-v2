/**
 * Basketball Shot Analyzer v2.0 - User-Friendly Edition
 * Features: Working real-time filters, shot capture feedback, kid-friendly UI
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
const shotNumber = document.getElementById('shot-number');
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

// Analysis Data
let frameCount = 0;
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
    console.log('🚀 Initializing application...');
    
    try {
        statusText.textContent = 'Loading AI Coach...';
        
        // Wait for OpenCV
        await waitForOpenCV();
        console.log('✅ OpenCV loaded');
        
        // Initialize MediaPipe Pose
        await initializePose();
        console.log('✅ MediaPipe loaded');
        
        // Load progress data
        loadProgressData();
        
        // Initialize chart
        initializeChart();
        
        // Setup event listeners
        setupEventListeners();
        
        statusText.textContent = 'Ready to Start!';
        loadingOverlay.classList.add('hidden');
        
        console.log('✅ App ready!');
        
    } catch (error) {
        console.error('❌ Initialization error:', error);
        statusText.textContent = 'Error - Please refresh';
        alert('Failed to load. Please refresh the page.');
    }
}

/**
 * Wait for OpenCV.js to load
 */
function waitForOpenCV() {
    return new Promise((resolve) => {
        if (typeof cv !== 'undefined') {
            opencvReady = true;
            resolve();
        } else {
            const checkInterval = setInterval(() => {
                if (typeof cv !== 'undefined') {
                    opencvReady = true;
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
            
            // Timeout after 30 seconds
            setTimeout(() => {
                clearInterval(checkInterval);
                if (!opencvReady) {
                    console.warn('⚠️ OpenCV loading timeout - filters may not work');
                    resolve(); // Continue anyway
                }
            }, 30000);
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
    document.querySelectorAll('.filter-btn-simple').forEach(btn => {
        btn.addEventListener('click', () => {
            const filter = btn.dataset.filter;
            switchFilter(filter);
        });
    });
    
    // Keyboard controls
    document.addEventListener('keydown', handleKeyboard);
}

/**
 * Handle Keyboard Shortcuts
 */
function handleKeyboard(e) {
    if (!isRunning) return;
    
    const key = e.key.toLowerCase();
    
    switch(key) {
        case 'n':
            switchFilter('normal');
            break;
        case 'e':
            switchFilter('sobel');
            break;
        case 'c':
            switchFilter('canny');
            break;
        case 'b':
            switchFilter('blur');
            break;
        case 's':
            switchFilter('sharpen');
            break;
        case 'x':
            switchFilter('xray');
            break;
        case ' ':
            if (sessionMode && capturedShots.length < 10) {
                captureShot();
            }
            e.preventDefault();
            break;
    }
}

/**
 * Switch Filter Mode
 */
function switchFilter(filterName) {
    currentFilter = filterName;
    
    // Update filter name display
    const filterNames = {
        'normal': '👁️ Normal View',
        'sobel': '📐 Outline View',
        'canny': '✨ Edge View',
        'blur': '🌫️ Blur View',
        'sharpen': '🔪 Sharp View',
        'xray': '🦴 X-Ray View'
    };
    
    filterNameDisplay.textContent = filterNames[filterName] || 'Normal View';
    
    // Update active button
    document.querySelectorAll('.filter-btn-simple').forEach(btn => {
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
        statusText.textContent = 'Analyzing...';

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
        alert('Could not access camera. Please allow camera access and try again.');
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
    console.log('⏸️ Camera stopped');
}

/**
 * Start 10-Shot Session
 */
function startSession() {
    if (!isRunning) {
        alert('Please start training first!');
        return;
    }
    
    sessionMode = true;
    capturedShots = [];
    
    // Show session UI
    document.getElementById('session-counter').classList.remove('hidden');
    document.getElementById('session-panel').classList.remove('hidden');
    
    // Create shot grid
    const shotsGrid = document.getElementById('shots-grid');
    shotsGrid.innerHTML = '';
    for (let i = 0; i < 10; i++) {
        const shotDiv = document.createElement('div');
        shotDiv.className = 'shot-mini';
        shotDiv.id = `shot-${i}`;
        shotDiv.innerHTML = `<span>${i + 1}</span><span class="shot-mini-score">--</span>`;
        shotsGrid.appendChild(shotDiv);
    }
    
    updateSessionCounter();
    
    sessionBtn.disabled = true;
    statusText.textContent = 'Press SPACE to capture shots!';
    
    console.log('🎯 Session started');
}

/**
 * Capture Shot
 */
function captureShot() {
    if (!sessionMode || capturedShots.length >= 10) return;
    
    const shotIndex = capturedShots.length;
    const currentScore = parseInt(document.getElementById('overall-score').textContent) || 0;
    
    // Store shot data
    const shotData = {
        index: shotIndex,
        score: currentScore,
        timestamp: Date.now()
    };
    
    capturedShots.push(shotData);
    
    // Update shot thumbnail
    const shotDiv = document.getElementById(`shot-${shotIndex}`);
    if (shotDiv) {
        shotDiv.classList.add('captured');
        shotDiv.querySelector('.shot-mini-score').textContent = currentScore;
    }
    
    // Show flash effect
    showShotFlash(shotIndex + 1);
    
    // Play sound
    playSound('capture-sound');
    
    // Update counter
    updateSessionCounter();
    
    // Update stats
    updateSessionStats();
    
    console.log(`📸 Shot ${shotIndex + 1}/10 captured - Score: ${currentScore}`);
    
    // Check if session complete
    if (capturedShots.length === 10) {
        completeSessionBtn.disabled = false;
        statusText.textContent = 'Session complete! Click finish';
    }
}

/**
 * Show Shot Flash Effect
 */
function showShotFlash(shotNum) {
    shotNumber.textContent = `Shot ${shotNum}/10`;
    shotFlash.classList.remove('hidden');
    
    setTimeout(() => {
        shotFlash.classList.add('hidden');
    }, 800);
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
    
    // Save to progress
    saveSessionToProgress(avgScore);
    
    // Update chart
    updateProgressChart();
    
    // Check for celebration
    if (avgScore >= 90) {
        showCelebration(avgScore);
    } else {
        alert(`Session Complete!\n\nAverage Score: ${Math.round(avgScore)}/100\n\nKeep practicing!`);
    }
    
    // Reset session UI
    document.getElementById('session-counter').classList.add('hidden');
    completeSessionBtn.disabled = true;
    sessionBtn.disabled = false;
    
    console.log('✅ Session completed');
}

/**
 * Show Celebration
 */
function showCelebration(score) {
    document.getElementById('celebration-score').textContent = Math.round(score);
    
    if (score >= 95) {
        document.getElementById('celebration-title').textContent = '🏆 INCREDIBLE! 🏆';
        document.getElementById('celebration-message').textContent = "You've got NBA-level form!";
    } else {
        document.getElementById('celebration-title').textContent = '🎯 AMAZING! 🎯';
        document.getElementById('celebration-message').textContent = "Outstanding technique!";
    }
    
    celebrationOverlay.classList.remove('hidden');
    
    // Create confetti
    createConfetti();
    
    // Play sound
    playSound('crowd-cheer');
    
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
    
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffd700'];
    
    for (let i = 0; i < 50; i++) {
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
        sound.play().catch(e => console.log('Sound blocked:', e));
    }
}

/**
 * Process Pose Results and Apply Filters
 */
function onPoseResults(results) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply filter or draw normal video
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
        updateImprovementTips(['Get in position to start analyzing']);
        return;
    }

    // Draw pose skeleton
    drawPose(results.poseLandmarks);

    // Analyze form
    analyzeShootingForm(results.poseLandmarks);
    
    frameCount++;
}

/**
 * Apply OpenCV Filters
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
            case 'xray':
                applyXRayFilter(src, dst);
                break;
            default:
                dst = src.clone();
        }
        
        cv.imshow(canvas, dst);
    } finally {
        src.delete();
        dst.delete();
    }
}

/**
 * Sobel Filter
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
 * Canny Filter
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
 * Gaussian Blur Filter
 */
function applyGaussianBlur(src, dst) {
    cv.GaussianBlur(src, dst, new cv.Size(9, 9), 0);
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
 * X-Ray Filter
 */
function applyXRayFilter(src, dst) {
    const gray = new cv.Mat();
    const edges = new cv.Mat();
    
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.bitwise_not(gray, gray);
    cv.Canny(gray, edges, 50, 150);
    cv.bitwise_not(edges, edges);
    cv.cvtColor(edges, dst, cv.COLOR_GRAY2RGBA);
    
    gray.delete();
    edges.delete();
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

    ctx.strokeStyle = currentFilter === 'xray' ? '#00ff00' : '#4ade80';
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
            ctx.fillStyle = currentFilter === 'xray' ? '#ffffff' : '#667eea';
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
 * Analyze Shooting Form
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
    updateQuickBars(elbowScore, releaseScore, kneeScore, alignmentScoreValue);
    updateFeedback(overallScore);
    updateImprovementTips(avgElbow, avgRelease, avgKnee, avgAlignment);
}

// Calculation Functions
function calculateAngle(point1, point2, point3) {
    const radians = Math.atan2(point3.y - point2.y, point3.x - point2.x) -
                    Math.atan2(point1.y - point2.y, point1.x - point2.x);
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
    const shoulderDiff = Math.abs(leftShoulder.y - rightShoulder.y);
    return Math.max(0, 100 - (shoulderDiff * 1000));
}

function scoreElbowAngle(angle) {
    const optimal = 90;
    const tolerance = 10;
    const diff = Math.abs(angle - optimal);
    if (diff <= tolerance) return 100 - (diff * 5);
    return Math.max(0, 50 - ((diff - tolerance) * 2));
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

// UI Update Functions
function updateMetricDisplay(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) element.textContent = value;
}

function updateScoreRing(score) {
    const ring = document.getElementById('score-ring');
    if (!ring) return;
    
    const circumference = 2 * Math.PI * 60;
    const offset = circumference - (score / 100) * circumference;
    ring.style.strokeDashoffset = offset;
    
    if (score >= 80) ring.style.stroke = '#4ade80';
    else if (score >= 60) ring.style.stroke = '#fbbf24';
    else ring.style.stroke = '#ef4444';
}

function updateQuickBars(elbowScore, releaseScore, kneeScore, alignmentScore) {
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
    
    if (score >= 80) bar.classList.add('good');
    else if (score >= 60) bar.classList.add('warning');
    else bar.classList.add('poor');
}

function updateFeedback(score) {
    const feedback = document.getElementById('form-feedback');
    if (!feedback) return;
    
    if (score >= 90) feedback.textContent = '🔥 Amazing form!';
    else if (score >= 80) feedback.textContent = '🎯 Great job!';
    else if (score >= 70) feedback.textContent = '👍 Good work!';
    else if (score >= 60) feedback.textContent = '💪 Keep practicing!';
    else feedback.textContent = '📚 Check the tips below';
}

function updateImprovementTips(elbow, release, knee, alignment) {
    const tipsList = document.getElementById('improvement-list');
    if (!tipsList) return;
    
    const tips = [];
    
    if (elbow < 85) tips.push('Raise your elbow higher (aim for 90°)');
    else if (elbow > 95) tips.push('Lower your elbow slightly');
    
    if (release < 45) tips.push('Release the ball higher');
    else if (release > 60) tips.push('Release point is too high');
    
    if (knee < 100) tips.push('Bend your knees more for power');
    else if (knee > 130) tips.push('Don\'t bend knees too much');
    
    if (alignment < 90) tips.push('Keep shoulders level');
    
    if (tips.length === 0) {
        tips.push('Form looks great! Keep it up!');
    }
    
    tipsList.innerHTML = tips.map(tip => `<li>${tip}</li>`).join('');
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
    
    const now = Date.now();
    const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
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
            
            const improvementEl = document.getElementById('improvement');
            if (improvementEl) {
                improvementEl.textContent = (improvement >= 0 ? '+' : '') + Math.round(improvement);
                improvementEl.style.color = improvement >= 0 ? '#4ade80' : '#ef4444';
            }
        }
    }
}

function initializeChart() {
    const chartCanvas = document.getElementById('progress-chart');
    if (!chartCanvas) return;
    
    const chartCtx = chartCanvas.getContext('2d');
    
    progressChart = new Chart(chartCtx, {
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
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
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
    statusText.textContent = 'Ready to Start!';
}

// Initialize on load
window.addEventListener('load', initialize);

console.log('🏀 Shot Analyzer v2.0 Loaded!');
