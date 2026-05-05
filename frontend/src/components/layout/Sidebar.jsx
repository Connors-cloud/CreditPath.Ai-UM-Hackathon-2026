import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import styles from './Sidebar.module.css';

const studentNav = [
  { to: '/student', label: '🏠 Dashboard', exact: true },
  { to: '/student/new/credit-transfer', label: '📋 New Credit Transfer' },
  { to: '/student/new/pre-enrolment', label: '🎯 Pre-Enrolment Planning' }
];

const lecturerNav = [
  { to: '/lecturer', label: '🏠 Dashboard', exact: true },
  { to: '/lecturer/applications', label: '📥 Application Inbox' },
  { to: '/lecturer/syllabus', label: '🔍 Syllabus Search' }
];

export default function Sidebar() {
  const { isStudent, isLecturer } = useAuth();
  const nav = isStudent ? studentNav : isLecturer ? lecturerNav : [];

  return (
    <nav className={styles.sidebar}>
      {nav.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.exact}
          className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
