/**
 * ==========================================================================
 * CHATBOT CLIENT-SIDE CONTROLLER
 * ==========================================================================
 * This file handles user interaction, UI updates, and backend API requests.
 * It also controls the real-time background color changing and preset themes.
 */

// --------------------------------------------------------------------------
// 1. DOM ELEMENT REFERENCES
// --------------------------------------------------------------------------
// We select elements from index.html using their unique ID or class name
const chatBox = document.getElementById("chat-box");
const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const suggestionChips = document.querySelectorAll(".chip");

// Theme customizer elements
const themeButtons = document.querySelectorAll(".theme-btn");
const bgColorPicker = document.getElementById("bg-color-picker");

// --------------------------------------------------------------------------
// 2. CHAT UTILITY FUNCTIONS
// --------------------------------------------------------------------------

/**
 * Appends a message bubble to the chat box
 * @param {string} text - Content of the message
 * @param {string} sender - 'user' or 'bot' (determines styling class)
 */
function addMessage(text, sender) {
  // Create a new div element
  const messageDiv = document.createElement("div");
  // Set classes (e.g. "message user" or "message bot")
  messageDiv.className = `message ${sender}`;
  // Set the text content safely
  messageDiv.textContent = text;
  
  // Append to the chat container
  chatBox.appendChild(messageDiv);
  
  // Auto-scroll the chat box to the bottom to show the latest message
  chatBox.scrollTop = chatBox.scrollHeight;
}

/**
 * Displays a temporary loading/thinking indicator for the bot
 */
function showTypingIndicator() {
  const typingDiv = document.createElement("div");
  typingDiv.className = "message bot typing";
  typingDiv.id = "typing-indicator";
  
  // Add loading text and simple animated dots
  typingDiv.innerHTML = `
    <span>Thinking</span>
    <span class="typing-dot">.</span>
    <span class="typing-dot">.</span>
    <span class="typing-dot">.</span>
  `;
  
  chatBox.appendChild(typingDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
}

/**
 * Removes the loading/thinking indicator once a response is received
 */
function removeTypingIndicator() {
  const typingDiv = document.getElementById("typing-indicator");
  if (typingDiv) {
    typingDiv.remove();
  }
}

// --------------------------------------------------------------------------
// 3. BACKEND API & MOCK SYSTEM
// --------------------------------------------------------------------------

/**
 * Local mock response fallback database.
 * If the python server cannot connect to OpenAI/GPT-4, this local logic 
 * returns helpful static support answers to make sure the app works offline.
 */
function getMockReply(message) {
  const lower = message.toLowerCase();

  if (lower.includes("recover") || lower.includes("account")) {
    return "🔑 Account Recovery: Visit the X Login page, click 'Forgot Password?', and enter your username or email. We will send a security code to verify your identity.";
  }

  if (lower.includes("delete") || lower.includes("deactivate")) {
    return "🗑️ Deletion: Go to Settings > Your Account > Deactivate your account. Confirm your password and your account will be deleted permanently after 30 days of deactivation.";
  }

  if (lower.includes("secure") || lower.includes("password") || lower.includes("hack")) {
    return "🛡️ Security: Go to Settings > Security and account access > Security > Two-factor authentication. Enable App-based or Security Key 2FA to fully secure your profile.";
  }

  return "💬 Hello! I am the X Support AI Assistant. I can help you with account recovery, deletion, security, and general profile settings. What would you like to know?";
}

/**
 * Handles sending a message to the server API and displaying the response.
 * @param {string} text - Message from the user
 */
async function processChatMessage(text) {
  // 1. Show the user's message immediately in the UI
  addMessage(text, "user");
  // 2. Show the typing animation
  showTypingIndicator();

  try {
    // 3. Make a POST request to our local Python server
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text })
    });

    // 4. Remove typing indicator once HTTP response returns
    removeTypingIndicator();

    if (!response.ok) {
      throw new Error("Local server API returned an error status.");
    }

    const data = await response.json();
    
    // 5. If server returns a valid reply, print it. Otherwise, use mock.
    if (data.reply && !data.reply.includes("backend is not ready")) {
      addMessage(data.reply, "bot");
    } else {
      // Fallback if backend model files aren't loaded
      addMessage(getMockReply(text), "bot");
    }
  } catch (error) {
    // 6. Handle offline fallback
    removeTypingIndicator();
    console.warn("Backend error, using client-side mock responder:", error);
    addMessage(getMockReply(text), "bot");
  }
}

