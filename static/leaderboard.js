// AIC 2025 Leaderboard - Minimal Professional UI
const API_URL = '/api/leaderboard-data';
const REFRESH_INTERVAL = 2000;

let currentTab = 'realtime';
let leaderboardData = null;

function switchTab(tabName) {
    currentTab = tabName;
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-view`).classList.add('active');
    
    if (leaderboardData) {
        currentTab === 'realtime' ? renderRealtimeView(leaderboardData) : renderOverallView(leaderboardData);
    }
}

async function fetchLeaderboard() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        leaderboardData = await response.json();
        updateLeaderboard(leaderboardData);
    } catch (error) {
        console.error('Fetch error:', error);
    }
}

function updateLeaderboard(data) {
    updateActiveQuestionIndicator(data.active_question_id);
    currentTab === 'realtime' ? renderRealtimeView(data) : renderOverallView(data);
}

function updateActiveQuestionIndicator(questionId) {
    const el = document.getElementById('active-question-indicator');
    if (questionId) {
        el.textContent = `Q${questionId} Active`;
        el.style.borderColor = 'var(--color-success)';
    } else {
        el.textContent = 'No active question';
        el.style.borderColor = 'var(--border-color)';
    }
}

function renderRealtimeView(data) {
    const grid = document.getElementById('realtime-grid');
    const activeQ = data.active_question_id;
    
    if (!activeQ) {
        grid.innerHTML = '<div class="loading-message">No active question</div>';
        return;
    }
    
    // Show ALL teams, sort by score (teams with score first, then others)
    const teams = [...data.teams].sort((a, b) => {
        const scoreA = a.questions[activeQ]?.score || 0;
        const scoreB = b.questions[activeQ]?.score || 0;
        if (scoreB !== scoreA) return scoreB - scoreA;
        // Secondary sort: real teams first
        if (a.is_real !== b.is_real) return a.is_real ? -1 : 1;
        return 0;
    });
    
    if (teams.length === 0) {
        grid.innerHTML = '<div class="loading-message">Waiting for teams...</div>';
        return;
    }
    
    grid.innerHTML = teams.map((team, idx) => createTeamCard(team, activeQ, idx + 1)).join('');
}

function createTeamCard(team, questionId, rank) {
    const q = team.questions[questionId] || {};
    const score = q.score || 0;
    const correct = q.correct_count || 0;
    const wrong = q.wrong_count || 0;
    
    const rankClass = rank <= 3 ? `rank-${rank}` : '';
    const scoreClass = score > 0 ? 'has-score' : 'no-score';
    const realClass = team.is_real ? 'real-team' : '';
    
    return `
        <div class="team-card ${realClass}">
            <div class="card-header">
                <span class="team-rank ${rankClass}">#${rank}</span>
                <span class="team-name">${team.team_name}</span>
            </div>
            <div class="card-body">
                <span class="score-display ${scoreClass}">${score.toFixed(1)}</span>
                <span class="submission-stats">
                    <span class="stat-correct">${correct}</span>
                    <span class="stat-divider">/</span>
                    <span class="stat-wrong">${wrong}</span>
                </span>
            </div>
        </div>
    `;
}

function renderOverallView(data) {
    const questions = data.questions || [];
    const teams = [...data.teams].sort((a, b) => b.total_score - a.total_score);
    
    // Update table header
    const table = document.getElementById('overall-table');
    const thead = table.querySelector('thead tr');
    thead.innerHTML = `
        <th class="rank-col">#</th>
        <th class="team-col">Team</th>
        ${questions.map(q => `<th class="question-col">Q${q}</th>`).join('')}
        <th class="total-col">Total</th>
    `;
    
    // Update table body
    const tbody = document.getElementById('overall-body');
    
    if (teams.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${questions.length + 3}" class="no-data">No data</td></tr>`;
        return;
    }
    
    tbody.innerHTML = teams.map((team, idx) => {
        const rank = idx + 1;
        const rankClass = rank <= 3 ? `rank-${rank}` : '';
        const realClass = team.is_real ? 'real-team-row' : '';
        
        const qCells = questions.map(qId => {
            const q = team.questions[qId];
            if (!q) return '<td class="question-col">-</td>';
            const scoreClass = q.score > 0 ? 'has-score' : 'no-score';
            return `<td class="question-col">
                <div class="score ${scoreClass}">${q.score.toFixed(1)}</div>
                <div class="subs">${q.correct_count}/${q.wrong_count}</div>
            </td>`;
        }).join('');
        
        return `
            <tr class="${realClass}">
                <td class="rank-col ${rankClass}">${rank}</td>
                <td class="team-col">${team.team_name}</td>
                ${qCells}
                <td class="total-col">${team.total_score.toFixed(1)}</td>
            </tr>
        `;
    }).join('');
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchLeaderboard();
    setInterval(fetchLeaderboard, REFRESH_INTERVAL);
});

document.addEventListener('visibilitychange', () => {
    if (!document.hidden) fetchLeaderboard();
});

window.switchTab = switchTab;
