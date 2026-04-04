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

function showToast(message) {
    let toast = document.querySelector('.toast-notification');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast-notification';
        document.body.appendChild(toast);
    }
    toast.innerHTML = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}

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

function formatDescription(text) {
    if (!text) return '';
    const paragraphs = text.split(/\n\s*\n/);
    return paragraphs.map(para => {
        const lines = para.split('\n');
        const formatted = lines.map(line => line.trim()).join('<br>');
        return `<p>${formatted}</p>`;
    }).join('');
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function (m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
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

    problemMeta.innerHTML = `
        <span>Tempo limite: <i class="fa-solid fa-stopwatch"></i> ${challenge.timeLimitSec}s</span>
        <span>Memória limite: <i class="fa-solid fa-microchip"></i> ${challenge.memoryLimitMB}MB</span>
    `;
    
    const formattedDescription = formatDescription(challenge.description || '');
    let html = `<div class="problem-description">${formattedDescription}</div>`;

    if (challenge.inputFormat) {
        html += `
            <div class="problem-section">
                <h4><i class="fa-solid fa-keyboard"></i> Formato de Entrada</h4>
                <pre>${escapeHtml(challenge.inputFormat)}</pre>
            </div>`;
    }

    if (challenge.outputFormat) {
        html += `
            <div class="problem-section">
                <h4><i class="fa-solid fa-print"></i> Formato de Saída</h4>
                <pre>${escapeHtml(challenge.outputFormat)}</pre>
            </div>`;
    }

    if (challenge.constraints) {
        html += `
            <div class="problem-section">
                <h4><i class="fa-solid fa-ban"></i> Restrições</h4>
                <pre>${escapeHtml(challenge.constraints)}</pre>
            </div>`;
    }

    if (challenge.samples && challenge.samples.length) {
        html += '<h4><i class="fa-solid fa-thumbtack"></i> Exemplos:</h4>';
        challenge.samples.forEach((s, idx) => {
            html += `<pre><strong>Entrada ${idx + 1}:</strong>\n${escapeHtml(s.input)}\n<strong>Saída:</strong>\n${escapeHtml(s.output)}</pre>`;
        });
    }

    problemDescription.innerHTML = html;

    const practiceInfo = document.getElementById('practiceInfo');
    if (practiceInfo) practiceInfo.style.display = 'none';
}

function showChallengesView() {
    challengesView.classList.add('active');
    editorView.classList.remove('active');
    exitChallengeBtn.style.display = 'none';

    const practiceInfo = document.getElementById('practiceInfo');
    if (practiceInfo) {
        practiceInfo.style.display = 'block';
    }

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
        challengeListContainer.innerHTML = `<div class="loading-placeholder"><i class="fa-solid fa-circle-exclamation"></i> ${escapeHtml(err.message)}</div>`;
        showConsole(`<i class="fa-solid fa-bug"></i> Erro: ${escapeHtml(err.message)}`, true);
    }
}

