// ==========================================
// 1. STATE BUKU BESAR MURNI
// ==========================================
let appData = {
  allowance: 0,
  periodDays: 7,
  targets: [],
  activeTargetId: null,
  transactions: [],
  streakDays: 0,
  lastStreakDate: null,
  snakeHighScore: 0,
  brickHighScore: 0
};

let selectedFilterPeriod = 'daily';
let currentGame = 'snake';
let gameInterval = null;
let gameScore = 0;

// ==========================================
// 2. HELPER SANITASI MURNI & PARSING ANGKANOMINAL
// ==========================================
function formatRupiahInput(e) {
  let value = e.target.value.replace(/[^0-9]/g, '');
  if (value) {
    let numberVal = parseInt(value, 10);
    e.target.value = 'Rp ' + numberVal.toLocaleString('id-ID');
  } else {
    e.target.value = '';
  }
}

function parseRupiahValue(textValue) {
  if (!textValue) return 0;
  const cleanNumber = String(textValue).replace(/[^0-9]/g, '');
  return parseFloat(cleanNumber) || 0;
}

// ==========================================
// 3. INIT & EVENT LISTENERS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadData();
  registerEvents();
  initTabNavigation();
  initFilterEvents();
  initGameEvents();
  recalculateAll();
});

function initTheme() {
  const savedTheme = localStorage.getItem('sakuquest_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  const themeBtn = document.getElementById('themeToggleBtn');
  if (themeBtn) themeBtn.textContent = savedTheme === 'light' ? '☀️' : '🌙';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('sakuquest_theme', next);
  document.getElementById('themeToggleBtn').textContent = next === 'light' ? '☀️' : '🌙';
}

function loadData() {
  const saved = localStorage.getItem('sakuquest_data');
  if (saved) {
    try {
      appData = { ...appData, ...JSON.parse(saved) };
      if (!appData.targets) appData.targets = [];
      if (!appData.transactions) appData.transactions = [];
    } catch (e) {
      console.error('Data corrupt');
    }
  }
}

function saveData() {
  localStorage.setItem('sakuquest_data', JSON.stringify(appData));
  recalculateAll();
}

function initTabNavigation() {
  const tabs = [
    { btn: 'navHomeBtn', tab: 'tabHome' },
    { btn: 'navTxBtn', tab: 'tabTransaction' },
    { btn: 'navTargetBtn', tab: 'tabTarget' },
    { btn: 'navStatsBtn', tab: 'tabStats' },
    { btn: 'navGamesBtn', tab: 'tabGames' }
  ];

  tabs.forEach(t => {
    const btnEl = document.getElementById(t.btn);
    if (btnEl) {
      btnEl.addEventListener('click', () => {
        stopGameLoop();
        tabs.forEach(x => {
          document.getElementById(x.btn).classList.remove('active');
          document.getElementById(x.tab).classList.remove('active-tab');
        });
        btnEl.classList.add('active');
        document.getElementById(t.tab).classList.add('active-tab');
        
        if (t.tab === 'tabStats') renderAnalysis();
        if (t.tab === 'tabGames') resetGameScreen();
      });
    }
  });
}

function registerEvents() {
  document.getElementById('themeToggleBtn').onclick = toggleTheme;

  ['txAmount', 'allowanceInput', 'targetAmountInput'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', formatRupiahInput);
  });

  const txTypeSelect = document.getElementById('txType');
  const targetGroup = document.getElementById('targetAllocationGroup');
  txTypeSelect.addEventListener('change', () => {
    if (txTypeSelect.value === 'save') {
      targetGroup.classList.remove('hidden-field');
      populateTargetDropdown();
    } else {
      targetGroup.classList.add('hidden-field');
    }
  });

  document.getElementById('transactionForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const type = document.getElementById('txType').value;
    const title = document.getElementById('txTitle').value;
    const category = document.getElementById('txCategory').value;
    const amount = parseRupiahValue(document.getElementById('txAmount').value);
    const targetId = type === 'save' ? parseInt(document.getElementById('targetAllocationSelect').value, 10) : null;

    if (amount <= 0) return alert('Masukkan nominal angka di atas 0.');

    appData.transactions.unshift({
      id: Date.now(),
      type,
      title,
      category,
      amount,
      targetId,
      timestamp: Date.now(),
      date: new Date().toLocaleDateString('id-ID')
    });

    document.getElementById('txTitle').value = '';
    document.getElementById('txAmount').value = '';
    
    updateStreak();
    saveData();
    alert('✅ Transaksi berhasil dicatat!');
  });

  document.getElementById('targetForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('targetNameInput').value;
    const amount = parseRupiahValue(document.getElementById('targetAmountInput').value);

    if (amount <= 0) return alert('Nominal target harus lebih dari 0.');

    const newTarget = { id: Date.now(), name, amount };
    appData.targets.push(newTarget);
    if (!appData.activeTargetId) appData.activeTargetId = newTarget.id;

    document.getElementById('targetNameInput').value = '';
    document.getElementById('targetAmountInput').value = '';

    saveData();
    alert(`🎯 Target "${name}" berhasil ditambahkan!`);
  });

  document.getElementById('allowanceForm').addEventListener('submit', (e) => {
    e.preventDefault();
    appData.allowance = parseRupiahValue(document.getElementById('allowanceInput').value);
    appData.periodDays = parseInt(document.getElementById('periodSelect').value, 10) || 7;

    saveData();
    alert('💰 Anggaran uang saku berhasil disimpan!');
  });

  document.getElementById('resetDataBtn').addEventListener('click', () => {
    if (confirm('Apakah Anda yakin ingin menghapus seluruh data SakuQ?')) {
      localStorage.removeItem('sakuquest_data');
      location.reload();
    }
  });
}

