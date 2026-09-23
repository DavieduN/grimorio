import { useState, useEffect } from 'react';
import { api } from '../services/api';

export function useLibrary() {
    const [library, setLibrary] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        api.getLibrary()
            .then(data => setLibrary(data))
            .catch(err => setError(err.message))
            .finally(() => setIsLoading(false));
    }, []);

    return { library, isLoading, error };
}