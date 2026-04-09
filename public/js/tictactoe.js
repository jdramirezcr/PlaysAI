const WINS = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

let board, current, gameOver, mode;
let scores = { X: 0, O: 0, D: 0 };

function setMode(m) {
  mode = m;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  newGame();
}

function newGame() {
  board = Array(9).fill('');
  current = 'X';
  gameOver = false;
  document.getElementById('status').textContent = `Turno de ${current}`;
  document.getElementById('status').style.color = '#f0a500';
  renderBoard();
}

function handleClick(i) {
  if (gameOver || board[i]) return;
  play(i);
  if (!gameOver && mode === 'cpu' && current === 'O') {
    setTimeout(cpuMove, 350);
  }
}

function play(i) {
  board[i] = current;
  const winner = checkWin();
  if (winner) {
    gameOver = true;
    scores[current]++;
    updateScore();
    renderBoard(winner);
    document.getElementById('status').textContent = `¡${current} gana!`;
    document.getElementById('status').style.color = current === 'X' ? '#e94560' : '#4fc3f7';
    return;
  }
  if (board.every(c => c)) {
    gameOver = true;
    scores.D++;
    updateScore();
    renderBoard();
    document.getElementById('status').textContent = '¡Empate!';
    document.getElementById('status').style.color = '#aaa';
    return;
  }
  current = current === 'X' ? 'O' : 'X';
  document.getElementById('status').textContent = `Turno de ${current}`;
  document.getElementById('status').style.color = current === 'X' ? '#e94560' : '#4fc3f7';
  renderBoard();
}

function checkWin() {
  return WINS.find(([a,b,c]) => board[a] && board[a] === board[b] && board[b] === board[c]) || null;
}

function cpuMove() {
  if (gameOver) return;
  const i = bestMove();
  play(i);
}

function bestMove() {
  for (const [a,b,c] of WINS) {
    if (board[a]==='O' && board[b]==='O' && !board[c]) return c;
    if (board[a]==='O' && !board[b] && board[c]==='O') return b;
    if (!board[a] && board[b]==='O' && board[c]==='O') return a;
  }
  for (const [a,b,c] of WINS) {
    if (board[a]==='X' && board[b]==='X' && !board[c]) return c;
    if (board[a]==='X' && !board[b] && board[c]==='X') return b;
    if (!board[a] && board[b]==='X' && board[c]==='X') return a;
  }
  const pref = [4, 0, 2, 6, 8, 1, 3, 5, 7];
  return pref.find(i => !board[i]);
}

function updateScore() {
  document.getElementById('scoreX').textContent = scores.X;
  document.getElementById('scoreO').textContent = scores.O;
  document.getElementById('scoreDraw').textContent = scores.D;
}

function renderBoard(winLine = null) {
  const el = document.getElementById('board');
  el.innerHTML = '';
  board.forEach((val, i) => {
    const cell = document.createElement('div');
    cell.className = 'cell' + (val ? ' taken' : '') + (val === 'X' ? ' x' : val === 'O' ? ' o' : '');
    if (winLine && winLine.includes(i)) cell.classList.add('win');
    cell.textContent = val === 'X' ? '✕' : val === 'O' ? '○' : '';
    cell.addEventListener('click', () => handleClick(i));
    el.appendChild(cell);
  });
}

mode = 'pvp';
newGame();
