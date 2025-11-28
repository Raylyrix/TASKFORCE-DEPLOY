// This script runs in the auth callback page
// It extracts the OAuth code and state from URL and sends them to the background script

const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get("code");
const state = urlParams.get("state");
const error = urlParams.get("error");

const loadingEl = document.getElementById("loading");
const errorEl = document.getElementById("error");
const successEl = document.getElementById("success");
const errorMessageEl = document.getElementById("error-message");

if (error) {
  // Show error
  if (loadingEl) loadingEl.style.display = "none";
  if (errorEl) errorEl.style.display = "block";
  if (errorMessageEl) {
    errorMessageEl.textContent = `Authentication failed: ${decodeURIComponent(error)}`;
  }
  
  // Try to send error to extension
  try {
    chrome.runtime.sendMessage(
      chrome.runtime.id,
      {
        type: "AUTH_CALLBACK_ERROR",
        error: decodeURIComponent(error),
      },
      () => {
        // Close window after a delay
        setTimeout(() => {
          window.close();
        }, 3000);
      }
    );
  } catch (e) {
    console.error("Failed to send error to extension:", e);
  }
} else if (code && state) {
  // Send code and state to background script
  try {
    chrome.runtime.sendMessage(
      chrome.runtime.id,
      {
        type: "AUTH_CALLBACK",
        code,
        state,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("Error sending message:", chrome.runtime.lastError);
          if (loadingEl) loadingEl.style.display = "none";
          if (errorEl) errorEl.style.display = "block";
          if (errorMessageEl) {
            errorMessageEl.textContent = "Failed to communicate with extension. Please try again.";
          }
          return;
        }
        
        if (response?.error) {
          // Show error from background
          if (loadingEl) loadingEl.style.display = "none";
          if (errorEl) errorEl.style.display = "block";
          if (errorMessageEl) {
            errorMessageEl.textContent = response.error;
          }
        } else {
          // Show success
          if (loadingEl) loadingEl.style.display = "none";
          if (successEl) successEl.style.display = "block";
          
          // Close window after a short delay
          setTimeout(() => {
            window.close();
          }, 2000);
        }
      }
    );
  } catch (e) {
    console.error("Failed to send message to extension:", e);
    if (loadingEl) loadingEl.style.display = "none";
    if (errorEl) errorEl.style.display = "block";
    if (errorMessageEl) {
      errorMessageEl.textContent = "Failed to communicate with extension. Please try again.";
    }
  }
} else {
  // Missing parameters
  if (loadingEl) loadingEl.style.display = "none";
  if (errorEl) errorEl.style.display = "block";
  if (errorMessageEl) {
    errorMessageEl.textContent = "Missing authentication parameters. Please try again.";
  }
}


