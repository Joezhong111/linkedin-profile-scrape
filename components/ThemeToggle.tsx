import React from 'react';
import { useTheme } from '../lib/ThemeContext';
import { SunIcon, MoonIcon, ComputerDesktopIcon } from '@heroicons/react/24/outline';

export default function ThemeToggle() {
    const { theme, setTheme } = useTheme();

    const toggleTheme = () => {
        if (theme === 'light') {
            setTheme('dark');
        } else if (theme === 'dark') {
            setTheme('system');
        } else {
            setTheme('light');
        }
    };

    return (
        <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-400 transition-colors"
            title={`Current: ${theme}`}
        >
            {theme === 'light' && <SunIcon className="w-5 h-5" />}
            {theme === 'dark' && <MoonIcon className="w-5 h-5" />}
            {theme === 'system' && <ComputerDesktopIcon className="w-5 h-5" />}
        </button>
    );
}
