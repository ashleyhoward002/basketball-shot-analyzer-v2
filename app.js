/**
 * Basketball Shot Form Analyzer v2.0 - Module 7 Enhanced Edition
 * 
 * This application builds on Module 6 by adding:
 * - Real-time computer vision filters (Sobel, Canny, Blur, Sharpen, Cartoon, X-Ray)
 * - 10-shot session tracking with detailed analysis
 * - Progress tracking over time with charts
 * - Achievement/celebration system with stadium overlay
 * - Interactive parameter controls
 * - Side-by-side comparison mode
 * - Keyboard shortcuts for quick filter switching
 * 
 * Technologies: MediaPipe Pose, OpenCV.js, Chart.js
 */

// ==================== DOM ELEMENTS ====================
const video = document.getElementById('webcam');
const canvas = document.getElementById('output-canvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('start-btn');
const sessionBtn = document.getElementById('session-btn');
const stopBtn = document.getElementById('stop-btn');
const resetBtn = document.getElementById('reset-btn');
const loadingOverlay = document.getElementById('loading-overlay');
const statusText = document.getElementById('status-text');
const filterModeDisplay = document.getElementById('filter-name');
const completeSessionBtn = document.getElementById('complete-session-btn');
const celebrationOverlay = document.getElementById('celebration-overlay');
const celebrationClose = document.getElementById('celebration-close');

// ==================== STATE MANAGEMENT ====================
let pose;
let camera;
let isRunning = false;
let currentFilter = 'normal';
let sessionMode = false;
let capturedShots = [];
let sessionData = {
    shots: [],
    startTime: null,
    bestShot: 0,
    worstShot: 100,
    averageScore: 0
};

// ==================== OPENCV STATE ====================
let opencvReady = false;
let tempMat = null;

// ==================== ANALYSIS DATA ====================
let frameCount = 0;
let analysisData = {
    elbowAngles: [],
    releaseHeights: [],
    kneeAngles: [],
    alignmentScores: [],
    overallScores: []
};

// ==================== FILTER PARAMETERS ====================
let filterParams = {
    cannyT1: 80,
    cannyT2: 150,
    blurSize: 5,
    sharpenIntensity: 1.5
};

// ==================== PROGRESS TRACKING ====================
let progressData = {
    sessions: [],
    dailyScores: {},
    weeklyProgress: []
};

// ==================== CHART INSTANCE ====================
let progressChart = null;

/**
 * Initialize the application
 */
async function initialize() {
    try {
        statusText.textContent = 'Loading AI Models...';
        
        // Wait for OpenCV to load
        await waitForOpenCV();
        
        // Initialize MediaPipe Pose
        await initializePose();
        
        // Load progress data from localStorage
        loadProgressData();
        
        // Initialize progress chart
        initializeChart();
        
        // Set up event listeners
        setupEventListeners();
        
        statusText.textContent = 'Ready';
        loadingOverlay.classList.add('hidden');
        
        console.log('✅ Application initialized successfully');
        
    } catch (error) {
        console.error('❌ Initialization error:', error);
        statusText.textContent = 'Error loading application';
        alert('Failed to load application. Please refresh the page.');
    }
}

/**
 * Wait for OpenCV.js to load
 */
function waitForOpenCV() {
    return new Promise((resolve) => {
        if (typeof cv !== 'undefined') {
            opencvReady = true;
            console.log('✅ OpenCV.js loaded');
            resolve();
        } else {
            const checkInterval = setInterval(() => {
                if (typeof cv !== 'undefined') {
                    opencvReady = true;
                    console.log('✅ OpenCV.js loaded');
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
        }
    });
}

/**
 * Initialize MediaPipe Pose detection
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
        smoothSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    pose.onResults(onPoseResults);
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
    // Button controls
    startBtn.addEventListener('click', startCamera);
    sessionBtn.addEventListener('click', startSession);
    stopBtn.addEventListener('click', stopCamera);
    resetBtn.addEventListener('click', resetStats);
    completeSessionBtn.addEventListener('click', completeSession);
    celebrationClose.addEventListener('click', closeCelebration);
    
    // Filter button controls
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const filter = btn.dataset.filter;
            switchFilter(filter);
        });
    });
    
    // Parameter controls
    document.getElementById('canny-t1').addEventListener('input', (e) => {
        filterParams.cannyT1 = parseInt(e.target.value);
        document.getElementById('canny-t1-val').textContent = filterParams.cannyT1;
    });
    
    document.getElementById('canny-t2').addEventListener('input', (e) => {
        filterParams.cannyT2 = parseInt(e.target.value);
        document.getElementById('canny-t2-val').textContent = filterParams.cannyT2;
    });
    
    document.getElementById('blur-size').addEventListener('input', (e) => {
        filterParams.blurSize = parseInt(e.target.value);
        document.getElementById('blur-size-val').textContent = filterParams.blurSize;
        document.getElementById('blur-size-val-2').textContent = filterParams.blurSize;
    });
    
    document.getElementById('sharpen-intensity').addEventListener('input', (e) => {
        filterParams.sharpenIntensity = parseFloat(e.target.value);
        document.getElementById('sharpen-val').textContent = filterParams.sharpenIntensity;
    });
    
    // Keyboard controls
    document.addEventListener('keydown', handleKeyboard);
}

/**
 * Handle keyboard shortcuts
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
        case 't':
            switchFilter('cartoon');
            break;
        case 'x':
            switchFilter('xray');
            break;
        case 'v':
            switchFilter('comparison');
            break;
        case ' ':
            if (sessionMode) {
                captureShot();
            }
            e.preventDefault();
            break;
    }
}

/**
 * Switch between filter modes
 */
function switchFilter(filterName) {
    currentFilter = filterName;
    filterModeDisplay.textContent = getFilterDisplayName(filterName);
    
    // Update active button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === filterName) {
            btn.classList.add('active');
        }
    });
    
    console.log(`🎨 Switched to ${filterName} filter`);
}

/**
 * Get display name for filter
 */
function getFilterDisplayName(filterName) {
    const names = {
        'normal': 'Normal Mode',
        'sobel': 'Sobel Edge Detection',
        'canny': 'Canny Edge Detection',
        'blur': 'Gaussian Blur',
        'sharpen': 'Sharpened',
        'cartoon': 'Cartoon Effect',
        'xray': 'X-Ray Mode',
        'comparison': 'Side-by-Side Comparison'
    };
    return names[filterName] || 'Unknown';
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
        
    } catch (error) {
        console.error('Error starting camera:', error);
        alert('Could not access camera. Please grant camera permissions and try again.');
        resetCamera();
    }
}

