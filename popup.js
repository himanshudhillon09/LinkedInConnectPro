document.addEventListener('DOMContentLoaded', () => {
  const maxInvitesInput = document.getElementById('maxInvites');
  const sentTodayEl = document.getElementById('sentToday');
  const limitDisplayEl = document.getElementById('limitDisplay');
  const statusBadge = document.getElementById('statusBadge');
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const saveBtn = document.getElementById('saveBtn');
  const resetBtn = document.getElementById('resetBtn');
  const message = document.getElementById('message');

  // Helper function to get week key (YYYY-WW format)
  function getWeekKey(date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7); // Get Thursday of the week
    const week1 = new Date(d.getFullYear(), 0, 4); // January 4th is always in week 1
    const weekNum = Math.ceil((((d - week1) / 86400000) + week1.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
  }

  const defaults = {
    maxInvites: 10,
    countThisWeek: 0,
    weekKey: getWeekKey()
  };

  function showMessage(text, type = 'success') {
    message.textContent = text;
    message.className = `message show ${type}`;
    setTimeout(() => {
      message.classList.remove('show');
    }, 3000);
  }

  function updateStatus(count, max) {
    if (count >= max) {
      statusBadge.textContent = 'Limit Reached';
      statusBadge.className = 'status-badge limit-reached';
    } else {
      statusBadge.textContent = 'Active';
      statusBadge.className = 'status-badge';
    }
  }

  // Check if automation is running
  async function checkAutomationStatus() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url && tab.url.includes('linkedin.com')) {
        chrome.tabs.sendMessage(tab.id, { action: 'getStatus' }, (response) => {
          if (!chrome.runtime.lastError && response && response.isRunning) {
            startBtn.style.display = 'none';
            stopBtn.style.display = 'block';
          } else {
            startBtn.style.display = 'block';
            stopBtn.style.display = 'none';
          }
        });
      } else {
        // Not on LinkedIn, show start button
        startBtn.style.display = 'block';
        stopBtn.style.display = 'none';
      }
    } catch (e) {
      // Ignore errors, default to showing start button
      startBtn.style.display = 'block';
      stopBtn.style.display = 'none';
    }
  }

  // Check automation status periodically
  setInterval(checkAutomationStatus, 1000); // Check every second

  // Load Settings
  chrome.storage.local.get(Object.keys(defaults), (result) => {
    const data = { ...defaults, ...result };
    const currentWeek = getWeekKey();

    // Check week reset
    if (data.weekKey !== currentWeek) {
      data.countThisWeek = 0;
      data.weekKey = currentWeek;
      chrome.storage.local.set({ countThisWeek: 0, weekKey: currentWeek });
    }

    // Populate UI
    maxInvitesInput.value = data.maxInvites;
    sentTodayEl.textContent = data.countThisWeek;
    limitDisplayEl.textContent = data.maxInvites;
    updateStatus(data.countThisWeek, data.maxInvites);
    
    // Check automation status
    checkAutomationStatus();
  });

  // Listen for storage changes (real-time updates)
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.countThisWeek) {
      const newCount = changes.countThisWeek.newValue;
      console.log('Popup: Storage updated, new count:', newCount);
      sentTodayEl.textContent = newCount;
      const max = parseInt(limitDisplayEl.textContent, 10);
      updateStatus(newCount, max);
    }
  });

  // Also refresh count when popup is opened (in case listener missed updates)
  function refreshCount() {
    chrome.storage.local.get(['countThisWeek', 'maxInvites'], (result) => {
      if (result.countThisWeek !== undefined) {
        sentTodayEl.textContent = result.countThisWeek;
        if (result.maxInvites !== undefined) {
          limitDisplayEl.textContent = result.maxInvites;
        }
        const max = parseInt(limitDisplayEl.textContent, 10);
        updateStatus(result.countThisWeek, max);
      }
    });
  }

  // Refresh count periodically while popup is open
  setInterval(refreshCount, 2000); // Check every 2 seconds
  
  // Refresh when popup gains focus (user switches back to it)
  window.addEventListener('focus', refreshCount);
  
  // Initial refresh after a short delay to catch any missed updates
  setTimeout(refreshCount, 500);

  // Save Settings
  saveBtn.addEventListener('click', () => {
    const maxInvites = parseInt(maxInvitesInput.value, 10) || 10;
    if (maxInvites < 1) {
      showMessage('Please enter a valid limit (minimum 1)', 'error');
      return;
    }
    chrome.storage.local.set({ maxInvites }, () => {
      limitDisplayEl.textContent = maxInvites;
      const currentCount = parseInt(sentTodayEl.textContent, 10);
      updateStatus(currentCount, maxInvites);
      showMessage('Settings saved successfully!');
      saveBtn.textContent = '✓ Saved!';
      setTimeout(() => {
        saveBtn.textContent = '💾 Save Settings';
      }, 2000);
    });
  });

  // Start Automation
  startBtn.addEventListener('click', async () => {
    const currentCount = parseInt(sentTodayEl.textContent, 10);
    const max = parseInt(limitDisplayEl.textContent, 10);
    
    if (currentCount >= max) {
      showMessage('Weekly limit reached! Reset or increase limit.', 'error');
      return;
    }

    startBtn.disabled = true;
    startBtn.textContent = '⏳ Starting...';
    
    try {
      // Get current active tab
      let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Set auto-start flag
      chrome.storage.local.set({ autoStart: true });
      
      // Check if on LinkedIn
      if (!tab.url || !tab.url.includes('linkedin.com')) {
        showMessage('Opening LinkedIn Grow page...', 'success');
        tab = await chrome.tabs.create({ url: 'https://www.linkedin.com/mynetwork/grow/' });
        await waitForPageLoad(tab.id);
      } else if (!tab.url.includes('/mynetwork/grow/') && !tab.url.includes('/feed/')) {
        // Not on grow page, navigate to it
        showMessage('Navigating to Grow page...', 'success');
        await chrome.tabs.update(tab.id, { url: 'https://www.linkedin.com/mynetwork/grow/' });
        await waitForPageLoad(tab.id);
        [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      }
      
      // Also try direct message as fallback
      setTimeout(() => {
        chrome.tabs.sendMessage(tab.id, { action: 'startAutomation' }, () => {
          // Ignore errors here, auto-start will handle it
        });
      }, 1000);

      // Wait for content script to be ready and check for cohort cards
      showMessage('Waiting for page to load...', 'success');
      await delay(2000);
      
      // Check if cohort cards are present, if not wait more
      let cardsFound = false;
      for (let i = 0; i < 5; i++) {
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              return document.querySelector('[data-view-name="cohort-card"]') !== null;
            }
          });
          
          if (results && results[0] && results[0].result) {
            cardsFound = true;
            break;
          }
        } catch (e) {
          console.log('Error checking for cards:', e);
        }
        await delay(1000);
      }

      // Send message to content script with retry
      let retries = 0;
      const maxRetries = 10;
      
      function tryStartAutomation() {
        chrome.tabs.sendMessage(tab.id, { action: 'startAutomation' }, (response) => {
          if (chrome.runtime.lastError) {
            retries++;
            if (retries < maxRetries) {
              console.log(`Retry ${retries}/${maxRetries}...`);
              setTimeout(tryStartAutomation, 1500);
            } else {
              showMessage('Error: Content script not ready. Please refresh the page.', 'error');
              startBtn.disabled = false;
              startBtn.textContent = '🚀 Start Automation';
              stopBtn.style.display = 'none';
            }
          } else {
            showMessage('Automation started!', 'success');
            startBtn.style.display = 'none';
            stopBtn.style.display = 'block';
            startBtn.disabled = false;
            // Force immediate UI update
            checkAutomationStatus();
          }
        });
      }
      
      tryStartAutomation();
    } catch (error) {
      showMessage('Error starting automation: ' + error.message, 'error');
      startBtn.disabled = false;
      startBtn.textContent = '🚀 Start Automation';
      stopBtn.style.display = 'none';
    }
  });

  // Stop Automation
  stopBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab && tab.url && tab.url.includes('linkedin.com')) {
        chrome.tabs.sendMessage(tab.id, { action: 'stopAutomation' }, (response) => {
          if (chrome.runtime.lastError) {
            showMessage('Error: ' + chrome.runtime.lastError.message, 'error');
          } else {
            showMessage('Automation stopped!', 'success');
            startBtn.style.display = 'block';
            stopBtn.style.display = 'none';
            startBtn.disabled = false;
            startBtn.textContent = '🚀 Start Automation';
          }
        });
      }
    } catch (error) {
      showMessage('Error stopping automation: ' + error.message, 'error');
    }
  });

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function waitForPageLoad(tabId) {
    return new Promise((resolve) => {
      let resolved = false;
      
      const checkComplete = (updatedTabId, changeInfo) => {
        if (resolved) return;
        
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(checkComplete);
          resolved = true;
          // Wait for dynamic content to load
          setTimeout(async () => {
            // Check if cohort cards are loaded by executing script
            try {
              const results = await chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: () => {
                  return document.querySelector('[data-view-name="cohort-card"]') !== null;
                }
              });
              
              if (results && results[0] && results[0].result) {
                resolve();
              } else {
                // Wait a bit more and resolve anyway
                setTimeout(resolve, 2000);
              }
            } catch (e) {
              // If scripting API fails, just wait and resolve
              setTimeout(resolve, 2000);
            }
          }, 2000);
        }
      };
      
      chrome.tabs.onUpdated.addListener(checkComplete);
      
      // Also check if already loaded
      chrome.tabs.get(tabId, (tab) => {
        if (tab.status === 'complete' && !resolved) {
          chrome.tabs.onUpdated.removeListener(checkComplete);
          resolved = true;
          setTimeout(async () => {
            try {
              const results = await chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: () => {
                  return document.querySelector('[data-view-name="cohort-card"]') !== null;
                }
              });
              
              if (results && results[0] && results[0].result) {
                resolve();
              } else {
                setTimeout(resolve, 2000);
              }
            } catch (e) {
              setTimeout(resolve, 2000);
            }
          }, 2000);
        }
      });
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          chrome.tabs.onUpdated.removeListener(checkComplete);
          resolve();
        }
      }, 10000);
    });
  }

  // Reset This Week's Count
  resetBtn.addEventListener('click', () => {
    if (confirm('Reset this week\'s connection count to 0?')) {
      chrome.storage.local.set({ countThisWeek: 0 }, () => {
        sentTodayEl.textContent = '0';
        const max = parseInt(limitDisplayEl.textContent, 10);
        updateStatus(0, max);
        showMessage('Count reset successfully!');
        resetBtn.textContent = '✓ Reset!';
        setTimeout(() => {
          resetBtn.textContent = '🔄 Reset Week';
        }, 2000);
      });
    }
  });
});
