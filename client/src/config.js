
let API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

if (API_URL && !API_URL.startsWith('http')) {
    API_URL = 'https://' + API_URL;
}

if (API_URL && API_URL.endsWith('/')) {
    API_URL = API_URL.slice(0, -1);
}

export default API_URL;