/**
 * Stop camera and pose detection
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
 * Start 10-shot session mode
 */
function startSession() {
    if (!isRunning) {
        alert('Please start analysis first!');
        return;
    }
    
    sessionMode = true;
    capturedShots = [];
    sessionData = {
        shots: [],
        startTime: Date.now(),
        bestShot: 0,
        worstShot: 100,
        averageScore: 0
    };
    
    // Show session UI elements
    document.getElementById('session-counter').classList.remove('hidden');
    document.getElementById('session-progress-panel').classList.remove('hidden');
    
    // Initialize shot grid
    const shotsGrid = document.getElementById('shots-grid');
    shotsGrid.innerHTML = '';
    for (let i = 0; i < 10; i++) {
        const shotDiv = document.createElement('div');
        shotDiv.className = 'shot-thumbnail';
        shotDiv.id = `shot-${i}`;
        shotDiv.innerHTML = `<span>Shot ${i + 1}</span><span class="shot-score">--</span>`;
        shotsGrid.appendChild(shotDiv);
    }
    
    updateSessionCounter();
    
    sessionBtn.disabled = true;
    statusText.textContent = 'Session Mode - Press SPACE to capture shots';
    
    console.log('🎯 Started 10-shot session');
}

/**
 * Capture a shot during session
 */
function captureShot() {
    if (!sessionMode || capturedShots.length >= 10) return;
    
    const shotIndex = capturedShots.length;
    const currentScore = parseInt(document.getElementById('overall-score').textContent) || 0;
    
    // Store shot data
    const shotData = {
        index: shotIndex,
        score: currentScore,
        timestamp: Date.now(),
        metrics: {
            elbow: parseFloat(document.getElementById('elbow-angle').textContent) || 0,
            release: parseFloat(document.getElementById('release-height').textContent) || 0,
            knee: parseFloat(document.getElementById('knee-angle').textContent) || 0,
            alignment: parseFloat(document.getElementById('alignment-score').textContent) || 0
        }
    };
    
    capturedShots.push(shotData);
    sessionData.shots.push(shotData);
    
    // Update shot thumbnail
    const shotDiv = document.getElementById(`shot-${shotIndex}`);
    shotDiv.classList.add('captured');
    shotDiv.querySelector('.shot-score').textContent = currentScore;
    
    // Update session stats
    updateSessionStats();
    updateSessionCounter();
    
    // Play capture sound (optional)
    playSound('achievement-sound', 0.3);
    
    console.log(`📸 Captured shot ${shotIndex + 1}/10 - Score: ${currentScore}`);
    
    // Check if session complete
    if (capturedShots.length === 10) {
        completeSessionBtn.disabled = false;
        statusText.textContent = 'Session Complete! Review your shots.';
    }
}

