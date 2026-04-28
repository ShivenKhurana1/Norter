// Content script for page interaction
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getPageContent") {
    const content = {
      title: document.title,
      url: window.location.href,
      text: document.body.innerText.substring(0, 5000)
    };
    sendResponse(content);
  }
});