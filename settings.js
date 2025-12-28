// DOM Elements
const eyeBreakSlider = document.getElementById('eyeBreak');
const eyeBreakValue = document.getElementById('eyeBreakValue');
const stretchBreakSlider = document.getElementById('stretchBreak');
const stretchBreakValue = document.getElementById('stretchBreakValue');
const longBreakSlider = document.getElementById('longBreak');
const longBreakValue = document.getElementById('longBreakValue');
const soundEnabled = document.getElementById('soundEnabled');
const achievementsEnabled = document.getElementById('achievementsEnabled');
const focusMode = document.getElementById('focusMode');
const blockedSites = document.getElementById('blockedSites');
const exportBtn = document.getElementById('exportBtn');
const resetBtn = document.getElementById('resetBtn');
const saveBtn = document.getElementById('saveBtn');
const cancelBtn = document.getElementById('cancelBtn');
const statusMessage = document.getElementById('statusMessage');

// Load saved settings
document.addEventListener('DOMContentLoaded', loadSettings);

function loadSettings() {
    chrome.storage.local.get('settings', (data) => {
        const settings = data.settings || {};
        
        // Break intervals
        eyeBreakSlider.value = settings.eyeBreak || 20;
        stretchBreakSlider.value = settings.stretchBreak || 45;
        longBreakSlider.value = settings.longBreak || 90;
        
        updateSliderValues();
        
        // Toggles
        soundEnabled.checked = settings.soundEnabled || false;
        achievementsEnabled.checked = settings.achievementsEnabled !== false;
        focusMode.checked = settings.focusMode || false;
        
        // Blocked sites
        if (settings.blockedSites && Array.isArray(settings.blockedSites)) {
            blockedSites.value = settings.blockedSites.join('\n');
        }
    });
}

function updateSliderValues() {
    eyeBreakValue.textContent = `${eyeBreakSlider.value} min`;
    stretchBreakValue.textContent = `${stretchBreakSlider.value} min`;
    longBreakValue.textContent = `${longBreakSlider.value} min`;
}

// Event Listeners
eyeBreakSlider.addEventListener('input', updateSliderValues);
stretchBreakSlider.addEventListener('input', updateSliderValues);
longBreakSlider.addEventListener('input', updateSliderValues);

saveBtn.addEventListener('click', saveSettings);
cancelBtn.addEventListener('click', () => window.close());
exportBtn.addEventListener('click', exportData);
resetBtn.addEventListener('click', resetData);

function saveSettings() {
    const blockedSitesArray = blockedSites.value
        .split('\n')
        .map(site => site.trim())
        .filter(site => site.length > 0 && site !== 'example.com');

    const settings = {
        eyeBreak: parseInt(eyeBreakSlider.value),
        stretchBreak: parseInt(stretchBreakSlider.value),
        longBreak: parseInt(longBreakSlider.value),
        soundEnabled: soundEnabled.checked,
        achievementsEnabled: achievementsEnabled.checked,
        focusMode: focusMode.checked,
        blockedSites: blockedSitesArray
    };

    chrome.storage.local.set({ settings }, () => {
        showStatus('Settings saved successfully!', 'success');
        
        // Notify background script about settings change
        chrome.runtime.sendMessage({ action: 'settingsUpdated', settings });
    });
}

function exportData() {
    chrome.storage.local.get(null, (data) => {
        // Remove sensitive or unnecessary data
        delete data.eyeBreakLast;
        delete data.stretchBreakLast;
        delete data.longBreakLast;
        delete data.lastSwitchTime;
        delete data.currentDomain;
        
        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const url = URL.createObjectURL(dataBlob);
        const date = new Date().toISOString().split('T')[0];
        
        chrome.downloads.download({
            url: url,
            filename: `touch-the-grass-data-${date}.json`,
            saveAs: true
        });
        
        showStatus('Data exported successfully!', 'success');
    });
}

function resetData() {
    if (confirm('Are you sure you want to reset all data? This cannot be undone.')) {
        chrome.storage.local.clear(() => {
            // Re-initialize with defaults
            chrome.runtime.sendMessage({ action: 'reinitialize' });
            loadSettings();
            showStatus('All data has been reset', 'success');
        });
    }
}

function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = 'status-message show';
    
    if (type === 'success') {
        statusMessage.style.background = '#8ae68a';
        statusMessage.style.color = '#0c1a12';
    } else if (type === 'error') {
        statusMessage.style.background = '#ff6b6b';
        statusMessage.style.color = '#fff';
    }
    
    setTimeout(() => {
        statusMessage.className = 'status-message';
    }, 3000);
}