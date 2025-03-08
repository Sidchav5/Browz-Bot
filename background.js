chrome.runtime.onInstalled.addListener(() => {
    console.log("Browz Bot installed and ready!");
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "open_tab") {
        chrome.tabs.create({ url: request.url });
    } else if (request.action === "close_all_tabs") {
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => chrome.tabs.remove(tab.id));
        });
    } else if (request.action === "close_this_tab") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0) {
                chrome.tabs.remove(tabs[0].id);
            }
        });
    } else if (request.action === "screenshot") {
        chrome.tabs.captureVisibleTab(null, { format: "png" }, function (dataUrl) {
            chrome.downloads.download({ url: dataUrl, filename: "screenshot.png" });
        });
    }
});