function populateTargetDropdown() {
  const select = document.getElementById('targetAllocationSelect');
  if (appData.targets.length === 0) {
    select.innerHTML = '<option value="">(Belum Ada Target - Buat di Menu Target)</option>';
  } else {
    select.innerHTML = appData.targets.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
  }
}

// ==========================================
// 4. KALKULASI SALDO & STREAK
// ==========================================
function recalculateAll() {
  let income = 0;
  let expense = 0;
  let saved = 0;
  let withdrawn = 0;

  appData.transactions.forEach(tx => {
    if (tx.type === 'income') income += tx.amount;
    if (tx.type === 'expense') expense += tx.amount;
    if (tx.type === 'save') saved += tx.amount;
    if (tx.type === 'withdraw') withdrawn += tx.amount;
  });

  const availableBalance = (income + withdrawn) - (expense + saved);
  const totalSavings = saved - withdrawn;
  const totalNet = availableBalance + totalSavings;

  const today = new Date().toLocaleDateString('id-ID');
  const todaySpent = appData.transactions
    .filter(tx => tx.type === 'expense' && tx.date === today)
    .reduce((sum, tx) => sum + tx.amount, 0);

  const dailyBudget = Math.max(0, (appData.allowance / appData.periodDays) - todaySpent);

  document.getElementById('availableBalanceDisplay').textContent = `Rp ${Math.max(0, availableBalance).toLocaleString('id-ID')}`;
  document.getElementById('totalSavingsDisplay').textContent = `Rp ${Math.max(0, totalSavings).toLocaleString('id-ID')}`;
  document.getElementById('totalNetDisplay').textContent = `Rp ${Math.max(0, totalNet).toLocaleString('id-ID')}`;
  document.getElementById('dailyBudgetDisplay').textContent = `Rp ${Math.round(dailyBudget).toLocaleString('id-ID')}`;
  document.getElementById('streakCount').textContent = appData.streakDays;

  renderTargets(totalSavings);
  renderHistoryLists();
}

