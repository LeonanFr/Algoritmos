const ORCHESTRATOR_URL = 'https://orquestradoralgoritmos.onrender.com';
const API_TOKEN = 'cWcG1T82qiJk';

let selectedTournament = null;
let tournaments = [];

const tournamentGrid = document.getElementById('tournamentGrid');
const tournamentCountSpan = document.getElementById('tournamentCount');
const validationSection = document.getElementById('validationSection');
const teamCodeInput = document.getElementById('teamCodeInput');
const validateBtn = document.getElementById('validateBtn');
const validationError = document.getElementById('validationError');

const headers = {
    'Authorization': `Bearer ${API_TOKEN}`,
    'Content-Type': 'application/json'
};

async function fetchTournaments() {
    try {
        const response = await fetch(`${ORCHESTRATOR_URL}/api/tournaments`, { headers });
        if (!response.ok) throw new Error('Falha ao carregar torneios');
        const data = await response.json();
        tournaments = data.filter(t => t.status === 'pending' || t.status === 'waiting');
        renderTournaments();
    } catch (error) {
        tournamentGrid.innerHTML = `<div class="loading-placeholder"><i class="fas fa-times-circle"></i> Erro ao carregar torneios: ${error.message}</div>`;
        console.error(error);
    }
}

function renderTournaments() {
    if (!tournaments.length) {
        tournamentGrid.innerHTML = '<div class="loading-placeholder">Nenhum torneio disponível no momento.</div>';
        tournamentCountSpan.textContent = '0';
        return;
    }
    tournamentCountSpan.textContent = tournaments.length;
    tournamentGrid.innerHTML = tournaments.map(t => `
        <div class="tournament-card" data-id="${t.id}">
            <h3>${t.name}</h3>
            <p>Duração: ${t.durationMinutes} minutos</p>
            <div class="card-footer">
                <span><i class="fas fa-trophy"></i> ${t.challengeIds?.length || 0} desafios</span>
                <span>${t.status === 'pending' ? '<i class="fas fa-lock"></i> Aguardando início' : '<i class="fas fa-clipboard-list"></i> Inscrições abertas'}</span>
            </div>
        </div>
    `).join('');

    document.querySelectorAll('.tournament-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.dataset.id;
            selectedTournament = tournaments.find(t => t.id === id);
            document.querySelectorAll('.tournament-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            validationSection.style.display = 'block';
            validationError.innerText = '';
            teamCodeInput.focus();
        });
    });
}

async function validateTeam() {
    const teamCode = teamCodeInput.value.trim();
    if (!selectedTournament) {
        validationError.innerText = 'Selecione um torneio primeiro.';
        return;
    }
    if (!teamCode) {
        validationError.innerText = 'Digite o código da equipe.';
        return;
    }

    validationError.innerText = '';
    validateBtn.disabled = true;
    validateBtn.textContent = 'Validando...';

    try {
        const response = await fetch(`${ORCHESTRATOR_URL}/api/team/validate`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                tournamentId: selectedTournament.id,
                teamCode: teamCode
            })
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || data.message || 'Falha na validação');
        }
        const team = data.team;
        localStorage.setItem('tournament', JSON.stringify(selectedTournament));
        localStorage.setItem('team', JSON.stringify(team));
        window.location.href = 'editor.html';
    } catch (error) {
        validationError.innerText = error.message;
        validateBtn.disabled = false;
        validateBtn.textContent = 'Validar e entrar';
    }
}

validateBtn.addEventListener('click', validateTeam);
teamCodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') validateTeam();
});

fetchTournaments();