import React, { useState, useEffect } from 'react';
import { BugReport, User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import BugReportCard from '../components/bug_tracker/BugReportCard';
import { Bug, ShieldCheck, Filter } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export default function BugTracker() {
  const [reports, setReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [filters, setFilters] = useState({ status: 'all', type: 'all' });

  useEffect(() => {
    const checkUserAndLoadData = async () => {
      setIsLoading(true);
      try {
        const user = await User.me();
        setCurrentUser(user);
        if (user && user.role === 'admin') {
          setIsAdmin(true);
          const reportData = await BugReport.list('-created_date');
          setReports(reportData);
          setFilteredReports(reportData);
        } else {
          setIsAdmin(false);
        }
      } catch (error) {
        console.error("Error loading user or reports:", error);
        setIsAdmin(false);
      }
      setIsLoading(false);
    };
    checkUserAndLoadData();
  }, []);
  
  useEffect(() => {
    let tempReports = [...reports];
    if (filters.status !== 'all') {
      tempReports = tempReports.filter(r => r.status === filters.status);
    }
    if (filters.type !== 'all') {
      tempReports = tempReports.filter(r => r.report_type === filters.type);
    }
    setFilteredReports(tempReports);
  }, [filters, reports]);

  const handleUpdateReport = async (id, data) => {
    await BugReport.update(id, data);
    const reportData = await BugReport.list('-created_date');
    setReports(reportData);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
          <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6 text-center">
        <ShieldCheck className="mx-auto h-12 w-12 text-red-500" />
        <h1 className="mt-4 text-xl font-bold tracking-tight text-gray-900 dark:text-white">Access Denied</h1>
        <p className="mt-2 text-base text-gray-600 dark:text-gray-400">You must be an administrator to view this page.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="creator-card p-6">
          <div className="flex items-center gap-4">
            <Bug className="w-8 h-8 text-red-500" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bug & Feature Tracker</h1>
              <p className="text-gray-600 dark:text-gray-400">Manage all user-submitted reports and suggestions.</p>
            </div>
          </div>
        </header>

        <div className="creator-card p-4">
          <div className="flex items-center gap-4">
            <Filter className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <Select value={filters.status} onValueChange={value => setFilters(f => ({ ...f, status: value }))}>
              <SelectTrigger className="w-[180px] dark:bg-gray-800 dark:border-gray-600">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                <SelectItem value="all" className="dark:focus:bg-gray-700">All Statuses</SelectItem>
                <SelectItem value="open" className="dark:focus:bg-gray-700">Open</SelectItem>
                <SelectItem value="in_progress" className="dark:focus:bg-gray-700">In Progress</SelectItem>
                <SelectItem value="completed" className="dark:focus:bg-gray-700">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.type} onValueChange={value => setFilters(f => ({ ...f, type: value }))}>
              <SelectTrigger className="w-[180px] dark:bg-gray-800 dark:border-gray-600">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                <SelectItem value="all" className="dark:focus:bg-gray-700">All Types</SelectItem>
                <SelectItem value="bug" className="dark:focus:bg-gray-700">Bugs</SelectItem>
                <SelectItem value="feature_request" className="dark:focus:bg-gray-700">Feature Requests</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
                {filteredReports.map((report) => (
                    <motion.div
                        key={report.id}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2 }}
                    >
                        <BugReportCard report={report} onUpdate={handleUpdateReport} />
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
        {filteredReports.length === 0 && (
            <div className="text-center py-12 creator-card">
                <p className="text-gray-600 dark:text-gray-400">No reports match the current filters.</p>
            </div>
        )}
      </div>
    </div>
  );
}