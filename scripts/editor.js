const ORCHESTRATOR_URL = 'https://orquestradoralgoritmos.onrender.com';
const API_TOKEN = 'cWcG1T82qiJk';

let socket = null;
let tournament = JSON.parse(localStorage.getItem('tournament'));
let team = JSON.parse(localStorage.getItem('team'));
let currentChallenge = null;
let challenges = [];
let globalTimerInterval = null;
let cooldownTimers = { test: null, submit: null };
let editor = null;
let tournamentStarted = false;
let tournamentEnded = false;
let teamCompleted = false;

const ledRed = document.getElementById('ledRed');
const ledAmber = document.getElementById('ledAmber');
const ledGreen = document.getElementById('ledGreen');
const testBtn = document.getElementById('testBtn');
const submitBtn = document.getElementById('submitBtn');
const outputConsole = document.getElementById('consoleContent');
const languageSelect = document.getElementById('languageSelect');
const problemTitle = document.getElementById('problemTitle');
const problemMeta = document.getElementById('problemMeta');
const problemDescription = document.getElementById('problemDescription');
const problemSamples = document.getElementById('problemSamples');

let handoverInterval = null;
let handoverStartTime = null;
let handoverDuration = 0;
let currentPlayerIndex = 0;
let playerDuration = 0;
let handoverSecondsConfig = 0;
let totalCycle = 0;
let cycleStartTime = null;
let handoverActive = false;

const handoverOverlay = document.getElementById('handoverOverlay');
const handoverFill = document.getElementById('handoverFill');
const handoverSecondsSpan = document.getElementById('handoverSeconds');

let handoverRAF = null;

function showHandover(durationSeconds) {
    if (handoverRAF) cancelAnimationFrame(handoverRAF);

    handoverDuration = durationSeconds;
    handoverStartTime = performance.now();
    handoverActive = true;
    handoverOverlay.style.display = 'flex';
    testBtn.disabled = true;
    submitBtn.disabled = true;
    if (editor) editor.updateOptions({ readOnly: true });

    function updateHandover() {
        if (!handoverActive) return;

        const now = performance.now();
        const elapsed = (now - handoverStartTime) / 1000;
        const remaining = Math.max(0, handoverDuration - elapsed);
        const seconds = Math.ceil(remaining);

        handoverSecondsSpan.textContent = seconds.toString().padStart(2, '0');
        const progress = Math.min(1, elapsed / handoverDuration);
        handoverFill.style.height = (100 - (progress * 100)) + '%';

        if (remaining <= 0) {
            hideHandover();
        } else {
            handoverRAF = requestAnimationFrame(updateHandover);
        }
    }
    handoverRAF = requestAnimationFrame(updateHandover);
}

function hideHandover() {
    handoverActive = false;
    handoverOverlay.style.display = 'none';
    if (handoverRAF) {
        cancelAnimationFrame(handoverRAF);
        handoverRAF = null;
    }

    if (!cooldownTimers.test && tournamentStarted && !teamCompleted && !tournamentEnded) testBtn.disabled = false;
    if (!cooldownTimers.submit && tournamentStarted && !teamCompleted && !tournamentEnded) submitBtn.disabled = false;

    if (editor && tournamentStarted && !teamCompleted && !tournamentEnded) editor.updateOptions({ readOnly: false });
    if (handoverInterval) clearInterval(handoverInterval);
}

let rotationRAF = null;

function startRotationCycle(startTimeISO, endTimeISO, playerMin, handoverSec, finalExtraMin) {
    if (rotationRAF) cancelAnimationFrame(rotationRAF);

    const start = new Date(startTimeISO).getTime();
    const end = new Date(endTimeISO).getTime();
    const playerDurationMs = playerMin * 60 * 1000;
    const handoverMs = handoverSec * 1000;
    const totalCycleMs = playerDurationMs + handoverMs;
    const finalExtraMs = (finalExtraMin || 0) * 60 * 1000;

    function checkRotation() {
        if (tournamentEnded || teamCompleted) {
            if (handoverActive) hideHandover();
            return;
        }

        const now = Date.now();
        const remainingGlobal = end - now;

        if (remainingGlobal <= finalExtraMs) {
            if (handoverActive) hideHandover();
            rotationRAF = requestAnimationFrame(checkRotation);
            return;
        }

        const elapsed = now - start;
        const cyclePosition = elapsed % totalCycleMs;

        if (cyclePosition < playerDurationMs) {
            if (handoverActive) hideHandover();
        } else {
            if (!handoverActive) {
                const remainingInWindow = (handoverMs - (cyclePosition - playerDurationMs)) / 1000;
                if (remainingInWindow > 0) {
                    showHandover(remainingInWindow);
                }
            }
        }
        rotationRAF = requestAnimationFrame(checkRotation);
    }
    rotationRAF = requestAnimationFrame(checkRotation);
}