/**
 * Update session counter display
 */
function updateSessionCounter() {
    document.getElementById('current-shot').textContent = capturedShots.length;
    
    // Update progress ring
    const ring = document.getElementById('session-ring');
    const circumference = 2 * Math.PI * 25;
    const offset = circumference - (capturedShots.length / 10) * circumference;
    ring.style.strokeDashoffset = offset;
}

/**
 * Update session statistics
 */
function updateSessionStats() {
    if (capturedShots.length === 0) return;
    
    const scores = capturedShots.map(s => s.score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const bestShot = Math.max(...scores);
    const worstShot = Math.min(...scores);
    const stdDev = calculateStdDev(scores);
    const consistency = Math.max(0, 100 - stdDev);
    
    document.getElementById('best-shot').textContent = bestShot;
    document.getElementById('session-avg').textContent = Math.round(avgScore);
    document.getElementById('consistency').textContent = Math.round(consistency) + '%';
    
    sessionData.bestShot = bestShot;
    sessionData.worstShot = worstShot;
    sessionData.averageScore = avgScore;
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values) {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
    return Math.sqrt(avgSquareDiff);
}

/**
 * Complete session and show celebration if earned
 */
function completeSession() {
    sessionMode = false;
    
    // Save session to progress data
    saveSessionToProgress();
    
    // Update chart
    updateProgressChart();
    
    // Check for celebration
    if (sessionData.averageScore >= 90) {
        showCelebration(sessionData.averageScore);
    } else {
        // Show summary tips
        showSessionSummary();
    }
    
    // Reset session UI
    document.getElementById('session-counter').classList.add('hidden');
    completeSessionBtn.disabled = true;
    sessionBtn.disabled = false;
    
    console.log('✅ Session completed');
}

/**
 * Show celebration overlay for high scores
 */
function showCelebration(score) {
    celebrationOverlay.classList.remove('hidden');
    
    // Update celebration content
    let title, message;
    if (score >= 95) {
        title = '🏆 NBA READY! 🏆';
        message = 'ELITE FORM - You\'re scout-worthy!';
    } else if (score >= 90) {
        title = '🎯 EXCELLENT FORM! 🎯';
        message = 'Outstanding technique!';
    }
    
    document.getElementById('celebration-title').textContent = title;
    document.getElementById('celebration-message').textContent = message;
    document.getElementById('celebration-score').textContent = Math.round(score);
    document.getElementById('celebration-avg').textContent = Math.round(sessionData.averageScore);
    
    // Create confetti
    createConfetti();
    
    // Play sounds
    playSound('crowd-cheer', 0.5);
    setTimeout(() => playSound('achievement-sound', 0.6), 500);
    
    console.log('🎉 Celebration triggered!');
}

/**
 * Create confetti animation
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
 * Close celebration overlay
 */
function closeCelebration() {
    celebrationOverlay.classList.add('hidden');
}

/**
 * Play sound effect
 */
function playSound(soundId, volume = 0.5) {
    const sound = document.getElementById(soundId);
    if (sound) {
        sound.volume = volume;
        sound.currentTime = 0;
        sound.play().catch(e => console.log('Sound play prevented:', e));
    }
}

/**
 * Show session summary with improvement tips
 */
function showSessionSummary() {
    const avgScore = sessionData.averageScore;
    let tips = [];
    
    // Analyze session patterns
    const elbowAvg = sessionData.shots.reduce((sum, s) => sum + s.metrics.elbow, 0) / 10;
    const releaseAvg = sessionData.shots.reduce((sum, s) => sum + s.metrics.release, 0) / 10;
    const kneeAvg = sessionData.shots.reduce((sum, s) => sum + s.metrics.knee, 0) / 10;
    
    if (elbowAvg < 85) {
        tips.push('💡 Raise your elbow higher - aim for 90°');
    } else if (elbowAvg > 95) {
        tips.push('💡 Lower your elbow slightly for better control');
    }
    
    if (releaseAvg < 45) {
        tips.push('💡 Release the ball higher for better arc');
    }
    
    if (kneeAvg < 100) {
        tips.push('💡 Bend your knees more for power generation');
    }
    
    if (tips.length > 0) {
        alert('Session Complete!\n\nYour Score: ' + Math.round(avgScore) + '/100\n\nTips for Improvement:\n' + tips.join('\n'));
    } else {
        alert('Great session! Score: ' + Math.round(avgScore) + '/100\n\nKeep practicing to maintain consistency!');
    }
}

/**
 * Save session data to localStorage for progress tracking
 */
function saveSessionToProgress() {
    const today = new Date().toDateString();
    
    if (!progressData.dailyScores[today]) {
        progressData.dailyScores[today] = [];
    }
    
    progressData.dailyScores[today].push(sessionData.averageScore);
    progressData.sessions.push({
        date: Date.now(),
        score: sessionData.averageScore,
        shots: sessionData.shots.length
    });
    
    // Keep only last 30 sessions
    if (progressData.sessions.length > 30) {
        progressData.sessions = progressData.sessions.slice(-30);
    }
    
    // Update weekly progress
    updateWeeklyProgress();
    
    // Save to localStorage
    localStorage.setItem('shotAnalyzerProgress', JSON.stringify(progressData));
    
    // Update stats display
    updateProgressStats();
}

/**
 * Load progress data from localStorage
 */
function loadProgressData() {
    const saved = localStorage.getItem('shotAnalyzerProgress');
    if (saved) {
        progressData = JSON.parse(saved);
        updateProgressStats();
    }
}

/**
 * Update weekly progress summary
 */
function updateWeeklyProgress() {
    const now = Date.now();
    const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
    
    const thisWeek = progressData.sessions.filter(s => s.date > weekAgo);
    progressData.weeklyProgress = thisWeek;
}

/**
 * Update progress statistics display
 */
function updateProgressStats() {
    const today = new Date().toDateString();
    const sessionsToday = (progressData.dailyScores[today] || []).length;
    const sessionsWeek = progressData.weeklyProgress.length;
    
    document.getElementById('sessions-today').textContent = sessionsToday;
    document.getElementById('sessions-week').textContent = sessionsWeek;
    
    // Calculate improvement
    if (progressData.sessions.length >= 2) {
        const recent = progressData.sessions.slice(-5);
        const older = progressData.sessions.slice(-10, -5);
        
        if (older.length > 0) {
            const recentAvg = recent.reduce((sum, s) => sum + s.score, 0) / recent.length;
            const olderAvg = older.reduce((sum, s) => sum + s.score, 0) / older.length;
            const improvement = recentAvg - olderAvg;
            
            const improvementEl = document.getElementById('improvement');
            improvementEl.textContent = (improvement >= 0 ? '+' : '') + Math.round(improvement);
            improvementEl.style.color = improvement >= 0 ? '#4ade80' : '#ef4444';
        }
    }
}

/**
 * Initialize progress chart
 */
function initializeChart() {
    const chartCanvas = document.getElementById('progress-chart');
    const chartCtx = chartCanvas.getContext('2d');
    
    progressChart = new Chart(chartCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Form Score',
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
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value;
                        }
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
    
    updateProgressChart();
}

/**
 * Update progress chart with latest data
 */
function updateProgressChart() {
    if (!progressChart) return;
    
    const sessions = progressData.sessions.slice(-10); // Last 10 sessions
    const labels = sessions.map((s, i) => `Session ${i + 1}`);
    const scores = sessions.map(s => Math.round(s.score));
    
    progressChart.data.labels = labels;
    progressChart.data.datasets[0].data = scores;
    progressChart.update();
}

/**
 * Reset all statistics
 */
function resetStats() {
    analysisData = {
        elbowAngles: [],
        releaseHeights: [],
        kneeAngles: [],
        alignmentScores: [],
        overallScores: []
    };
    frameCount = 0;
    
    updateMetricDisplay('overall-score', '--');
    updateMetricDisplay('elbow-angle', '--°');
    updateMetricDisplay('release-height', '--°');
    updateMetricDisplay('knee-angle', '--°');
    updateMetricDisplay('alignment-score', '--');
    
    document.getElementById('form-feedback').textContent = 'Statistics reset. Continue analyzing...';
    updateProgressBars(0, 0, 0, 0);
    updateScoreRing(0);
}

/**
 * Process pose detection results and apply current filter
 */
function onPoseResults(results) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw video frame (or apply filter to it)
    if (opencvReady && currentFilter !== 'normal') {
        applyFilterToFrame(results.image);
    } else {
        ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
    }

    if (!results.poseLandmarks) {
        document.getElementById('form-feedback').textContent = 'No person detected. Step into frame.';
        return;
    }

    // Draw pose overlay (if not in certain filter modes)
    if (currentFilter !== 'comparison') {
        drawPose(results.poseLandmarks);
    }

    // Perform biomechanical analysis
    analyzeShootingForm(results.poseLandmarks);
    
    frameCount++;
}

