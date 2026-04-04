const ORCHESTRATOR_URL = 'https://orquestradoralgoritmos.onrender.com';
const API_TOKEN = 'cWcG1T82qiJk';

let currentChallenge = null;
let challenges = [];
let editor = null;
let cooldownTimers = { test: null, submit: null };

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

const challengesView = document.getElementById('challengesView');
const editorView = document.getElementById('editorView');
const exitChallengeBtn = document.getElementById('exitChallengeBtn');
const challengeListContainer = document.getElementById('challengeList');

let completedChallenges = new Set();

function loadProgress() {
    const saved = localStorage.getItem('practiceProgress');
    if (saved) {
        completedChallenges = new Set(JSON.parse(saved));
    }
}

function saveProgress() {
    localStorage.setItem('practiceProgress', JSON.stringify([...completedChallenges]));
}

function isChallengeCompleted(challengeId) {
    return completedChallenges.has(challengeId);
}

function markChallengeCompleted(challengeId) {
    completedChallenges.add(challengeId);
    saveProgress();
    const card = document.querySelector(`.challenge-card[data-id="${challengeId}"]`);
    if (card) {
        card.classList.add('completed');
        const badge = card.querySelector('.completed-badge');
        if (!badge) {
            card.innerHTML += '<span class="completed-badge"><i class="fa-solid fa-check-circle"></i></span>';
        }
    }
}

function getNextUncompletedChallenge() {
    for (const challenge of challenges) {
        if (!completedChallenges.has(challenge.id)) {
            return challenge;
        }
    }
    return null;
}

function setLED(state) {
    ledRed.classList.remove('active');
    ledAmber.classList.remove('active');
    ledGreen.classList.remove('active');
    if (state === 'loading') ledAmber.classList.add('active');
    else if (state === 'cooldown') ledRed.classList.add('active');
    else if (state === 'completed') ledGreen.classList.add('active');
}

function showConsole(msg) {
    outputConsole.innerHTML = msg;
    outputConsole.style.color = '';
}

function showLoading(show) {
    if (show) setLED('loading');
    else setLED('idle');
}

async function fetchPracticeChallenges() {
    const res = await fetch(`${ORCHESTRATOR_URL}/api/practice/challenges`, {
        headers: { 'Authorization': `Bearer ${API_TOKEN}` }
    });
    if (!res.ok) throw new Error('Erro ao carregar desafios de prática');
    return res.json();
}

