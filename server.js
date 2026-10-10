import { sendGeminiChatMessage, formatMarkdown } from './geminiCoach.js';

async function handleChatSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('chatInput');
    const userText = input.value.trim();
    if (!userText) return;

    try {
        const reply = await sendGeminiChatMessage(userText, gameState, chatHistory);
        // Append bot reply to your UI chat box using formatMarkdown(reply)
    } catch (err) {
        // Handle error (e.g. missing API key or network failure)
    }
}

/**
 * Gemini Poker Coach Service
 * Handles communication with the Google Gemini API using local API key storage.
 */

// Format markdown text returned by the AI into basic HTML safely
function formatMarkdown(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .replace(/\*(.*?)\*/g, '<i>$1</i>')
        .replace(/\n/g, '<br>');
}

// Escape HTML to prevent injection
function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Sends a prompt and the current game context to the Gemini API.
 * @param {string} userText - The user's question or prompt.
 * @param {Object} gameState - The current state of the poker game (hole cards, board, pot, opponents, etc.).
 * @param {Array} chatHistory - The array tracking conversation history.
 * @returns {Promise<string>} - The AI response text.
 */
async function sendGeminiChatMessage(userText, gameState, chatHistory) {
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
        throw new Error('Gemini API key not found in local storage.');
    }

    // Construct context from game state
    const holeText = gameState.hole[0] && gameState.hole[1] 
        ? `${gameState.hole[0].r}${gameState.hole[0].s} ${gameState.hole[1].r}${gameState.hole[1].s}`
        : 'None selected';
    
    const boardText = gameState.board.filter(Boolean).map(c => `${c.r}${c.s}`).join(' ') || 'Preflop (No board cards)';
    
    const simContext = gameState.lastSimResults ? `
        - Win Equity: ${gameState.lastSimResults.winPct.toFixed(1)}%
        - Tie Equity: ${gameState.lastSimResults.tiePct.toFixed(1)}%
        - Required Pot Odds: ${gameState.lastSimResults.potOdds.toFixed(1)}%
        - Expected Value (EV): $${gameState.lastSimResults.expectedValue.toFixed(2)}
        - Recommended Action: ${gameState.lastSimResults.action}
    ` : 'Monte Carlo simulation not run yet.';

    const systemPrompt = `You are a world-class, friendly Texas Hold'em Poker Coach assisting a beginner player. 
    Translate raw math into concise, encouraging strategy explanations. Keep responses beginner-friendly, under 3 paragraphs, using bullet points for key tips.

    Current Table Context:
    - Player Hole Cards: ${holeText}
    - Community Board: ${boardText}
    - Active Opponents: ${gameState.opponents}
    - Current Pot: $${gameState.pot}
    - Amount to Call: $${gameState.callAmount}
    Monte Carlo Engine Stats:
    ${simContext}`;

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;
    
    chatHistory.push({ role: 'user', parts: [{ text: userText }] });

    const payload = {
        contents: [
            { role: 'user', parts: [{ text: `System Context:\n${systemPrompt}\n\nUser Question: ${userText}` }] }
        ]
    };

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`API returned HTTP ${response.status}`);
    }

    const result = await response.json();
    const aiReply = result.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't generate a strategy recommendation. Please try rephrasing.";

    chatHistory.push({ role: 'model', parts: [{ text: aiReply }] });
    return aiReply;
}

// Export functions if using ES Modules
export { sendGeminiChatMessage, formatMarkdown, escapeHtml };
