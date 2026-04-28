// ─── Constants ────────────────────────────────────────────────────────────────
const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const BASE_BET = 10;
const SIDE_BET_5 = 5;
const SIDE_BET_1 = 1;
const JACKPOT_5 = 52847.50;
const JACKPOT_1 = 5107.46;
const STARTING_BALANCE = 200;

// ─── State ────────────────────────────────────────────────────────────────────
let state = {
  deck: [],
  dealerHand: [],
  hands: [],            // [{ cards, done, busted, isAceSplit }]
  activeHandIdx: 0,
  isSplitGame: false,
  phase: 'idle',        // 'idle' | 'playing' | 'result'
  firstActionFeedback: null,
  firstCorrectAct: null,
  firstActionDone: false,
  gameResults: [],
  lastBetDelta: 0,
  stats: { correct: 0, total: 0 },
  sideBet5Active: false,
  sideBet1Active: false,
  sideResult5: null,   // { name, amount, isJackpot, delta } | null
  sideResult1: null,
  balance: STARTING_BALANCE,
  totalWagered: 0,
  totalProfit: 0,
  history: [],
  currentBet: BASE_BET,
  showHistory: false,
  show21Table: false,
};

// ─── Deck helpers ─────────────────────────────────────────────────────────────
function createDeck() {
  const deck = [];
  for (const suit of SUITS) for (const value of VALUES) deck.push({ suit, value });
  return shuffle(deck);
}
function shuffle(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}
function cardValue(card) {
  if (['J','Q','K'].includes(card.value)) return 10;
  if (card.value === 'A') return 11;
  return parseInt(card.value);
}
function handTotal(hand) {
  let total = 0, aces = 0;
  for (const card of hand) { total += cardValue(card); if (card.value === 'A') aces++; }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}
function isSoft(hand) {
  let total = 0, aces = 0;
  for (const card of hand) { total += cardValue(card); if (card.value === 'A') aces++; }
  return aces > 0 && total <= 21 && (total - 10) >= 1;
}
function canSplit(hand) { return hand.length === 2 && cardValue(hand[0]) === cardValue(hand[1]); }
function isAcePair(hand) { return hand.length === 2 && hand[0].value === 'A' && hand[1].value === 'A'; }

// ─── 21+3 Side Bet ────────────────────────────────────────────────────────────
function rankIndex(card) {
  if (card.value === 'A') return 1;
  if (card.value === 'J') return 11;
  if (card.value === 'Q') return 12;
  if (card.value === 'K') return 13;
  return parseInt(card.value);
}

function _baseEval(p1, p2, dealer) {
  const cards = [p1, p2, dealer];
  const sameSuit = cards[0].suit === cards[1].suit && cards[1].suit === cards[2].suit;
  const allSameValue = cards[0].value === cards[1].value && cards[1].value === cards[2].value;
  const ranks = cards.map(rankIndex).sort((a, b) => a - b);
  const isStraight = (ranks[2] - ranks[1] === 1 && ranks[1] - ranks[0] === 1) ||
                     (ranks[0] === 1 && ranks[1] === 2 && ranks[2] === 3);
  return { sameSuit, allSameValue, isStraight, rankVal: cards[0].value };
}

function evaluate5Jackpot(p1, p2, dealer) {
  const { sameSuit, allSameValue, isStraight, rankVal } = _baseEval(p1, p2, dealer);
  if (allSameValue && sameSuit && ['A','K','Q'].includes(rankVal))
    return { name: `3 ${rankVal}s del mismo palo`, isJackpot: true, amount: JACKPOT_5 };
  if (allSameValue && sameSuit)  return { name: 'Three-of-a-Kind (mismo palo)', amount: 625 };
  if (isStraight && sameSuit)    return { name: 'Straight Flush', amount: 125 };
  if (allSameValue)              return { name: 'Three-of-a-Kind', amount: 100 };
  if (isStraight)                return { name: 'Straight', amount: 30 };
  if (sameSuit)                  return { name: 'Flush', amount: 10 };
  return null;
}

function evaluate1Jackpot(p1, p2, dealer) {
  const { sameSuit, allSameValue, isStraight, rankVal } = _baseEval(p1, p2, dealer);
  if (allSameValue && sameSuit && ['J','10','7'].includes(rankVal))
    return { name: `3 ${rankVal}s del mismo palo`, isJackpot: true, amount: JACKPOT_1 };
  if (allSameValue && sameSuit)  return { name: 'Three-of-a-Kind (mismo palo)', amount: 125 };
  if (isStraight && sameSuit)    return { name: 'Straight Flush', amount: 25 };
  if (allSameValue)              return { name: 'Three-of-a-Kind', amount: 20 };
  if (isStraight)                return { name: 'Straight', amount: 6 };
  if (sameSuit)                  return { name: 'Flush', amount: 2 };
  return null;
}

