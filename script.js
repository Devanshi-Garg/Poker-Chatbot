import { monteCarlo } from "./monteCarlo.js";
// ==========================================
// CONSTANTS & GAME STATE
// ==========================================
const SUITS = ['s', 'h', 'd', 'c']; // spades, hearts, diamonds, clubs
const SUIT_SYMBOLS = { 's': '♠', 'h': '♥', 'd': '♦', 'c': '♣' };
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

let gameState = {
    hole: [null, null], // 2 hole cards
    board: [null, null, null, null, null], // Up to 5 board cards
    opponents: 2,
    pot: 150,
    callAmount: 50,
    activePickerTarget: null, // { type: 'hole'|'board', index: 0-4 }
    selectedSuitFilter: 's',
    lastSimResults: null
};

let chatHistory = [];

// Preset hands for quick testing
const PRESETS = {
    pocket_aces: {
        hole: [{r:'A', s:'s'}, {r:'A', s:'h'}],
        board: [null, null, null, null, null],
        pot: 100, call: 30, opponents: 2
    },
    flush_draw: {
        hole: [{r:'A', s:'h'}, {r:'K', s:'h'}],
        board: [{r:'J', s:'h'}, {r:'4', s:'h'}, {r:'9', s:'c'}, null, null],
        pot: 200, call: 60, opponents: 3
    },
    set_flop: {
        hole: [{r:'8', s:'s'}, {r:'8', s:'d'}],
        board: [{r:'8', s:'h'}, {r:'K', s:'c'}, {r:'2', s:'s'}, null, null],
        pot: 250, call: 50, opponents: 2
    },
    bluff_river: {
        hole: [{r:'J', s:'d'}, {r:'T', s:'s'}],
        board: [{r:'K', s:'h'}, {r:'Q', s:'c'}, {r:'4', s:'s'}, {r:'2', s:'d'}, {r:'7', s:'h'}],
        pot: 400, call: 150, opponents: 1
    }
};

// Initialize App
window.onload = function() {
    checkApiKeyStatus();
    renderTable();
};

function checkApiKeyStatus() {
    const key = localStorage.getItem('gemini_api_key');
    const dot = document.getElementById('apiKeyDot');
    const text = document.getElementById('apiKeyText');
    if (key) {
        dot.className = "w-2 h-2 rounded-full bg-emerald-400";
        text.innerText = "Gemini Key Saved";
    } else {
        dot.className = "w-2 h-2 rounded-full bg-amber-500 animate-pulse";
        text.innerText = "Set Gemini API Key";
    }
}

function toggleKeyModal() {
    const modal = document.getElementById('keyModal');
    modal.classList.toggle('hidden');
}

function saveApiKey() {
    const key = document.getElementById('apiKeyInput').value.trim();
    if (key) {
        localStorage.setItem('gemini_api_key', key);
        checkApiKeyStatus();
        toggleKeyModal();
        alert('Gemini API key saved successfully!');
    }
}

function openGuideModal() {
    document.getElementById('guideModal').classList.remove('hidden');
}

function closeGuideModal() {
    document.getElementById('guideModal').classList.add('hidden');
}

function openCardPicker(type, index) {
    gameState.activePickerTarget = { type, index };
    document.getElementById('pickerModalTitle').innerText = `Select ${type === 'hole' ? 'Hole Card ' + (index+1) : 'Board Card ' + (index+1)}`;
    renderRankGrid();
    document.getElementById('cardPickerModal').classList.remove('hidden');
}

function closeCardPicker() {
    document.getElementById('cardPickerModal').classList.add('hidden');
    gameState.activePickerTarget = null;
}

function filterSuit(suit) {
    gameState.selectedSuitFilter = suit;
    document.querySelectorAll('.suit-tab').forEach(btn => {
        btn.className = "suit-tab flex-1 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:bg-slate-800";
    });
    const activeBtn = document.getElementById(`suitBtn-${suit}`);
    activeBtn.className = "suit-tab flex-1 py-1.5 rounded-lg text-xs font-bold bg-slate-800 text-slate-100 border border-slate-700";
    renderRankGrid();
}