/**
 * Apply OpenCV filters to the video frame
 */
function applyFilterToFrame(imageElement) {
    try {
        // Create mat from image
        const src = cv.imread(imageElement);
        let dst = new cv.Mat();
        
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
            case 'cartoon':
                applyCartoonFilter(src, dst);
                break;
            case 'xray':
                applyXRayFilter(src, dst);
                break;
            case 'comparison':
                applyComparisonMode(src, dst);
                break;
            default:
                dst = src.clone();
        }
        
        // Draw filtered image to canvas
        cv.imshow(canvas, dst);
        
        // Clean up
        src.delete();
        dst.delete();
        
    } catch (error) {
        console.error('Filter error:', error);
        // Fallback to normal display
        ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
    }
}

/**
 * Apply Sobel edge detection filter
 */
function applySobelFilter(src, dst) {
    const gray = new cv.Mat();
    const gradX = new cv.Mat();
    const gradY = new cv.Mat();
    const absGradX = new cv.Mat();
    const absGradY = new cv.Mat();
    
    // Convert to grayscale
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    
    // Apply Sobel
    cv.Sobel(gray, gradX, cv.CV_16S, 1, 0, 3);
    cv.Sobel(gray, gradY, cv.CV_16S, 0, 1, 3);
    
    // Convert back to CV_8U
    cv.convertScaleAbs(gradX, absGradX);
    cv.convertScaleAbs(gradY, absGradY);
    
    // Combine gradients
    cv.addWeighted(absGradX, 0.5, absGradY, 0.5, 0, dst);
    
    // Convert to RGBA for display
    cv.cvtColor(dst, dst, cv.COLOR_GRAY2RGBA);
    
    // Clean up
    gray.delete();
    gradX.delete();
    gradY.delete();
    absGradX.delete();
    absGradY.delete();
}