// ─── Strategy ─────────────────────────────────────────────────────────────────
function getCorrectAction(playerHand, dealerUpCard, afterSplit = false) {
  const total = handTotal(playerHand), dv = cardValue(dealerUpCard);
  const soft = isSoft(playerHand);
  if (canSplit(playerHand) && playerHand.length === 2 && !afterSplit) {
    const pv = cardValue(playerHand[0]);
    if (pv === 11) return 'split'; if (pv === 8) return 'split';
    if (pv === 9) return (dv === 7 || dv >= 10) ? 'stand' : 'split';
    if (pv === 7) return dv <= 7 ? 'split' : 'hit';
    if (pv === 6) return dv <= 6 ? 'split' : 'hit';
    if (pv === 4) return (dv === 5 || dv === 6) ? 'split' : 'hit';
    if (pv === 3 || pv === 2) return dv <= 7 ? 'split' : 'hit';
    if (pv === 10) return 'stand';
    if (pv === 5) return dv <= 9 ? 'double' : 'hit';
  }
  if (playerHand.length === 2 && !afterSplit) {
    if (soft) {
      if (total >= 20) return 'stand';
      if (total === 19) return dv === 6 ? 'double' : 'stand';
      if (total === 18) { if (dv >= 2 && dv <= 6) return 'double'; if (dv <= 8) return 'stand'; return 'hit'; }
      if (total === 17) return (dv >= 3 && dv <= 6) ? 'double' : 'hit';
      if (total === 16 || total === 15) return (dv >= 4 && dv <= 6) ? 'double' : 'hit';
      if (total === 14 || total === 13) return (dv >= 5 && dv <= 6) ? 'double' : 'hit';
      return 'hit';
    }
    if (total === 11) return dv <= 10 ? 'double' : 'hit';
    if (total === 10) return dv <= 9 ? 'double' : 'hit';
    if (total === 9) return (dv >= 3 && dv <= 6) ? 'double' : 'hit';
  }
  if (soft) {
    if (total >= 19) return 'stand';
    if (total === 18) return dv >= 9 ? 'hit' : 'stand';
    return 'hit';
  }
  if (total >= 17) return 'stand';
  if (total >= 13 && total <= 16) return dv >= 7 ? 'hit' : 'stand';
  if (total === 12) return (dv >= 4 && dv <= 6) ? 'stand' : 'hit';
  return 'hit';
}
function actionLabel(a) {
  return { hit: 'pedir carta', stand: 'plantarte', double: 'doblar', split: 'dividir' }[a] || a;
}
function resolveHandResult(pt, dt, bet) {
  if (pt > 21) return { label: '💥 Te pasaste', delta: -bet };
  if (dt > 21) return { label: '🎉 Dealer se pasó', delta: bet };
  if (pt > dt)  return { label: '🏆 Ganaste', delta: bet };
  if (pt < dt)  return { label: '😞 Dealer ganó', delta: -bet };
  return { label: '🤝 Empate', delta: 0 };
}

// ─── Game actions ─────────────────────────────────────────────────────────────
function startNewGame() {
  const nd = createDeck();
  const p1 = nd.pop(), p2 = nd.pop(), d1 = nd.pop(), d2 = nd.pop();
  state.deck = nd;
  state.dealerHand = [d1, d2];
  state.hands = [{ cards: [p1, p2], done: false, busted: false, isAceSplit: false }];
  state.activeHandIdx = 0;
  state.isSplitGame = false;
  state.phase = 'playing';
  state.firstActionFeedback = null;
  state.firstCorrectAct = null;
  state.firstActionDone = false;
  state.gameResults = [];
  state.lastBetDelta = 0;
  state.currentBet = BASE_BET;
  state.sideResult5 = null;
  state.sideResult1 = null;

  if (state.sideBet5Active) {
    const res = evaluate5Jackpot(p1, p2, d1);
    state.sideResult5 = res ? { ...res, delta: res.amount } : { name: null, delta: -SIDE_BET_5 };
  }
  if (state.sideBet1Active) {
    const res = evaluate1Jackpot(p1, p2, d1);
    state.sideResult1 = res ? { ...res, delta: res.amount } : { name: null, delta: -SIDE_BET_1 };
  }
  render();
}