async function submitPracticeCode(payload) {
    const res = await fetch(`${ORCHESTRATOR_URL}/api/practice/submit`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_TOKEN}`
        },
        body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

function renderChallenge(challenge) {
    currentChallenge = challenge;
    problemTitle.innerText = challenge.title;
    problemMeta.innerHTML = `<span>Tempo limite de execução: <i class="fa-solid fa-stopwatch"></i> ${challenge.timeLimitSec}s</span> <span>Memória limite: <i class="fa-solid fa-microchip"></i> ${challenge.memoryLimitMB}MB</span>`;
    problemDescription.innerText = challenge.description || '';

    let samplesHtml = '<h4><i class="fa-solid fa-thumbtack"></i> Exemplos:</h4>';
    if (challenge.samples && challenge.samples.length) {
        challenge.samples.forEach((s, idx) => {
            samplesHtml += `<pre><strong>Entrada ${idx + 1}:</strong>\n${s.input}\n<strong>Saída:</strong>\n${s.output}</pre>`;
        });
    }
    problemSamples.innerHTML = samplesHtml;
}

function showChallengesView() {
    challengesView.classList.add('active');
    editorView.classList.remove('active');
    exitChallengeBtn.style.display = 'none';
    if (editor) {
        editor.setValue('');
        editor.updateOptions({ readOnly: true });
    }
    testBtn.disabled = true;
    submitBtn.disabled = true;
    setLED('idle');
    showConsole('<i class="fa-solid fa-info-circle"></i> Selecione um desafio para começar.');
}

function showEditorView() {
    challengesView.classList.remove('active');
    editorView.classList.add('active');
    exitChallengeBtn.style.display = 'flex';
    if (editor) editor.updateOptions({ readOnly: false });
    testBtn.disabled = false;
    submitBtn.disabled = false;
}

async function loadChallenges() {
    try {
        challenges = await fetchPracticeChallenges();
        if (!challenges.length) throw new Error('Nenhum desafio disponível');
        loadProgress();
        renderChallengeList();
        showChallengesView();
    } catch (err) {
        challengeListContainer.innerHTML = `<div class="loading-placeholder"><i class="fa-solid fa-circle-exclamation"></i> ${err.message}</div>`;
        showConsole(`<i class="fa-solid fa-bug"></i> Erro: ${err.message}`, true);
    }
}

function renderChallengeList() {
    if (!challenges.length) {
        challengeListContainer.innerHTML = '<div class="loading-placeholder">Nenhum desafio encontrado.</div>';
        return;
    }
    challengeListContainer.innerHTML = challenges.map(c => `
        <div class="challenge-card ${completedChallenges.has(c.id) ? 'completed' : ''}" data-id="${c.id}">
            <h3><i class="fa-solid fa-code"></i> ${c.title}</h3>
            <p>${c.description ? c.description.substring(0, 100) + '...' : 'Sem descrição'}</p>
            <span class="difficulty"><i class="fa-solid fa-chart-line"></i> Treino livre</span>
            ${completedChallenges.has(c.id) ? '<span class="completed-badge"><i class="fa-solid fa-check-circle"></i></span>' : ''}
        </div>
    `).join('');

    document.querySelectorAll('.challenge-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.dataset.id;
            const challenge = challenges.find(c => c.id === id);
            if (challenge) {
                currentChallenge = challenge;
                renderChallenge(challenge);
                showEditorView();
                if (editor) editor.setValue('');
            }
        });
    });
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
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        disableMonospaceOptimizations: true,
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

async function handleSubmission(type) {
    if (!currentChallenge) {
        showConsole('<i class="fa-solid fa-exclamation-triangle"></i> Nenhum desafio selecionado.', true);
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
    showLoading(true);
    try {
        const result = await submitPracticeCode({
            challengeId: currentChallenge.id,
            language: languageSelect.value,
            code: code,
            type: type
        });
        showLoading(false);

        if (type === 'test') {
            let verdictClass = result.verdict.toLowerCase().replace('_', '-');
            let output = `<div class="console-verdict verdict-${verdictClass}">
                <strong>VEREDITO: ${result.verdict.toUpperCase()}</strong>
              </div>`;

            if (result.testCases && result.testCases.length) {
                result.testCases.forEach((tc, i) => {
                    const statusClass = tc.passed ? 'case-passed' : 'case-failed';
                    const statusIcon = tc.passed ? 'fa-check-circle' : 'fa-circle-xmark';

                    output += `
                        <div class="test-case-box ${statusClass}">
                            <div class="test-case-header">
                                <span><i class="fa-solid fa-flask"></i> Caso ${i + 1}</span>
                                <i class="fa-solid ${statusIcon}"></i>
                            </div>
                            <div class="test-case-data">
                                <div class="data-line">
                                    <span class="label">INPUT:</span>
                                    <span class="value">${tc.input}</span>
                                </div>
                                <div class="data-line">
                                    <span class="label">EXPECTED:</span>
                                    <span class="value">${tc.expected}</span>
                                </div>
                                <div class="data-line">
                                    <span class="label">OUTPUT:</span>
                                    <span class="value">${tc.output}</span>
                                </div>
                            </div>
                        </div>`;
                });
            } else if (result.message) {
                output += `<div class="console-message">${result.message}</div>`;
            }
            showConsole(output);
        } else {
            if (result.verdict === 'accepted') {
                markChallengeCompleted(currentChallenge.id);
                showConsole('<div class="console-success"><i class="fa-solid fa-trophy"></i> PARABÉNS! SOLUÇÃO ACEITA!</div>');
                setLED('completed');
                setTimeout(() => setLED('idle'), 2000);

                const next = getNextUncompletedChallenge();
                if (next) {
                    setTimeout(() => {
                        currentChallenge = next;
                        renderChallenge(next);
                        if (editor) editor.setValue('');
                        showConsole(`<i class="fa-solid fa-arrow-right"></i> Próximo desafio: ${next.title}`);
                    }, 1500);
                } else {
                    showCompletionOverlay();
                }
            }
        }
    } catch (err) {
        showLoading(false);
        showConsole(`<div class="console-error"><i class="fa-solid fa-bug"></i> Erro: ${err.message}</div>`, true);
    }
}

function showCompletionOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'completion-overlay';
    overlay.innerHTML = `
        <div class="completion-content">
            <i class="fa-solid fa-crown"></i>
            <h2>Parabéns!</h2>
            <p>Você completou todos os desafios de prática.</p>
            <button class="btn-neon" id="closeCompletionBtn">Fechar</button>
        </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('closeCompletionBtn').addEventListener('click', () => {
        overlay.remove();
        showChallengesView();
    });
}

testBtn.addEventListener('click', () => handleSubmission('test'));
submitBtn.addEventListener('click', () => handleSubmission('submit'));
exitChallengeBtn.addEventListener('click', () => showChallengesView());

window.addEventListener('load', async () => {
    require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' } });
    require(['vs/editor/editor.main'], function () {
        initMonaco();
        loadChallenges();
    });
});