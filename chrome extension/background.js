// Context menu for quick capture
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "quickCapture",
    title: "Quick Capture to Norter",
    contexts: ["selection", "page", "image"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "quickCapture") {
    let content = "";
    let type = "text";
    
    if (info.selectionText) {
      content = info.selectionText;
      type = "selection";
    } else if (info.srcUrl) {
      content = info.srcUrl;
      type = "image";
    } else {
      content = tab.url;
      type = "page";
    }
    
    chrome.storage.local.get(['notes'], (result) => {
      const notes = result.notes || [];
      const note = {
        id: Date.now().toString(),
        title: type === "selection" ? "Quick Capture" : "Page Capture",
        text: content,
        tags: ["quick-capture"],
        folder: "uncategorized",
        linkedNotes: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        versions: [{ content, timestamp: Date.now() }],
        pinned: false
      };
      notes.unshift(note);
      chrome.storage.local.set({ notes });
      
      chrome.notifications.create({
        type: "basic",
        title: "Norter",
        message: "Content captured successfully!"
      });
    });
  }
});

// Check for reminders
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith("task-reminder-")) {
    const taskId = alarm.name.replace("task-reminder-", "");
    chrome.storage.local.get(['tasks'], (result) => {
      const tasks = result.tasks || [];
      const task = tasks.find(t => t.id === taskId);
      if (task && !task.completed) {
        chrome.notifications.create({
          type: "basic",
          title: "Task Reminder",
          message: task.text
        });
      }
    });
  }
});

// Listen for keyboard shortcut
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'open-citation-picker') {
    chrome.tabs.sendMessage(tab.id, { action: 'openCitationPicker' });
  }
});

// Also handle from context menu or other triggers
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'citationInserted') {
    console.log('Citation inserted:', request.paper);
  }
});