function isCardInUse(rank, suit) {
    const match = card => card && card.r === rank && card.s === suit;
    return gameState.hole.some(match) || gameState.board.some(match);
}

function renderRankGrid() {
    const grid = document.getElementById('cardRankGrid');
    grid.innerHTML = '';
    const suit = gameState.selectedSuitFilter;

    RANKS.slice().reverse().forEach(rank => {
        const used = isCardInUse(rank, suit);
        const btn = document.createElement('button');
        const isRed = suit === 'h' || suit === 'd';
        btn.disabled = used;
        btn.className = `p-3 rounded-xl border font-mono font-bold text-sm flex flex-col items-center justify-center transition ${
            used
                ? 'bg-slate-950 border-slate-900 text-slate-700 cursor-not-allowed opacity-40'
                : 'bg-slate-800 border-slate-700 hover:border-amber-400 text-slate-100 hover:bg-slate-700'
        }`;
        btn.innerHTML = `<span>${rank}</span><span class="${isRed ? 'text-red-400' : 'text-slate-300'}">${SUIT_SYMBOLS[suit]}</span>`;
        btn.onclick = () => selectCard(rank, suit);
        grid.appendChild(btn);
    });
}

function selectCard(rank, suit) {
    if (!gameState.activePickerTarget) return;
    const { type, index } = gameState.activePickerTarget;
    gameState[type][index] = { r: rank, s: suit };
    closeCardPicker();
    renderTable();
}

function removeSelectedCard() {
    if (!gameState.activePickerTarget) return;
    const { type, index } = gameState.activePickerTarget;
    gameState[type][index] = null;
    closeCardPicker();
    renderTable();
}

function clearTableCards() {
    gameState.hole = [null, null];
    gameState.board = [null, null, null, null, null];
    renderTable();
    document.getElementById('simResultsCard').classList.add('hidden');
}

function updateOpponents(val) {
    gameState.opponents = parseInt(val);
    document.getElementById('opponentsVal').innerText = val;
}

function updatePot(val) {
    gameState.pot = parseFloat(val) || 0;
    document.getElementById('tablePotDisplay').innerText = `$${gameState.pot}`;
}

function updateCall(val) {
    gameState.callAmount = parseFloat(val) || 0;
}

function loadPreset(key) {
    const preset = PRESETS[key];
    if (!preset) return;
    gameState.hole = JSON.parse(JSON.stringify(preset.hole));
    gameState.board = JSON.parse(JSON.stringify(preset.board));
    gameState.pot = preset.pot;
    gameState.callAmount = preset.call;
    gameState.opponents = preset.opponents;

    document.getElementById('potInput').value = preset.pot;
    document.getElementById('callInput').value = preset.call;
    document.getElementById('opponentsInput').value = preset.opponents;
    document.getElementById('opponentsVal').innerText = preset.opponents;
    document.getElementById('tablePotDisplay').innerText = `$${preset.pot}`;

    renderTable();
    runMonteCarloSimulation();
}
        const SUIT_COLORS = { s: 'suit-black', h: 'suit-red', d: 'suit-red', c: 'suit-black' };

