import React, { useState } from 'react';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  Bars3Icon,
  XMarkIcon,
  HomeIcon,
  UserGroupIcon,
  BriefcaseIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import ThemeToggle from './ThemeToggle';

type Props = {
  authed: boolean;
  isAdmin?: boolean;
  route: string;
  apifyReady: boolean;
  dbConnected: boolean;
  onSignOut: () => void;
};

const Navbar: React.FC<Props> = ({
  authed,
  isAdmin,
  route,
  apifyReady,
  dbConnected,
  onSignOut,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { href: '#/dashboard', label: 'Dashboard', icon: HomeIcon, route: 'dashboard' },
    { href: '#/profiles', label: 'Profiles', icon: UserGroupIcon, route: 'profiles' },
    { href: '#/leads', label: 'Leads', icon: BriefcaseIcon, route: 'leads' },
  ];

  if (isAdmin) {
    navItems.push({ href: '#/admin', label: 'Admin', icon: Cog6ToothIcon, route: 'admin' });
  }

  const handleNavClick = () => {
    setMobileMenuOpen(false);
  };

  return (
    <>
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-30 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex items-center justify-between">
          {/* Left: Logo + Desktop Nav */}
          <div className="flex items-center gap-4">
            {/* Mobile menu button */}
            {authed && (
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="sm:hidden p-2 -ml-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-95 transition-all duration-200"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <XMarkIcon className="h-6 w-6" />
                ) : (
                  <Bars3Icon className="h-6 w-6" />
                )}
              </button>
            )}

            <a
              href="#/"
              className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white tracking-tight"
            >
              <span className="hidden sm:inline">LinkedIn Insights Pro</span>
              <span className="sm:hidden">LI Pro</span>
            </a>

            {/* Desktop Navigation */}
            {authed && (
              <nav className="hidden sm:flex items-center gap-1 text-sm ml-4">
                {navItems.map((item) => (
                  <a
                    key={item.route}
                    href={item.href}
                    className={`px-3 py-1.5 rounded-lg transition-all duration-200 font-medium ${
                      route === item.route
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-blue-900/50'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 sm:gap-4 text-sm font-medium">
            {authed ? (
              <>
                <ThemeToggle />
                <button
                  onClick={onSignOut}
                  className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 active:scale-95"
                >
                  <ArrowRightOnRectangleIcon className="h-4 w-4" />
                  Logout
                </button>
                {/* Status indicators - desktop only */}
                <div className="hidden lg:flex items-center gap-1.5">
                  <span className="text-gray-500 dark:text-gray-400">Apify:</span>
                  {apifyReady ? (
                    <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                      <CheckCircleIcon className="h-4 w-4" /> Ready
                    </span>
                  ) : (
                    <span className="text-red-500 flex items-center gap-1">
                      <ExclamationTriangleIcon className="h-4 w-4" /> Missing
                    </span>
                  )}
                </div>
                <div className="hidden lg:flex items-center gap-1.5">
                  <span className="text-gray-500 dark:text-gray-400">DB:</span>
                  {dbConnected ? (
                    <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                      <CheckCircleIcon className="h-4 w-4" /> OK
                    </span>
                  ) : (
                    <span className="text-red-500 flex items-center gap-1">
                      <ExclamationTriangleIcon className="h-4 w-4" /> Err
                    </span>
                  )}
                </div>
              </>
            ) : (
              <a
                href="#/login"
                className="px-3 py-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 active:scale-95"
              >
                Login
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {authed && mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm sm:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Slide-in menu */}
          <div className="fixed top-0 left-0 bottom-0 z-50 w-72 bg-white dark:bg-gray-800 shadow-xl sm:hidden animate-in slide-in-from-left duration-200">
            {/* Menu Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <span className="text-lg font-bold text-gray-900 dark:text-white">菜单</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Navigation Links */}
            <nav className="p-4 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.route}
                    href={item.href}
                    onClick={handleNavClick}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${
                      route === item.route
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-blue-900/50'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </a>
                );
              })}
            </nav>

            {/* Divider */}
            <div className="mx-4 border-t border-gray-200 dark:border-gray-700" />

            {/* Status Section */}
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Apify 状态</span>
                {apifyReady ? (
                  <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                    <CheckCircleIcon className="h-4 w-4" /> 已就绪
                  </span>
                ) : (
                  <span className="text-red-500 flex items-center gap-1">
                    <ExclamationTriangleIcon className="h-4 w-4" /> 未配置
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">数据库</span>
                {dbConnected ? (
                  <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                    <CheckCircleIcon className="h-4 w-4" /> 已连接
                  </span>
                ) : (
                  <span className="text-red-500 flex items-center gap-1">
                    <ExclamationTriangleIcon className="h-4 w-4" /> 断开
                  </span>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="mx-4 border-t border-gray-200 dark:border-gray-700" />

            {/* Logout Button */}
            <div className="p-4">
              <button
                onClick={() => {
                  handleNavClick();
                  onSignOut();
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 font-medium transition-colors"
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
                退出登录
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default Navbar;
