/**
 * PC Builder - API Service Layer
 * Handles all API calls to Django backend.
 */

const hardwareAPI = {
    /**
     * Fetch all categories
     */
    async getCategories() {
        return await apiFetch(API_CONFIG.ENDPOINTS.CATEGORIES);
    },

    /**
     * Fetch components for a category with optional filters
     */
    async getComponents(category, filters = {}) {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value) params.append(key, value);
        });
        const endpoint = API_CONFIG.ENDPOINTS.COMPONENTS(category);
        const queryString = params.toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return await apiFetch(url);
    },

    /**
     * Fetch filter options for a category
     */
    async getFilterOptions(category, appliedFilters = {}) {
        const params = new URLSearchParams();
        Object.entries(appliedFilters).forEach(([key, value]) => {
            if (value) params.append(key, value);
        });
        const endpoint = API_CONFIG.ENDPOINTS.FILTERS(category);
        const queryString = params.toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return await apiFetch(url);
    },

    /**
     * Fetch a single component by ID
     */
    async getComponent(category, id) {
        return await apiFetch(API_CONFIG.ENDPOINTS.DETAIL(category, id));
    },

    /**
     * Search components within a category
     */
    async searchComponents(category, query) {
        const allComponents = await this.getComponents(category);
        if (!query) return allComponents;
        const lowerQuery = query.toLowerCase();
        return allComponents.filter(item => item.name && item.name.toLowerCase().includes(lowerQuery));
    }
};

const analysisAPI = {
    /**
     * Submit a PC configuration for analysis
     */
    async analyze(selections) {
        return await apiFetch(API_CONFIG.ENDPOINTS.ANALYZE, {
            method: 'POST',
            body: JSON.stringify({ selections: selections })
        });
    },

    /**
     * Check API health
     */
    async checkHealth() {
        return await apiFetch(API_CONFIG.ENDPOINTS.HEALTH);
    }
};
