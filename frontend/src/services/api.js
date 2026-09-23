const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = {
    async getLibrary() {
        const response = await fetch(`${API_URL}/library/`);
        if (!response.ok) {
            throw new Error('Failed to fetch library data');
        }
        return response.json();
    },

    async buildNotebook(payload) {
        const response = await fetch(`${API_URL}/notebook/build`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || 'Failed to build notebook');
        }
        
        return response.blob();
    }
};