function recordFirstAction(action, correct, isCorrect) {
  if (!state.firstActionDone) {
    state.firstActionFeedback = isCorrect;
    state.firstCorrectAct = correct;
    state.stats.correct += isCorrect ? 1 : 0;
    state.stats.total += 1;
    state.firstActionDone = true;
  }
}

function findNextActiveHand(hs, currentIdx) {
  for (let i = currentIdx + 1; i < hs.length; i++) if (!hs[i].done) return i;
  return currentIdx;
}

function updateDeckAndHands(newDeck, newHands, newActiveIdx) {
  state.deck = newDeck;
  state.hands = newHands;
  state.activeHandIdx = newActiveIdx;
  if (newHands.every(h => h.done)) finalizeGame(newHands, newDeck);
  else render();
}

function handleHit() {
  const { hands, activeHandIdx, deck, dealerHand, isSplitGame } = state;
  const activeCards = hands[activeHandIdx].cards;
  const correct = getCorrectAction(activeCards, dealerHand[0], isSplitGame);
  recordFirstAction('hit', correct, 'hit' === correct);
  const cd = [...deck], newCard = cd.pop();
  const newCards = [...activeCards, newCard];
  const busted = handTotal(newCards) > 21, autoStand = handTotal(newCards) >= 21;
  const newHands = hands.map((h, i) => i === activeHandIdx ? { ...h, cards: newCards, done: busted || autoStand, busted } : h);
  let nextIdx = activeHandIdx;
  if (busted || autoStand) nextIdx = findNextActiveHand(newHands, activeHandIdx);
  updateDeckAndHands(cd, newHands, nextIdx);
}

function handleStand() {
  const { hands, activeHandIdx, deck, dealerHand, isSplitGame } = state;
  const activeCards = hands[activeHandIdx].cards;
  const correct = getCorrectAction(activeCards, dealerHand[0], isSplitGame);
  recordFirstAction('stand', correct, 'stand' === correct);
  const newHands = hands.map((h, i) => i === activeHandIdx ? { ...h, done: true } : h);
  const nextIdx = findNextActiveHand(newHands, activeHandIdx);
  updateDeckAndHands([...deck], newHands, nextIdx);
}

function handleDouble() {
  const { hands, activeHandIdx, deck, dealerHand, isSplitGame } = state;
  const activeCards = hands[activeHandIdx].cards;
  const correct = getCorrectAction(activeCards, dealerHand[0], isSplitGame);
  recordFirstAction('double', correct, 'double' === correct);
  state.currentBet = BASE_BET * 2;
  const cd = [...deck], newCard = cd.pop();
  const newCards = [...activeCards, newCard];
  const busted = handTotal(newCards) > 21;
  const newHands = hands.map((h, i) => i === activeHandIdx ? { ...h, cards: newCards, done: true, busted } : h);
  const nextIdx = findNextActiveHand(newHands, activeHandIdx);
  updateDeckAndHands(cd, newHands, nextIdx);
}

function handleSplit() {
  const { hands, activeHandIdx, deck, dealerHand } = state;
  const activeCards = hands[activeHandIdx].cards;
  const correct = getCorrectAction(activeCards, dealerHand[0], false);
  recordFirstAction('split', correct, 'split' === correct);
  state.currentBet = BASE_BET * 2;
  state.isSplitGame = true;
  const acesSplit = isAcePair(activeCards);
  const cd = [...deck];
  const hand1Cards = [activeCards[0], cd.pop()];
  const hand2Cards = [activeCards[1], cd.pop()];
  const newHands = [
    { cards: hand1Cards, done: acesSplit, busted: false, isAceSplit: acesSplit },
    { cards: hand2Cards, done: acesSplit, busted: false, isAceSplit: acesSplit },
  ];
  state.hands = newHands;
  state.activeHandIdx = 0;
  state.deck = cd;
  if (acesSplit) finalizeGame(newHands, cd);
  else render();
}

