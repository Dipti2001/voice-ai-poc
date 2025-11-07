// Voice AI Agent System Frontend

class VoiceAIAgentSystem {
    constructor() {
        this.currentTab = 'agents';
        this.ws = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadAgents();
        this.loadCalls();
        this.loadAnalytics();
    }

    bindEvents() {
        // Tab switching
        document.getElementById('agents-tab').addEventListener('click', () => this.switchTab('agents'));
        document.getElementById('calls-tab').addEventListener('click', () => this.switchTab('calls'));
        document.getElementById('analytics-tab').addEventListener('click', () => this.switchTab('analytics'));

        // Agent modal
        document.getElementById('create-agent-btn').addEventListener('click', () => this.openAgentModal());
        document.getElementById('agent-form').addEventListener('submit', (e) => this.saveAgent(e));

        // Call modal
        document.getElementById('make-call-btn').addEventListener('click', () => this.openCallModal());
        document.getElementById('call-form').addEventListener('submit', (e) => this.makeCall(e));

        // Modal close
        document.querySelectorAll('.modal-close').forEach(close => {
            close.addEventListener('click', () => this.closeAllModals());
        });

        // Click outside modal to close
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeAllModals();
            });
        });
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
        document.getElementById(`${tabName}-tab`).classList.add('active');

        // Update sections
        document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
        document.getElementById(`${tabName}-section`).classList.add('active');

        this.currentTab = tabName;
    }

    async loadAgents() {
        try {
            const response = await fetch('/api/agents');
            const agents = await response.json();
            this.renderAgents(agents);
        } catch (error) {
            console.error('Error loading agents:', error);
            this.showError('Failed to load agents');
        }
    }

    renderAgents(agents) {
        const container = document.getElementById('agents-list');
        container.innerHTML = '';

        if (agents.length === 0) {
            container.innerHTML = '<p class="empty-state">No agents created yet. Create your first agent to get started.</p>';
            return;
        }

        agents.forEach(agent => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <h3>${agent.name}</h3>
                <p><strong>Type:</strong> ${agent.type}</p>
                <p><strong>Voice:</strong> ${agent.voice}</p>
                ${agent.phone_number ? `<p><strong>Phone:</strong> ${agent.phone_number}</p>` : ''}
                <p class="prompt-preview">${agent.prompt.substring(0, 100)}...</p>
                <div class="card-actions">
                    <button class="btn secondary" onclick="app.editAgent('${agent.id}')">Edit</button>
                    <button class="btn danger" onclick="app.deleteAgent('${agent.id}')">Delete</button>
                </div>
            `;
            container.appendChild(card);
        });
    }

    async loadCalls() {
        try {
            const response = await fetch('/api/calls');
            const calls = await response.json();
            this.renderCalls(calls);
        } catch (error) {
            console.error('Error loading calls:', error);
            this.showError('Failed to load calls');
        }
    }

    renderCalls(calls) {
        const container = document.getElementById('calls-list');
        container.innerHTML = '';

        if (calls.length === 0) {
            container.innerHTML = '<p class="empty-state">No calls recorded yet.</p>';
            return;
        }

        calls.forEach(call => {
            const card = document.createElement('div');
            card.className = 'card';
            const statusClass = call.success ? 'success' : call.rating < 5 ? 'error' : 'warning';
            card.innerHTML = `
                <h3>${call.customer_number}</h3>
                <p><strong>Agent:</strong> ${call.agent_name}</p>
                <p><strong>Direction:</strong> ${call.direction}</p>
                <p><strong>Status:</strong> <span class="status ${statusClass}">${call.success ? 'Successful' : 'Needs Improvement'}</span></p>
                ${call.rating ? `<p><strong>Rating:</strong> ${call.rating}/10</p>` : ''}
                <p><strong>Date:</strong> ${new Date(call.created_at).toLocaleDateString()}</p>
                <div class="card-actions">
                    <button class="btn primary" onclick="app.viewConversation('${call.id}')">View Details</button>
                </div>
            `;
            container.appendChild(card);
        });
    }

    async loadAnalytics() {
        try {
            const response = await fetch('/api/calls/analytics');
            const analytics = await response.json();
            this.renderAnalytics(analytics);
        } catch (error) {
            console.error('Error loading analytics:', error);
            this.showError('Failed to load analytics');
        }
    }

    renderAnalytics(analytics) {
        const container = document.getElementById('analytics-content');
        container.innerHTML = `
            <div class="metric-card">
                <div class="metric-value">${analytics.total_calls || 0}</div>
                <div class="metric-label">Total Calls</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${analytics.successful_calls || 0}</div>
                <div class="metric-label">Successful Calls</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${analytics.avg_rating ? analytics.avg_rating.toFixed(1) : 0}</div>
                <div class="metric-label">Average Rating</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${analytics.avg_duration ? Math.round(analytics.avg_duration) : 0}s</div>
                <div class="metric-label">Avg Duration</div>
            </div>
        `;
    }

    openAgentModal(agent = null) {
        const modal = document.getElementById('agent-modal');
        const form = document.getElementById('agent-form');
        const title = document.getElementById('agent-modal-title');

        if (agent) {
            title.textContent = 'Edit Agent';
            document.getElementById('agent-name').value = agent.name;
            document.getElementById('agent-type').value = agent.type;
            document.getElementById('agent-voice').value = agent.voice;
            document.getElementById('agent-phone').value = agent.phone_number || '';
            document.getElementById('agent-prompt').value = agent.prompt;
            form.dataset.agentId = agent.id;
        } else {
            title.textContent = 'Create Agent';
            form.reset();
            delete form.dataset.agentId;
        }

        modal.classList.add('show');
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => modal.classList.remove('show'));
    }

    async saveAgent(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const agentData = {
            name: formData.get('agent-name'),
            type: formData.get('agent-type'),
            voice: formData.get('agent-voice'),
            phone_number: formData.get('agent-phone'),
            prompt: formData.get('agent-prompt')
        };

        try {
            const agentId = e.target.dataset.agentId;
            let response;

            if (agentId) {
                response = await fetch(`/api/agents/${agentId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(agentData)
                });
            } else {
                response = await fetch('/api/agents', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(agentData)
                });
            }

            if (response.ok) {
                this.closeAllModals();
                this.loadAgents();
                this.showSuccess(agentId ? 'Agent updated successfully' : 'Agent created successfully');
            } else {
                throw new Error('Failed to save agent');
            }
        } catch (error) {
            console.error('Error saving agent:', error);
            this.showError('Failed to save agent');
        }
    }

    async deleteAgent(agentId) {
        if (!confirm('Are you sure you want to delete this agent?')) return;

        try {
            const response = await fetch(`/api/agents/${agentId}`, { method: 'DELETE' });
            if (response.ok) {
                this.loadAgents();
                this.showSuccess('Agent deleted successfully');
            } else {
                throw new Error('Failed to delete agent');
            }
        } catch (error) {
            console.error('Error deleting agent:', error);
            this.showError('Failed to delete agent');
        }
    }

    editAgent(agentId) {
        // Find agent from current list (could be optimized with caching)
        const agentCard = document.querySelector(`[onclick*="editAgent('${agentId}')"]`);
        if (agentCard) {
            // Extract agent data from DOM (simplified approach)
            this.openAgentModal({ id: agentId });
        }
    }

    openCallModal() {
        const modal = document.getElementById('call-modal');
        const agentSelect = document.getElementById('call-agent');

        // Load agents into select
        fetch('/api/agents')
            .then(response => response.json())
            .then(agents => {
                agentSelect.innerHTML = '<option value="">Select an agent</option>';
                agents.forEach(agent => {
                    agentSelect.innerHTML += `<option value="${agent.id}">${agent.name}</option>`;
                });
            })
            .catch(error => {
                console.error('Error loading agents for call:', error);
                this.showError('Failed to load agents');
            });

        modal.classList.add('show');
    }

    async makeCall(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const callData = {
            agent_id: formData.get('call-agent'),
            to: formData.get('call-number')
        };

        try {
            const response = await fetch('/api/calls/outbound', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(callData)
            });

            if (response.ok) {
                this.closeAllModals();
                this.loadCalls();
                this.showSuccess('Call initiated successfully');
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to make call');
            }
        } catch (error) {
            console.error('Error making call:', error);
            this.showError(error.message);
        }
    }

    async viewConversation(conversationId) {
        try {
            const response = await fetch(`/api/calls/${conversationId}`);
            const conversation = await response.json();

            const modal = document.getElementById('conversation-modal');
            const content = document.getElementById('conversation-content');

            content.innerHTML = `
                <div class="conversation-info">
                    <p><strong>Agent:</strong> ${conversation.agent_name}</p>
                    <p><strong>Customer:</strong> ${conversation.customer_number}</p>
                    <p><strong>Direction:</strong> ${conversation.direction}</p>
                    <p><strong>Rating:</strong> ${conversation.rating || 'Not rated'}/10</p>
                    <p><strong>Success:</strong> ${conversation.success ? 'Yes' : 'No'}</p>
                </div>
                <div class="conversation-messages">
                    ${conversation.messages.map(msg => `
                        <div class="message ${msg.role}">
                            <div class="message-role">${msg.role === 'user' ? 'Customer' : 'Agent'}</div>
                            <div class="message-content">${msg.content}</div>
                        </div>
                    `).join('')}
                </div>
            `;

            modal.classList.add('show');
        } catch (error) {
            console.error('Error loading conversation:', error);
            this.showError('Failed to load conversation');
        }
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type) {
        // Simple notification - could be enhanced with a proper notification system
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 5px;
            color: white;
            background: ${type === 'success' ? '#27ae60' : '#e74c3c'};
            z-index: 1001;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;

        document.body.appendChild(notification);
        setTimeout(() => document.body.removeChild(notification), 3000);
    }
}

// Initialize the application
const app = new VoiceAIAgentSystem;