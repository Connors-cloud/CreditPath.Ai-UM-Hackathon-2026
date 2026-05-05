import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.js';
import Layout from './components/layout/Layout.jsx';

const Login = lazy(() => import('./pages/Login.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));

const StudentDashboard = lazy(() => import('./pages/student/StudentDashboard.jsx'));
const NewCreditTransferRequest = lazy(() => import('./pages/student/NewCreditTransferRequest.jsx'));
const NewPreEnrolmentPlanning = lazy(() => import('./pages/student/NewPreEnrolmentPlanning.jsx'));
const AnalysisResult = lazy(() => import('./pages/student/AnalysisResult.jsx'));
const AnalysisReport = lazy(() => import('./pages/student/AnalysisReport.jsx'));
const ApplicationTracking = lazy(() => import('./pages/student/ApplicationTracking.jsx'));

const LecturerDashboard = lazy(() => import('./pages/lecturer/LecturerDashboard.jsx'));
const ApplicationInbox = lazy(() => import('./pages/lecturer/ApplicationInbox.jsx'));
const ApplicationVerify = lazy(() => import('./pages/lecturer/ApplicationVerify.jsx'));
const SyllabusSearch = lazy(() => import('./pages/lecturer/SyllabusSearch.jsx'));

function Fallback() {
  return <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>Loading…</div>;
}

function RequireAuth({ children, role }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={user.role === 'lecturer' ? '/lecturer' : '/student'} replace />;
  return children;
}

export default function AppRoutes() {
  const { user } = useAuth();

  return (
    <Suspense fallback={<Fallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/student" element={<RequireAuth role="student"><Layout /></RequireAuth>}>
          <Route index element={<StudentDashboard />} />
          <Route path="new/credit-transfer" element={<NewCreditTransferRequest />} />
          <Route path="new/pre-enrolment" element={<NewPreEnrolmentPlanning />} />
          <Route path="analyses/:id" element={<AnalysisResult />} />
          <Route path="analyses/:id/report" element={<AnalysisReport />} />
          <Route path="applications/:id" element={<ApplicationTracking />} />
        </Route>

        <Route path="/lecturer" element={<RequireAuth role="lecturer"><Layout /></RequireAuth>}>
          <Route index element={<LecturerDashboard />} />
          <Route path="applications" element={<ApplicationInbox />} />
          <Route path="applications/:id" element={<ApplicationVerify />} />
<Route path="syllabus" element={<SyllabusSearch />} />
        </Route>

        <Route path="/" element={
          user
            ? <Navigate to={user.role === 'lecturer' ? '/lecturer' : '/student'} replace />
            : <Navigate to="/login" replace />
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
