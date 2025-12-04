// AIC 2025 Admin - Minimal Professional UI
const REFRESH_INTERVAL = 2000;
const COUNTDOWN_INTERVAL = 1000;

const API = {
    START_QUESTION: '/admin/start-question',
    STOP_QUESTION: '/admin/stop-question',
    RESET_ALL: '/admin/reset',
    SESSIONS: '/admin/sessions',
    CONFIG: '/config'
};

let activeQuestionId = null;
let questionConfig = {};
let countdownTimer = null;
let remainingSeconds = 0;

document.addEventListener('DOMContentLoaded', () => {
    log('System ready', 'info');
    loadQuestionConfig();
    refreshStatus();
    refreshSessions();
    setInterval(() => { refreshStatus(); refreshSessions(); }, REFRESH_INTERVAL);
    startCountdownTimer();
    document.getElementById('question-id').addEventListener('input', updateQuestionInfo);
});

function startCountdownTimer() {
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
        if (remainingSeconds > 0) {
            remainingSeconds--;
            updateCountdownDisplay();
        }
    }, COUNTDOWN_INTERVAL);
}

async function loadQuestionConfig() {
    try {
        const response = await fetch(API.CONFIG);
        const data = await response.json();
        questionConfig = data.questions || {};
    } catch (error) {
        log('Failed to load config', 'error');
    }
}

function updateQuestionInfo() {
    const qId = document.getElementById('question-id').value;
    const infoDiv = document.getElementById('question-info');
    
    if (!qId || !questionConfig[qId]) {
        infoDiv.classList.add('hidden');
        return;
    }
    
    const q = questionConfig[qId];
    infoDiv.classList.remove('hidden');
    infoDiv.innerHTML = `<strong>Q${qId}</strong> ${q.type} | ${q.scene_id}_${q.video_id} | ${q.num_events || 0} events`;
}

async function startQuestion() {
    const questionId = parseInt(document.getElementById('question-id').value);
    const timeLimit = parseInt(document.getElementById('time-limit').value) || 300;
    const bufferTime = parseInt(document.getElementById('buffer-time').value) || 10;
    
    if (!questionId || !questionConfig[questionId]) {
        log('Invalid question ID', 'error');
        return;
    }
    
    try {
        const response = await fetch(API.START_QUESTION, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question_id: questionId, time_limit: timeLimit, buffer_time: bufferTime })
        });
        const data = await response.json();
        
        if (data.success) {
            log(`Started Q${questionId} (${timeLimit}s + ${bufferTime}s)`, 'success');
            activeQuestionId = questionId;
            refreshStatus();
            refreshSessions();
        } else {
            log(`Failed: ${data.message || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        log(`Error: ${error.message}`, 'error');
    }
}

async function stopCurrentQuestion() {
    const questionId = parseInt(document.getElementById('question-id').value);
    if (!questionId) {
        log('Enter question ID to stop', 'error');
        return;
    }
    
    try {
        const response = await fetch(API.STOP_QUESTION, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question_id: questionId })
        });
        const data = await response.json();
        
        if (data.success) {
            log(`Stopped Q${questionId}`, 'warning');
            if (activeQuestionId === questionId) activeQuestionId = null;
            refreshStatus();
            refreshSessions();
        } else {
            log(`Failed: ${data.message || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        log(`Error: ${error.message}`, 'error');
    }
}

async function resetAll() {
    if (!confirm('Reset ALL sessions?')) return;
    
    try {
        const response = await fetch(API.RESET_ALL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        
        if (data.success) {
            log('All sessions reset', 'warning');
            activeQuestionId = null;
            refreshStatus();
            refreshSessions();
        } else {
            log(`Failed: ${data.message}`, 'error');
        }
    } catch (error) {
        log(`Error: ${error.message}`, 'error');
    }
}

async function refreshStatus() {
    try {
        const response = await fetch(API.SESSIONS);
        const data = await response.json();
        const activeSessions = data.sessions?.filter(s => s.is_active) || [];
        
        const activeEl = document.getElementById('active-question');
        const timeEl = document.getElementById('time-remaining');
        const subsEl = document.getElementById('teams-submitted');
        const doneEl = document.getElementById('teams-completed');
        
        if (activeSessions.length === 0) {
            activeEl.textContent = '-';
            activeEl.classList.add('inactive');
            timeEl.textContent = '-';
            timeEl.classList.add('inactive');
            subsEl.textContent = '0';
            doneEl.textContent = '0';
            activeQuestionId = null;
            remainingSeconds = 0;
            return;
        }
        
        const session = activeSessions[activeSessions.length - 1];
        activeQuestionId = session.question_id;
        
        activeEl.textContent = `Q${session.question_id}`;
        activeEl.classList.remove('inactive');
        activeEl.classList.add('active');
        
        const elapsed = session.elapsed_time || 0;
        const totalTime = (session.time_limit || 300) + (session.buffer_time || 10);
        remainingSeconds = Math.max(0, Math.floor(totalTime - elapsed));
        
        updateCountdownDisplay();
        timeEl.classList.remove('inactive');
        timeEl.classList.add('active');
        
        subsEl.textContent = session.total_submissions || 0;
        doneEl.textContent = session.completed_teams || 0;
    } catch (error) {
        console.error('Status refresh error:', error);
    }
}

function updateCountdownDisplay() {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    document.getElementById('time-remaining').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

async function refreshSessions() {
    try {
        const response = await fetch(API.SESSIONS);
        const data = await response.json();
        const tbody = document.getElementById('sessions-tbody');
        
        if (!data.sessions || data.sessions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);">No sessions</td></tr>';
            return;
        }
        
        tbody.innerHTML = data.sessions.map(session => {
            const statusBadge = session.is_active 
                ? '<span class="status-badge status-active">Active</span>'
                : '<span class="status-badge status-inactive">Stopped</span>';
            const qType = questionConfig[session.question_id]?.type || '-';
            
            return `<tr>
                <td><strong>${session.question_id}</strong></td>
                <td>${qType}</td>
                <td>${statusBadge}</td>
                <td>${session.time_limit}s</td>
                <td>${session.total_submissions}</td>
                <td>${session.completed_teams}</td>
            </tr>`;
        }).join('');
    } catch (error) {
        console.error('Sessions refresh error:', error);
    }
}

function log(message, type = 'info') {
    const container = document.getElementById('log-container');
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    entry.innerHTML = `<span class="log-time">${time}</span><span class="log-message">${message}</span>`;
    
    container.insertBefore(entry, container.firstChild);
    
    // Keep only last 30 entries
    const entries = container.querySelectorAll('.log-entry');
    if (entries.length > 30) entries[entries.length - 1].remove();
}

window.startQuestion = startQuestion;
window.stopCurrentQuestion = stopCurrentQuestion;
window.resetAll = resetAll;
