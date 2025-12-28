console.log("Touch The Grass background running...");

// -------------------------------
// VARIABLES & DEFAULT SETTINGS
// -------------------------------
let currentDomain = null;
let lastSwitchTime = Date.now();
let totalToday = 0;

// Break tracking with separate timers
let eyeBreakLast = Date.now();
let stretchBreakLast = Date.now();
let longBreakLast = Date.now();

// Default settings
const DEFAULT_SETTINGS = {
    eyeBreak: 20,
    stretchBreak: 45,
    longBreak: 90,
    soundEnabled: false,
    notificationType: 'basic',
    blockedSites: [],
    focusMode: false,
    achievementsEnabled: true
};

// Load settings on startup
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get('settings', (data) => {
        if (!data.settings) {
            chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
        }
    });
    
    // Initialize daily data
    initDailyData();
});

// Initialize or reset daily data
function initDailyData() {
    const today = new Date().toDateString();
    chrome.storage.local.get(['lastReset', 'dailyStats'], (data) => {
        if (data.lastReset !== today) {
            chrome.storage.local.set({
                lastReset: today,
                dailyStats: {
                    totalTime: 0,
                    breaksTaken: 0,
                    eyeBreaks: 0,
                    stretchBreaks: 0,
                    longBreaks: 0,
                    date: today
                },
                usage: {}
            });
        }
    });
}

// -------------------------------
// TAB & TIME TRACKING
// -------------------------------
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
        handleTabSwitch(tab.url);
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {
        handleTabSwitch(changeInfo.url);
    }
});

// Track time when window loses focus (user is away)
chrome.windows.onFocusChanged.addListener((windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
        // User switched to another window or desktop
        if (currentDomain) {
            const timeSpent = Date.now() - lastSwitchTime;
            addTime(currentDomain, timeSpent);
        }
    } else {
        // User came back, update timestamps
        lastSwitchTime = Date.now();
        eyeBreakLast = Date.now();
        stretchBreakLast = Date.now();
        longBreakLast = Date.now();
    }
});

function handleTabSwitch(url) {
    const now = Date.now();

    // Save time spent on previous site
    if (currentDomain) {
        const timeSpent = now - lastSwitchTime;
        if (timeSpent > 1000) { // Ignore very short switches
            addTime(currentDomain, timeSpent);
        }
    }

    // Update domain + timestamp
    currentDomain = extractDomain(url);
    lastSwitchTime = now;

    // Check if site should be blocked (focus mode)
    checkBlockedSite(currentDomain);
    
    // Check for break reminders
    checkBreakReminder();
}

function extractDomain(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace('www.', '');
    } catch {
        return "unknown";
    }
}

function addTime(domain, timeSpent) {
    chrome.storage.local.get(['usage', 'dailyStats'], (data) => {
        let usage = data.usage || {};
        let dailyStats = data.dailyStats || { totalTime: 0 };

        if (!usage[domain]) {
            usage[domain] = { time: 0, visits: 0 };
        }
        
        if (typeof usage[domain] === 'number') {
            // Convert old format to new format
            usage[domain] = { time: usage[domain], visits: 1 };
        }
        
        usage[domain].time += timeSpent;
        usage[domain].visits += 1;
        
        dailyStats.totalTime += timeSpent;

        chrome.storage.local.set({ usage, dailyStats });
    });
}

// -------------------------------
// BREAK REMINDERS
// -------------------------------
function checkBreakReminder() {
    chrome.storage.local.get('settings', (data) => {
        const settings = data.settings || DEFAULT_SETTINGS;
        const now = Date.now();
        
        // Convert minutes to milliseconds
        const EYE_BREAK = settings.eyeBreak * 60 * 1000;
        const STRETCH_BREAK = settings.stretchBreak * 60 * 1000;
        const LONG_BREAK = settings.longBreak * 60 * 1000;
        
        if (now - longBreakLast > LONG_BREAK) {
            triggerBreak('long', "🌿 Time to Touch Some Grass!", 
                "You've been browsing for " + settings.longBreak + " minutes. Take a 5-10 minute break!");
            longBreakLast = now;
            stretchBreakLast = now;
            eyeBreakLast = now;
            updateAchievement('longBreaks');
            return;
        }
        
        if (now - stretchBreakLast > STRETCH_BREAK) {
            triggerBreak('stretch', "🧘 Stretch Break Time!", 
                "Stand up and stretch for 2 minutes! Your body will thank you.");
            stretchBreakLast = now;
            eyeBreakLast = now;
            updateAchievement('stretchBreaks');
            return;
        }
        
        if (now - eyeBreakLast > EYE_BREAK) {
            triggerBreak('eye', "👀 20-20-20 Rule", 
                "Look at something 20 feet away for 20 seconds. Blink a few times!");
            eyeBreakLast = now;
            updateAchievement('eyeBreaks');
        }
    });
}

