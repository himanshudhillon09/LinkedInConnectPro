// Minimal background script
// Reset daily limit if needed when browser starts (redundancy)

chrome.runtime.onInstalled.addListener(() => {
    // Initialize default storage if empty
    chrome.storage.local.get(['maxInvites', 'countToday', 'dateKey'], (result) => {
        const today = new Date().toISOString().split('T')[0];
        if (!result.dateKey || result.dateKey !== today) {
            chrome.storage.local.set({
                countToday: 0,
                dateKey: today,
                maxInvites: result.maxInvites || 10
            });
        }
    });
});
