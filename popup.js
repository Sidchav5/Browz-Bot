let lastCommand = ''; // Track the last command used
let recognition; // Store reference to the speech recognition instance

const googleApiKey = ""; // Google Cloud API Key

document.addEventListener("DOMContentLoaded", () => {
    const startButton = document.getElementById("startListening");
    const statusText = document.getElementById("status");

    startButton.addEventListener("click", () => {
        statusText.innerText = "Listening...";
        startVoiceRecognition();
    });
});

// Function to handle speech synthesis
const speak = (message, callback) => {
    const utterance = new SpeechSynthesisUtterance(message);
    const voices = speechSynthesis.getVoices();
    utterance.voice = voices.length > 0 ? voices[0] : null;
    utterance.rate = 1;
    utterance.pitch = 1;

    if ("speechSynthesis" in window) {
        utterance.onend = callback;
        window.speechSynthesis.speak(utterance);
    } else {
        console.error("Speech synthesis is not supported in this browser.");
    }
};

// Function to start voice recognition
const startVoiceRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("Speech Recognition is not supported in this browser.");
        return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
        const command = event.results[0][0].transcript.toLowerCase().trim();
        console.log(`Command received: ${command}`);
        processCommand(command);
    };

    recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
    };

    recognition.onend = () => {
        document.getElementById("status").innerText = "Click to start voice commands";
    };

    recognition.start();
};

// Function to process voice commands
const processCommand = (command) => {
  const words = command.split(" ");

  if (command === "stop") {
      stopAnswering();
  } else if (command.startsWith("open") && words.length > 1) {
      handleOpenCommand(command);
  } else if (command==="bookmarks") {
    speak("Opening bookmarks.", () => {
        setTimeout(() => {
            const bookmarksUrl = "chrome://bookmarks/";
            chrome.tabs.create({ url: bookmarksUrl });
        }, 500);
    });
} else if (command==="downloads") {
    speak("Opening downloads.", () => {
        setTimeout(() => {
            const downloadsUrl = "chrome://downloads/";
            chrome.tabs.create({ url: downloadsUrl });
        }, 500);
    });
} else if (command==="settings") {
    speak("Opening settings.", () => {
        setTimeout(() => {
            const settingsUrl = "chrome://settings/";
            chrome.tabs.create({ url: settingsUrl });
        }, 500);
    });
}
  else if (command.includes("read summary")) {
      handleSummaryCommand();
  } else if (command.includes("read text")) {
      handleReadTextCommand();
  } else if (command.startsWith("search ") && words.length > 1) {
      handleSearchCommand(command);
  } else if (command.includes("scroll down")) {
      handleScrollDownCommand();
  } else if (command.includes("scroll up")) {
      handleScrollUpCommand();
  } 
  else if (command==="play music") {
    const musicUrl = "https://open.spotify.com/track/5FuEhQ674excghjJ6WNkFj?si=a18008f53fad46e5";  
    speak("Playing music on Spotify.", () => {
        setTimeout(() => {
            chrome.tabs.create({ url: musicUrl });
        }, 500);
    });
} else if (command.includes("close this tab")) {
      speak("Closing this tab.", () => {
          setTimeout(() => {
              chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                  chrome.tabs.remove(tabs[0].id);
              });
          }, 500);
      });
  }else if (command.includes("screenshot")) {
      handleScreenshotCommand();
  } else if (command === "incognito") {
      speak("Opening a new incognito window.", () => {
          setTimeout(() => {
              chrome.windows.create({ incognito: true });
          }, 500);
      });
  } else if (command === "close all tabs") {
      closeAllTabs();
  } else if (command.trim().length > 0) {
      handleAIQueryCommand(command);
  } 
  
};


// Function to stop speech synthesis and stop answering
const stopAnswering = () => {
    if ("speechSynthesis" in window) {
        speechSynthesis.cancel(); // Stop speech synthesis
    }
    recognition.stop(); // Stop voice recognition
    speak("Stopping all actions and answers.");
};

// Function to open a website
const openWebsite = (site) => {
    if (!site.match(/\.[a-z]{2,}$/)) {
        site += ".com";
    }
    const url = `https://${site}`;
    speak(`Opening ${site}`, () => {
        chrome.runtime.sendMessage({ action: "open_tab", url });
    });
};

const handleOpenCommand = (command) => {
    let site = command.slice(5).trim();
    openWebsite(site);
};

// Function to extract and summarize webpage text using Google Cloud NLP
const handleSummaryCommand = () => {
    speak("Fetching the summary of the current page.", readWebpageSummary);
};

// Function to extract text from webpage and send to Google Cloud NLP API
const readWebpageSummary = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) {
            speak("No active tab found.");
            return;
        }

        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: extractPageText
        }, (results) => {
            if (results && results[0] && results[0].result) {
                fetchGoogleCloudSummary(results[0].result);
            } else {
                speak("No relevant content found on this page.");
            }
        });
    });
};

