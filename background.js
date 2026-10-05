// Map to track active timeouts for empty tabs
const pendingTabs = new Map();

// Helper to determine if a tab is empty
function isEmptyTab(tab) {
  const url = tab.url || "";
  const title = tab.title || "";
  
  return (
    url === "chrome://newtab/" || 
    url === "about:blank" || 
    url === "" ||
    title === "New Tab"
  );
}

// Function to handle tracking and conditionally closing an empty tab
function evaluateTab(tabId, tab) {
  if (!tab) return;

  if (isEmptyTab(tab)) {
    // If we are already tracking this tab, don't start a duplicate timer
    if (pendingTabs.has(tabId)) return;

    // Schedule the tab evaluation
    const timeoutId = setTimeout(() => {
      // Query all open tabs to check how many empty tabs exist globally
      chrome.tabs.query({}, (allTabs) => {
        // Filter out tabs that meet the empty criteria
        const emptyTabsCount = allTabs.filter(isEmptyTab).length;

        // Condition: ONLY close this tab if there is MORE THAN ONE empty tab open
        if (emptyTabsCount > 1) {
          chrome.tabs.remove(tabId, () => {
            if (chrome.runtime.lastError) {
              console.log(`Tab ${tabId} already removed or unavailable.`);
            }
          });
        } else {
          console.log(`Keep alive: Tab ${tabId} is the last remaining empty tab.`);
        }
      });
      
      pendingTabs.delete(tabId);
    }, 5000);

    pendingTabs.set(tabId, timeoutId);
  } else {
    // If the tab is no longer empty (user navigated), clear the timer
    clearTabTimer(tabId);
  }
}

function clearTabTimer(tabId) {
  if (pendingTabs.has(tabId)) {
    clearTimeout(pendingTabs.get(tabId));
    pendingTabs.delete(tabId);
  }
}

// Listen for newly created tabs
chrome.tabs.onCreated.addListener((tab) => {
  if (tab.id) {
    evaluateTab(tab.id, tab);
  }
});

// Listen for tab updates (e.g., when the URL loads or changes)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "loading" || changeInfo.url) {
    evaluateTab(tabId, tab);
  }
});

// Clean up references if the user manually closes the tab before the 5s limit
chrome.tabs.onRemoved.addListener((tabId) => {
  clearTabTimer(tabId);
});