function renderChallengeList() {
    if (!challenges.length) {
        challengeListContainer.innerHTML = '<div class="loading-placeholder">Nenhum desafio encontrado.</div>';
        return;
    }
    challengeListContainer.innerHTML = challenges.map(c => {
        const shortDesc = c.description ? c.description.substring(0, 100) + '...' : 'Sem descrição';
        return `
            <div class="challenge-card ${completedChallenges.has(c.id) ? 'completed' : ''}" data-id="${c.id}">
                <h3><i class="fa-solid fa-code"></i> ${escapeHtml(c.title)}</h3>
                <p>${escapeHtml(shortDesc)}</p>
                <span class="difficulty"><i class="fa-solid fa-chart-line"></i> Treino livre</span>
                ${completedChallenges.has(c.id) ? '<span class="completed-badge"><i class="fa-solid fa-check-circle"></i></span>' : ''}
            </div>
        `;
    }).join('');

    document.querySelectorAll('.challenge-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.dataset.id;
            const challenge = challenges.find(c => c.id === id);
            if (challenge) {
                currentChallenge = challenge;
                renderChallenge(challenge);
                showEditorView();
                loadSavedPracticeCode();
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

    editor.onDidChangeModelContent(() => {
        debouncedPracticeAutoSave();
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
                <strong>VEREDITO: ${escapeHtml(result.verdict.toUpperCase())}</strong>
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
                                    <span class="value">${escapeHtml(tc.input)}</span>
                                </div>
                                <div class="data-line">
                                    <span class="label">EXPECTED:</span>
                                    <span class="value">${escapeHtml(tc.expected)}</span>
                                </div>
                                <div class="data-line">
                                    <span class="label">OUTPUT:</span>
                                    <span class="value">${escapeHtml(tc.output)}</span>
                                </div>
                            </div>
                        </div>`;
                });
            } else if (result.message) {
                output += `<div class="console-message">${escapeHtml(result.message)}</div>`;
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
                        showConsole(`<i class="fa-solid fa-arrow-right"></i> Próximo desafio: ${escapeHtml(next.title)}`);
                    }, 1500);
                } else {
                    showCompletionOverlay();
                }
            } else {
                const errorMsg = result.message || 'Falha na submissão';
                showConsole(`<div class="test-case-box case-failed">
                                <div class="test-case-header">
                                    <span>SUBMISSÃO FINAL</span>
                                    <i class="fa-solid fa-circle-xmark"></i>
                                </div>
                                <div class="console-message" style="padding: 10px">${escapeHtml(errorMsg)}</div>
                             </div>`, true);
            }
        }
    } catch (err) {
        showLoading(false);
        showConsole(`<div class="console-error"><i class="fa-solid fa-bug"></i> Erro: ${escapeHtml(err.message)}</div>`, true);
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

let saveTimeout = null;
let lastSavedCode = '';
let lastSavedLanguage = '';

function savePracticeCodeLocally(code, language) {
    const key = `practice_code_${currentChallenge.id}`;
    localStorage.setItem(key, JSON.stringify({ code, language }));
    lastSavedCode = code;
    lastSavedLanguage = language;
}

function loadPracticeCodeLocally() {
    const key = `practice_code_${currentChallenge.id}`;
    const saved = localStorage.getItem(key);
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (e) { return null; }
    }
    return null;
}

function performPracticeSave() {
    if (!editor || !currentChallenge) return;
    const currentCode = editor.getValue();
    const currentLang = languageSelect.value;
    if (currentCode === lastSavedCode && currentLang === lastSavedLanguage) return;
    savePracticeCodeLocally(currentCode, currentLang);
    showToast('<i class="fa-solid fa-check-circle"></i> Código salvo localmente.');
}

function debouncedPracticeAutoSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        performPracticeSave();
    }, 3000);
}

function loadSavedPracticeCode() {
    const saved = loadPracticeCodeLocally();
    if (saved && saved.code && editor) {
        editor.setValue(saved.code);
        if (saved.language && languageSelect.value !== saved.language) {
            languageSelect.value = saved.language;
            languageSelect.dispatchEvent(new Event('change'));
        }
        lastSavedCode = saved.code;
        lastSavedLanguage = saved.language;
        showConsole('<i class="fa-solid fa-download"></i> Código restaurado localmente.');
    }
}

testBtn.addEventListener('click', () => handleSubmission('test'));
submitBtn.addEventListener('click', () => handleSubmission('submit'));
exitChallengeBtn.addEventListener('click', () => showChallengesView());

window.addEventListener('load', async () => {
    require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' } });
    require(['vs/editor/editor.main'], function () {
        initMonaco();
        const saveBtn = document.getElementById('saveCodeBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                if (saveTimeout) clearTimeout(saveTimeout);
                performPracticeSave();
            });
        }
        loadChallenges();
    });
});