const BASE_URL = 'http://127.0.0.1:5000';
const USE_MOCKS = false; // Toggle this to switch between mock data and real backend

/**
 * Standard headers with dynamic token retrieval.
 */
function getHeaders() {
    const headers = {
        'Content-Type': 'application/json'
    };
    const token = localStorage.getItem('pulse_token');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

/**
 * Core fetch wrapper
 */
async function fetchWrapper(endpoint, options = {}) {
    if (USE_MOCKS) {
        return mockWrapper(endpoint, options);
    }

    try {
        const response = await fetch(`${BASE_URL}${endpoint}`, options);
        
        // Handle 401 Unauthorized globally
        if (response.status === 401) {
            localStorage.removeItem('pulse_token');
            localStorage.removeItem('pulse_user');
            window.location.href = '/index.html';
            throw new Error('Session expired. Please log in again.');
        }

        const contentType = response.headers.get("content-type");
        const data = contentType && contentType.includes("application/json") ? await response.json() : null;

        if (!response.ok) {
            const errorMsg = data && data.error && data.error.message ? data.error.message : `HTTP Error: ${response.status}`;
            throw new Error(errorMsg);
        }

        return data;
    } catch (error) {
        console.error(`API Error on ${endpoint}:`, error);
        throw error;
    }
}

// -----------------------------------------------------------------------------
// Exposed API Methods
// -----------------------------------------------------------------------------

export const api = {
    get: (endpoint) => fetchWrapper(endpoint, { method: 'GET', headers: getHeaders() }),
    
    post: (endpoint, body) => fetchWrapper(endpoint, { 
        method: 'POST', 
        headers: getHeaders(),
        body: JSON.stringify(body) 
    }),
    
    put: (endpoint, body) => fetchWrapper(endpoint, { 
        method: 'PUT', 
        headers: getHeaders(),
        body: JSON.stringify(body) 
    }),

    patch: (endpoint, body) => fetchWrapper(endpoint, { 
        method: 'PATCH', 
        headers: getHeaders(),
        body: JSON.stringify(body) 
    }),
    
    del: (endpoint) => fetchWrapper(endpoint, { method: 'DELETE', headers: getHeaders() })
};

// -----------------------------------------------------------------------------
// Mock Data Generation
// -----------------------------------------------------------------------------

// Local mock state
let mockCollections = JSON.parse(localStorage.getItem('mockCollections')) || [];
let mockInterests = JSON.parse(localStorage.getItem('mockInterests')) || [];

function saveMockState() {
    localStorage.setItem('mockCollections', JSON.stringify(mockCollections));
    localStorage.setItem('mockInterests', JSON.stringify(mockInterests));
}

async function mockWrapper(endpoint, options) {
    console.log(`[MOCK API] ${options.method || 'GET'} ${endpoint}`);
    
    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, 800));

    // MOCK: /api/tokens (Login)
    if (endpoint === '/api/tokens' && options.method === 'POST') {
        const body = JSON.parse(options.body);
        if (body.username === 'test' && body.password === 'password') {
            return {
                token: 'mock_jwt_token_12345',
                user: { id: 1, username: 'test', weights_json: '{}', source_prefs_json: '{}' }
            };
        }
        throw new Error('Invalid username or password (use test/password)');
    }

    // MOCK: /api/users (Register)
    if (endpoint === '/api/users' && options.method === 'POST') {
        const body = JSON.parse(options.body);
        
        // Reset mock state for new user
        mockCollections = [];
        mockInterests = [];
        saveMockState();
        
        return {
            token: 'mock_jwt_token_12345',
            user: { id: 2, username: body.username, weights_json: '{}', source_prefs_json: '{}' }
        };
    }

    // Protect all other routes in mock mode
    if (!localStorage.getItem('pulse_token')) {
        window.location.href = '/index.html';
        throw new Error('Unauthorized');
    }

    // MOCK: /api/users/me
    if (endpoint === '/api/users/me' && options.method === 'GET') {
        return { user: { id: 1, username: 'test_user' } };
    }

    if (endpoint === '/api/users/me' && options.method === 'PATCH') {
        const body = JSON.parse(options.body);
        let user = JSON.parse(localStorage.getItem('pulse_user')) || { id: 1, username: 'test_user' };
        user = { ...user, ...body };
        localStorage.setItem('pulse_user', JSON.stringify(user));
        return { user: user };
    }

    // MOCK: /api/items
    if (endpoint.startsWith('/api/items') && options.method === 'GET') {
        const user = JSON.parse(localStorage.getItem('pulse_user')) || {};
        const prefs = user.source_prefs_json ? JSON.parse(user.source_prefs_json) : { news: 33, video: 33, discuss: 33 };
        
        let stories = [];
        let storyId = 100;
        
        // Helper to generate stories for a source type
        const generateStories = (sourceType, weight, numStories) => {
            for (let i = 0; i < numStories; i++) {
                // Pick a random interest or default
                const interest = mockInterests.length > 0 
                    ? mockInterests[Math.floor(Math.random() * mockInterests.length)].name 
                    : 'General Topic';
                
                stories.push({
                    id: ++storyId,
                    title: `Latest updates on ${interest}`,
                    summary: `Here is a simulated ${sourceType} feed item about ${interest}.`,
                    relevance: Math.floor(Math.random() * 40) + 60, // 60-99
                    sourceType: sourceType,
                    createdAt: new Date(Date.now() - Math.random() * 86400000 * 3).toISOString()
                });
            }
        };

        // Calculate proportions
        const totalPref = prefs.news + prefs.video + prefs.discuss || 1;
        const totalStories = 15; // Generate 15 stories total
        
        const newsCount = Math.round((prefs.news / totalPref) * totalStories);
        const videoCount = Math.round((prefs.video / totalPref) * totalStories);
        const discussCount = totalStories - newsCount - videoCount; // Remainder

        generateStories('gnews', prefs.news, newsCount);
        generateStories('youtube', prefs.video, videoCount);
        generateStories('lemmy', prefs.discuss, discussCount);
        
        // Shuffle stories
        stories.sort(() => Math.random() - 0.5);

        return stories;
    }

    // MOCK: /api/search
    if (endpoint.startsWith('/api/search')) {
        return [
            {
                id: 104,
                title: "Search Result for query",
                summary: "This is a mocked search result object.",
                relevance: 60,
                sourceType: "gnews"
            }
        ];
    }

    // MOCK: /api/stories/:id
    if (endpoint.match(/^\/api\/stories\/\d+$/) && options.method === 'GET') {
        const id = endpoint.split('/').pop();
        return {
            id: id,
            title: `Detailed View for Story #${id}`,
            content: "<p>This is the full extracted content for this story. In the real application, this would contain the complete article text, properly formatted from the original source.</p><p>It provides deeper context than the summary shown on the timeline or search results.</p>",
            sourceType: "gnews",
            url: "https://example.com/original-article",
            comments: [
                { author: "user_123", body: "Great insights on this topic!" },
                { author: "pulse_fan", body: "Thanks for sharing this." }
            ]
        };
    }

    // MOCK: /api/interests
    if (endpoint === '/api/interests' && options.method === 'GET') {
        return mockInterests;
    }

    if (endpoint === '/api/interests' && options.method === 'POST') {
        const body = JSON.parse(options.body);
        const newInterest = { id: Date.now(), name: body.name, keywords: body.keywords, weight: body.weight };
        mockInterests.push(newInterest);
        saveMockState();
        return newInterest;
    }

    // MOCK: /api/collections
    if (endpoint === '/api/collections' && options.method === 'GET') {
        return mockCollections;
    }

    if (endpoint === '/api/collections' && options.method === 'POST') {
        const body = JSON.parse(options.body);
        const newCol = { id: Date.now(), name: body.name, itemCount: 0 };
        mockCollections.push(newCol);
        saveMockState();
        return newCol;
    }
    
    if (endpoint.startsWith('/api/collections/') && options.method === 'PUT') {
        const id = parseInt(endpoint.split('/').pop());
        const body = JSON.parse(options.body);
        const col = mockCollections.find(c => c.id === id);
        if (col) col.name = body.name;
        saveMockState();
        return col;
    }

    if (endpoint.startsWith('/api/collections/') && options.method === 'DELETE') {
        const id = parseInt(endpoint.split('/').pop());
        mockCollections = mockCollections.filter(c => c.id !== id);
        saveMockState();
        return { success: true };
    }

    // Default catch-all
    return { status: "success", message: "Mocked response for " + endpoint };
}
