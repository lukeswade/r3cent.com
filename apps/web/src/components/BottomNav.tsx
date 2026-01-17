import { NavLink } from 'react-router-dom';
import { HomeIcon, ChatIcon, MicIcon, SettingsIcon } from './icons';

const navItems = [
  { path: '/', label: 'Now', icon: HomeIcon },
  { path: '/ask', label: 'Ask', icon: ChatIcon },
  { path: '/capture', label: 'Capture', icon: MicIcon },
  { path: '/settings', label: 'Settings', icon: SettingsIcon },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav">
      <div className="flex justify-around items-center max-w-lg mx-auto">
        {navItems.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `nav-item ${isActive ? 'active' : ''}`
            }
          >
            <Icon className="w-6 h-6" />
            <span className="text-xs">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
