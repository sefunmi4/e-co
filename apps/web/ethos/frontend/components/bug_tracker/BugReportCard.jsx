import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import StatusToggle from '@/components/shared/StatusToggle';
import { formatDistanceToNow } from 'date-fns';
import { Bug, Lightbulb, ExternalLink } from 'lucide-react';

export default function BugReportCard({ report, onUpdate }) {
  const handleStatusChange = async (newStatus) => {
    onUpdate(report.id, { status: newStatus });
  };

  const statusConfig = {
    open: { label: "Open", icon: Bug, color: "bg-red-100 text-red-700 border-red-200", next: "in_progress" },
    in_progress: { label: "In Progress", icon: Bug, color: "bg-yellow-100 text-yellow-700 border-yellow-200", next: "completed" },
    completed: { label: "Completed", icon: Bug, color: "bg-green-100 text-green-700 border-green-200", next: "open" },
  };

  const typeConfig = {
    bug: { icon: Bug, color: "text-red-500" },
    feature_request: { icon: Lightbulb, color: "text-blue-500" },
  };
  
  const TypeIcon = typeConfig[report.report_type].icon;

  return (
    <Card className="creator-card w-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                <TypeIcon className={`w-5 h-5 ${typeConfig[report.report_type].color}`} />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-gray-900 dark:text-white mb-1">{report.title}</CardTitle>
              <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <span>Submitted by {report.created_by.split('@')[0]}</span>
                <span>·</span>
                <span>{formatDistanceToNow(new Date(report.created_date), { addSuffix: true })}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusToggle 
                status={report.status} 
                isCreator={true} // Admin can always change status
                onStatusChange={handleStatusChange} 
                config={statusConfig}
            />
            <Badge variant={report.report_type === 'bug' ? 'destructive' : 'default'} className="capitalize">
              {report.report_type.replace('_', ' ')}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap mb-4">{report.description}</p>
        
        {report.page_url && (
          <a href={report.page_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1 mb-4">
            <ExternalLink className="w-3 h-3" />
            <span>{report.page_url}</span>
          </a>
        )}

        {report.screenshot_urls && report.screenshot_urls.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Screenshots:</p>
            <div className="flex flex-wrap gap-2">
              {report.screenshot_urls.map((url, index) => (
                <a key={index} href={url} target="_blank" rel="noopener noreferrer">
                  <img src={url} alt={`screenshot ${index+1}`} className="h-24 w-24 object-cover rounded-md border hover:opacity-80 transition-opacity" />
                </a>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}