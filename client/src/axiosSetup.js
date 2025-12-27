import axios from 'axios';
import { toast } from 'react-hot-toast';

const setupAxios = (navigate) => {
    axios.interceptors.response.use(
        (response) => response,
        (error) => {
            // Handle 401 (Unauthorized) and 403 (Forbidden)
            if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                // Ignore if we are already on the login page to avoid loops
                // (though handling it gracefully is better)
                if (!window.location.pathname.includes('/login')) {
                    // Clear storage
                    localStorage.removeItem('token');
                    localStorage.removeItem('userId');
                    localStorage.removeItem('username');
                    localStorage.removeItem('email');
                    localStorage.setItem('isGuest', 'false');

                    toast.error('Session expired. Please log in again.');

                    // Redirect to login using the passed navigate function or window.location
                    if (navigate) {
                        navigate('/login');
                    } else {
                        window.location.href = '/login';
                    }
                }
            }
            return Promise.reject(error);
        }
    );
};

export default setupAxios;