function updateStreak() {
  const today = new Date().toLocaleDateString('id-ID');
  if (appData.lastStreakDate !== today) {
    appData.streakDays += 1;
    appData.lastStreakDate = today;
  }
}

// ==========================================
// 5. RENDER TARGETS & TRANSAKSI
// ==========================================
function renderTargets(globalSavings) {
  const activeTarget = appData.targets.find(t => t.id === appData.activeTargetId) || appData.targets[0] || null;

  if (activeTarget) {
    const targetSavings = appData.transactions
      .filter(tx => tx.type === 'save' && tx.targetId === activeTarget.id)
      .reduce((sum, tx) => sum + tx.amount, 0);

    const percent = Math.min(100, Math.round((targetSavings / activeTarget.amount) * 100));

    document.getElementById('activeTargetName').textContent = activeTarget.name;
    document.getElementById('activeTargetProgressPercent').textContent = `${percent}%`;
    document.getElementById('activeTargetProgressBar').style.width = `${percent}%`;
    document.getElementById('activeTargetAmountText').textContent = `Rp ${targetSavings.toLocaleString('id-ID')} / Rp ${activeTarget.amount.toLocaleString('id-ID')}`;
  } else {
    document.getElementById('activeTargetName').textContent = 'Belum Ada Target';
    document.getElementById('activeTargetProgressPercent').textContent = '0%';
    document.getElementById('activeTargetProgressBar').style.width = '0%';
    document.getElementById('activeTargetAmountText').textContent = 'Rp 0 / Rp 0';
  }

  const container = document.getElementById('targetListContainer');
  if (container) {
    if (appData.targets.length === 0) {
      container.innerHTML = '<div class="empty-msg">Belum ada target dibuat.</div>';
    } else {
      container.innerHTML = appData.targets.map(t => {
        const tSavings = appData.transactions
          .filter(tx => tx.type === 'save' && tx.targetId === t.id)
          .reduce((sum, tx) => sum + tx.amount, 0);
        const percent = Math.min(100, Math.round((tSavings / t.amount) * 100));
        const isActive = activeTarget && activeTarget.id === t.id;

        return `
          <div class="target-item-card ${isActive ? 'active-target' : ''}">
            <div class="target-item-header">
              <strong>${t.name} ${isActive ? '⭐ (Aktif)' : ''}</strong>
              <small>Rp ${tSavings.toLocaleString('id-ID')} / Rp ${t.amount.toLocaleString('id-ID')} (${percent}%)</small>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width: ${percent}%;"></div>
            </div>
            <div class="target-actions-btn">
              ${!isActive ? `<button onclick="selectTarget(${t.id})" class="btn-small btn-select">Set Aktif</button>` : ''}
              <button onclick="deleteTarget(${t.id})" class="btn-small btn-delete">Hapus</button>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

function renderHistoryLists() {
  const formatItem = (tx) => {
    const sign = tx.type === 'income' || tx.type === 'withdraw' ? '+' : '-';
    const color = sign === '+' ? 'var(--accent)' : 'var(--danger)';
    return `
      <li class="history-item">
        <span>${tx.title} <small>(${tx.category || 'Umum'})</small></span>
        <strong style="color:${color}">${sign} Rp ${tx.amount.toLocaleString('id-ID')}</strong>
      </li>
    `;
  };

  const recentList = document.getElementById('recentHistoryList');
  if (recentList) {
    recentList.innerHTML = appData.transactions.length === 0 
      ? '<li class="empty-msg">Belum ada transaksi.</li>' 
      : appData.transactions.slice(0, 4).map(formatItem).join('');
  }

  const fullList = document.getElementById('fullHistoryList');
  if (fullList) {
    fullList.innerHTML = appData.transactions.length === 0 
      ? '<li class="empty-msg">Belum ada transaksi.</li>' 
      : appData.transactions.map(formatItem).join('');
  }
}

function selectTarget(id) {
  appData.activeTargetId = id;
  saveData();
}

function deleteTarget(id) {
  if (confirm('Hapus target ini?')) {
    appData.targets = appData.targets.filter(t => t.id !== id);
    if (appData.activeTargetId === id) appData.activeTargetId = null;
    saveData();
  }
}

// ==========================================
// 6. ANALISIS PERIODE
// ==========================================
function initFilterEvents() {
  const btns = document.querySelectorAll('.filter-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      btns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      selectedFilterPeriod = e.target.dataset.period;
      renderAnalysis();
    });
  });
}

function renderAnalysis() {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  const filtered = appData.transactions.filter(tx => {
    if (tx.type !== 'expense') return false;
    if (selectedFilterPeriod === 'daily') return tx.date === new Date().toLocaleDateString('id-ID');
    if (selectedFilterPeriod === 'weekly') return (now - tx.timestamp) <= (7 * oneDay);
    if (selectedFilterPeriod === 'monthly') return (now - tx.timestamp) <= (30 * oneDay);
    return true;
  });

  const categories = {
    'Makanan': { label: '🍔 Makanan', total: 0, color: '#ef4444' },
    'Transportasi': { label: '🚌 Transportasi', total: 0, color: '#f59e0b' },
    'Hiburan': { label: '🎮 Hiburan', total: 0, color: '#6366f1' },
    'Pendidikan': { label: '📚 Pendidikan', total: 0, color: '#10b981' },
    'Umum': { label: '📦 Lainnya', total: 0, color: '#94a3b8' }
  };

  let grandTotal = 0;
  filtered.forEach(tx => {
    const cat = tx.category || 'Umum';
    if (categories[cat]) {
      categories[cat].total += tx.amount;
      grandTotal += tx.amount;
    }
  });

  drawPieChart(categories, grandTotal);

  const container = document.getElementById('categoryBreakdown');
  if (grandTotal === 0) {
    container.innerHTML = '<div class="empty-msg">Belum ada pengeluaran pada periode ini.</div>';
    return;
  }

  container.innerHTML = Object.keys(categories).map(k => {
    const item = categories[k];
    const percent = Math.round((item.total / grandTotal) * 100) || 0;
    return `
      <div class="category-row">
        <span>${item.label} (${percent}%)</span>
        <strong>Rp ${item.total.toLocaleString('id-ID')}</strong>
      </div>
    `;
  }).join('');
}

function drawPieChart(categories, grandTotal) {
  const canvas = document.getElementById('categoryPieChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (grandTotal === 0) {
    ctx.beginPath();
    ctx.arc(100, 100, 70, 0, 2 * Math.PI);
    ctx.fillStyle = '#334155';
    ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText('Tidak ada data', 100, 104);
    return;
  }

  let startAngle = 0;
  Object.keys(categories).forEach(k => {
    const item = categories[k];
    if (item.total > 0) {
      const sliceAngle = (item.total / grandTotal) * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(100, 100);
      ctx.arc(100, 100, 70, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = item.color;
      ctx.fill();
      startAngle += sliceAngle;
    }
  });
}

// ==========================================
// 7. MINI GAMES RETRO 
// ==========================================
let snake = [];
let snakeDir = 'RIGHT';
let food = { x: 0, y: 0 };
let paddleX = 110;
let ball = { x: 150, y: 240, dx: 3, dy: -3 };
let bricks = [];

function initGameEvents() {
  const selectSnakeBtn = document.getElementById('selectSnakeBtn');
  const selectBrickBtn = document.getElementById('selectBrickBtn');

  if (selectSnakeBtn) {
    selectSnakeBtn.onclick = () => {
      currentGame = 'snake';
      selectSnakeBtn.classList.add('active');
      if (selectBrickBtn) selectBrickBtn.classList.remove('active');
      resetGameScreen();
    };
  }

  if (selectBrickBtn) {
    selectBrickBtn.onclick = () => {
      currentGame = 'brick';
      selectBrickBtn.classList.add('active');
      if (selectSnakeBtn) selectSnakeBtn.classList.remove('active');
      resetGameScreen();
    };
  }

  const startBtn = document.getElementById('startGameBtn');
  if (startBtn) {
    startBtn.onclick = () => {
      if (currentGame === 'snake') startSnakeGame();
      else startBrickGame();
    };
  }

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (currentGame === 'snake') {
      if ((k === 'w' || k === 'arrowup') && snakeDir !== 'DOWN') snakeDir = 'UP';
      if ((k === 's' || k === 'arrowdown') && snakeDir !== 'UP') snakeDir = 'DOWN';
      if ((k === 'a' || k === 'arrowleft') && snakeDir !== 'RIGHT') snakeDir = 'LEFT';
      if ((k === 'd' || k === 'arrowright') && snakeDir !== 'LEFT') snakeDir = 'RIGHT';
    } else if (currentGame === 'brick') {
      if (k === 'a' || k === 'arrowleft') paddleX = Math.max(0, paddleX - 20);
      if (k === 'd' || k === 'arrowright') paddleX = Math.min(220, paddleX + 20); // 300px - 80px = 220px
    }
  });

  const btnUp = document.getElementById('btnUp');
  const btnDown = document.getElementById('btnDown');
  const btnLeft = document.getElementById('btnLeft');
  const btnRight = document.getElementById('btnRight');

  if (btnUp) btnUp.onclick = () => { if (snakeDir !== 'DOWN') snakeDir = 'UP'; };
  if (btnDown) btnDown.onclick = () => { if (snakeDir !== 'UP') snakeDir = 'DOWN'; };
  if (btnLeft) btnLeft.onclick = () => {
    if (currentGame === 'snake' && snakeDir !== 'RIGHT') snakeDir = 'LEFT';
    if (currentGame === 'brick') paddleX = Math.max(0, paddleX - 25);
  };
  if (btnRight) btnRight.onclick = () => {
    if (currentGame === 'snake' && snakeDir !== 'LEFT') snakeDir = 'RIGHT';
    if (currentGame === 'brick') paddleX = Math.min(220, paddleX + 25);
  };
}

function stopGameLoop() {
  if (gameInterval) clearInterval(gameInterval);
}

// Fungsi pembantu untuk mengunci ukuran internal Canvas
function fixCanvasSize() {
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return null;
  canvas.width = 300;
  canvas.height = 300;
  return canvas;
}

function resetGameScreen() {
  stopGameLoop();
  const canvas = fixCanvasSize();
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#9bbc0f';
  ctx.fillRect(0, 0, 300, 300);
  
  gameScore = 0;
  document.getElementById('gameScore').textContent = '0';
  document.getElementById('gameHighScore').textContent = currentGame === 'snake' ? appData.snakeHighScore : appData.brickHighScore;
}

// GAME 1: SNAKE KLASIK
// Variable penampung arah agar tidak berbalik instant
let nextSnakeDir = 'RIGHT';

// 1. Definisikan fungsi spawn makanan di atas sebelum dipanggil
function spawnSnakeFood() {
  food = {
    x: Math.floor(Math.random() * 20),
    y: Math.floor(Math.random() * 20)
  };
}

// 2. Fungsi Utama Game Snake
function startSnakeGame() {
  stopGameLoop(); // Hentikan loop game sebelumnya
  const canvas = fixCanvasSize();
  if (!canvas) return;

  // Inisialisasi Ular & Arah
  snake = [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }];
  snakeDir = 'RIGHT';
  nextSnakeDir = 'RIGHT';
  gameScore = 0;
  
  // Buat makanan pertama
  spawnSnakeFood();

  // Jalankan interval pergerakan ular
  gameInterval = setInterval(() => {
    // Terapkan arah baru dari buffer
    snakeDir = nextSnakeDir;

    const head = { ...snake[0] };
    if (snakeDir === 'UP') head.y -= 1;
    if (snakeDir === 'DOWN') head.y += 1;
    if (snakeDir === 'LEFT') head.x -= 1;
    if (snakeDir === 'RIGHT') head.x += 1;

    // Deteksi Tabrakan Tembok (Grid 0-19) atau Menabrak Ekor Sendiri
    if (head.x < 0 || head.x >= 20 || head.y < 0 || head.y >= 20 || snake.some(s => s.x === head.x && s.y === head.y)) {
      stopGameLoop();
      alert(`GAME OVER! Skor: ${gameScore}`);
      if (gameScore > appData.snakeHighScore) {
        appData.snakeHighScore = gameScore;
        saveData();
      }
      return;
    }

    snake.unshift(head);

    // Memakan Makanan
    if (head.x === food.x && head.y === food.y) {
      gameScore += 10;
      document.getElementById('gameScore').textContent = gameScore;
      spawnSnakeFood();
    } else {
      snake.pop();
    }

    // Render Ular & Makanan di Canvas
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#9bbc0f';
    ctx.fillRect(0, 0, 300, 300);

    ctx.fillStyle = '#0f380f';
    snake.forEach(s => ctx.fillRect(s.x * 15, s.y * 15, 14, 14));

    ctx.fillStyle = '#8b0000';
    ctx.fillRect(food.x * 15, food.y * 15, 14, 14);
  }, 120);
}
// GAME 2: BRICK BREAKER
function startBrickGame() {
  stopGameLoop();
  const canvas = fixCanvasSize();

  paddleX = 110;
  
  const randomDx = (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 1.5);
  ball = { x: paddleX + 40, y: 250, dx: randomDx, dy: -3.5 };
  gameScore = 0;

  bricks = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 6; c++) {
      bricks.push({ x: c * 48 + 6, y: r * 18 + 20, alive: true });
    }
  }

  gameInterval = setInterval(() => {
    ball.x += ball.dx;
    ball.y += ball.dy;

    // Pantulan Tembok Kiri (0px) & Kanan Presisi (295px)
    if (ball.x <= 5) {
      ball.dx = Math.abs(ball.dx);
      ball.x = 5;
    } else if (ball.x >= 295) {
      ball.dx = -Math.abs(ball.dx);
      ball.x = 295;
    }

    // Pantulan Tembok Atas
    if (ball.y <= 5) {
      ball.dy = Math.abs(ball.dy);
      ball.y = 5;
    }

    // Pantulan Paddle
    if (ball.y >= 260 && ball.y <= 270 && ball.x >= paddleX && ball.x <= paddleX + 80) {
      ball.dy = -Math.abs(ball.dy);
      const hitPoint = (ball.x - (paddleX + 40)) / 40;
      ball.dx = hitPoint * 4;
    }

    // Jatuh ke Bawah Layar
    if (ball.y > 295) {
      stopGameLoop();
      alert(`GAME OVER! Skor: ${gameScore}`);
      if (gameScore > appData.brickHighScore) {
        appData.brickHighScore = gameScore;
        saveData();
      }
      return;
    }

    // Benturan Bata
    bricks.forEach(b => {
      if (b.alive && ball.x >= b.x && ball.x <= b.x + 44 && ball.y >= b.y && ball.y <= b.y + 14) {
        b.alive = false;
        ball.dy *= -1;
        gameScore += 10;
        document.getElementById('gameScore').textContent = gameScore;
      }
    });

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#9bbc0f';
    ctx.fillRect(0, 0, 300, 300);

    ctx.fillStyle = '#0f380f';
    ctx.fillRect(paddleX, 265, 80, 10);

    ctx.beginPath();
    ctx.arc(ball.x, ball.y, 5, 0, Math.PI * 2);
    ctx.fill();

    bricks.forEach(b => {
      if (b.alive) ctx.fillRect(b.x, b.y, 44, 14);
    });
  }, 20);
}