function renderCardContent(rank, suit, isSmall = false) {
  const symbol = SUIT_SYMBOLS[suit] || '';
  const colorClass = SUIT_COLORS[suit] || 'suit-black';
  const displayRank = rank === 'T' ? '10' : rank;
  
  if (rank === 'A') {
    return `
      <div class="relative w-full h-full p-1.5 flex flex-col justify-between ${colorClass} select-none">
        <div class="flex flex-col items-center leading-tight font-bold z-10 w-4">
          <span class="text-xs sm:text-sm tracking-tighter">${displayRank}</span>
          <span class="text-xs sm:text-sm -mt-1">${symbol}</span>
        </div>
        <div class="absolute inset-0 flex items-center justify-center">
          <span class="text-4xl sm:text-5xl ${colorClass} drop-shadow-sm select-none">${symbol}</span>
        </div>
        <div class="flex flex-col items-center leading-tight font-bold z-10 w-4 self-end transform rotate-180">
          <span class="text-xs sm:text-sm tracking-tighter">${displayRank}</span>
          <span class="text-xs sm:text-sm -mt-1">${symbol}</span>
        </div>
      </div>`;
  } else if (['J', 'Q', 'K'].includes(rank)) {
    return `
      <div class="relative w-full h-full p-1.5 flex flex-col justify-between ${colorClass} select-none">
        <div class="flex flex-col items-center leading-tight font-bold z-10 w-4">
          <span class="text-xs sm:text-sm tracking-tighter">${displayRank}</span>
          <span class="text-xs sm:text-sm -mt-1">${symbol}</span>
        </div>
        <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none ${colorClass}">
          <span class="text-2xl sm:text-3xl font-extrabold tracking-tighter leading-none">${rank}</span>
          <span class="text-base sm:text-lg -mt-1 opacity-90">${symbol}</span>
        </div>
        <div class="flex flex-col items-center leading-tight font-bold z-10 w-4 self-end transform rotate-180">
          <span class="text-xs sm:text-sm tracking-tighter">${displayRank}</span>
          <span class="text-xs sm:text-sm -mt-1">${symbol}</span>
        </div>
      </div>`;
  } else {
    const pipsCount = rank === 'T' ? 10 : parseInt(rank, 10);
    const pipPositions = {
      2: [{ x: 50, y: 20, inv: false }, { x: 50, y: 80, inv: true }],
      3: [{ x: 50, y: 20, inv: false }, { x: 50, y: 50, inv: false }, { x: 50, y: 80, inv: true }],
      4: [{ x: 30, y: 20, inv: false }, { x: 70, y: 20, inv: false }, { x: 30, y: 80, inv: true }, { x: 70, y: 80, inv: true }],
      5: [{ x: 30, y: 20, inv: false }, { x: 70, y: 20, inv: false }, { x: 50, y: 50, inv: false }, { x: 30, y: 80, inv: true }, { x: 70, y: 80, inv: true }],
      6: [{ x: 30, y: 20, inv: false }, { x: 70, y: 20, inv: false }, { x: 30, y: 50, inv: false }, { x: 70, y: 50, inv: false }, { x: 30, y: 80, inv: true }, { x: 70, y: 80, inv: true }],
      7: [{ x: 30, y: 20, inv: false }, { x: 70, y: 20, inv: false }, { x: 50, y: 35, inv: false }, { x: 30, y: 50, inv: false }, { x: 70, y: 50, inv: false }, { x: 30, y: 80, inv: true }, { x: 70, y: 80, inv: true }],
      8: [{ x: 30, y: 20, inv: false }, { x: 70, y: 20, inv: false }, { x: 50, y: 35, inv: false }, { x: 30, y: 50, inv: false }, { x: 70, y: 50, inv: false }, { x: 50, y: 65, inv: true }, { x: 30, y: 80, inv: true }, { x: 70, y: 80, inv: true }],
      9: [{ x: 30, y: 18, inv: false }, { x: 70, y: 18, inv: false }, { x: 30, y: 39, inv: false }, { x: 70, y: 39, inv: false }, { x: 50, y: 50, inv: false }, { x: 30, y: 61, inv: true }, { x: 70, y: 61, inv: true }, { x: 30, y: 82, inv: true }, { x: 70, y: 82, inv: true }],
      10: [{ x: 30, y: 18, inv: false }, { x: 70, y: 18, inv: false }, { x: 50, y: 30, inv: false }, { x: 30, y: 40, inv: false }, { x: 70, y: 40, inv: false }, { x: 30, y: 60, inv: true }, { x: 70, y: 60, inv: true }, { x: 50, y: 70, inv: true }, { x: 30, y: 82, inv: true }, { x: 70, y: 82, inv: true }]
    };
    const pips = pipPositions[pipsCount] || [];
    return `
      <div class="relative w-full h-full p-1.5 flex flex-col justify-between ${colorClass} select-none">
        <div class="flex flex-col items-center leading-tight font-bold z-10 w-4">
          <span class="text-xs sm:text-sm tracking-tighter">${displayRank}</span>
          <span class="text-xs sm:text-sm -mt-1">${symbol}</span>
        </div>
        <div class="absolute inset-[15%] pointer-events-none">
          ${pips.map(p => `<span class="absolute text-xs ${colorClass}" style="left: ${p.x}\%; top:${p.y}%; transform: translate(-50%, -50%) ${p.inv ? 'rotate(180deg)' : ''};">${symbol}</span>`).join('')}
        </div>
        <div class="flex flex-col items-center leading-tight font-bold z-10 w-4 self-end transform rotate-180">
          <span class="text-xs sm:text-sm tracking-tighter">${displayRank}</span>
          <span class="text-xs sm:text-sm -mt-1">${symbol}</span>
        </div>
      </div>`;
  }
}

