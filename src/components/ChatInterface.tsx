import { useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { Emotion } from '../App';
import './ChatInterface.css';

interface ChatInterfaceProps {
  onEmotionChange: (emotion: Emotion) => void;
  currentEmotion: Emotion;
}

interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  emotion?: Emotion;
  timestamp: Date;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  onEmotionChange, 
  currentEmotion 
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Generate response using OpenAI API via Tauri backend
  const generateResponse = async (userMessage: string): Promise<{ text: string; emotion: Emotion }> => {
    try {
      const response = await invoke<{ text: string; emotion: string }>('generate_response', {
        userMessage: userMessage
      });
      
      return {
        text: response.text,
        emotion: response.emotion as Emotion
      };
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      throw new Error(`Failed to generate response: ${error}`);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isProcessing) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: inputText,
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsProcessing(true);

    try {
      const response = await generateResponse(inputText);
      
      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: response.text,
        isUser: false,
        emotion: response.emotion,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);
      
      // Change the robot's emotion based on the response
      onEmotionChange(response.emotion);
      
    } catch (error) {
      console.error('Error generating response:', error);
      
      // Add error message to chat
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: `Sorry, I encountered an error: ${error}`,
        isUser: false,
        emotion: 'neutral',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <h3>Chat with Robot</h3>
        <div className="current-emotion-display">
          Current: <strong>{currentEmotion}</strong>
        </div>
      </div>
      
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="empty-state">
            <p>Start a conversation with your AI robot! 🤖</p>
            <p>Powered by OpenAI GPT-4o Mini</p>
            <p>Try saying things like:</p>
            <ul>
              <li>"Tell me a joke"</li>
              <li>"How are you feeling today?"</li>
              <li>"What's the weather like?"</li>
              <li>"Help me with a problem"</li>
            </ul>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`message ${message.isUser ? 'user' : 'bot'}`}
            >
              <div className="message-content">
                <p>{message.text}</p>
                {!message.isUser && message.emotion && (
                  <span className="emotion-indicator">
                    Emotion: {message.emotion}
                  </span>
                )}
              </div>
              <div className="message-time">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
        {isProcessing && (
          <div className="message bot">
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="chat-input">
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message here... (Press Enter to send)"
          disabled={isProcessing}
          rows={2}
        />
        <button
          onClick={handleSendMessage}
          disabled={!inputText.trim() || isProcessing}
          className="send-button"
        >
          {isProcessing ? '⏳' : '📤'}
        </button>
      </div>
    </div>
  );
};

export default ChatInterface;
