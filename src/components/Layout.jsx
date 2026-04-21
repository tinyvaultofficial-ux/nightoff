import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';

export default function Layout() {
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <Link to="/" className="sidebar-logo">
            <div className="sidebar-logo-icon">📋</div>
            <div>
              <div className="sidebar-logo-text">제안서 어시스턴트</div>
              <div className="sidebar-logo-sub">Proposal Agent</div>
            </div>
          </Link>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">메뉴</div>
          <NavLink to="/" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <span className="icon">👥</span> 클라이언트 목록
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <span className="icon">⚙️</span> 설정 (API 키)
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <Link to="/clients/new" className="sidebar-add-btn">
            <span>+</span> 클라이언트 추가
          </Link>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
