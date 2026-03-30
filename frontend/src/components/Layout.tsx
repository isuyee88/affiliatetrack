import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Megaphone,
  Gift,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Globe,
  Network,
  MousePointerClick,
  DollarSign,
  Layers,
  Route,
  LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '../stores/auth';

interface LayoutProps {
  children: ReactNode;
}

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { path: '/flows', label: 'Flows', icon: Route },
  { path: '/offers', label: 'Offers', icon: Gift },
  { path: '/traffic-sources', label: 'Traffic Sources', icon: Globe },
  { path: '/affiliate-networks', label: 'Affiliate Networks', icon: Network },
  {
    path: '/reports',
    label: 'Reports',
    icon: BarChart3,
    children: [
      { path: '/reports/overview', label: 'Overview', icon: BarChart3 },
      { path: '/reports/clicks', label: 'Clicks Log', icon: MousePointerClick },
      { path: '/reports/conversions', label: 'Conversions Log', icon: DollarSign },
    ],
  },
  { path: '/domains', label: 'Domains', icon: Layers },
  { path: '/settings', label: 'Settings', icon: Settings },
];

function NavItemComponent({ item, sidebarOpen, setSidebarOpen }: { item: NavItem; sidebarOpen: boolean; setSidebarOpen: (open: boolean) => void }) {
  const location = useLocation();
  const [expanded, setExpanded] = useState(false);
  const Icon = item.icon;

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const hasChildren = item.children && item.children.length > 0;
  const active = isActive(item.path);

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            active ? 'bg-primary-50 text-primary-600' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center">
            <Icon className="w-5 h-5 mr-3" />
            {item.label}
          </div>
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
        {expanded && (
          <div className="mt-1 ml-4 space-y-1">
            {item.children!.map((child) => {
              const ChildIcon = child.icon;
              return (
                <Link
                  key={child.path}
                  to={child.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive(child.path)
                      ? 'bg-primary-50 text-primary-600'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <ChildIcon className="w-4 h-4 mr-3" />
                  {child.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      to={item.path}
      onClick={() => setSidebarOpen(false)}
      className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active ? 'bg-primary-50 text-primary-600' : 'text-gray-600 hover:bg-gray-50'
      }`}
    >
      <Icon className="w-5 h-5 mr-3" />
      {item.label}
    </Link>
  );
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          <Link to="/" className="text-xl font-bold text-primary-600">
            AffiliateTrack
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded-md hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map((item) => (
            <NavItemComponent
              key={item.path}
              item={item}
              sidebarOpen={sidebarOpen}
              setSidebarOpen={setSidebarOpen}
            />
          ))}
        </nav>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-64">
        {/* Header */}
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between h-full px-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-md hover:bg-gray-100"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="hidden lg:block" />

            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">{user?.email}</span>
              <button
                onClick={logout}
                className="flex items-center text-sm text-gray-600 hover:text-gray-900"
              >
                <LogOut className="w-4 h-4 mr-1" />
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
