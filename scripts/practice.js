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
const challengeListPanel = document.getElementById('challengeListPanel');

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
    document.getElementById('problemTitle').innerText = challenge.title;
    document.getElementById('problemMeta').innerHTML = `<span><i class="fa-solid fa-stopwatch"></i> ${challenge.timeLimitSec}s</span> <span><i class="fa-solid fa-microchip"></i> ${challenge.memoryLimitMB}MB</span>`;
    document.getElementById('problemDescription').innerText = challenge.description || '';

    let samplesHtml = '<h4><i class="fa-solid fa-thumbtack"></i> Exemplos:</h4>';
    if (challenge.samples && challenge.samples.length) {
        challenge.samples.forEach((s, idx) => {
            samplesHtml += `<pre><strong>Entrada ${idx + 1}:</strong>\n${s.input}\n<strong>Saída:</strong>\n${s.output}</pre>`;
        });
    }
    document.getElementById('problemSamples').innerHTML = samplesHtml;
}

async function loadChallenges() {
    try {
        challenges = await fetchPracticeChallenges();
        if (!challenges.length) throw new Error('Nenhum desafio disponível');
        currentChallenge = challenges[0];
        renderChallenge(currentChallenge);
        renderChallengeList();
    } catch (err) {
        showConsole(`<i class="fa-solid fa-bug"></i> Erro: ${err.message}`, true);
        challengeListPanel.innerHTML = '<div class="loading-placeholder">Falha ao carregar desafios.</div>';
    }
}

function renderChallengeList() {
    if (!challenges.length) {
        challengeListPanel.innerHTML = '<div class="loading-placeholder">Nenhum desafio encontrado.</div>';
        return;
    }
    challengeListPanel.innerHTML = challenges.map(c => `
        <div class="challenge-list-item ${currentChallenge && currentChallenge.id === c.id ? 'active' : ''}" data-id="${c.id}">
            <i class="fa-solid fa-code"></i>
            <span>${c.title}</span>
        </div>
    `).join('');

    document.querySelectorAll('.challenge-list-item').forEach(item => {
        item.addEventListener('click', () => {
            const id = item.dataset.id;
            const challenge = challenges.find(c => c.id === id);
            if (challenge) {
                currentChallenge = challenge;
                renderChallenge(challenge);
                renderChallengeList();
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
        readOnly: false
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
    if (cooldownTimers[type]) clearInterval(cooldownTimers[type]);
    btn.disabled = true;
    setLED('cooldown');
    let remaining = seconds;
    btn.innerHTML = `<i class="fa-solid fa-${icon}"></i> ${type === 'test' ? 'Testar' : 'Enviar'} (${remaining}s)`;
    const interval = setInterval(() => {
        remaining--;
        if (remaining > 0) {
            btn.innerHTML = `<i class="fa-solid fa-${icon}"></i> ${type === 'test' ? 'Testar' : 'Enviar'} (${remaining}s)`;
        } else {
            clearInterval(interval);
            cooldownTimers[type] = null;
            btn.innerHTML = `<i class="fa-solid fa-${icon}"></i> ${type === 'test' ? 'Testar' : 'Enviar'}`;
            btn.disabled = false;
            const other = type === 'test' ? 'submit' : 'test';
            if (!cooldownTimers[other]) setLED('idle');
        }
    }, 1000);
    cooldownTimers[type] = interval;
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
                showConsole('<i class="fa-solid fa-trophy"></i> PARABÉNS! SOLUÇÃO ACEITA!');
                setLED('completed');
                setTimeout(() => setLED('idle'), 2000);
            } else {
                showConsole(`<i class="fa-solid fa-circle-xmark"></i> ${result.message || 'Falha na submissão'}`, true);
            }
        }
    } catch (err) {
        showLoading(false);
        showConsole(`<i class="fa-solid fa-bug"></i> Erro: ${err.message}`, true);
    }
}

testBtn.addEventListener('click', () => handleSubmission('test'));
submitBtn.addEventListener('click', () => handleSubmission('submit'));

window.addEventListener('load', async () => {
    require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' } });
    require(['vs/editor/editor.main'], function () {
        initMonaco();
        loadChallenges();
    });
});