

import React, { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { User } from "@/api/entities";
import { createPageUrl } from "@/utils";
import {
  Home,
  Users,
  PlusCircle,
  Clock,
  User as UserIcon,
  Settings,
  Target,
  FolderKanban,
  Github,
  LogOut,
  Bug,
  Lightbulb,
  Wrench,
  Menu,
  X
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import GitHubConnectModal from "../components/layout/GitHubConnectModal";
import BugReportFormModal from "../components/bug_tracker/BugReportFormModal";
import TermsOfServiceModal from "../components/legal/TermsOfServiceModal";
import TutorialOverlay from "../components/tutorial/TutorialOverlay";
import { getStepsForPage } from "../components/tutorial/tutorialSteps";

const navigationItems = [
  {
    title: "Feed",
    url: createPageUrl("Dashboard"),
    icon: Home,
    description: "See what's happening"
  },
  {
    title: "Workspace",
    url: createPageUrl("Workspace"),
    icon: FolderKanban,
    description: "Your personal projects"
  },
  {
    title: "Create",
    url: createPageUrl("CreateQuest"),
    icon: PlusCircle,
    description: "Share your work"
  },
  {
    title: "Community",
    url: createPageUrl("Community"),
    icon: Users,
    description: "Find your tribe"
  },
  {
    title: "Activity",
    url: createPageUrl("QuestLogs"),
    icon: Clock,
    description: "Track progress"
  },
];

const roleTypeColors = {
  creator: {
    primary: "#8b5cf6",
    secondary: "#a78bfa", 
    accent: "#c4b5fd",
    light: "#f3f4f6"
  },
  developer: {
    primary: "#3b82f6",
    secondary: "#60a5fa",
    accent: "#93c5fd", 
    light: "#f3f4f6"
  },
  freelancer: {
    primary: "#10b981",
    secondary: "#34d399",
    accent: "#6ee7b7",
    light: "#f3f4f6"
  },
  explorer: {
    primary: "#f59e0b", 
    secondary: "#fbbf24",
    accent: "#fcd34d",
    light: "#f3f4f6"
  }
};

export default function Layout({ children, currentPageName: propCurrentPageName }) {
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(null);
  const [showGitHubModal, setShowGitHubModal] = useState(false);
  const [showBugReportModal, setShowBugReportModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const applyUserTheme = useCallback((user) => {
    const root = document.documentElement;
    const themeMode = user.theme_mode || 'system';
    const userType = user.user_type || 'explorer';
    const useRoleColors = user.use_role_colors !== false;

    const isDarkMode = themeMode === 'dark' || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    if (useRoleColors && roleTypeColors[userType]) {
      const colors = roleTypeColors[userType];
      root.style.setProperty('--primary-color', colors.primary);
      root.style.setProperty('--secondary-color', colors.secondary);
      root.style.setProperty('--accent-color', colors.accent);
      root.style.setProperty('--light-color', colors.light);
    } else {
      root.style.removeProperty('--primary-color');
      root.style.removeProperty('--secondary-color');
      root.style.removeProperty('--accent-color');
      root.style.removeProperty('--light-color');
    }
  }, []); // roleTypeColors is a constant, document/window are stable globals

  const fetchUser = useCallback(() => {
    User.me()
      .then((user) => {
        setCurrentUser(user);
        applyUserTheme(user);
        
        // Check if user needs to accept terms
        if (!user.terms_accepted) {
          setShowTermsModal(true);
        }
      })
      .catch(() => {
        setCurrentUser(null);
        setShowTermsModal(false);
      });
  }, [applyUserTheme]); // applyUserTheme is now a dependency as it's a callback

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const getPageNameFromPath = (pathname) => {
    if (pathname.includes('Dashboard') || pathname === '/') return 'dashboard';
    if (pathname.includes('Workspace')) return 'workspace';
    if (pathname.includes('CreateQuest')) return 'create';
    if (pathname.includes('Community')) return 'community';
    if (pathname.includes('QuestLogs')) return 'activity';
    return null;
  };

  // Check if tutorial should be shown for current page
  useEffect(() => {
    const pageName = getPageNameFromPath(location.pathname);
    if (currentUser && !currentUser.tutorial_completed && pageName) {
      if (!currentUser.tutorial_progress?.[pageName]) {
        setShowTutorial(true);
        setTutorialStep(0);
      } else {
        setShowTutorial(false);
      }
    } else {
      setShowTutorial(false);
    }
  }, [location.pathname, currentUser]);

  const onGitHubConnect = () => {
    fetchUser();
    setShowGitHubModal(false);
  };

  const handleTermsAccept = async () => {
    try {
      await User.updateMyUserData({ 
        terms_accepted: true, 
        terms_accepted_date: new Date().toISOString() 
      });
      setShowTermsModal(false);
      fetchUser();
    } catch (error) {
      console.error("Error accepting terms:", error);
    }
  };

  const handleTermsDecline = () => {
    User.logout();
  };

  const handleTutorialComplete = async () => {
    const pageName = getPageNameFromPath(location.pathname);
    if (pageName && currentUser) {
      try {
        const updatedProgress = {
          ...currentUser.tutorial_progress,
          [pageName]: true
        };
        
        const tutorialPages = ['dashboard', 'workspace', 'create', 'community', 'activity'];
        const allPagesCompleted = tutorialPages.every(page => updatedProgress[page]);
        
        await User.updateMyUserData({
          tutorial_progress: updatedProgress,
          tutorial_completed: allPagesCompleted
        });
        
        setShowTutorial(false);
        fetchUser();
      } catch (error) {
        console.error("Error updating tutorial progress:", error);
      }
    }
  };

  const adminNavigationItems = [
    {
        title: "Bug Tracker",
        url: createPageUrl("BugTracker"),
        icon: Bug,
        description: "Manage user reports"
    },
    {
        title: "Utilities",
        url: createPageUrl("AdminUtils"),
        icon: Wrench,
        description: "Perform admin tasks"
    }
  ];

  const currentPageName = getPageNameFromPath(location.pathname);
  const tutorialSteps = currentPageName ? getStepsForPage(currentPageName) : [];

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gray-50 dark:bg-gray-900">
        <style>
          {`
            /* Enhanced Mobile-First Responsive Design */
            :root {
              --primary-color: var(--primary-color, #3b82f6);
              --secondary-color: var(--secondary-color, #60a5fa);
              --accent-color: var(--accent-color, #93c5fd);
              --light-color: var(--light-color, #f8fafc);
            }
            
            /* Base responsive breakpoints */
            .creator-card {
              background: white;
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
              transition: all 0.2s ease;
              color: #1e293b;
              margin: 0;
              width: 100%;
            }
            
            .dark .creator-card {
              background: #1e293b;
              border-color: #334155;
              color: #f1f5f9;
            }
            
            .creator-card:hover {
              box-shadow: 0 4px 12px 0 rgba(0, 0, 0, 0.1);
              border-color: #cbd5e1;
            }
            
            .dark .creator-card:hover {
              border-color: #475569;
              box-shadow: 0 4px 12px 0 rgba(0, 0, 0, 0.25);
            }

            /* Mobile-optimized buttons */
            .creator-btn {
              background: var(--primary-color, #3b82f6);
              color: white;
              border: none;
              border-radius: 8px;
              padding: 8px 16px;
              font-weight: 600;
              font-size: 14px;
              transition: all 0.2s ease;
              display: inline-flex;
              align-items: center;
              gap: 6px;
              min-height: 36px;
              white-space: nowrap;
            }
            
            @media (min-width: 640px) {
              .creator-btn {
                padding: 10px 20px;
                border-radius: 12px;
                min-height: 40px;
              }
            }
            
            .creator-btn:hover {
              background: var(--secondary-color, #1d4ed8);
              transform: translateY(-1px);
            }

            .creator-btn:active {
              transform: translateY(0);
            }

            .creator-btn-secondary {
              background: white;
              color: var(--primary-color, #3b82f6);
              border: 2px solid #e2e8f0;
              border-radius: 8px;
              padding: 6px 14px;
              font-weight: 600;
              font-size: 14px;
              transition: all 0.2s ease;
              display: inline-flex;
              align-items: center;
              gap: 6px;
              min-height: 36px;
            }
            
            @media (min-width: 640px) {
              .creator-btn-secondary {
                padding: 8px 18px;
                border-radius: 12px;
                min-height: 40px;
              }
            }
            
            .dark .creator-btn-secondary {
              background: #334155;
              color: #f1f5f9;
              border-color: #475569;
            }
            
            .creator-btn-secondary:hover {
              background: #f8fafc;
              border-color: var(--primary-color, #3b82f6);
            }
            
            .dark .creator-btn-secondary:hover {
              background: #475569;
              border-color: var(--secondary-color, #60a5fa);
            }

            /* Mobile-first text system */
            .text-primary { color: #1e293b !important; }
            .dark .text-primary { color: #f1f5f9 !important; }
            .text-secondary { color: #64748b !important; }
            .dark .text-secondary { color: #cbd5e1 !important; }
            .text-muted { color: #94a3b8 !important; }
            .dark .text-muted { color: #64748b !important; }

            /* Enhanced dark mode support */
            .dark h1, .dark h2, .dark h3, .dark h4, .dark h5, .dark h6 {
              color: #f1f5f9 !important;
            }
            .dark p, .dark span, .dark div {
              color: #cbd5e1;
            }
            .dark .text-gray-900 { color: #f1f5f9 !important; }
            .dark .text-gray-800 { color: #e2e8f0 !important; }
            .dark .text-gray-700 { color: #cbd5e1 !important; }
            .dark .text-gray-600 { color: #94a3b8 !important; }
            .dark .text-gray-500 { color: #64748b !important; }
            .dark .text-gray-400 { color: #64748b !important; }

            /* Mobile form elements */
            .dark input, .dark textarea, .dark select {
              background: #334155 !important;
              color: #f1f5f9 !important;
              border-color: #475569 !important;
            }
            .dark input::placeholder, .dark textarea::placeholder {
              color: #94a3b8 !important;
            }
            .dark input:focus, .dark textarea:focus, .dark select:focus {
              border-color: var(--primary-color, #3b82f6) !important;
              box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1) !important;
            }

            /* Enhanced scrollbars for mobile */
            ::-webkit-scrollbar {
              width: 6px;
              height: 6px;
            }
            @media (min-width: 768px) {
              ::-webkit-scrollbar {
                width: 8px;
                height: 8px;
              }
            }
            ::-webkit-scrollbar-track {
              background: #f1f5f9;
            }
            .dark ::-webkit-scrollbar-track {
              background: #1e293b;
            }
            ::-webkit-scrollbar-thumb {
              background: #cbd5e1;
              border-radius: 4px;
            }
            .dark ::-webkit-scrollbar-thumb {
              background: #475569;
            }

            /* Mobile-optimized focus styles */
            *:focus {
              outline: 2px solid var(--primary-color, #3b82f6);
              outline-offset: 2px;
            }

            /* Safe area support for mobile */
            .safe-area-bottom {
              padding-bottom: env(safe-area-inset-bottom);
            }

            /* Enhanced mobile navigation */
            .mobile-nav {
              background: rgba(255, 255, 255, 0.98);
              backdrop-filter: blur(20px);
              border-top: 1px solid #e2e8f0;
              box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
            }
            
            .dark .mobile-nav {
              background: rgba(30, 41, 59, 0.98);
              border-top-color: #334155;
              box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.3);
            }

            /* Responsive sidebar */
            .sidebar {
              background: white;
              border-right: 1px solid #e2e8f0;
            }
            
            .dark .sidebar {
              background: #1e293b;
              border-right-color: #334155;
            }

            /* Mobile header optimization */
            .mobile-header {
              height: 60px;
              display: flex;
              align-items: center;
              padding: 0 16px;
              background: rgba(255, 255, 255, 0.98);
              backdrop-filter: blur(20px);
              border-bottom: 1px solid #e2e8f0;
              position: sticky;
              top: 0;
              z-index: 50;
            }
            
            .dark .mobile-header {
              background: rgba(30, 41, 59, 0.98);
              border-bottom-color: #334155;
            }

            /* Responsive content container */
            .content-container {
              flex: 1;
              min-width: 0;
              display: flex;
              flex-direction: column;
            }
            
            .content-main {
              flex: 1;
              overflow-y: auto;
              background: #f8fafc;
              padding-bottom: 80px;
              min-height: 0;
            }
            
            .dark .content-main {
              background: #0f172a;
            }
            
            @media (min-width: 768px) {
              .content-main {
                padding-bottom: 0;
              }
            }

            /* Enhanced button touch targets for mobile */
            @media (max-width: 768px) {
              button, .btn, [role="button"] {
                min-height: 44px;
                min-width: 44px;
              }
              
              /* Increase touch targets for small buttons */
              .touch-target {
                padding: 12px;
              }
            }

            /* Mobile typography optimization */
            @media (max-width: 640px) {
              h1 { font-size: 1.5rem; line-height: 1.4; }
              h2 { font-size: 1.25rem; line-height: 1.4; }
              h3 { font-size: 1.125rem; line-height: 1.4; }
              
              .text-xs { font-size: 0.75rem; }
              .text-sm { font-size: 0.875rem; }
              .text-base { font-size: 1rem; }
              .text-lg { font-size: 1.125rem; }
              
              /* Better line height for mobile reading */
              p, .prose {
                line-height: 1.6;
              }
            }

            /* Improved loading states */
            .animate-pulse {
              background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
              background-size: 200% 100%;
              animation: pulse 1.5s ease-in-out infinite;
            }
            
            .dark .animate-pulse {
              background: linear-gradient(90deg, #334155 25%, #475569 50%, #334155 75%);
              background-size: 200% 100%;
            }

            @keyframes pulse {
              0% { background-position: 200% 0; }
              100% { background-position: -200% 0; }
            }

            /* Mobile-specific utilities */
            .mobile-only {
              display: block;
            }
            .desktop-only {
              display: none;
            }
            
            @media (min-width: 768px) {
              .mobile-only {
                display: none;
              }
              .desktop-only {
                display: block;
              }
            }
          `}
        </style>

        {/* Desktop Sidebar */}
        <Sidebar className="sidebar hidden md:flex">
          <SidebarHeader className="border-b border-gray-100 dark:border-gray-700 p-4 lg:p-6">
            <div className="text-center">
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gray-900 dark:bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-2 lg:mb-3">
                <Target className="w-5 h-5 lg:w-6 lg:h-6 text-white dark:text-gray-900" />
              </div>
              <h2 className="font-bold text-lg lg:text-xl text-gray-900 dark:text-gray-100">Ethos</h2>
              <p className="text-xs lg:text-sm text-gray-500 dark:text-gray-400">Creator Platform</p>
            </div>
          </SidebarHeader>

          <SidebarContent className="p-2 lg:p-4">
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1 lg:space-y-2">
                  {navigationItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        className={`rounded-lg p-2 lg:p-3 transition-all duration-200 ${
                          location.pathname === item.url
                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-medium'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
                        }`}
                      >
                        <Link to={item.url}>
                          <item.icon className="w-4 h-4 lg:w-5 lg:h-5" />
                          <div className="flex flex-col items-start">
                            <span className="font-medium text-sm lg:text-base">{item.title}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 hidden lg:block">{item.description}</span>
                          </div>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            
            {currentUser && currentUser.role === 'admin' && (
                <SidebarGroup>
                    <SidebarGroupLabel className="text-gray-500 dark:text-gray-400 text-xs lg:text-sm">Admin</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu className="space-y-1 lg:space-y-2">
                            {adminNavigationItems.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton
                                    asChild
                                    className={`rounded-lg p-2 lg:p-3 transition-all duration-200 ${
                                    location.pathname === item.url
                                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-medium'
                                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
                                    }`}
                                >
                                    <Link to={item.url}>
                                    <item.icon className="w-4 h-4 lg:w-5 lg:h-5" />
                                    <div className="flex flex-col items-start">
                                        <span className="font-medium text-sm lg:text-base">{item.title}</span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400 hidden lg:block">{item.description}</span>
                                    </div>
                                    </Link>
                                </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            )}
          </SidebarContent>

          <SidebarFooter className="border-t border-gray-100 dark:border-gray-700 p-2 lg:p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex items-center gap-2 lg:gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded-lg">
                  <div className="w-8 h-8 lg:w-10 lg:h-10 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                    {currentUser?.github_avatar_url ? (
                        <img src={currentUser.github_avatar_url} alt="User Avatar" className="w-full h-full rounded-full object-cover" />
                    ) : (
                        <UserIcon className="w-4 h-4 lg:w-5 lg:h-5 text-gray-600 dark:text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 hidden lg:block">
                    <p className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">
                      {currentUser?.full_name || "Guest"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{currentUser?.email}</p>
                  </div>
                  <Settings className="w-3 h-3 lg:w-4 lg:h-4 text-gray-400 dark:text-gray-500" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 mb-2 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700" align="end">
                <DropdownMenuLabel className="text-gray-900 dark:text-gray-100">My Account</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-gray-200 dark:bg-gray-700" />
                <Link to={createPageUrl("Workspace")}>
                  <DropdownMenuItem className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                    <UserIcon className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                </Link>
                <Link to={createPageUrl("Settings")}>
                  <DropdownMenuItem className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                </Link>
                {!currentUser?.github_username && (
                   <DropdownMenuItem onClick={() => setShowGitHubModal(true)} className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                    <Github className="mr-2 h-4 w-4" />
                    <span>Connect GitHub</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator className="bg-gray-200 dark:bg-gray-700" />
                 <DropdownMenuItem onClick={() => setShowBugReportModal(true)} className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                  <Bug className="mr-2 h-4 w-4" />
                  <span>Report an Issue</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={User.logout} className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        {/* Mobile Navigation */}
        <div className="mobile-nav md:hidden fixed bottom-0 left-0 right-0 z-50 safe-area-bottom">
          <div className="flex items-center justify-around py-2 px-1">
            {navigationItems.slice(0, 4).map((item) => (
              <Link
                key={item.title}
                to={item.url}
                className={`flex flex-col items-center p-2 rounded-lg transition-colors min-w-0 flex-1 touch-target ${
                  location.pathname === item.url
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                <item.icon className="w-5 h-5 mb-1" />
                <span className="text-xs font-medium truncate">{item.title}</span>
              </Link>
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex flex-col items-center p-2 rounded-lg text-gray-600 dark:text-gray-300 min-w-0 flex-1 touch-target">
                  {currentUser?.github_avatar_url ? (
                    <img src={currentUser.github_avatar_url} alt="Avatar" className="w-5 h-5 rounded-full mb-1" />
                  ) : (
                    <UserIcon className="w-5 h-5 mb-1" />
                  )}
                  <span className="text-xs font-medium truncate">More</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="mb-4 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700" align="end">
                <Link to={createPageUrl("QuestLogs")}>
                  <DropdownMenuItem className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                    <Clock className="mr-2 h-4 w-4" />
                    <span>Activity</span>
                  </DropdownMenuItem>
                </Link>
                {currentUser && currentUser.role === 'admin' && (
                  <>
                  <Link to={createPageUrl("BugTracker")}>
                    <DropdownMenuItem className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                      <Bug className="mr-2 h-4 w-4" />
                      <span>Bug Tracker</span>
                    </DropdownMenuItem>
                  </Link>
                  <Link to={createPageUrl("AdminUtils")}>
                    <DropdownMenuItem className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                      <Wrench className="mr-2 h-4 w-4" />
                      <span>Utilities</span>
                    </DropdownMenuItem>
                  </Link>
                  </>
                )}
                <DropdownMenuSeparator className="bg-gray-200 dark:bg-gray-700" />
                <Link to={createPageUrl("Workspace")}>
                  <DropdownMenuItem className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                    <UserIcon className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                </Link>
                <Link to={createPageUrl("Settings")}>
                  <DropdownMenuItem className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator className="bg-gray-200 dark:bg-gray-700" />
                <DropdownMenuItem onClick={() => setShowBugReportModal(true)} className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                  <Bug className="mr-2 h-4 w-4" />
                  <span>Report an Issue</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={User.logout} className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <main className="content-container">
          {/* Mobile Header */}
          <header className="mobile-header md:hidden">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-7 h-7 bg-gray-900 dark:bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Target className="w-4 h-4 text-white dark:text-gray-900" />
                </div>
                <h1 className="text-base font-bold text-gray-900 dark:text-gray-100 truncate">Ethos</h1>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {currentUser?.github_avatar_url ? (
                  <img src={currentUser.github_avatar_url} alt="Avatar" className="w-7 h-7 rounded-full" />
                ) : (
                  <div className="w-7 h-7 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center">
                    <UserIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                  </div>
                )}
              </div>
            </div>
          </header>

          <div className="content-main">
            {children}
          </div>
        </main>
      </div>
      
      {/* Modals */}
      {showGitHubModal && (
        <GitHubConnectModal
          onClose={() => setShowGitHubModal(false)}
          onSuccess={onGitHubConnect}
        />
      )}
      <BugReportFormModal 
        isOpen={showBugReportModal}
        onClose={() => setShowBugReportModal(false)}
      />
      {showTermsModal && (
        <TermsOfServiceModal
          isOpen={showTermsModal}
          onAccept={handleTermsAccept}
          onDecline={handleTermsDecline}
        />
      )}
      {showTutorial && tutorialSteps.length > 0 && (
        <TutorialOverlay
          isOpen={showTutorial}
          onClose={() => setShowTutorial(false)}
          onComplete={handleTutorialComplete}
          steps={tutorialSteps}
          currentStep={tutorialStep}
          onNext={() => setTutorialStep(prev => Math.min(prev + 1, tutorialSteps.length - 1))}
          onPrevious={() => setTutorialStep(prev => Math.max(prev - 1, 0))}
          pageName={currentPageName}
        />
      )}
    </SidebarProvider>
  );
}