/**
 * Apply Canny edge detection filter
 */
function applyCannyFilter(src, dst) {
    const gray = new cv.Mat();
    const edges = new cv.Mat();
    
    // Convert to grayscale
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    
    // Apply Gaussian blur to reduce noise
    cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
    
    // Apply Canny edge detection
    cv.Canny(gray, edges, filterParams.cannyT1, filterParams.cannyT2);
    
    // Convert to RGBA for display
    cv.cvtColor(edges, dst, cv.COLOR_GRAY2RGBA);
    
    // Clean up
    gray.delete();
    edges.delete();
}

/**
 * Apply Gaussian blur filter
 */
function applyGaussianBlur(src, dst) {
    const ksize = new cv.Size(filterParams.blurSize, filterParams.blurSize);
    cv.GaussianBlur(src, dst, ksize, 0);
}

/**
 * Apply sharpening filter
 */
function applySharpenFilter(src, dst) {
    const blurred = new cv.Mat();
    const ksize = new cv.Size(5, 5);
    
    // Blur the image
    cv.GaussianBlur(src, blurred, ksize, 0);
    
    // Sharpen = original + intensity * (original - blurred)
    cv.addWeighted(src, 1 + filterParams.sharpenIntensity, blurred, -filterParams.sharpenIntensity, 0, dst);
    
    blurred.delete();
}

/**
 * Apply cartoon effect filter
 */
function applyCartoonFilter(src, dst) {
    const gray = new cv.Mat();
    const edges = new cv.Mat();
    const color = new cv.Mat();
    
    // Edge detection
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.medianBlur(gray, gray, 7);
    cv.adaptiveThreshold(gray, edges, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY, 9, 2);
    
    // Color quantization
    cv.bilateralFilter(src, color, 9, 300, 300);
    
    // Combine edges and color
    cv.cvtColor(edges, edges, cv.COLOR_GRAY2RGBA);
    cv.bitwise_and(color, edges, dst);
    
    // Clean up
    gray.delete();
    edges.delete();
    color.delete();
}

