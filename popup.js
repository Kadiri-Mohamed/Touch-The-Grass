// DOM Elements
const totalTimeEl = document.getElementById('totalTime');
const breaksTakenEl = document.getElementById('breaksTaken');
const plantsCountEl = document.getElementById('plantsCount');
const nextBreakTimerEl = document.getElementById('nextBreakTimer');
const nextBreakTypeEl = document.getElementById('nextBreakType');
const sitesListEl = document.getElementById('sitesList');
const achievementsEl = document.getElementById('achievements');
const takeBreakBtn = document.getElementById('takeBreakBtn');
const settingsBtn = document.getElementById('settingsBtn');
const statsBtn = document.getElementById('statsBtn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
    setupEventListeners();
    startTimer();
});

function loadDashboard() {
    chrome.storage.local.get(['dailyStats', 'usage', 'achievements', 'settings'], (data) => {
        const dailyStats = data.dailyStats || { totalTime: 0, breaksTaken: 0 };
        const usage = data.usage || {};
        const achievements = data.achievements || { plantsCollected: 0 };
        const settings = data.settings || {};

        // Update stats
        totalTimeEl.textContent = Math.round(dailyStats.totalTime / 60000);
        breaksTakenEl.textContent = dailyStats.breaksTaken || 0;
        plantsCountEl.textContent = achievements.plantsCollected || 0;

        // Load top sites
        loadTopSites(usage);

        // Load achievements
        loadAchievements(achievements);

        // Calculate next break
        calculateNextBreak(settings);
    });
}

function loadTopSites(usage) {
    sitesListEl.innerHTML = '';
    
    if (Object.keys(usage).length === 0) {
        sitesListEl.innerHTML = '<div class="loading">No browsing data yet today</div>';
        return;
    }

    // Convert to array and sort
    const entries = Object.entries(usage)
        .map(([domain, data]) => ({
            domain,
            time: data.time || data, // Support both old and new format
            visits: data.visits || 1
        }))
        .sort((a, b) => b.time - a.time)
        .slice(0, 5);

    entries.forEach((site, index) => {
        const siteEl = document.createElement('div');
        siteEl.className = 'site-item';
        
        const minutes = Math.round(site.time / 60000);
        const visitsText = site.visits > 1 ? ` (${site.visits} visits)` : '';
        
        siteEl.innerHTML = `
            <div class="site-domain">
                <span class="site-rank">${index + 1}.</span> ${truncateDomain(site.domain)}
            </div>
            <div class="site-time">${minutes}m${visitsText}</div>
        `;
        
        sitesListEl.appendChild(siteEl);
    });
}

function truncateDomain(domain) {
    return domain.length > 25 ? domain.substring(0, 22) + '...' : domain;
}

function loadAchievements(achievements) {
    achievementsEl.innerHTML = '';
    
    const achievementList = [
        { id: 'firstBreak', icon: 'fas fa-seedling', name: 'First Break', locked: !achievements.milestones?.firstBreak },
        { id: 'tenBreaks', icon: 'fas fa-leaf', name: '10 Breaks', locked: !achievements.milestones?.tenBreaks },
        { id: 'hourBreaks', icon: 'fas fa-tree', name: '1 Hour', locked: !achievements.milestones?.hourOfBreaks },
        { id: 'weekStreak', icon: 'fas fa-trophy', name: '7 Day Streak', locked: !achievements.milestones?.weekStreak }
    ];
    
    achievementList.forEach(achievement => {
        const achievementEl = document.createElement('div');
        achievementEl.className = `achievement ${achievement.locked ? 'locked' : ''}`;
        
        achievementEl.innerHTML = `
            <i class="${achievement.icon}"></i>
            <div class="achievement-name">${achievement.name}</div>
        `;
        
        achievementsEl.appendChild(achievementEl);
    });
}

function calculateNextBreak(settings) {
    const now = Date.now();
    const eyeBreak = (settings.eyeBreak || 20) * 60 * 1000;
    
    chrome.storage.local.get(['eyeBreakLast', 'stretchBreakLast', 'longBreakLast'], (data) => {
        const eyeBreakLast = data.eyeBreakLast || now;
        const stretchBreakLast = data.stretchBreakLast || now;
        const longBreakLast = data.longBreakLast || now;
        
        const times = [
            { time: eyeBreakLast + eyeBreak, type: '👀 Eye Break' },
            { time: stretchBreakLast + ((settings.stretchBreak || 45) * 60 * 1000), type: '🧘 Stretch Break' },
            { time: longBreakLast + ((settings.longBreak || 90) * 60 * 1000), type: '🌿 Long Break' }
        ];
        
        const nextBreak = times.reduce((prev, curr) => 
            curr.time < prev.time ? curr : prev
        );
        
        const timeUntilBreak = Math.max(0, nextBreak.time - now);
        updateTimerDisplay(timeUntilBreak, nextBreak.type);
    });
}

function updateTimerDisplay(ms, type) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    
    nextBreakTimerEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    nextBreakTypeEl.textContent = type;
}

function startTimer() {
    setInterval(() => {
        chrome.storage.local.get(['settings'], (data) => {
            calculateNextBreak(data.settings || {});
        });
    }, 1000);
}

function setupEventListeners() {
    takeBreakBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'manualBreak' });
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: '🌿 Break Time!',
            message: 'Enjoy your break! Remember to stretch and look away from the screen.'
        });
    });
    
    settingsBtn.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });
    
    statsBtn.addEventListener('click', () => {
        window.open(chrome.runtime.getURL('stats.html'), '_blank');
    });
}

// Listen for updates
chrome.storage.onChanged.addListener((changes) => {
    if (changes.dailyStats || changes.usage || changes.achievements) {
        loadDashboard();
    }
});