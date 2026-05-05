import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import styles from './Header.module.css';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <Link to="/">
          <span className={styles.logo}>Credit Path AI</span>
        </Link>
        <span className={styles.sub}>UKM FTSM Credit Transfer</span>
      </div>
      {user && (
        <div className={styles.right}>
          <span className={styles.name}>{user.name}</span>
          <span className={`badge badge-${user.role === 'student' ? 'primary' : 'warning'}`}>{user.role}</span>
          <button className="btn-secondary btn-sm" onClick={handleLogout}>Log Out</button>
        </div>
      )}
    </header>
  );
}
