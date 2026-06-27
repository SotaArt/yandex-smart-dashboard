import { useState, useEffect } from "react";

export function useYandexToken() {
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("yandex_access_token");
    if (saved) setTokenState(saved);
    setIsLoaded(true);
  }, []);

  const setToken = (newToken: string | null) => {
    if (newToken) {
      localStorage.setItem("yandex_access_token", newToken);
    } else {
      localStorage.removeItem("yandex_access_token");
    }
    setTokenState(newToken);
  };

  return { token, setToken, isLoaded };
}
