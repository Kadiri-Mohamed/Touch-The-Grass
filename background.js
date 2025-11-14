console.log("Touch The Grass background running...");

// -------------------------------
// VARIABLES
// -------------------------------
let currentDomain = null;
let lastSwitchTime = Date.now();
let lastBreakTime = Date.now();

// break reminder intervals
const EYE_BREAK = 20 * 60 * 1000;      // 20 min
const STRETCH_BREAK = 45 * 60 * 1000;  // 45 min
const LONG_BREAK = 90 * 60 * 1000;     // 90 min

// -------------------------------
// HANDLE TAB CHANGES
// -------------------------------
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    handleTabSwitch(tab.url);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {
        handleTabSwitch(changeInfo.url);
    }
});

// -------------------------------
// FUNCTIONS
// -------------------------------
function handleTabSwitch(url) {
    const now = Date.now();

    // Save time spent on previous site
    if (currentDomain) {
        const timeSpent = now - lastSwitchTime;
        addTime(currentDomain, timeSpent);
    }

    // Update domain + timestamp
    currentDomain = extractDomain(url);
    lastSwitchTime = now;

    checkBreakReminder();
}

function extractDomain(url) {
    try {
        return new URL(url).hostname;
    } catch {
        return "unknown";
    }
}

function addTime(domain, timeSpent) {
    chrome.storage.local.get("usage", (data) => {
        let usage = data.usage || {};

        if (!usage[domain]) usage[domain] = 0;

        usage[domain] += timeSpent;

        chrome.storage.local.set({ usage });
    });
}

// -------------------------------
// BREAK REMINDERS
// -------------------------------
function checkBreakReminder() {
    const now = Date.now();
    const sinceBreak = now - lastBreakTime;

    if (sinceBreak > LONG_BREAK) {
        sendNotification("Long break time!", "You've been using the screen for 90 minutes. Touch some grass 🌱");
        lastBreakTime = now;
        return;
    }

    if (sinceBreak > STRETCH_BREAK) {
        sendNotification("Stretch break", "You've been here 45 minutes. Stand up for a moment! 🌿");
        lastBreakTime = now;
        return;
    }

    if (sinceBreak > EYE_BREAK) {
        sendNotification("Eye break", "Look away for 20 seconds 👀🌱");
        lastBreakTime = now;
        return;
    }
}

function sendNotification(title, message) {
    chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon128.png",
        title,
        message
    });
}