function createCardElement(card, placeholderText) {
    if (!card) {
        return `<span class="text-xs text-emerald-400/50">${placeholderText}</span>`;
    }
    const isRed = card.s === 'h' || card.s === 'd';
    return `
                <div class="bg-white text-slate-900 w-full h-full rounded-xl flex flex-col justify-between p-1.5 shadow-md font-mono">
                    <div class="text-xs font-black leading-none ${isRed ? 'text-red-600' : 'text-slate-900'}">${card.r}</div>
                    <div class="text-base text-center leading-none ${isRed ? 'text-red-600' : 'text-slate-900'}">${SUIT_SYMBOLS[card.s]}</div>
                    <div class="text-xs font-black text-right leading-none ${isRed ? 'text-red-600' : 'text-slate-900'}">${card.r}</div>
                </div>
            `;
}

function renderTable() {
    // Render hole cards
    for (let i = 0; i < 2; i++) {
        const el = document.getElementById(`hole-${i}`);
        const card = gameState.hole[i];
        if (card) {
            el.className = "poker-card w-16 h-24 md:w-20 md:h-28 cursor-pointer shadow-xl border-2 border-emerald-400";
            el.innerHTML = renderCardContent(card.r, card.s);
        } else {
            el.className = "poker-card w-16 h-24 md:w-20 md:h-28 bg-slate-900/90 border-2 border-dashed border-emerald-400/60 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-amber-400 shadow-xl";
            el.innerHTML = `<span class="text-xs text-emerald-300/80 font-medium">Card ${i+1}</span>`;
        }
    }

    // Render board cards
    const boardNames = ['Flop 1', 'Flop 2', 'Flop 3', 'Turn', 'River'];
    for (let i = 0; i < 5; i++) {
        const el = document.getElementById(`board-${i}`);
        const card = gameState.board[i];
        if (card) {
            el.className = "poker-card w-14 h-20 md:w-16 md:h-24 cursor-pointer shadow-md border-2 border-emerald-400";
            el.innerHTML = renderCardContent(card.r, card.s);
        } else {
            el.className = "poker-card w-14 h-20 md:w-16 md:h-24 bg-slate-900/80 border-2 border-dashed border-emerald-500/40 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-amber-400";
            el.innerHTML = `<span class="text-xs text-emerald-400/60">${boardNames[i]}</span>`;
        }
    }
}

