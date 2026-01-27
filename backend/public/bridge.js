// Enhanced Bridge script with INPUT emotion detection
(function() {
  console.log('Enhanced Realtime Bridge script with INPUT emotion detection loaded');
  
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
  
  // Emotion detection from USER input text
  function detectEmotionFromUserInput(text) {
    if (!text) return null;
    
    const lowerText = text.toLowerCase();
    
    // Happy indicators in user input
    if (lowerText.includes('happy') || lowerText.includes('great') || 
        lowerText.includes('wonderful') || lowerText.includes('excellent') ||
        lowerText.includes('amazing') || lowerText.includes('fantastic') ||
        lowerText.includes('love') || lowerText.includes('excited') ||
        lowerText.includes('awesome') || lowerText.includes('incredible') ||
        lowerText.includes('!') || lowerText.includes('😊') || lowerText.includes('😄') ||
        lowerText.includes('yes') || lowerText.includes('perfect') ||
        lowerText.includes('thank you') || lowerText.includes('thanks')) {
      return 'happy';
    }
    
    // Sad indicators in user input
    if (lowerText.includes('sad') || lowerText.includes('sorry') || 
        lowerText.includes('unfortunately') || lowerText.includes('disappointed') ||
        lowerText.includes('trouble') || lowerText.includes('problem') ||
        lowerText.includes('help') || lowerText.includes('struggling') ||
        lowerText.includes('difficult') || lowerText.includes('hard') ||
        lowerText.includes('😢') || lowerText.includes('😔') ||
        lowerText.includes('worried') || lowerText.includes('concerned')) {
      return 'sad';
    }
    
    // Excited indicators in user input
    if (lowerText.includes('excited') || lowerText.includes('thrilled') || 
        lowerText.includes('awesome') || lowerText.includes('incredible') ||
        lowerText.includes('wow') || lowerText.includes('amazing') ||
        lowerText.includes('🚀') || lowerText.includes('⚡') ||
        lowerText.includes('can\'t wait') || lowerText.includes('so excited') ||
        lowerText.includes('this is great') || lowerText.includes('brilliant')) {
      return 'excited';
    }
    
    // Thinking indicators in user input
    if (lowerText.includes('let me think') || lowerText.includes('hmm') || 
        lowerText.includes('considering') || lowerText.includes('analyzing') ||
        lowerText.includes('processing') || lowerText.includes('🤔') ||
        lowerText.includes('💭') || lowerText.includes('i think') ||
        lowerText.includes('maybe') || lowerText.includes('perhaps') ||
        lowerText.includes('not sure') || lowerText.includes('wondering')) {
      return 'thinking';
    }
    
    // Confused indicators in user input
    if (lowerText.includes('confused') || lowerText.includes('unclear') || 
        lowerText.includes('not sure') || lowerText.includes('uncertain') ||
        lowerText.includes('🤷') || lowerText.includes('❓') ||
        lowerText.includes('what') || lowerText.includes('how') ||
        lowerText.includes('why') || lowerText.includes('explain') ||
        lowerText.includes('don\'t understand') || lowerText.includes('lost')) {
      return 'confused';
    }
    
    // Surprised indicators in user input
    if (lowerText.includes('surprised') || lowerText.includes('wow') || 
        lowerText.includes('unexpected') || lowerText.includes('really') ||
        lowerText.includes('😮') || lowerText.includes('😲') ||
        lowerText.includes('no way') || lowerText.includes('seriously') ||
        lowerText.includes('that\'s crazy') || lowerText.includes('unbelievable')) {
      return 'surprised';
    }
    
    return null; // Default to neutral
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
    console.log('Initializing bridge with INPUT emotion detection...');
    
    // Send ready signal
    sendToParent('bridge_ready');
    
    // Monitor for various UI elements and events
    monitorUIEvents();
    monitorAudioEvents();
    monitorConnectionStatus();
    monitorUserInput();
    
    // Listen for messages from parent
    window.addEventListener('message', (event) => {
      if (event.data.type === 'bridge_ready') {
        console.log('Bridge communication established with Tauri app');
        sendToParent('session_status', { connected: true });
      }
    });
  }
  
  function monitorUIEvents() {
    // Monitor for button clicks and form interactions
    document.addEventListener('click', (event) => {
      const target = event.target;
      if (target && target.textContent) {
        const text = target.textContent.toLowerCase();
        console.log('Button clicked:', text);
        
        if (text.includes('start') || text.includes('record') || text.includes('connect')) {
          sendToParent('speech_started');
        } else if (text.includes('stop') || text.includes('end') || text.includes('disconnect')) {
          sendToParent('speech_stopped');
        }
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
  
  function monitorUserInput() {
    // Monitor for user input text changes
    const inputObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
          // Look for user input text
          const target = mutation.target;
          if (target.nodeType === 1 || target.nodeType === 3) {
            const textContent = target.textContent || target.innerText;
            if (textContent && textContent.length > 5) {
              // Check if this looks like USER input
              const isUserInput = textContent.includes('User:') || 
                                 textContent.includes('You:') ||
                                 textContent.includes('Me:') ||
                                 (textContent.length > 10 && !textContent.includes('Assistant:') && !textContent.includes('AI:'));
              
              if (isUserInput) {
                console.log('Detected potential user input:', textContent.substring(0, 100) + '...');
                const emotion = detectEmotionFromUserInput(textContent);
                if (emotion) {
                  console.log('Detected emotion from user input:', emotion);
                  sendToParent('emotion_suggestion', { emotion: emotion, source: 'user_input' });
                }
              }
            }
          }
        }
      });
    });
    
    // Monitor the entire document for text changes
    inputObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
    
    // Also monitor for specific user input containers
    const userInputSelectors = [
      '[class*="user"]',
      '[class*="input"]',
      '[class*="transcript"]',
      '[class*="message"]',
      'input[type="text"]',
      'textarea'
    ];
    
    userInputSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        const textContent = element.textContent || element.value;
        if (textContent && textContent.length > 5) {
          const emotion = detectEmotionFromUserInput(textContent);
          if (emotion) {
            console.log('Detected emotion in user input', selector, ':', emotion);
            sendToParent('emotion_suggestion', { emotion: emotion, source: 'user_input' });
          }
        }
      });
    });
    
    // Monitor input fields directly
    document.addEventListener('input', (event) => {
      if (event.target.type === 'text' || event.target.tagName === 'TEXTAREA') {
        const text = event.target.value;
        if (text && text.length > 5) {
          const emotion = detectEmotionFromUserInput(text);
          if (emotion) {
            console.log('Detected emotion from input field:', emotion);
            sendToParent('emotion_suggestion', { emotion: emotion, source: 'input_field' });
          }
        }
      }
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