function finalizeGame(finalHands, finalDeck) {
  let df = [...state.dealerHand], cd = [...finalDeck];
  if (finalHands.some(h => !h.busted)) while (handTotal(df) < 17) df = [...df, cd.pop()];
  state.dealerHand = df;

  const dt = handTotal(df), bet = state.currentBet;
  let totalDelta = 0;
  const results = [];

  for (const h of finalHands) {
    const pt = handTotal(h.cards);
    const isNaturalBJ = !state.isSplitGame && h.cards.length === 2 && pt === 21;
    let label = '', delta = 0;
    if (isNaturalBJ && dt !== 21) { label = '🃏 ¡BLACKJACK!'; delta = Math.round(bet * 1.5); }
    else { const r = resolveHandResult(pt, dt, bet); label = r.label; delta = r.delta; }
    results.push({ cards: h.cards, total: pt, label, delta });
    totalDelta += delta;
  }

  let sideDelta = 0;
  if (state.sideBet5Active && state.sideResult5) sideDelta += state.sideResult5.delta;
  if (state.sideBet1Active && state.sideResult1) sideDelta += state.sideResult1.delta;
  totalDelta += sideDelta;

  state.gameResults = results;
  state.phase = 'result';

  const sideCost = (state.sideBet5Active ? SIDE_BET_5 : 0) + (state.sideBet1Active ? SIDE_BET_1 : 0);
  state.balance += totalDelta;
  state.totalWagered += bet + sideCost;
  state.totalProfit += totalDelta;
  state.lastBetDelta = totalDelta;

  const overallLabel = totalDelta > 0 ? '🏆 Ganaste' : totalDelta < 0 ? '😞 Perdiste' : '🤝 Empate';
  state.history = [
    { result: overallLabel, delta: totalDelta, balance: state.balance, bet: bet + sideCost },
    ...state.history
  ].slice(0, 20);

  render();
}

// ─── Render helpers ───────────────────────────────────────────────────────────
function makeCard(card, { hidden = false, small = false, active = false } = {}) {
  const div = document.createElement('div');
  div.className = 'card ' + (small ? 'small' : 'normal');
  if (hidden) {
    div.classList.add('hidden');
    div.textContent = '?';
    return div;
  }
  const isRed = card.suit === '♥' || card.suit === '♦';
  div.classList.add(active ? 'active' : 'face-up');
  div.classList.add(isRed ? 'red' : 'black');

  const topCorner = document.createElement('div');
  topCorner.className = 'card-corner';
  topCorner.innerHTML = card.value + '<br>' + card.suit;

  const center = document.createElement('div');
  center.className = 'card-suit-center';
  center.textContent = card.suit;

  const botCorner = document.createElement('div');
  botCorner.className = 'card-corner bot';
  botCorner.innerHTML = card.value + '<br>' + card.suit;

  div.appendChild(topCorner);
  div.appendChild(center);
  div.appendChild(botCorner);
  return div;
}

function renderCards(container, hand, { hidden2nd = false, small = false, active = false } = {}) {
  container.innerHTML = '';
  hand.forEach((card, i) => {
    container.appendChild(makeCard(card, { hidden: hidden2nd && i === 1, small, active }));
  });
}

