import { useEffect, useState } from 'react';

const format = (ms) => {
  if (ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return days > 0 ? `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

/** Live-ticking "time until expiresAt" label, formatted HH:MM:SS (or "Nd HH:MM:SS" past 24h). */
export const useCountdown = (expiresAt) => {
  const target = new Date(expiresAt).getTime();
  const [label, setLabel] = useState(() => format(target - Date.now()));

  useEffect(() => {
    const id = setInterval(() => setLabel(format(target - Date.now())), 1000);
    return () => clearInterval(id);
  }, [target]);

  return label;
};
