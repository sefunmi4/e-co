import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Play, CheckCircle, RefreshCw, XCircle } from 'lucide-react';

const defaultConfig = {
  open: {
    label: "Open",
    icon: RefreshCw,
    color: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600",
    hoverColor: "hover:bg-gray-200 dark:hover:bg-gray-600",
    next: "in_progress"
  },
  in_progress: {
    label: "In Progress",
    icon: Play,
    color: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700",
    hoverColor: "hover:bg-blue-100 dark:hover:bg-blue-900",
    next: "completed"
  },
  completed: {
    label: "Completed",
    icon: CheckCircle,
    color: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700",
    hoverColor: "hover:bg-green-100 dark:hover:bg-green-800",
    next: "in_progress"
  },
  closed: {
      label: "Closed",
      icon: XCircle,
      color: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700",
      hoverColor: "",
      next: "closed"
  }
};

export default function StatusToggle({ status, isCreator, onStatusChange, config: customConfig }) {
  const currentStatus = status || 'open';
  const config = customConfig || defaultConfig;
  const statusInfo = config[currentStatus] || config.open;

  const handleToggle = () => {
    if (!isCreator || statusInfo.next === currentStatus) return;
    const nextStatus = statusInfo.next;
    onStatusChange(nextStatus);
  };

  const Icon = statusInfo.icon;

  return (
    <Badge
      onClick={handleToggle}
      className={`gap-1 border text-xs capitalize transition-all duration-200 ${statusInfo.color} ${isCreator ? `cursor-pointer ${statusInfo.hoverColor}` : 'cursor-default'}`}
    >
      <Icon className="w-3 h-3" />
      {statusInfo.label}
    </Badge>
  );
}