// ─── Main render ──────────────────────────────────────────────────────────────
function render() {
  const s = state;
  const activeHand = s.hands[s.activeHandIdx] || { cards: [], done: false, busted: false, isAceSplit: false };
  const activeCards = activeHand.cards;
  const playerTotal = handTotal(activeCards);
  const accuracy = s.stats.total > 0 ? Math.round((s.stats.correct / s.stats.total) * 100) : 0;
  const roi = s.totalWagered > 0 ? ((s.totalProfit / s.totalWagered) * 100).toFixed(1) : '0.0';
  const profitColor = s.totalProfit > 0 ? '#2ed573' : s.totalProfit < 0 ? '#e94560' : '#f0e6d3';
  const sideDeltaTotal = (s.sideBet5Active && s.sideResult5 ? s.sideResult5.delta : 0) +
                         (s.sideBet1Active && s.sideResult1 ? s.sideResult1.delta : 0);
  const overallDelta = s.gameResults.reduce((sum, r) => sum + r.delta, 0) + sideDeltaTotal;
  const showSplitBtn = s.phase === 'playing' && !s.isSplitGame && canSplit(activeCards) && activeCards.length === 2;
  const showDoubleBtn = s.phase === 'playing' && activeCards.length === 2 && !s.isSplitGame;

  // Stats row
  document.getElementById('stat-hands').textContent = s.stats.total;
  document.getElementById('stat-correct').textContent = s.stats.correct;
  const accEl = document.getElementById('stat-accuracy');
  accEl.textContent = accuracy + '%';
  accEl.style.color = accuracy >= 70 ? '#2ed573' : '#e94560';

  // Balance
  const balEl = document.getElementById('balance-val');
  balEl.textContent = s.balance + '€';
  balEl.style.color = s.balance >= STARTING_BALANCE ? '#2ed573' : '#e94560';
  balEl.style.animation = s.phase === 'result' ? 'pop 0.4s ease' : 'none';

  document.getElementById('profit-val').textContent = (s.totalProfit >= 0 ? '+' : '') + s.totalProfit + '€';
  document.getElementById('profit-val').style.color = profitColor;
  document.getElementById('roi-val').textContent = 'ROI ' + roi + '%';

  const lastEl = document.getElementById('last-hand-val');
  lastEl.textContent = s.lastBetDelta === 0 && s.totalWagered === 0 ? '—' : (s.lastBetDelta > 0 ? '+' : '') + s.lastBetDelta + '€';
  lastEl.style.color = s.lastBetDelta > 0 ? '#2ed573' : s.lastBetDelta < 0 ? '#e94560' : '#888';
  document.getElementById('wagered-val').textContent = 'apostado ' + s.totalWagered + '€';

  // Balance bar
  const barPct = Math.min(100, Math.max(0, (s.balance / STARTING_BALANCE) * 100));
  const barEl = document.getElementById('balance-bar');
  barEl.style.width = barPct + '%';
  barEl.style.background = s.balance >= STARTING_BALANCE
    ? 'linear-gradient(90deg,#2ed573,#27ae60)'
    : 'linear-gradient(90deg,#e94560,#c0392b)';

  // History button
  const histBtn = document.getElementById('history-btn');
  if (s.history.length > 0) {
    histBtn.style.display = 'block';
    histBtn.textContent = s.showHistory ? '▲ OCULTAR HISTORIAL' : `▼ VER HISTORIAL (${s.history.length} manos)`;
  } else {
    histBtn.style.display = 'none';
  }

  // History list
  const histList = document.getElementById('history-list');
  if (s.showHistory && s.history.length > 0) {
    histList.style.display = 'block';
    histList.innerHTML = '';
    s.history.forEach((h, i) => {
      const row = document.createElement('div');
      row.className = 'hrow';
      row.innerHTML = `
        <span style="color:#888;min-width:18px">#${s.history.length - i}</span>
        <span style="color:#aaa;flex:1;margin:0 6px;font-size:10px">${h.result.replace(/[🃏💥🎉🏆😞🤝]/g,'').trim()}</span>
        <span style="color:#666;font-size:10px;margin-right:6px">${h.bet}€</span>
        <span style="color:${h.delta>0?'#2ed573':h.delta<0?'#e94560':'#888'};font-weight:bold;min-width:38px;text-align:right">${h.delta===0?'±0€':(h.delta>0?'+':'')+h.delta+'€'}</span>
        <span style="color:#555;min-width:46px;text-align:right">${h.balance}€</span>`;
      histList.appendChild(row);
    });
  } else {
    histList.style.display = 'none';
  }

  // 21+3 panel — border lights up if any tier is active
  const anyActive = s.sideBet5Active || s.sideBet1Active;
  const sidePanel = document.getElementById('side-panel');
  sidePanel.style.border = anyActive ? '1px solid rgba(244,208,63,0.4)' : '1px solid rgba(255,255,255,0.08)';
  sidePanel.style.background = anyActive ? 'rgba(244,208,63,0.05)' : 'rgba(0,0,0,0.2)';

  // Tier toggle buttons (always enabled — takes effect on next hand)
  function applyToggleStyle(btn, active) {
    btn.textContent = active ? 'ON ✓' : 'OFF';
    btn.style.background = active ? 'linear-gradient(135deg,#f4d03f,#d4ac0d)' : 'rgba(255,255,255,0.08)';
    btn.style.color = active ? '#1a1a2e' : '#888';
    btn.style.border = active ? 'none' : '1px solid rgba(255,255,255,0.15)';
  }
  applyToggleStyle(document.getElementById('side5-toggle'), s.sideBet5Active);
  applyToggleStyle(document.getElementById('side1-toggle'), s.sideBet1Active);

  document.getElementById('paytable-wrap').style.display = s.show21Table ? 'block' : 'none';

  // Side bet results
  const sideResultWrap = document.getElementById('side-result-wrap');
  if (s.phase === 'result' && anyActive) {
    let html = '';
    function sideResultHtml(res, betAmount, tier) {
      if (!res) return '';
      if (res.name) {
        const isJackpot = res.isJackpot;
        return `<div style="background:rgba(244,208,63,0.1);border:1px solid rgba(244,208,63,0.3);border-radius:8px;padding:8px 12px;margin-bottom:6px;${isJackpot ? 'animation:glow 1.5s ease infinite' : ''}">
          <div style="font-family:'Courier New',monospace;font-size:11px;color:#aaa;margin-bottom:2px">${tier}</div>
          <div style="font-family:'Courier New',monospace;font-size:12px;color:#f4d03f;font-weight:bold">${isJackpot ? '🎰 ¡JACKPOT! ' : ''}${res.name}</div>
          <div style="font-family:'Courier New',monospace;font-size:11px;color:#2ed573;margin-top:3px">+${res.amount.toLocaleString('es-ES', {minimumFractionDigits: res.amount % 1 ? 2 : 0})}€</div>
        </div>`;
      }
      return `<div style="font-family:'Courier New',monospace;font-size:11px;color:#e94560;margin-bottom:4px">${tier}: sin combinación — -${betAmount}€</div>`;
    }
    if (s.sideBet5Active && s.sideResult5) html += sideResultHtml(s.sideResult5, SIDE_BET_5, '€5 JACKPOT');
    if (s.sideBet1Active && s.sideResult1) html += sideResultHtml(s.sideResult1, SIDE_BET_1, '€1 JACKPOT');
    sideResultWrap.style.display = html ? 'block' : 'none';
    sideResultWrap.innerHTML = html ? `<div style="margin-top:10px;border-top:1px solid rgba(255,255,255,0.06);padding-top:10px">${html}</div>` : '';
  } else {
    sideResultWrap.style.display = 'none';
    sideResultWrap.innerHTML = '';
  }

  // Bet row
  const betLabel = document.getElementById('bet-label');
  let betHtml = s.currentBet + '€ ' + (s.currentBet > BASE_BET ? '<span id="bet-doubled">(doblada)</span>' : '');
  if (s.sideBet5Active) betHtml += ` <span id="bet-side">+${SIDE_BET_5}€ J5</span>`;
  if (s.sideBet1Active) betHtml += ` <span id="bet-side">+${SIDE_BET_1}€ J1</span>`;
  betLabel.innerHTML = betHtml;

  const splitInd = document.getElementById('split-indicator');
  splitInd.textContent = (s.isSplitGame && s.phase === 'playing') ? `✂️ MANO ${s.activeHandIdx + 1} DE ${s.hands.length}` : '';

  // Dealer cards
  const dealerCards = document.getElementById('dealer-cards');
  const dealerLabel = document.getElementById('dealer-label');
  dealerLabel.textContent = 'DEALER' + (s.phase === 'result' ? ` — ${handTotal(s.dealerHand)} pts` : '');
  renderCards(dealerCards, s.dealerHand, { hidden2nd: s.phase === 'playing' });

  // Player section
  const playerSection = document.getElementById('player-section');
  playerSection.innerHTML = '';

  if (s.phase === 'playing') {
    const label = document.createElement('div');
    label.className = 'section-label';
    let labelText = (s.isSplitGame ? `TU MANO ${s.activeHandIdx + 1}` : 'TU MANO') + ` — ${playerTotal} pts`;
    if (isSoft(activeCards) && playerTotal <= 21) labelText += ' <span style="color:#f4d03f">(blanda)</span>';
    if (activeHand.isAceSplit) labelText += ' <span style="color:#a29bfe">(split de Ases)</span>';
    label.innerHTML = labelText;
    playerSection.appendChild(label);

    const row = document.createElement('div');
    row.className = 'cards-row';
    activeCards.forEach(card => row.appendChild(makeCard(card, { active: true })));
    playerSection.appendChild(row);

    // Show completed split hands
    s.hands.forEach((h, i) => {
      if (i !== s.activeHandIdx && h.done) {
        const wrap = document.createElement('div');
        wrap.className = 'split-done-hand';
        const lbl = document.createElement('div');
        lbl.className = 'split-done-label';
        lbl.textContent = `MANO ${i + 1} (jugada) — ${handTotal(h.cards)} pts ${h.busted ? '💥' : ''}`;
        wrap.appendChild(lbl);
        const cr = document.createElement('div');
        cr.className = 'cards-row small';
        h.cards.forEach(card => cr.appendChild(makeCard(card, { small: true })));
        wrap.appendChild(cr);
        playerSection.appendChild(wrap);
      }
    });
  } else {
    // Result phase
    s.gameResults.forEach((r, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'result-hand-row';
      const meta = document.createElement('div');
      meta.className = 'result-hand-meta';
      const deltaColor = r.delta > 0 ? '#2ed573' : r.delta < 0 ? '#e94560' : '#888';
      meta.innerHTML = `<span>${s.gameResults.length > 1 ? `MANO ${i+1}` : 'TU MANO'} — ${r.total} pts</span>
        <span class="result-hand-outcome" style="color:${deltaColor}">${r.label} ${r.delta === 0 ? '±0€' : (r.delta > 0 ? '+' : '') + r.delta + '€'}</span>`;
      wrap.appendChild(meta);
      const cr = document.createElement('div');
      cr.className = 'cards-row' + (s.gameResults.length > 1 ? ' small' : '');
      r.cards.forEach(card => cr.appendChild(makeCard(card, { small: s.gameResults.length > 1 })));
      wrap.appendChild(cr);
      playerSection.appendChild(wrap);
    });
  }

  // Feedback badge
  const feedbackBadge = document.getElementById('feedback-badge');
  feedbackBadge.innerHTML = '';
  if (s.phase === 'playing' && s.firstActionDone) {
    const badge = document.createElement('div');
    badge.className = 'badge ' + (s.firstActionFeedback ? 'correct' : 'incorrect');
    badge.textContent = s.firstActionFeedback ? '✓ ¡Correcto!' : `✗ Debiste ${actionLabel(s.firstCorrectAct)}`;
    feedbackBadge.appendChild(badge);
  }

  // Action area
  const actionArea = document.getElementById('action-area');
  actionArea.innerHTML = '';

  if (s.phase === 'playing' && !activeHand.isAceSplit) {
    const row1 = document.createElement('div');
    row1.className = 'btn-row';
    const hitBtn = document.createElement('button');
    hitBtn.className = 'abtn hit';
    hitBtn.textContent = '🃏 PEDIR';
    hitBtn.onclick = handleHit;
    const standBtn = document.createElement('button');
    standBtn.className = 'abtn stand';
    standBtn.textContent = '✋ PLANTARSE';
    standBtn.onclick = handleStand;
    row1.appendChild(hitBtn);
    row1.appendChild(standBtn);
    actionArea.appendChild(row1);

    if (showDoubleBtn || showSplitBtn) {
      const row2 = document.createElement('div');
      row2.className = 'btn-row';
      if (showDoubleBtn) {
        const dblBtn = document.createElement('button');
        dblBtn.className = 'abtn double';
        dblBtn.textContent = `×2 DOBLAR (${BASE_BET * 2}€)`;
        dblBtn.onclick = handleDouble;
        row2.appendChild(dblBtn);
      }
      if (showSplitBtn) {
        const splBtn = document.createElement('button');
        splBtn.className = 'abtn split';
        splBtn.textContent = `✂️ DIVIDIR (${BASE_BET * 2}€)`;
        splBtn.onclick = handleSplit;
        row2.appendChild(splBtn);
      }
      actionArea.appendChild(row2);
    }

    const hint = document.createElement('div');
    hint.id = 'action-hint';
    hint.textContent = s.isSplitGame
      ? 'Doblar/dividir no disponible en manos divididas'
      : showSplitBtn && showDoubleBtn ? 'Par detectado — puedes doblar o dividir'
      : showSplitBtn ? 'Par detectado — puedes dividir'
      : 'Doblar/dividir solo en primeras 2 cartas';
    actionArea.appendChild(hint);
  }

  if (s.phase === 'result') {
    // Badge in result
    const badge = document.createElement('div');
    badge.className = 'badge ' + (s.firstActionFeedback ? 'correct' : 'incorrect');
    badge.style.marginBottom = '12px';
    badge.style.display = 'flex';
    badge.textContent = s.firstActionFeedback ? '✓ Estrategia correcta' : `✗ Debiste ${actionLabel(s.firstCorrectAct)}`;

    const resultHeader = document.createElement('div');
    resultHeader.id = 'result-header';
    const deltaColor = overallDelta > 0 ? '#2ed573' : overallDelta < 0 ? '#e94560' : '#888';
    const overallText = overallDelta > 0 ? '🏆 ¡Ganaste!' : overallDelta < 0 ? '😞 Perdiste' : '🤝 Empate';
    resultHeader.innerHTML = `<div id="result-label">${overallText}</div>
      <div id="result-delta" style="color:${deltaColor}">${overallDelta === 0 ? '±0€' : (overallDelta > 0 ? '+' : '') + overallDelta + '€'}</div>`;

    actionArea.appendChild(resultHeader);
    actionArea.appendChild(badge);

    if (s.balance <= 0) {
      const bustMsg = document.createElement('div');
      bustMsg.id = 'bust-msg';
      bustMsg.innerHTML = '<p>💸 ¡Sin saldo!</p>';
      const resetBtn = document.createElement('button');
      resetBtn.className = 'abtn reset';
      resetBtn.textContent = `REINICIAR CON ${STARTING_BALANCE}€ →`;
      resetBtn.onclick = () => {
        state.balance = STARTING_BALANCE;
        state.totalWagered = 0;
        state.totalProfit = 0;
        state.history = [];
        state.lastBetDelta = 0;
        startNewGame();
      };
      bustMsg.appendChild(resetBtn);
      actionArea.appendChild(bustMsg);
    } else {
      const newBtn = document.createElement('button');
      newBtn.className = 'abtn new-hand';
      newBtn.textContent = 'NUEVA MANO →';
      newBtn.onclick = startNewGame;
      actionArea.appendChild(newBtn);
    }
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Build paytable (two tiers)
  const ptWrap = document.getElementById('paytable-wrap');

  function buildTierTable(title, jackpotVal, bet, rows) {
    const header = document.createElement('div');
    header.style.cssText = 'font-family:Courier New,monospace;font-size:10px;color:#f4d03f;font-weight:bold;letter-spacing:2px;margin:8px 0 4px';
    header.textContent = `${title} — Jackpot: €${jackpotVal.toLocaleString('es-ES', {minimumFractionDigits: 2})}`;
    ptWrap.appendChild(header);

    rows.forEach(row => {
      const div = document.createElement('div');
      div.className = 'pt-row';
      div.innerHTML = `<span style="color:${row.jackpot ? '#f4d03f' : '#aaa'}">${row.hand}</span><span class="pt-pay">${row.pays}</span>`;
      ptWrap.appendChild(div);
    });

    const note = document.createElement('div');
    note.style.cssText = 'margin-bottom:4px;font-size:10px;color:#555;font-family:Courier New,monospace';
    note.textContent = `Apuesta: €${bet} por mano`;
    ptWrap.appendChild(note);
  }

  buildTierTable('€5 JACKPOT', JACKPOT_5, SIDE_BET_5, [
    { hand: '3 Ases, Reyes o Reinas (mismo palo)', pays: '100% Jackpot', jackpot: true },
    { hand: 'Three-of-a-Kind (mismo palo)', pays: '€625' },
    { hand: 'Straight Flush', pays: '€125' },
    { hand: 'Three-of-a-Kind', pays: '€100' },
    { hand: 'Straight', pays: '€30' },
    { hand: 'Flush', pays: '€10' },
  ]);

  const divider = document.createElement('div');
  divider.style.cssText = 'border-top:1px solid rgba(255,255,255,0.06);margin:6px 0';
  ptWrap.appendChild(divider);

  buildTierTable('€1 JACKPOT', JACKPOT_1, SIDE_BET_1, [
    { hand: '3 Jotas, 10s o 7s (mismo palo)', pays: '100% Jackpot', jackpot: true },
    { hand: 'Three-of-a-Kind (mismo palo)', pays: '€125' },
    { hand: 'Straight Flush', pays: '€25' },
    { hand: 'Three-of-a-Kind', pays: '€20' },
    { hand: 'Straight', pays: '€6' },
    { hand: 'Flush', pays: '€2' },
  ]);

  // Paytable toggle
  document.getElementById('paytable-btn').addEventListener('click', () => {
    state.show21Table = !state.show21Table;
    document.getElementById('paytable-btn').textContent = state.show21Table ? '▲ CERRAR' : 'PREMIOS';
    document.getElementById('paytable-wrap').style.display = state.show21Table ? 'block' : 'none';
  });

  // Side bet toggles (always enabled — effect on next hand)
  document.getElementById('side5-toggle').addEventListener('click', () => {
    state.sideBet5Active = !state.sideBet5Active;
    render();
  });
  document.getElementById('side1-toggle').addEventListener('click', () => {
    state.sideBet1Active = !state.sideBet1Active;
    render();
  });

  // History toggle
  document.getElementById('history-btn').addEventListener('click', () => {
    state.showHistory = !state.showHistory;
    render();
  });

  startNewGame();
});