function triggerBreak(type, title, message) {
    // Update stats
    chrome.storage.local.get('dailyStats', (data) => {
        let dailyStats = data.dailyStats || { breaksTaken: 0 };
        dailyStats.breaksTaken = (dailyStats.breaksTaken || 0) + 1;
        dailyStats[type + 'Breaks'] = (dailyStats[type + 'Breaks'] || 0) + 1;
        
        chrome.storage.local.set({ dailyStats });
    });
    
    // Show notification
    sendNotification(title, message);
    
    // Play sound if enabled
    chrome.storage.local.get('settings', (data) => {
        if (data.settings?.soundEnabled) {
            playNotificationSound();
        }
    });
}

function sendNotification(title, message) {
    chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: title,
        message: message,
        priority: 2
    });
}

function playNotificationSound() {
    const audio = new Audio(chrome.runtime.getURL('sounds/notification.mp3'));
    audio.volume = 0.3;
    audio.play().catch(e => console.log("Sound play failed:", e));
}

// -------------------------------
// FOCUS MODE & BLOCKED SITES
// -------------------------------
function checkBlockedSite(domain) {
    chrome.storage.local.get('settings', async (data) => {
        const settings = data.settings || DEFAULT_SETTINGS;
        
        if (settings.focusMode && settings.blockedSites && settings.blockedSites.length > 0) {
            const blocked = settings.blockedSites.some(site => 
                domain.includes(site.trim())
            );
            
            if (blocked) {
                // Check if we're currently in a break period
                const now = Date.now();
                const sinceLongBreak = now - longBreakLast;
                const longBreakThreshold = (settings.longBreak * 60 * 1000) - (5 * 60 * 1000); // 5 min before break
                
                if (sinceLongBreak > longBreakThreshold) {
                    // Redirect to break page or show warning
                    try {
                        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                        if (tabs[0]) {
                            chrome.tabs.update(tabs[0].id, {
                                url: chrome.runtime.getURL('break.html')
                            });
                        }
                    } catch (error) {
                        console.log("Could not redirect:", error);
                    }
                }
            }
        }
    });
}

// -------------------------------
// ACHIEVEMENT SYSTEM
// -------------------------------
function updateAchievement(type) {
    chrome.storage.local.get(['achievements', 'settings'], (data) => {
        if (!data.settings?.achievementsEnabled) return;
        
        let achievements = data.achievements || {
            totalBreaks: 0,
            streaks: 0,
            lastBreakDay: null,
            plantsCollected: 0,
            milestones: {
                firstBreak: false,
                tenBreaks: false,
                hourOfBreaks: false,
                weekStreak: false
            }
        };
        
        achievements.totalBreaks = (achievements.totalBreaks || 0) + 1;
        
        // Check for streak
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        
        if (achievements.lastBreakDay === yesterday) {
            achievements.streaks = (achievements.streaks || 0) + 1;
        } else if (achievements.lastBreakDay !== today) {
            achievements.streaks = 1;
        }
        
        achievements.lastBreakDay = today;
        
        // Check milestones
        if (!achievements.milestones.firstBreak && achievements.totalBreaks >= 1) {
            achievements.milestones.firstBreak = true;
            achievements.plantsCollected = (achievements.plantsCollected || 0) + 1;
            sendNotification("🌱 First Plant Collected!", "You took your first break! Collect more plants by continuing your healthy habits.");
        }
        
        if (!achievements.milestones.tenBreaks && achievements.totalBreaks >= 10) {
            achievements.milestones.tenBreaks = true;
            achievements.plantsCollected += 2;
            sendNotification("🌿 Two More Plants!", "You've taken 10 breaks! Your digital garden is growing.");
        }
        
        chrome.storage.local.set({ achievements });
    });
}

// -------------------------------
// ALARMS FOR PERIODIC TASKS
// -------------------------------
chrome.alarms.create('checkIdle', { periodInMinutes: 1 });
chrome.alarms.create('dailyReset', { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'dailyReset') {
        initDailyData();
    }
});