// Function to fetch summary from Google Cloud NLP API
const fetchGoogleCloudSummary = (pageText) => {
    const url = `https://language.googleapis.com/v1beta2/documents:analyzeEntities?key=${googleApiKey}`;
    
    const body = {
        document: {
            type: "PLAIN_TEXT",
            content: pageText,
        },
        encodingType: "UTF8",
    };

    fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    })
    .then(response => response.json())
    .then(data => {
        if (data.entities) {
            const summary = generateMeaningfulSummary(data.entities);
            speak(summary);
        } else {
            speak("Sorry, no summary available.");
        }
    })
    .catch(error => {
        console.error("Error fetching summary:", error);
        speak("Error fetching summary.");
    });
};

// Function to generate meaningful summary from entities
const generateMeaningfulSummary = (entities) => {
    const entityGroups = {
        PERSON: [],
        ORGANIZATION: [],
        LOCATION: [],
        EVENT: [],
        WORK_OF_ART: [],
        CONSUMER_GOOD: [],
        OTHER: []
    };

    entities.forEach(entity => {
        if (entityGroups[entity.type]) {
            entityGroups[entity.type].push(entity.name);
        } else {
            entityGroups.OTHER.push(entity.name);
        }
    });

    let summary = "Here's a summary of the page: ";

    if (entityGroups.PERSON.length > 0) {
        summary += `This page mentions people like ${entityGroups.PERSON.join(", ")}. `;
    }
    if (entityGroups.ORGANIZATION.length > 0) {
        summary += `It talks about organizations such as ${entityGroups.ORGANIZATION.join(", ")}. `;
    }
    if (entityGroups.LOCATION.length > 0) {
        summary += `Important locations include ${entityGroups.LOCATION.join(", ")}. `;
    }
    if (entityGroups.EVENT.length > 0) {
        summary += `It references events like ${entityGroups.EVENT.join(", ")}. `;
    }
    if (entityGroups.WORK_OF_ART.length > 0) {
        summary += `Works of art mentioned include ${entityGroups.WORK_OF_ART.join(", ")}. `;
    }
    if (entityGroups.CONSUMER_GOOD.length > 0) {
        summary += `Products or consumer goods mentioned include ${entityGroups.CONSUMER_GOOD.join(", ")}. `;
    }
    if (entityGroups.OTHER.length > 0) {
        summary += `Other relevant terms include ${entityGroups.OTHER.join(", ")}. `;
    }

    return summary.trim();
};

const handleReadTextCommand = () => {
  speak("Reading the content of the page.");
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) {
          speak("No active tab found.");
          return;
      }
      chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          function: extractPageText
      }, (results) => {
          if (results && results[0] && results[0].result) {
              speak(results[0].result);
          } else {
              speak("No relevant content found on this page.");
          }
      });
  });
};

// Function to extract text content from paragraphs and headings
const extractPageText = () => {
  const elements = document.querySelectorAll("p, h1, h2, h3, h4, h5, h6");
  return Array.from(elements).map(el => el.innerText).join(" ");
};

// Function to search Google
const handleSearchCommand = (command) => {
    const searchQuery = command.slice(7).trim();
    searchInGoogle(searchQuery);
};

const searchInGoogle = (query) => {
    const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    speak(`Searching Google for: ${query}`, () => {
        chrome.runtime.sendMessage({ action: "open_tab", url: googleSearchUrl });
    });
};

// Scroll commands
const handleScrollDownCommand = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) return;
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: () => window.scrollBy({ top: window.innerHeight, left: 0, behavior: 'smooth' })
        });
    });
    speak("Scrolling down.");
};

const handleScrollUpCommand = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) return;
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: () => window.scrollBy({ top: -window.innerHeight, left: 0, behavior: 'smooth' })
        });
    });
    speak("Scrolling up.");
};

// Function to fetch info from DuckDuckGo
const fetchDuckDuckGoInfo = (query) => {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.AbstractText) {
                speak(data.AbstractText);
            } else {
                speak("Sorry, I couldn't find an answer.");
            }
        })
        .catch(error => {
            console.error("DuckDuckGo API error:", error);
            speak("Error retrieving information.");
        });
};

const handleAIQueryCommand = (command) => {
    speak("Searching for an answer.", () => fetchDuckDuckGoInfo(command));
};

// Function to open incognito tab
const openIncognitoTab = () => {
    chrome.runtime.sendMessage({ action: "open_incognito" });
};

// Function to close all tabs
const closeAllTabs = () => {
    chrome.runtime.sendMessage({ action: "close_all_tabs" });
};

const handleScreenshotCommand=()=>{
  speak("Taking a screenshot.", () => {
    setTimeout(() => {
      chrome.tabs.captureVisibleTab(null, { format: "png" }, function(dataUrl) {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = 'screenshot.png';
        link.click();
      });
    }, 500);
      })};
