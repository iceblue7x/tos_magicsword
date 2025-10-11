
(function () {
    const GRID_SIZE = 6;
    const COLORS = 5;
    const MAX_LEVEL = 5;

    /** @type {{color:number, level:number}[][]} */
    let grid = [];
    let selectedBall = null; // { row, col } | null
    let isProcessing = false;
    let moveCount = 0;
    let level5Count = [0, 0, 0, 0, 0];
    let dragState = null; // active drag metadata
    const DRAG_THRESHOLD_PX = 24;
    let isEditMode = false;
    let editSelection = { color: 1, level: 1 };
    let uiInitialized = false;
    let modeSwitchInput = null;
    let ballPickerElement = null;
    let colorOptionButtons = [];
    let levelSelect = null;

    const colorSchemes = [
        ["#", "#", "#", "#", "#"], // 佔位，實際用漸層字串（陣列索引 0 不使用）
        [
            "linear-gradient(135deg, #89CFF0, #4A90E2)",
            "linear-gradient(135deg, #6BB6D9, #3A7FC2)",
            "linear-gradient(135deg, #4D9DC2, #2A6EA2)",
            "linear-gradient(135deg, #3084AB, #1A5D82)",
            "linear-gradient(135deg, #1F6B8C, #0A4C62)"
        ],
        [
            "linear-gradient(135deg, #FF6B6B, #C92A2A)",
            "linear-gradient(135deg, #E85555, #B31F1F)",
            "linear-gradient(135deg, #D14040, #9D1515)",
            "linear-gradient(135deg, #BA2B2B, #870A0A)",
            "linear-gradient(135deg, #A31616, #710000)"
        ],
        [
            "linear-gradient(135deg, #51CF66, #37B24D)",
            "linear-gradient(135deg, #3FB950, #2A9C3A)",
            "linear-gradient(135deg, #2DA33A, #1D8627)",
            "linear-gradient(135deg, #1B8D24, #107014)",
            "linear-gradient(135deg, #09770E, #005A01)"
        ],
        [
            "linear-gradient(135deg, #FFD43B, #F59F00)",
            "linear-gradient(135deg, #E9BE25, #DF8900)",
            "linear-gradient(135deg, #D3A80F, #C97300)",
            "linear-gradient(135deg, #BD9200, #B35D00)",
            "linear-gradient(135deg, #A77C00, #9D4700)"
        ],
        [
            "linear-gradient(135deg, #B197FC, #7950F2)",
            "linear-gradient(135deg, #9B7FE6, #6340D6)",
            "linear-gradient(135deg, #8567D0, #4D30BA)",
            "linear-gradient(135deg, #6F4FBA, #37209E)",
            "linear-gradient(135deg, #5937A4, #211082)"
        ],
    ];

    function getBallColor(color, level) {
        const idx = Math.min(level - 1, MAX_LEVEL - 1);
        return colorSchemes[color][idx];
    }

    // ===== 產生初始盤面（避免一開始就有可合併） =====
    function hasMatchingCombination(testGrid) {
        // 橫向 3 連
        for (let row = 0; row < GRID_SIZE; row++) {
            for (let col = 0; col < GRID_SIZE - 2; col++) {
                const a = testGrid[row][col];
                const b = testGrid[row][col + 1];
                const c = testGrid[row][col + 2];

                if (
                    a && b && c &&
                    a.color === b.color &&
                    a.color === c.color &&
                    a.level === b.level &&
                    a.level === c.level
                ) {
                    return true;
                }
            }
        }

        // 直向 3 連
        for (let col = 0; col < GRID_SIZE; col++) {
            for (let row = 0; row < GRID_SIZE - 2; row++) {
                const a = testGrid[row][col];
                const b = testGrid[row + 1][col];
                const c = testGrid[row + 2][col];

                if (
                    a && b && c &&
                    a.color === b.color &&
                    a.color === c.color &&
                    a.level === b.level &&
                    a.level === c.level
                ) {
                    return true;
                }
            }
        }

        return false;
    }

    function generateValidGrid() {
        let attempts = 0;
        const maxAttempts = 120;

        while (attempts < maxAttempts) {
            const t = [];

            for (let i = 0; i < GRID_SIZE; i++) {
                t[i] = [];
                for (let j = 0; j < GRID_SIZE; j++) {
                    t[i][j] = {
                        color: 1 + Math.floor(Math.random() * COLORS),
                        level: 1
                    };
                }
            }

            if (!hasMatchingCombination(t)) {
                return t;
            }

            attempts++;
        }

        // 若嘗試多次仍無法避免 3 連，改採逐格嘗試法
        const t = [];
        for (let i = 0; i < GRID_SIZE; i++) {
            t[i] = [];
            for (let j = 0; j < GRID_SIZE; j++) {
                let ok = false;
                let tries = 0;

                while (!ok && tries < 20) {
                    const color = 1 + Math.floor(Math.random() * COLORS);
                    t[i][j] = { color, level: 1 };

                    let match = false;
                    if (j >= 2) {
                        const a = t[i][j - 1];
                        const b = t[i][j - 2];
                        if (a && b && a.color === color && b.color === color) {
                            match = true;
                        }
                    }
                    if (i >= 2) {
                        const a = t[i - 1][j];
                        const b = t[i - 2][j];
                        if (a && b && a.color === color && b.color === color) {
                            match = true;
                        }
                    }

                    ok = !match;
                    tries++;
                }
            }
        }
        return t;
    }

    // ===== 初始化與 UI 更新 =====
    function initGame() {
        grid = generateValidGrid();
        moveCount = 0;
        level5Count = [0, 0, 0, 0, 0];
        selectedBall = null;
        if (!uiInitialized) {
            initializeUI();
            uiInitialized = true;
        }
        updateModeUI();
        updateStats();
        renderGrid();
    }

    function initializeUI() {
        modeSwitchInput = document.querySelector(".switch-container .switch input[type='checkbox']");
        ballPickerElement = document.querySelector(".ball-picker");

        if (modeSwitchInput) {
            modeSwitchInput.addEventListener("change", () => {
                if (isProcessing) {
                    modeSwitchInput.checked = isEditMode;
                    return;
                }
                setEditMode(modeSwitchInput.checked);
            });
        }

        setupColorPicker();
        updateModeUI();
    }

    function setupColorPicker() {
        if (!ballPickerElement) return;

        const indicators = ballPickerElement.querySelectorAll(".color-indicator");
        colorOptionButtons = [];
        indicators.forEach((indicator, index) => {
            const parentCounter = indicator.closest(".color-counter");
            if (!parentCounter) return;
            const colorIndex = index + 1;
            parentCounter.dataset.color = String(colorIndex);
            parentCounter.addEventListener("click", () => {
                setEditColor(colorIndex);
            });
            colorOptionButtons.push(parentCounter);
        });

        levelSelect = ballPickerElement.querySelector(".ball-level");
        if (levelSelect) {
            levelSelect.addEventListener("change", () => {
                const rawValue = levelSelect.value || levelSelect.options[levelSelect.selectedIndex]?.textContent || "";
                const nextLevel = Number(rawValue);
                if (!Number.isNaN(nextLevel)) {
                    setEditLevel(nextLevel);
                }
            });
        }

        setEditColor(editSelection.color);
        setEditLevel(editSelection.level);
    }

    function setEditMode(enabled) {
        if (isEditMode === enabled) {
            updateModeUI();
            return;
        }
        isEditMode = enabled;
        if (modeSwitchInput && modeSwitchInput.checked !== enabled) {
            modeSwitchInput.checked = enabled;
        }
        selectedBall = null;
        dragState = null;
        isProcessing = false;
        updateModeUI();
        renderGrid();
    }

    function updateModeUI() {
        if (modeSwitchInput) {
            modeSwitchInput.checked = isEditMode;
        }
        if (ballPickerElement) {
            ballPickerElement.style.display = isEditMode ? "" : "none";
        }
    }

    function applyEditorSelection(row, col) {
        if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return;
        isProcessing = false;
        grid[row][col] = { color: editSelection.color, level: editSelection.level };
        selectedBall = null;
        dragState = null;
        recalculateLevel5Count();
        updateStats();
        renderGrid();
    }

    function recalculateLevel5Count() {
        level5Count = [0, 0, 0, 0, 0];
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                const cell = grid[r][c];
                if (cell && cell.level === MAX_LEVEL) {
                    const idx = Math.max(0, Math.min(COLORS - 1, (cell.color || 1) - 1));
                    level5Count[idx] = (level5Count[idx] || 0) + 1;
                }
            }
        }
    }

    function setEditColor(color) {
        if (typeof color !== "number" || color < 1 || color > COLORS) return;
        editSelection = { ...editSelection, color };
        colorOptionButtons.forEach((btn) => {
            const btnColor = Number(btn.dataset.color);
            btn.classList.toggle("active", btnColor === color);
        });
    }

    function setEditLevel(level) {
        if (typeof level !== "number" || Number.isNaN(level)) return;
        const clamped = Math.min(Math.max(1, level), MAX_LEVEL);
        editSelection = { ...editSelection, level: clamped };
        if (levelSelect && Number(levelSelect.value) !== clamped) {
            levelSelect.value = String(clamped);
        }
    }

    function updateStats() {
        document.getElementById("move-count").textContent = String(moveCount);
        for (let i = 0; i < COLORS; i++) {
            document.getElementById(`count-${i}`).textContent = String(level5Count[i]);
        }
    }

    function renderGrid() {
        const gridElement = document.getElementById("grid");
        gridElement.innerHTML = "";

        updateOuterZones();

        for (let i = 0; i < GRID_SIZE; i++) {
            for (let j = 0; j < GRID_SIZE; j++) {
                const cell = document.createElement("div");
                cell.className = "cell";
                cell.dataset.row = String(i);
                cell.dataset.col = String(j);

                const val = grid[i][j];
                if (val) {
                    const ball = document.createElement("div");
                    ball.className = "ball";
                    ball.style.background = getBallColor(val.color, val.level);
                    ball.textContent = String(val.level);

                    if (val.level === MAX_LEVEL) {
                        ball.classList.add("max-level");
                    }
                    if (selectedBall && selectedBall.row === i && selectedBall.col === j) {
                        ball.classList.add("selected");
                    }

                    if (!isEditMode) {
                        attachBallDragHandlers(ball, i, j);
                    }
                    cell.appendChild(ball);
                }

                cell.addEventListener("click", () => handleCellClick(i, j));
                gridElement.appendChild(cell);
            }
        }
    }

    function updateOuterZones() {
        const zones = ["outer-top", "outer-bottom", "outer-left", "outer-right"];
        zones.forEach((id) => {
            const z = document.getElementById(id);
            if (isEditMode) {
                z.classList.remove("active");
            } else if (selectedBall && isEdgeBall(selectedBall.row, selectedBall.col, id)) {
                z.classList.add("active");
            } else {
                z.classList.remove("active");
            }
        });
    }

    function isEdgeBall(row, col, zoneId) {
        if (zoneId === "outer-top" && row === 0) return true;
        if (zoneId === "outer-bottom" && row === GRID_SIZE - 1) return true;
        if (zoneId === "outer-left" && col === 0) return true;
        if (zoneId === "outer-right" && col === GRID_SIZE - 1) return true;
        return false;
    }

    // ===== 互動事件 =====
    document.getElementById("outer-top").addEventListener("click", () => {
        handleOuterClick(-1, selectedBall?.col);
    });

    document.getElementById("outer-bottom").addEventListener("click", () => {
        handleOuterClick(GRID_SIZE, selectedBall?.col);
    });

    document.getElementById("outer-left").addEventListener("click", () => {
        handleOuterClick(selectedBall?.row, -1);
    });

    document.getElementById("outer-right").addEventListener("click", () => {
        handleOuterClick(selectedBall?.row, GRID_SIZE);
    });

    document.getElementById("reset-button").addEventListener("click", () => {
        if (!isProcessing) initGame();
    });

    function handleOuterClick(row, col) {
        if (isEditMode || !selectedBall || isProcessing) return;

        const valid =
            (row === -1 && selectedBall.row === 0) ||
            (row === GRID_SIZE && selectedBall.row === GRID_SIZE - 1) ||
            (col === -1 && selectedBall.col === 0) ||
            (col === GRID_SIZE && selectedBall.col === GRID_SIZE - 1);

        if (valid) {
            moveBall(selectedBall.row, selectedBall.col, row, col);
            selectedBall = null;
        }
    }

    function handleCellClick(row, col) {
        processCellInteraction(row, col);
    }

    function processCellInteraction(row, col) {
        if (isEditMode) {
            applyEditorSelection(row, col);
            return;
        }

        if (isProcessing) return;

        if (selectedBall === null) {
            if (grid[row][col]) {
                selectedBall = { row, col };
                renderGrid();
            }
            return;
        }

        if (selectedBall.row === row && selectedBall.col === col) {
            selectedBall = null;
            renderGrid();
            return;
        }

        if (isAdjacent(selectedBall.row, selectedBall.col, row, col)) {
            moveBall(selectedBall.row, selectedBall.col, row, col);
            selectedBall = null;
        } else {
            selectedBall = grid[row][col] ? { row, col } : null;
            renderGrid();
        }
    }

    function attachBallDragHandlers(ball, row, col) {
        ball.addEventListener("click", (event) => {
            if (isEditMode) return;
            event.preventDefault();
            event.stopPropagation();
        });

        ball.addEventListener("pointerdown", (event) => {
            if (isEditMode) return;
            if (isProcessing) return;
            if (dragState) return;
            event.preventDefault();
            ball.setPointerCapture(event.pointerId);
            dragState = {
                pointerId: event.pointerId,
                startRow: row,
                startCol: col,
                startX: event.clientX,
                startY: event.clientY,
                targetRow: row,
                targetCol: col,
                moved: false
            };
            ball.classList.add("dragging");
        });

        ball.addEventListener("pointermove", (event) => {
            if (isEditMode) return;
            if (!dragState || dragState.pointerId !== event.pointerId) return;

            const dx = event.clientX - dragState.startX;
            const dy = event.clientY - dragState.startY;
            ball.style.transform = `translate(${dx}px, ${dy}px)`;

            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);
            const distance = Math.max(absDx, absDy);

            if (distance < DRAG_THRESHOLD_PX) {
                dragState.targetRow = dragState.startRow;
                dragState.targetCol = dragState.startCol;
                dragState.moved = false;
                return;
            }

            dragState.moved = true;
            if (absDx > absDy) {
                dragState.targetRow = dragState.startRow;
                dragState.targetCol = dragState.startCol + (dx > 0 ? 1 : -1);
            } else {
                dragState.targetRow = dragState.startRow + (dy > 0 ? 1 : -1);
                dragState.targetCol = dragState.startCol;
            }
        });

        const finishDrag = (event) => {
            if (isEditMode) return;
            if (!dragState || dragState.pointerId !== event.pointerId) return;

            try {
                ball.releasePointerCapture(event.pointerId);
            } catch (_) {
                // ignore if capture was already released
            }
            ball.classList.remove("dragging");
            ball.style.transform = "";

            const { startRow, startCol, targetRow, targetCol, moved } = dragState;
            dragState = null;

            if (!moved) {
                processCellInteraction(row, col);
                return;
            }

            const dr = targetRow - startRow;
            const dc = targetCol - startCol;
            const isOutside =
                targetRow < 0 || targetRow >= GRID_SIZE || targetCol < 0 || targetCol >= GRID_SIZE;

            if ((Math.abs(dr) === 1 && dc === 0) || (Math.abs(dc) === 1 && dr === 0) || isOutside) {
                selectedBall = null;
                moveBall(startRow, startCol, targetRow, targetCol);
            } else {
                processCellInteraction(row, col);
            }
        };

        ball.addEventListener("pointerup", finishDrag);
        ball.addEventListener("pointercancel", finishDrag);
    }

    function isAdjacent(r1, c1, r2, c2) {
        const dr = Math.abs(r1 - r2);
        const dc = Math.abs(c1 - c2);
        return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
    }

    function moveBall(fr, fc, tr, tc) {
        if (isEditMode) return;
        isProcessing = true;
        moveCount++;
        updateStats();

        // 往場外：移除球
        if (tr < 0 || tr >= GRID_SIZE || tc < 0 || tc >= GRID_SIZE) {
            grid[fr][fc] = null;
        } else {
            // 與目標交換
            const tmp = grid[fr][fc];
            grid[fr][fc] = grid[tr][tc];
            grid[tr][tc] = tmp;
        }

        renderGrid();
        setTimeout(() => {
            processGrid();
        }, 150);
    }

    async function processGrid() {
        let changed = true;

        while (changed) {
            changed = false;

            if (applyGravity()) {
                changed = true;
                renderGrid();
                await sleep(300);
            }

            if (checkAndMerge()) {
                changed = true;
                renderGrid();
                await sleep(300);
            }
        }

        isProcessing = false;
    }

    function applyGravity() {
        let moved = false;

        for (let c = 0; c < GRID_SIZE; c++) {
            for (let r = GRID_SIZE - 1; r >= 0; r--) {
                if (grid[r][c] === null) {
                    // 尋找上方第一顆非空球補下來
                    for (let k = r - 1; k >= 0; k--) {
                        if (grid[k][c] !== null) {
                            grid[r][c] = grid[k][c];
                            grid[k][c] = null;
                            moved = true;
                            break;
                        }
                    }

                    // 若仍為空，補新 1 級球
                    if (grid[r][c] === null) {
                        grid[r][c] = {
                            color: 1 + Math.floor(Math.random() * COLORS),
                            level: 1
                        };
                        moved = true;
                    }
                }
            }
        }

        return moved;
    }

    // === 合併邏輯：先彙總所有直/橫升級，再排除升級格後移除兩端 ===
    function checkAndMerge() {
        let merged = false;
        const allMatches = [];

        // 先找橫向連線
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                const m = findLine(r, c, 0, 1);
                if (m) allMatches.push(m);
            }
        }

        // 再找直向連線
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                const m = findLine(r, c, 1, 0);
                if (m) allMatches.push(m);
            }
        }

        if (!allMatches.length) return false;

        const toUpgrade = new Map(); // key -> level+1（同一輪僅 +1，不疊加）
        const toRemove = new Set();

        for (const { startRow, startCol, dRow, dCol, count, level } of allMatches) {
            if (level >= MAX_LEVEL) continue; // 滿級不參與

            // 內部格子全部升級（3 連 → 1 顆、4 連 → 2 顆、5 連 → 3 顆）
            for (let i = 1; i <= count - 2; i++) {
                const r = startRow + i * dRow;
                const c = startCol + i * dCol;
                const key = `${r},${c}`;
                if (!toUpgrade.has(key)) {
                    toUpgrade.set(key, level + 1);
                }
            }

            // 兩端進入待移除名單
            const head = `${startRow},${startCol}`;
            const tail = `${startRow + (count - 1) * dRow},${startCol + (count - 1) * dCol}`;
            toRemove.add(head);
            toRemove.add(tail);
        }

        // 升級優先：移除名單排除所有升級格（支援 T/L 形）
        for (const key of toUpgrade.keys()) {
            if (toRemove.has(key)) toRemove.delete(key);
        }

        // 執行升級
        for (const [key, newLv] of toUpgrade.entries()) {
            const [r, c] = key.split(",").map(Number);
            const cell = grid[r]?.[c];
            if (cell) {
                if (cell.level < newLv) cell.level = newLv;
                if (cell.level === MAX_LEVEL) {
                    level5Count[cell.color - 1] = (level5Count[cell.color - 1] || 0) + 1;
                    updateStats();
                }
                merged = true;
            }
        }

        // 執行移除
        for (const key of toRemove) {
            const [r, c] = key.split(",").map(Number);
            if (grid[r] && grid[r][c] !== null) {
                grid[r][c] = null;
                merged = true;
            }
        }

        return merged;
    }

    function findLine(sr, sc, dr, dc) {
        const start = grid[sr]?.[sc];
        if (!start) return null;

        const { color, level } = start;
        if (level >= MAX_LEVEL) return null;

        let cnt = 1;
        let r = sr + dr;
        let c = sc + dc;

        while (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
            const cur = grid[r][c];
            if (cur && cur.color === color && cur.level === level) {
                cnt++;
                r += dr;
                c += dc;
            } else {
                break;
            }
        }

        if (cnt >= 3) {
            return { startRow: sr, startCol: sc, dRow: dr, dCol: dc, count: cnt, color, level };
        }
        return null;
    }

    function sleep(ms) {
        return new Promise((res) => setTimeout(res, ms));
    }

    // ===== 測試輔助 =====
    const $log = document.getElementById("testLog");

    function tlog(msg) {
        $log.textContent += msg + "\n";
        console.log(msg);
    }

    function tclear() {
        $log.textContent = "";
    }

    function assert(cond, msg) {
        if (!cond) throw new Error(msg);
    }

    function clearGrid() {
        for (let i = 0; i < GRID_SIZE; i++) {
            for (let j = 0; j < GRID_SIZE; j++) {
                grid[i][j] = null;
            }
        }
    }

    function setBall(r, c, color = 1, level = 1) {
        grid[r][c] = { color, level };
    }
    
    // 啟動
    initGame();
})();
