'use client';

import type React from 'react';
import { useState, useEffect } from 'react';

type CountdownTime = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

const Countdown: React.FC = () => {
  const [countdown, setCountdown] = useState<CountdownTime>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [mounted, setMounted] = useState(false);

  // Fête de la Musique 2025 - Saturday, June 21st, 2025
  const eventDate = new Date('2025-06-21T00:00:00+02:00'); // Paris timezone

  const calculateCountdown = (now: Date): CountdownTime => {
    const difference = eventDate.getTime() - now.getTime();
    
    if (difference <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    }

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);

    return { days, hours, minutes, seconds };
  };

  const formatCountdown = (countdown: CountdownTime): string => {
    if (countdown.days === 0 && countdown.hours === 0 && countdown.minutes === 0 && countdown.seconds === 0) {
      return "🎉 C'est aujourd'hui ! Fête de la Musique is happening now! 🎊";
    }

    const parts = [];
    if (countdown.days > 0) parts.push(`${countdown.days}d`);
    if (countdown.hours > 0) parts.push(`${countdown.hours}h`);
    if (countdown.minutes > 0) parts.push(`${countdown.minutes}m`);
    if (countdown.seconds > 0) parts.push(`${countdown.seconds}s`);

    return `⏰ ${parts.join(' ')} until Saturday, June 21st`;
  };

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => {
      const now = new Date();
      setCountdown(calculateCountdown(now));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (!mounted) {
    return (
      <div className="text-center">
        <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
          ⏰ Saturday, June 21st, 2025 - Fête de la Musique
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium font-mono">
        {formatCountdown(countdown)}
      </div>
    </div>
  );
};

export default Countdown; 