// State
let settings = {};
let isAutomationRunning = false;
let shouldStopAutomation = false;

// Initialize
(function init() {
    loadSettings().then(() => {
        // Check if we should auto-start
        chrome.storage.local.get(['autoStart'], (result) => {
            if (result.autoStart) {
                const url = window.location.href;
                const isGrow = url.includes('/mynetwork/grow/') || url.includes('/feed/');
                
                if (isGrow) {
                    // Wait for cohort cards to appear
                    let attempts = 0;
                    const maxAttempts = 20;
                    
                    const checkAndStart = () => {
                        const hasCohortCards = document.querySelector('[data-view-name="cohort-card"]');
                        
                        if (hasCohortCards || attempts >= maxAttempts) {
                            console.log('LinkConnect: Auto-starting automation...');
                            shouldStopAutomation = false;
                            isAutomationRunning = true;
                            safeRun(startGrowSequence);
                            chrome.storage.local.set({ autoStart: false });
                        } else {
                            attempts++;
                            setTimeout(checkAndStart, 500);
                        }
                    };
                    
                    setTimeout(checkAndStart, 1000);
                } else {
                    chrome.storage.local.set({ autoStart: false });
                }
            }
        });
    });
})();

// Helper function to get week key (YYYY-WW format)
function getWeekKey(date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7); // Get Thursday of the week
    const week1 = new Date(d.getFullYear(), 0, 4); // January 4th is always in week 1
    const weekNum = Math.ceil((((d - week1) / 86400000) + week1.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
}

// Load settings from storage
async function loadSettings() {
    const defaults = {
        maxInvites: 10,
        countThisWeek: 0,
        weekKey: getWeekKey()
    };

    return new Promise((resolve, reject) => {
        try {
            chrome.storage.local.get(null, (result) => {
                if (chrome.runtime.lastError) {
                    return reject(chrome.runtime.lastError);
                }
                settings = { ...defaults, ...(result || {}) };
                // Check week reset
                const currentWeek = getWeekKey();
                if (settings.weekKey !== currentWeek) {
                    settings.countThisWeek = 0;
                    settings.weekKey = currentWeek;
                    chrome.storage.local.set({ countThisWeek: 0, weekKey: currentWeek });
                }
                resolve();
            });
        } catch (e) {
            reject(e);
        }
    });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startAutomation') {
        shouldStopAutomation = false;
        isAutomationRunning = true;
        safeRun(startGrowSequence);
        sendResponse({ success: true });
    } else if (request.action === 'stopAutomation') {
        shouldStopAutomation = true;
        isAutomationRunning = false;
        sendResponse({ success: true });
    } else if (request.action === 'getStatus') {
        sendResponse({ isRunning: isAutomationRunning });
    }
    return true;
});

async function safeRun(fn) {
    try {
        await fn();
    } catch (e) {
        if (e.message && e.message.includes('Extension context invalidated')) {
            alert('Extension updated. Please REFRESH this page.');
        } else {
            console.error('LinkConnect Error:', e);
        }
    }
}

