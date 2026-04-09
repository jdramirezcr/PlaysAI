const DIFFICULTY_MAP = { '3x3x2': 'easy', '5x5x4': 'medium', '8x8x10': 'hard' };

let rows, cols, totalMines;
let board, revealed, flagged, gameOver, firstClick;
let leftClickCount = 0;

function newGame() {
  const [r, c, m] = document.getElementById('difficulty').value.split('x').map(Number);
  rows = r; cols = c; totalMines = m;

  board    = Array.from({ length: rows }, () => Array(cols).fill(0));
  revealed = Array.from({ length: rows }, () => Array(cols).fill(false));
  flagged  = Array.from({ length: rows }, () => Array(cols).fill(false));
  gameOver    = false;
  firstClick  = true;
  leftClickCount = 0;

  document.getElementById('status').textContent = '';
  document.getElementById('totalMines').textContent = totalMines;
  document.getElementById('flags').textContent = 0;
  renderBoard();
}

function placeMines(safeR, safeC) {
  let available = 0;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (!(Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1))
        available++;
  const useFullZone = available >= totalMines;

  let placed = 0;
  while (placed < totalMines) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    if (board[r][c] === -1) continue;
    if (useFullZone && Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;
    if (!useFullZone && r === safeR && c === safeC) continue;
    board[r][c] = -1;
    placed++;
  }
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (board[r][c] !== -1)
        board[r][c] = countAdjMines(r, c);
}

function countAdjMines(r, c) {
  let count = 0;
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc] === -1)
        count++;
    }
  return count;
}

function reveal(r, c) {
  if (r < 0 || r >= rows || c < 0 || c >= cols) return;
  if (revealed[r][c] || flagged[r][c]) return;
  revealed[r][c] = true;
  if (board[r][c] === 0)
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++)
        reveal(r + dr, c + dc);
}

function handleClick(r, c) {
  if (gameOver || revealed[r][c] || flagged[r][c]) return;
  leftClickCount++;
  if (firstClick) { placeMines(r, c); firstClick = false; }
  if (board[r][c] === -1) {
    revealed[r][c] = true;
    gameOver = true;
    revealAllMines();
    document.getElementById('status').textContent = '💥 ¡Boom! ¡Perdiste!';
    document.getElementById('status').style.color = '#e94560';
    renderBoard();
    return;
  }
  reveal(r, c);
  renderBoard();
  checkWin();
}

function handleRightClick(e, r, c) {
  e.preventDefault();
  if (gameOver || revealed[r][c]) return;
  flagged[r][c] = !flagged[r][c];
  const total = flagged.flat().filter(Boolean).length;
  document.getElementById('flags').textContent = total;
  renderBoard();
}

function revealAllMines() {
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (board[r][c] === -1) revealed[r][c] = true;
}

function checkWin() {
  const safe = rows * cols - totalMines;
  let count = 0;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (board[r][c] !== -1 && (revealed[r][c] || flagged[r][c]))
        count++;
  if (count === safe) {
    gameOver = true;
    document.getElementById('status').textContent = '🎉 ¡Ganaste!';
    document.getElementById('status').style.color = '#81c784';
    showWinModal();
  }
}

function showWinModal() {
  const difficulty = DIFFICULTY_MAP[document.getElementById('difficulty').value];
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2>🎉 ¡Ganaste!</h2>
      <p>Clicks: <strong>${leftClickCount}</strong> — Dificultad: <strong>${difficulty}</strong></p>
      <input type="text" id="playerName" placeholder="Tu nombre (opcional)" maxlength="30" />
      <div class="modal-actions">
        <button class="btn-submit" onclick="submitScore('${difficulty}')">Guardar puntaje</button>
        <button class="btn-skip" onclick="closeModal()">Omitir</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function closeModal() {
  const overlay = document.querySelector('.modal-overlay');
  if (overlay) overlay.remove();
}

async function submitScore(difficulty) {
  const playerName = document.getElementById('playerName').value.trim() || 'Anonymous';
  try {
    await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName, difficulty, clickCount: leftClickCount }),
    });
    closeModal();
    loadLeaderboard(difficulty);
  } catch (err) {
    console.error('Error guardando puntaje:', err);
    closeModal();
  }
}

async function loadLeaderboard(difficulty) {
  try {
    const res = await fetch(`/api/scores?difficulty=${difficulty}`);
    const data = await res.json();
    renderLeaderboard(data.scores);
  } catch (err) {
    console.error('Error cargando leaderboard:', err);
  }
}

function renderLeaderboard(scores) {
  const tbody = document.getElementById('leaderboard-body');
  if (!tbody) return;
  if (!scores || scores.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="empty">Sin puntajes aún</td></tr>';
    return;
  }
  tbody.innerHTML = scores
    .map((s, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(s.player_name)}</td>
        <td>${s.click_count}</td>
      </tr>
    `)
    .join('');
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function switchTab(difficulty) {
  document.querySelectorAll('.leaderboard-tabs button').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  loadLeaderboard(difficulty);
}

function renderBoard() {
  const boardEl = document.getElementById('board');
  boardEl.style.gridTemplateColumns = `repeat(${cols}, 60px)`;
  boardEl.innerHTML = '';

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('button');
      cell.className = 'cell';

      if (revealed[r][c]) {
        cell.classList.add('revealed');
        if (board[r][c] === -1) {
          cell.classList.add('mine');
          cell.textContent = '💣';
        } else if (board[r][c] > 0) {
          cell.textContent = board[r][c];
          cell.setAttribute('data-n', board[r][c]);
        }
      } else if (flagged[r][c]) {
        cell.classList.add('flagged');
        cell.textContent = '🚩';
      }

      cell.addEventListener('click', () => handleClick(r, c));
      cell.addEventListener('contextmenu', (e) => handleRightClick(e, r, c));
      boardEl.appendChild(cell);
    }
  }
}

// Init
const initialDifficulty = DIFFICULTY_MAP[document.getElementById('difficulty').value] || 'easy';
loadLeaderboard(initialDifficulty);
newGame();