// --------------------------------------------------------------------------
// 4. THEME CUSTOMIZATION LOGIC (Changing Background Colors)
// --------------------------------------------------------------------------

/**
 * Changes CSS variables on the root document level.
 * This updates the background color of the body dynamically.
 * @param {string} startColor - HEX/RGB color for gradient start or solid bg
 * @param {string} endColor - HEX/RGB color for gradient end
 */
function setBackgroundStyle(startColor, endColor) {
  // document.documentElement gives us access to :root in CSS.
  // We use style.setProperty to overwrite the CSS variables.
  document.documentElement.style.setProperty("--bg-gradient-start", startColor);
  document.documentElement.style.setProperty("--bg-gradient-end", endColor);
}

// Map of pre-configured themes to hex colors
const themeMap = {
  default: { start: "#0f172a", end: "#1e293b" }, // Dark Slate
  cosmic:  { start: "#1e1b4b", end: "#311042" }, // Purple/Dark Violet
  aurora:  { start: "#022c22", end: "#064e3b" }, // Emerald Teal
  sunset:  { start: "#451a03", end: "#311042" }, // Amber/Magenta
  light:   { start: "#f1f5f9", end: "#cbd5e1" }  // Modern Light Gray
};

// Add click listeners to all theme preset buttons
themeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    // Remove active class from all buttons and add it to the clicked one
    themeButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    
    // Get theme details and update background
    const themeName = btn.getAttribute("data-theme");
    const theme = themeMap[themeName];
    
    if (theme) {
      setBackgroundStyle(theme.start, theme.end);
      
      // Update color picker value to match the start color
      bgColorPicker.value = theme.start;
    }
  });
});

// Listen to custom color picker changes
// "input" event fires in real-time as the user drags their cursor across the color palette
bgColorPicker.addEventListener("input", (event) => {
  const selectedColor = event.target.value;
  
  // Deactivate all preset theme buttons since a custom color is being set
  themeButtons.forEach(b => b.classList.remove("active"));
  
  // Set the background as a custom gradient starting with selectedColor
  setBackgroundStyle(selectedColor, darkenColor(selectedColor, -20));
});

/**
 * Helper utility to create a simple gradient end-point color by darkening/lightening hex colors
 */
function darkenColor(hex, percent) {
  let num = parseInt(hex.replace("#",""), 16),
      amt = Math.round(2.55 * percent),
      R = (num >> 16) + amt,
      G = (num >> 8 & 0x00FF) + amt,
      B = (num & 0x0000FF) + amt;
  return "#" + (0x1000000 + (R<255?R<0?0:R:255)*0x10000 + (G<255?G<0?0:G:255)*0x100 + (B<255?B<0?0:B:255)).toString(16).slice(1);
}

// --------------------------------------------------------------------------
// 5. EVENT LISTENERS & INITIALIZATION
// --------------------------------------------------------------------------

// Form submit event handler (when user clicks send or presses Enter)
chatForm.addEventListener("submit", (event) => {
  // Prevent default page reload on submit
  event.preventDefault();
  
  const text = userInput.value.trim();
  if (!text) return; // Ignore empty submissions
  
  // Clear the input field
  userInput.value = "";
  
  // Process and send message
  processChatMessage(text);
});

// Click handlers for suggestion chip buttons
suggestionChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    // Fill the input text and focus it
    userInput.value = chip.getAttribute("data-message");
    userInput.focus();
  });
});

// Add welcoming message on load
window.addEventListener("DOMContentLoaded", () => {
  addMessage("Hi! Welcome to X Support. Select a query below or type any question regarding your X/Twitter account.", "bot");
});