// Grow Page Automation
async function startGrowSequence() {
    console.log('LinkConnect: Starting automation...');

    await loadSettings();
    if (settings.countThisWeek >= settings.maxInvites) {
        console.log('LinkConnect: Weekly limit reached.');
        return;
    }

    // First, click "Show all" button if it exists
    const showAllButton = document.querySelector('button[data-view-name="cohort-section-see-all"]');
    if (showAllButton) {
        const ariaLabel = showAllButton.getAttribute('aria-label') || '';
        if (ariaLabel.includes('Show all suggestions')) {
            console.log('LinkConnect: Found "Show all" button, clicking it...');
            showAllButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await delay(500);
            
            try {
                showAllButton.click();
                console.log('LinkConnect: Clicked "Show all" button');
                await delay(3000); // Wait for content to expand
            } catch (e) {
                console.error('LinkConnect: Error clicking "Show all" button:', e);
                // Try alternative click method
                showAllButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                await delay(3000);
            }
        }
    }

    const processedButtons = new Set();
    let noNewContentCount = 0;
    const maxNoNewContent = 3; // Stop after 3 consecutive scrolls with no new content

    // Continuous auto-scroll loop
    while (settings.countThisWeek < settings.maxInvites && noNewContentCount < maxNoNewContent && !shouldStopAutomation) {
        // Find all available Connect buttons
        const connectButtons = Array.from(document.querySelectorAll('button[data-view-name="edge-creation-connect-action"]'));
        const allButtons = Array.from(document.querySelectorAll('button'));
        const connectButtonsByAria = allButtons.filter(b => {
            const ariaLabel = (b.getAttribute('aria-label') || '').toLowerCase();
            return ariaLabel.includes('invite') && ariaLabel.includes('to connect');
        });

        const allConnectButtons = [...new Set([...connectButtons, ...connectButtonsByAria])];
        
        // Filter out already processed buttons
        const availableButtons = allConnectButtons.filter(b => 
            b.offsetParent && !b.disabled && !processedButtons.has(b)
        );

        if (availableButtons.length === 0) {
            if (shouldStopAutomation) {
                console.log('LinkConnect: Automation stopped by user.');
            break;
        }

            // No new buttons found, scroll to load more
            console.log('LinkConnect: Scrolling to load more...');
            const scrollHeightBefore = document.body.scrollHeight;
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            await delay(2000);
            
            if (shouldStopAutomation) {
                console.log('LinkConnect: Automation stopped by user.');
                break;
            }
            
            const scrollHeightAfter = document.body.scrollHeight;
            
            // Check if new content loaded
            if (scrollHeightAfter === scrollHeightBefore) {
                noNewContentCount++;
                console.log(`LinkConnect: No new content (${noNewContentCount}/${maxNoNewContent})...`);
                await delay(1000);
            } else {
                noNewContentCount = 0; // Reset counter if new content loaded
            }
            continue;
        }

        // Process available buttons
        for (const connectBtn of availableButtons) {
            if (shouldStopAutomation) {
                console.log('LinkConnect: Automation stopped by user.');
                break;
            }
            
            if (settings.countThisWeek >= settings.maxInvites) {
                console.log('LinkConnect: Weekly limit reached.');
                break;
            }

            let name = 'there';
            const btnLabel = connectBtn.getAttribute('aria-label') || '';
            if (btnLabel.includes('Invite ') && btnLabel.includes(' to connect')) {
                const namePart = btnLabel.substring(7, btnLabel.indexOf(' to connect'));
                if (namePart) name = namePart.split(' ')[0];
            }

            // Find parent card to mark as processed
            const card = connectBtn.closest('[data-view-name="cohort-card"]') || 
                         connectBtn.closest('[role="listitem"]') ||
                         connectBtn.parentElement?.parentElement;

            connectBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await delay(300);

            console.log(`LinkConnect: Connecting to ${name}...`);

            try {
                connectBtn.click();
            } catch (e) {
                connectBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
            }

            await delay(400);
            await handleConnectModal();

            // Mark as processed with green border
            processedButtons.add(connectBtn);
            if (card) {
                card.style.border = '3px solid #057642';
                card.style.borderRadius = '8px';
                card.style.transition = 'border 0.3s ease';
            }
            connectBtn.style.opacity = '0.6';
            connectBtn.disabled = true;

            settings.countThisWeek++;
            await chrome.storage.local.set({ countThisWeek: settings.countThisWeek });

            console.log(`LinkConnect: ✓ Sent to ${name} (${settings.countThisWeek}/${settings.maxInvites})`);
            await delay(500);
        }
    }

    isAutomationRunning = false;
    
    if (shouldStopAutomation) {
        console.log(`LinkConnect: Automation stopped. Processed ${processedButtons.size} connections.`);
    } else if (noNewContentCount >= maxNoNewContent) {
        console.log(`LinkConnect: Finished! No more content to load. Processed ${processedButtons.size} connections.`);
    } else {
        console.log(`LinkConnect: Finished! Processed ${processedButtons.size} connections.`);
    }
}

// Modal Handler
async function handleConnectModal() {
    try {

        // Wait for modal
    let modal = null;
    for (let i = 0; i < 50; i++) {
        modal = document.querySelector('.artdeco-modal');
        if (modal) break;
        await delay(100);
    }

    if (!modal) {
        return;
    }

        await delay(300);

        // Find "Send without a note" button
        let sendBtn = modal.querySelector('button[aria-label="Send without a note"]');
        
        if (!sendBtn) {
            const actionbar = modal.querySelector('.artdeco-modal__actionbar');
            if (actionbar) {
                sendBtn = actionbar.querySelector('.artdeco-button--primary');
            }
        }

        if (sendBtn && !sendBtn.disabled) {
            sendBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await delay(100);
            sendBtn.click();
            await delay(300);
            
            // Wait for modal to close
            for (let i = 0; i < 20; i++) {
                await delay(50);
                if (!document.querySelector('.artdeco-modal')) {
                    break;
                }
            }
        }
    } catch (error) {
        console.error('LinkConnect: Error in handleConnectModal:', error);
    }
}

function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
}
