import React, { useState, useEffect, useRef } from 'react';
import { SUPPORTED_LANGUAGES, getLanguageDisplay } from '../services/languageService';

const LanguageSelector = ({ currentLang, onLanguageChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLanguageChange = (langCode) => {
    onLanguageChange(langCode);
    setIsOpen(false);
    localStorage.setItem('preferredLanguage', langCode);
  };

  const currentLangData = SUPPORTED_LANGUAGES[currentLang];

  return (
    <div className="language-selector-premium" ref={dropdownRef}>
      <button className="language-trigger" onClick={() => setIsOpen(!isOpen)}>
        <div className="language-trigger-content">
          <span className="language-flag-large">{currentLangData?.flag || '🌐'}</span>
          <div className="language-text">
            <span className="language-name">{currentLangData?.name || 'English'}</span>
            <span className="language-native">{currentLangData?.nativeName || 'English'}</span>
          </div>
          <svg className={`dropdown-icon ${isOpen ? 'open' : ''}`} width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </button>

      {isOpen && (
        <div className="language-dropdown-premium">
          <div className="language-dropdown-header">
            <span>🌐 Select Language</span>
            <span className="language-count">{Object.keys(SUPPORTED_LANGUAGES).length} languages</span>
          </div>
          <div className="language-search">
            <input 
              type="text" 
              placeholder="Search language..." 
              className="language-search-input"
              id="languageSearch"
              onChange={(e) => {
                const searchTerm = e.target.value.toLowerCase();
                const items = document.querySelectorAll('.language-option-premium');
                items.forEach(item => {
                  const text = item.textContent.toLowerCase();
                  if (text.includes(searchTerm)) {
                    item.style.display = 'flex';
                  } else {
                    item.style.display = 'none';
                  }
                });
              }}
            />
          </div>
          <div className="language-list">
            {Object.entries(SUPPORTED_LANGUAGES).map(([code, lang]) => (
              <button
                key={code}
                className={`language-option-premium ${currentLang === code ? 'active' : ''}`}
                onClick={() => handleLanguageChange(code)}
              >
                <span className="lang-flag-premium">{lang.flag}</span>
                <div className="lang-info">
                  <span className="lang-name-premium">{lang.name}</span>
                  <span className="lang-native-premium">{lang.nativeName}</span>
                </div>
                {currentLang === code && (
                  <span className="lang-check">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;