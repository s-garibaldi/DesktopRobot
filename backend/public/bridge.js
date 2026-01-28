// Bridge script for embedding the backend UI in the Tauri frontend.
// This file intentionally does NOT do keyword-based "emotion detection".
(function() {
  console.log('Realtime Bridge script loaded');
  
  // Function to send messages to parent window (Tauri app)
  function sendToParent(type, data = {}) {
    if (window.parent && window.parent !== window) {
      console.log('Sending to parent:', type, data);
      window.parent.postMessage({
        type: type,
        ...data
      }, '*');
    }
  }
  
  // Wait for the page to be fully loaded
  function waitForPageLoad() {
    if (document.readyState === 'complete') {
      initializeBridge();
    } else {
      window.addEventListener('load', initializeBridge);
    }
  }
  
  function initializeBridge() {
    console.log('Initializing bridge...');
    
    // Send ready signal
    sendToParent('bridge_ready');
    
    // Monitor for various UI elements and events
    monitorAudioEvents();
    monitorConnectionStatus();
    
    // Listen for messages from parent
    window.addEventListener('message', (event) => {
      if (event.data.type === 'bridge_ready') {
        console.log('Bridge communication established with Tauri app');
        sendToParent('session_status', { connected: true });
      }
    });
  }
  
  function monitorAudioEvents() {
    // Monitor existing audio elements
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => {
      audio.addEventListener('play', () => {
        console.log('Audio started playing');
        sendToParent('ai_speaking_start');
      });
      
      audio.addEventListener('pause', () => {
        console.log('Audio paused');
        sendToParent('ai_speaking_end');
      });
      
      audio.addEventListener('ended', () => {
        console.log('Audio ended');
        sendToParent('ai_speaking_end');
      });
    });
    
    // Monitor for dynamically created audio elements
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1 && node.tagName === 'AUDIO') {
            console.log('New audio element detected');
            node.addEventListener('play', () => sendToParent('ai_speaking_start'));
            node.addEventListener('pause', () => sendToParent('ai_speaking_end'));
            node.addEventListener('ended', () => sendToParent('ai_speaking_end'));
          }
        });
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  function monitorConnectionStatus() {
    let connectionStatus = false;
    
    const checkConnection = () => {
      // Look for various connection indicators
      const connectedElements = document.querySelectorAll(
        '[class*="connected"], [class*="active"], [class*="ready"], [class*="session"]'
      );
      const disconnectedElements = document.querySelectorAll(
        '[class*="disconnected"], [class*="error"], [class*="failed"]'
      );
      
      // Also check for specific text content
      const bodyText = document.body.textContent.toLowerCase();
      const hasConnectedText = bodyText.includes('connected') || bodyText.includes('session started');
      const hasErrorText = bodyText.includes('error') || bodyText.includes('failed') || bodyText.includes('disconnected');
      
      const isConnected = (connectedElements.length > 0 || hasConnectedText) && !hasErrorText;
      
      if (isConnected !== connectionStatus) {
        connectionStatus = isConnected;
        console.log('Connection status changed:', connectionStatus);
        sendToParent('session_status', { connected: connectionStatus });
      }
    };
    
    // Check connection status periodically
    setInterval(checkConnection, 2000);
    
    // Initial check
    setTimeout(checkConnection, 1000);
  }
  
  // Start the bridge
  waitForPageLoad();
  
})();