function runMonteCarloSimulation() {
    if (!gameState.hole[0] || !gameState.hole[1]) {
        alert('Please select both hole cards for your hand before running simulation.');
        return;
    }

    const simBtn = document.getElementById('runSimBtn');
    simBtn.disabled = true;
    simBtn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Running 10,000 Monte Carlo Deals...`;

    // Timeout to allow UI to show spinning state
    setTimeout(() => {

// Step 1: Convert the player's cards to our engine's format
        const myCards = gameState.hole.map(card =>
            card.r + card.s
        );

// Step 2: Convert known community cards
        const communityCards = gameState.board
            .filter(Boolean)
            .map(card => card.r + card.s);

// Step 3: Get the number of opponents
        const opponents = gameState.opponents;

// Step 4: Run our Monte Carlo simulation
        const result = monteCarlo(
            myCards,
            communityCards,
            opponents
        );

// Step 5: Extract the probabilities
        const winPct = result.winProbability;
        const tiePct = result.tieProbability;
        const lossPct = 100 - winPct - tiePct;


        // Pot Odds Calculation: Call / (Pot + Call)
        const pot = gameState.pot;
        const call = gameState.callAmount;
        const potOdds = call > 0 ? (call / (pot + call)) * 100 : 0;

        // Expected Value (EV): (Win Equity * Total Pot after Call) - Call
        const totalEquityFrac = (winPct + (tiePct / 2)) / 100;
        const expectedValue = call > 0 ? (totalEquityFrac * (pot + call)) - call : (totalEquityFrac * pot);

        // Recommendation Logic
        let action = "CHECK / CALL";
        let badgeClass = "bg-amber-500/20 text-amber-400 border-amber-500/30";

        if (call === 0) {
            if (winPct > (100 / (opponents + 1)) + 15) {
                action = "BET / RAISE";
                badgeClass = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
            } else {
                action = "CHECK";
                badgeClass = "bg-blue-500/20 text-blue-400 border-blue-500/30";
            }
        } else {
            if (totalEquityFrac * 100 > potOdds + 12) {
                action = "RAISE / RE-RAISE";
                badgeClass = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
            } else if (totalEquityFrac * 100 >= potOdds) {
                action = "CALL";
                badgeClass = "bg-amber-500/20 text-amber-400 border-amber-500/30";
            } else {
                action = "FOLD";
                badgeClass = "bg-rose-500/20 text-rose-400 border-rose-500/30";
            }
        }

        gameState.lastSimResults = {
            winPct, tiePct, lossPct, potOdds, expectedValue, action
        };

        // Update UI Display
        document.getElementById('simResultsCard').classList.remove('hidden');
        document.getElementById('winRateVal').innerText = winPct.toFixed(1) + '%';
        document.getElementById('tieRateVal').innerText = tiePct.toFixed(1) + '%';
        document.getElementById('potOddsVal').innerText = potOdds.toFixed(1) + '%';
        document.getElementById('evVal').innerText = (expectedValue >= 0 ? '+' : '') + '$' + expectedValue.toFixed(2);
        document.getElementById('evVal').className = `text-xl font-black font-mono ${expectedValue >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;

        const badge = document.getElementById('recommendedBadge');
        badge.innerText = action;
        badge.className = `px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${badgeClass}`;

        // Update Distribution Bar
        document.getElementById('winBar').style.width = `${winPct}%`;
        document.getElementById('tieBar').style.width = `${tiePct}%`;
        document.getElementById('lossBar').style.width = `${lossPct}%`;
        document.getElementById('equityBreakdownLabel').innerText = `Win: ${winPct.toFixed(1)}% | Tie: ${tiePct.toFixed(1)}% | Loss: ${lossPct.toFixed(1)}%`;

        // Analysis text
        document.getElementById('simAnalysisText').innerHTML = `
                    <b>Mathematical Summary:</b> Your total equity is <b>${(totalEquityFrac*100).toFixed(1)}%</b> compared to required Pot Odds of <b>${potOdds.toFixed(1)}%</b>. 
                    This results in a long-term expected value of <b class="${expectedValue >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${expectedValue >= 0 ? '+$' : '-$'}${Math.abs(expectedValue).toFixed(2)}</b> per decision.
                `;

        simBtn.disabled = false;
        simBtn.innerHTML = `<i class="fa-solid fa-calculator"></i> Run Monte Carlo Simulation (10,000 Hands)`;

        // Auto notify Gemini chatbot with state context
        appendSystemMessageToChat();
    }, 50);
}

