import React from 'react';
import './Header.css';

const Header = ({ darkMode, toggleDarkMode }) => {
  return (
    <header className="header">
      <div className="header-content">
        <div>
          <h1 className="app-title">Voice Notes</h1>
          <p className="subtitle">Talk as long as you want • Stop when you're done • Zero duplicates</p>
        </div>
        <button onClick={toggleDarkMode} className="theme-toggle" aria-label="Toggle dark mode">
          {darkMode ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  );
};

export default Header;