function setLED(state) {
    ledRed.classList.remove('active');
    ledAmber.classList.remove('active');
    ledGreen.classList.remove('active');
    if (state === 'loading') ledAmber.classList.add('active');
    else if (state === 'cooldown') ledRed.classList.add('active');
    else if (state === 'completed') ledGreen.classList.add('active');
}

function showConsole(msg, isError = false) {
    outputConsole.innerHTML = `<div style="color: ${isError ? '#ff5f57' : 'var(--neon-green)'}">${msg}</div>`;
}

function showLoading(show) {
    if (show) setLED('loading');
    else setLED('idle');
}

function showWaitingScreen() {
    problemTitle.innerText = 'Aguardando início...';
    problemMeta.innerHTML = '';
    problemDescription.innerHTML = '<i class="fa-solid fa-hourglass-half"></i> O torneio ainda não começou. Aguarde o sinal da organização.';
    problemSamples.innerHTML = '';
    if (editor) {
        editor.setValue('');
        editor.updateOptions({ readOnly: true });
    }
    testBtn.disabled = true;
    submitBtn.disabled = true;
}

function enableChallengeMode() {
    if (editor && !handoverActive && tournamentStarted && !teamCompleted && !tournamentEnded) {
        editor.updateOptions({ readOnly: false });
    }
    if (!handoverActive && !cooldownTimers.test && tournamentStarted && !teamCompleted && !tournamentEnded) testBtn.disabled = false;
    if (!handoverActive && !cooldownTimers.submit && tournamentStarted && !teamCompleted && !tournamentEnded) submitBtn.disabled = false;
}