function appendSystemMessageToChat() {
    if (!gameState.lastSimResults) return;
    const res = gameState.lastSimResults;
    const holeText = gameState.hole.map(c => `${c.r}${SUIT_SYMBOLS[c.s]}`).join(' ');
    const boardText = gameState.board.filter(Boolean).map(c => `${c.r}${SUIT_SYMBOLS[c.s]}`).join(' ') || 'Pre-flop';

    const msgHtml = `
                <div class="bg-emerald-950/40 border border-emerald-500/30 p-2.5 rounded-xl text-xs text-emerald-200/90 my-2">
                    <b class="text-emerald-400"><i class="fa-solid fa-chart-line"></i> Simulation Loaded into AI Context:</b><br>
                    Hand: [ ${holeText} ] | Board: [ ${boardText} ]<br>
                    Win Equity: ${res.winPct.toFixed(1)}% | EV: $${res.expectedValue.toFixed(2)} | Action: <b>${res.action}</b>
                </div>
            `;
    const chatBox = document.getElementById('chatMessages');
    chatBox.insertAdjacentHTML('beforeend', msgHtml);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function appendUserMessage(text) {
    const chatBox = document.getElementById('chatMessages');
    const msgHtml = `
                <div class="flex items-start gap-2.5 justify-end">
                    <div class="bg-emerald-600/20 border border-emerald-500/30 p-3 rounded-2xl rounded-tr-xs text-slate-100 max-w-[85%] text-xs leading-relaxed">
                        ${escapeHtml(text)}
                    </div>
                </div>
            `;
    chatBox.insertAdjacentHTML('beforeend', msgHtml);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function appendBotMessage(text) {
    const chatBox = document.getElementById('chatMessages');
    const msgHtml = `
                <div class="flex items-start gap-2.5">
                    <div class="w-7 h-7 rounded-full bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-xs shrink-0 mt-0.5">
                        <i class="fa-solid fa-robot"></i>
                    </div>
                    <div class="bg-slate-800 border border-slate-700/70 p-3 rounded-2xl rounded-tl-xs text-slate-300 max-w-[85%] text-xs leading-relaxed">
                        ${formatMarkdown(text)}
                    </div>
                </div>
            `;
    chatBox.insertAdjacentHTML('beforeend', msgHtml);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatMarkdown(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .replace(/\*(.*?)\*/g, '<i>$1</i>')
        .replace(/\n/g, '<br>');
}

function sendQuickPrompt(text) {
    document.getElementById('chatInput').value = text;
    handleChatSubmit(new Event('submit'));
}

async function handleChatSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('chatInput');
    const userText = input.value.trim();
    if (!userText) return;

    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
        toggleKeyModal();
        alert('Please enter your Gemini API key to talk with the AI coach.');
        return;
    }

    appendUserMessage(userText);
    input.value = '';

    // Construct System Prompt and Context
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

    // Show typing indicator
    const chatBox = document.getElementById('chatMessages');
    const typingId = 'typing-' + Date.now();
    chatBox.insertAdjacentHTML('beforeend', `
                <div id="${typingId}" class="flex items-start gap-2.5">
                    <div class="w-7 h-7 rounded-full bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-xs shrink-0 mt-0.5">
                        <i class="fa-solid fa-robot"></i>
                    </div>
                    <div class="bg-slate-800 border border-slate-700/70 p-3 rounded-2xl text-slate-400 text-xs italic">
                        Gemini is analyzing Monte Carlo equity...
                    </div>
                </div>
            `);
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
        // Call Gemini REST API
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

        document.getElementById(typingId)?.remove();

        if (!response.ok) {
            throw new Error(`API returned HTTP ${response.status}`);
        }

        const result = await response.json();
        const aiReply = result.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't generate a strategy recommendation. Please try rephrasing.";

        appendBotMessage(aiReply);
        chatHistory.push({ role: 'model', parts: [{ text: aiReply }] });

    } catch (err) {
        document.getElementById(typingId)?.remove();
        appendBotMessage(`⚠️ **Error connecting to Gemini API**: ${err.message}. Please check that your API key is valid.`);
    }
}

function clearChatHistory() {
    chatHistory = [];
    document.getElementById('chatMessages').innerHTML = `
                <div class="flex items-start gap-2.5">
                    <div class="w-7 h-7 rounded-full bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-xs shrink-0 mt-0.5">
                        <i class="fa-solid fa-robot"></i>
                    </div>
                    <div class="bg-slate-800 border border-slate-700/70 p-3 rounded-2xl rounded-tl-xs text-slate-300 max-w-[85%] text-xs leading-relaxed">
                        Chat reset! Select cards on the table and ask me any Texas Hold'em question.
                    </div>
                </div>
            `;
}

Object.assign(window, {
    openCardPicker,
    closeCardPicker,
    filterSuit,
    removeSelectedCard,
    clearTableCards,
    loadPreset,
    updateOpponents,
    updatePot,
    updateCall,
    runMonteCarloSimulation,
    toggleKeyModal,
    saveApiKey,
    openGuideModal,
    closeGuideModal,
    sendQuickPrompt,
    handleChatSubmit,
    clearChatHistory
});