/**
 * Apply X-Ray mode (inverted edges with skeleton)
 */
function applyXRayFilter(src, dst) {
    const gray = new cv.Mat();
    const edges = new cv.Mat();
    
    // Convert to grayscale and invert
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.bitwise_not(gray, gray);
    
    // Detect edges
    cv.Canny(gray, edges, 50, 150);
    
    // Create X-ray effect (white edges on black background)
    cv.bitwise_not(edges, edges);
    
    // Convert to RGBA
    cv.cvtColor(edges, dst, cv.COLOR_GRAY2RGBA);
    
    // Clean up
    gray.delete();
    edges.delete();
}

/**
 * Apply side-by-side comparison mode
 */
function applyComparisonMode(src, dst) {
    // Create 2x2 grid of different filters
    const w = src.cols;
    const h = src.rows;
    const halfW = Math.floor(w / 2);
    const halfH = Math.floor(h / 2);
    
    dst = src.clone();
    
    // For simplicity, just show normal for now
    // In full implementation, would show 4 different filter views
}

/**
 * Draw pose skeleton and landmarks
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

    // Draw connections
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

    // Draw landmarks
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
 * Analyze shooting form (same as v1 but with session tracking)
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
}

// Utility functions (same as v1)
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
    const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
    return Math.max(0, angle);
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

function updateMetricDisplay(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) element.textContent = value;
}

function updateScoreRing(score) {
    const ring = document.getElementById('score-ring');
    const circumference = 2 * Math.PI * 52;
    const offset = circumference - (score / 100) * circumference;
    ring.style.strokeDashoffset = offset;
    
    if (score >= 80) ring.style.stroke = '#4ade80';
    else if (score >= 60) ring.style.stroke = '#fbbf24';
    else ring.style.stroke = '#ef4444';
}

function updateProgressBars(elbowScore, releaseScore, kneeScore, alignmentScore) {
    updateBar('elbow-bar', elbowScore);
    updateBar('release-bar', releaseScore);
    updateBar('knee-bar', kneeScore);
    updateBar('alignment-bar', alignmentScore);
}

function updateBar(barId, score) {
    const bar = document.getElementById(barId);
    bar.style.width = score + '%';
    bar.classList.remove('good', 'warning', 'poor');
    if (score >= 80) bar.classList.add('good');
    else if (score >= 60) bar.classList.add('warning');
    else bar.classList.add('poor');
}

function updateFeedback(overall) {
    const feedback = document.getElementById('form-feedback');
    if (overall >= 85) feedback.textContent = '🎯 Excellent form! Your technique is on point!';
    else if (overall >= 70) feedback.textContent = '👍 Good form! Keep practicing for consistency.';
    else if (overall >= 50) feedback.textContent = '⚠️ Fair form. Focus on the metrics below.';
    else feedback.textContent = '💡 Needs improvement. Review the tips.';
}

function updateStatusMessages(elbow, release, knee, alignment) {
    const elbowStatus = document.getElementById('elbow-status');
    if (elbow >= 85 && elbow <= 95) {
        elbowStatus.textContent = '✓ Perfect elbow angle!';
        elbowStatus.style.color = '#4ade80';
    } else {
        elbowStatus.textContent = elbow < 85 ? '↑ Raise elbow' : '↓ Lower elbow';
        elbowStatus.style.color = '#f59e0b';
    }
    
    const releaseStatus = document.getElementById('release-status');
    if (release >= 45 && release <= 60) {
        releaseStatus.textContent = '✓ Optimal release!';
        releaseStatus.style.color = '#4ade80';
    } else {
        releaseStatus.textContent = release < 45 ? '↑ Higher release' : '↓ Lower release';
        releaseStatus.style.color = '#f59e0b';
    }
    
    const kneeStatus = document.getElementById('knee-status');
    if (knee >= 100 && knee <= 130) {
        kneeStatus.textContent = '✓ Good knee bend!';
        kneeStatus.style.color = '#4ade80';
    } else {
        kneeStatus.textContent = knee < 100 ? 'Bend more' : 'Too bent';
        kneeStatus.style.color = '#f59e0b';
    }
    
    const alignmentStatus = document.getElementById('alignment-status');
    if (alignment >= 90) {
        alignmentStatus.textContent = '✓ Perfect alignment!';
        alignmentStatus.style.color = '#4ade80';
    } else {
        alignmentStatus.textContent = 'Check shoulders';
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

// Initialize application when page loads
window.addEventListener('load', initialize);