async function fetchTournamentStatus() {
    try {
        const res = await fetch(`${ORCHESTRATOR_URL}/api/tournaments/${tournament.id}`, {
            headers: { 'Authorization': `Bearer ${API_TOKEN}` }
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data;
    } catch {
        return null;
    }
}

async function checkIfTournamentAlreadyStarted() {
    const t = await fetchTournamentStatus();
    if (t && t.status === 'active' && t.startTime) {
        const now = new Date();
        const start = new Date(t.startTime);
        if (now >= start) {
            tournamentStarted = true;
            startTournamentCountdown(t.endTime);
            startRotationCycle(t.startTime, t.endTime, t.rotationConfig.playerMinutes, t.rotationConfig.handoverSeconds, t.rotationConfig.finalExtraMin);
            await loadChallenges();
            enableChallengeMode();
            return true;
        }
    }
    return false;
}

async function fetchChallenges() {
    const res = await fetch(`${ORCHESTRATOR_URL}/api/challenges?tournamentId=${tournament.id}`, {
        headers: { 'Authorization': `Bearer ${API_TOKEN}` }
    });
    if (!res.ok) throw new Error('Erro ao carregar desafios');
    return res.json();
}

async function fetchTeamStatus() {
    const res = await fetch(`${ORCHESTRATOR_URL}/api/team/status?tournamentId=${tournament.id}&teamCode=${team.code}`, {
        headers: { 'Authorization': `Bearer ${API_TOKEN}` }
    });
    if (!res.ok) return null;
    return res.json();
}

async function submitCode(payload) {
    const res = await fetch(`${ORCHESTRATOR_URL}/api/submit`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_TOKEN}`
        },
        body: JSON.stringify(payload)
    });
    if (res.status === 429) {
        const data = await res.json();
        throw { cooldown: true, remaining: data.remainingSeconds };
    }
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

function connectWebSocket() {
    const wsUrl = ORCHESTRATOR_URL.replace(/^https?/, 'wss') + '/ws';
    socket = new WebSocket(wsUrl);
    socket.onopen = () => console.log('WebSocket conectado');
    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.event === 'TOURNAMENT_START' && !tournamentStarted) {
                tournamentStarted = true;
                startTournamentCountdown(data.endTime);
                startRotationCycle(data.startTime, data.endTime, data.config.playerMinutes, data.config.handoverSeconds, data.config.finalExtraMin); loadChallenges();
                enableChallengeMode();
            }
        } catch (e) {
            console.error('Erro ao processar mensagem WebSocket', e);
        }
    };
    socket.onerror = (err) => {
        console.error('WebSocket error', err);
        showConsole('<i class="fa-solid fa-wifi"></i> Erro na conexão em tempo real. Recarregue a página.', true);
    };
}

function startTournamentCountdown(endTimeISO) {
    if (globalTimerInterval) {
        clearInterval(globalTimerInterval);
        globalTimerInterval = null;
    }
    const end = new Date(endTimeISO);
    const updateTimer = () => {
        const now = new Date();
        const diff = Math.max(0, end - now);
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        const timerEl = document.getElementById('tournamentTimer');
        if (timerEl) timerEl.innerHTML = `<i class="fa-solid fa-clock"></i> ${minutes}:${seconds.toString().padStart(2, '0')}`;
        if (diff <= 0 && !tournamentEnded) {
            clearInterval(globalTimerInterval);
            globalTimerInterval = null;
            tournamentEnded = true;
            if (handoverActive) hideHandover();
            showConsole('<i class="fa-solid fa-clock"></i> Tempo do torneio esgotado!', true);
            testBtn.disabled = true;
            submitBtn.disabled = true;
            if (editor) editor.updateOptions({ readOnly: true });
        }
    };
    updateTimer();
    globalTimerInterval = setInterval(updateTimer, 250);
}

function renderChallenge(challenge) {
    currentChallenge = challenge;
    problemTitle.innerText = challenge.title;
    problemMeta.innerHTML = `<span><i class="fa-solid fa-stopwatch"></i> ${challenge.timeLimitSec}s</span> <span><i class="fa-solid fa-microchip"></i> ${challenge.memoryLimitMB}MB</span>`;
    problemDescription.innerText = challenge.description || '';

    let samplesHtml = '<h4><i class="fa-solid fa-thumbtack"></i> Exemplos:</h4>';
    if (challenge.samples && challenge.samples.length) {
        challenge.samples.forEach((s, idx) => {
            samplesHtml += `<pre><strong>Entrada ${idx + 1}:</strong>\n${s.input}\n<strong>Saída:</strong>\n${s.output}</pre>`;
        });
    }
    problemSamples.innerHTML = samplesHtml;
}

async function loadChallenges() {
    try {
        challenges = await fetchChallenges();
        if (!challenges.length) throw new Error('Nenhum desafio encontrado');
        currentChallenge = challenges[0];
        renderChallenge(currentChallenge);

        const status = await fetchTeamStatus();
        if (status && status.completed) {
            teamCompleted = true;
            setLED('completed');
            showConsole('<i class="fa-solid fa-check-circle"></i> Equipe já completou o desafio!', false);
            testBtn.disabled = true;
            submitBtn.disabled = true;
            if (editor) editor.updateOptions({ readOnly: true });
        } else if (tournamentStarted) {
            enableChallengeMode();
        } else {
            showWaitingScreen();
        }
    } catch (err) {
        showConsole(`<i class="fa-solid fa-bug"></i> Erro: ${err.message}`, true);
    }
}

function initMonaco() {
    const editorElement = document.getElementById('codeEditor');
    if (!editorElement) return;

    const languageMap = {
        'c': 'c',
        'cpp': 'cpp',
        'java': 'java',
        'javascript': 'javascript',
        'python': 'python',
        'kotlin': 'kotlin'
    };

    editor = monaco.editor.create(editorElement, {
        value: '',
        language: languageMap[languageSelect.value] || 'cpp',
        theme: 'vs-dark',
        fontSize: 14,
        fontFamily: 'JetBrains Mono, monospace',
        automaticLayout: true,
        minimap: { enabled: false },
        lineNumbers: 'on',
        glyphMargin: false,
        folding: true,
        bracketPairColorization: { enabled: true },
        renderWhitespace: 'selection',
        tabSize: 4,
        insertSpaces: true,
        scrollBeyondLastLine: false,
        readOnly: true
    });

    languageSelect.addEventListener('change', () => {
        const newLang = languageMap[languageSelect.value] || 'cpp';
        monaco.editor.setModelLanguage(editor.getModel(), newLang);
    });

    window.addEventListener('resize', () => editor.layout());
}

function startCooldown(type, seconds) {
    const btn = type === 'test' ? testBtn : submitBtn;
    const icon = type === 'test' ? 'vial' : 'upload';

    if (cooldownTimers[type]) {
        clearInterval(cooldownTimers[type]);
        cooldownTimers[type] = null;
    }

    btn.disabled = true;
    setLED('cooldown');

    let remaining = seconds;

    btn.innerHTML = `<i class="fa-solid fa-${icon}"></i> ${type === 'test' ? 'Testar' : 'Enviar'} (${remaining}s)`;

    const interval = setInterval(() => {
        remaining--;

        if (remaining > 0) {
            btn.innerHTML = `<i class="fa-solid fa-${icon}"></i> ${type === 'test' ? 'Testar' : 'Enviar'} (${remaining}s)`;
        } else {
            clearInterval(cooldownTimers[type]);
            cooldownTimers[type] = null;

            btn.innerHTML = `<i class="fa-solid fa-${icon}"></i> ${type === 'test' ? 'Testar' : 'Enviar'}`;

            if (!handoverActive && tournamentStarted && !tournamentEnded && !teamCompleted) {
                btn.disabled = false;
            }

            const otherType = type === 'test' ? 'submit' : 'test';
            if (!cooldownTimers[otherType]) {
                setLED('idle');
            }
        }
    }, 1000);

    cooldownTimers[type] = interval;
}

async function handleSubmission(type) {
    if (!tournamentStarted || handoverActive || tournamentEnded || teamCompleted) return;

    const btn = type === 'test' ? testBtn : submitBtn;
    if (btn.disabled) return;

    if (!tournament || !team || !currentChallenge) {
        showConsole('<i class="fa-solid fa-exclamation-triangle"></i> Dados não encontrados.', true);
        return;
    }
    if (!editor) {
        showConsole('<i class="fa-solid fa-bug"></i> Editor não inicializado.', true);
        return;
    }
    const code = editor.getValue();
    if (!code.trim()) {
        showConsole('<i class="fa-solid fa-keyboard"></i> Digite o código antes de enviar.', true);
        return;
    }

    btn.disabled = true;
    showLoading(true);

    try {
        const result = await submitCode({
            tournamentId: tournament.id,
            teamCode: team.code,
            challengeId: currentChallenge.id,
            type: type,
            language: languageSelect.value,
            code: code
        });

        if (type === 'test') {
            let output = `<strong>Veredito: ${result.verdict.toUpperCase()}</strong><br>`;
            if (result.testCases && result.testCases.length) {
                result.testCases.forEach((tc, i) => {
                    const iconPass = tc.passed ? '<i class="fa-solid fa-check-circle" style="color: var(--neon-green)"></i>' : '<i class="fa-solid fa-circle-xmark" style="color: #ff5f57"></i>';
                    output += `<hr><b>Caso ${i + 1}</b> ${iconPass}<br>`;
                    output += `<i class="fa-solid fa-inbox"></i> Input: ${tc.input}<br><i class="fa-solid fa-upload"></i> Esperado: ${tc.expected}<br><i class="fa-solid fa-laptop-code"></i> Recebido: ${tc.output}<br>`;
                });
            } else if (result.message) {
                output += result.message;
            }
            showConsole(output, result.verdict !== 'accepted');
        } else {
            if (result.verdict === 'accepted') {
                teamCompleted = true;
                showConsole('<i class="fa-solid fa-trophy"></i> PARABÉNS! DESAFIO CONCLUÍDO!');
                setLED('completed');
                testBtn.disabled = true;
                submitBtn.disabled = true;
                if (editor) editor.updateOptions({ readOnly: true });
                if (socket) socket.close();
                if (globalTimerInterval) clearInterval(globalTimerInterval);
            } else {
                showConsole(`<i class="fa-solid fa-circle-xmark"></i> ${result.message || 'Falha na submissão final'}`, true);
            }
        }

        const status = await fetchTeamStatus();
        if (status && status.cooldown) {
            if (status.cooldown.test > 0) startCooldown('test', status.cooldown.test);
            if (status.cooldown.submit > 0) startCooldown('submit', status.cooldown.submit);
        }
    } catch (err) {
        if (err.cooldown) {
            startCooldown(type, err.remaining);
            showConsole(`<i class="fa-solid fa-hourglass-half"></i> Cooldown: aguarde ${err.remaining} segundos.`, true);
        } else {
            showConsole(`<i class="fa-solid fa-bug"></i> Erro: ${err.message}`, true);
        }
    } finally {
        showLoading(false);
        if (!cooldownTimers[type] && !handoverActive && tournamentStarted && !tournamentEnded && !teamCompleted) {
            btn.disabled = false;
        }
    }
}

testBtn.addEventListener('click', () => handleSubmission('test'));
submitBtn.addEventListener('click', () => handleSubmission('submit'));

window.addEventListener('load', async () => {
    if (!tournament || !team) {
        window.location.href = 'index.html';
        return;
    }

    require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' } });

    require(['vs/editor/editor.main'], function () {
        initMonaco();
        showWaitingScreen();

        (async () => {
            const alreadyStarted = await checkIfTournamentAlreadyStarted();
            if (!alreadyStarted) {
                connectWebSocket();
            }
        })();
    });
});