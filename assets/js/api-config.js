/**
 * PC Builder - API Configuration
 * 
 * BASE_URL can be configured via:
 * 1. <meta name="api-base-url" content="https://api.example.com"> in HTML
 * 2. Environment variable (if using a build step)
 * 3. Defaults to localhost for development
 */

(function() {
    'use strict';

    /**
     * Get the API base URL from various sources in order of priority:
     * 1. Meta tag in HTML (for runtime configuration)
     * 2. window.__API_BASE_URL__ (for build-time injection)
     * 3. Default to localhost development server
     */
    function getApiBaseUrl() {
        // Check for meta tag (runtime configuration)
        const metaTag = document.querySelector('meta[name="api-base-url"]');
        if (metaTag && metaTag.content) {
            return metaTag.content.replace(/\/$/, '');
        }

        // Check for build-time injected variable
        if (typeof window !== 'undefined' && window.__API_BASE_URL__) {
            return window.__API_BASE_URL__.replace(/\/$/, '');
        }

        // Default to local development backend
        return 'http://localhost:8000/api';
    }

    const API_CONFIG = {
        BASE_URL: getApiBaseUrl(),
        ENDPOINTS: {
            CATEGORIES: '/hardware/categories/',
            COMPONENTS: (category) => `/hardware/categories/${category}/components/`,
            FILTERS: (category) => `/hardware/categories/${category}/filters/`,
            DETAIL: (category, id) => `/hardware/categories/${category}/components/${id}/`,
            ANALYZE: '/analysis/analyze/',
            HEALTH: '/analysis/health/'
        }
    };

    // Expose globally for other scripts
    window.API_CONFIG = API_CONFIG;

    /**
     * Generic API fetch helper with error handling
     */
    window.apiFetch = async function(endpoint, options = {}) {
        const url = `${API_CONFIG.BASE_URL}${endpoint}`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
            ...options
        };

        try {
            const response = await fetch(url, defaultOptions);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `API Error: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`[API] ${endpoint} failed:`, error);
            throw error;
        }
    };

    // Convenience methods
    window.hardwareAPI = {
        getCategories: () => apiFetch(API_CONFIG.ENDPOINTS.CATEGORIES),
        getComponents: (category) => apiFetch(API_CONFIG.ENDPOINTS.COMPONENTS(category)),
        getComponent: (category, id) => apiFetch(API_CONFIG.ENDPOINTS.DETAIL(category, id)),
        getFilters: (category) => apiFetch(API_CONFIG.ENDPOINTS.FILTERS(category)),
    };

    window.analysisAPI = {
        analyze: (selections) => apiFetch(API_CONFIG.ENDPOINTS.ANALYZE, {
            method: 'POST',
            body: JSON.stringify({ selections })
        }),
        health: () => apiFetch(API_CONFIG.ENDPOINTS.HEALTH),
    };

    // Log API configuration in development
    if (API_CONFIG.BASE_URL.includes('localhost') || API_CONFIG.BASE_URL.includes('127.0.0.1')) {
        console.log('[API] Using development backend:', API_CONFIG.BASE_URL);
    } else {
        console.log('[API] Using production backend:', API_CONFIG.BASE_URL);
    }
})();